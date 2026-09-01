'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ShoppingCart, Landmark, TrendingUp, Warehouse, Truck,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Clock, PlayCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useErp } from '../../context/ErpContext';
import StatCard from '../../components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../../services/axios';

export default function DashboardPage() {
  const { db, notifications, currentUserRole } = useErp();
  const router = useRouter();

  const [backendMetrics, setBackendMetrics] = useState<any>(null);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(res => {
        if (res.data && res.data.success) {
          setBackendMetrics(res.data.data);
        }
      })
      .catch(err => console.error('Failed to fetch dashboard reports:', err));
  }, []);

  // 1. Calculate Dashboard Metrics
  const metrics = useMemo(() => {
    // Warehouse occupancy percentage
    const totalCap = db.warehouses.reduce((sum, w) => sum + w.capacityMT, 0);
    const usedCap = db.warehouses.reduce((sum, w) => sum + w.usedCapacityMT, 0);
    const whUtilization = totalCap > 0 ? Math.round((usedCap / totalCap) * 100) : 0;

    // Only use backend metrics if they contain non-zero transactional data,
    // otherwise fall back to local seed data calculations so the dashboard is populated on startup.
    const hasBackendData = backendMetrics && (backendMetrics.totalPurchase > 0 || backendMetrics.totalSales > 0 || backendMetrics.stockValue > 0);

    if (hasBackendData) {
      return {
        totalPurchase: backendMetrics.totalPurchase,
        totalSales: backendMetrics.totalSales,
        stockValue: backendMetrics.stockValue,
        whUtilization,
        receivables: backendMetrics.receivable,
        payables: backendMetrics.payable,
        dispatchesToday: backendMetrics.pendingDispatch,
        collectionsToday: 0
      };
    }

    // Fallback to local storage calculations
    // Total Purchase
    const totalPurchase = db.purchaseOrders
      .filter(p => p.status !== 'Cancelled')
      .reduce((sum, p) => sum + p.total, 0);

    // Total Sales
    const totalSales = db.salesInvoices
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    // Current Stock Value
    const stockValue = db.stockItems.reduce((sum, item) => sum + (item.quantity * item.purchaseCost), 0);

    // Receivables (Customer outstandings)
    const receivables = db.customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);

    // Payables (Supplier / Farmer outstandings)
    const payables = db.suppliers.reduce((sum, s) => sum + Math.max(0, s.balance), 0) +
      db.farmers.reduce((sum, f) => sum + Math.max(0, f.balance), 0);

    // Today's Dispatches count
    const dispatchesToday = db.deliveryChallans
      .filter(dc => dc.dispatchDate === new Date().toISOString().split('T')[0]).length;

    // Today's collection amount
    const collectionsToday = db.vouchers
      .filter(v => v.voucherType === 'Receipt' && v.date === '2026-08-05') // mock date matching seed
      .reduce((sum, v) => sum + v.amount, 0);

    return {
      totalPurchase,
      totalSales,
      stockValue,
      whUtilization,
      receivables,
      payables,
      dispatchesToday,
      collectionsToday
    };
  }, [db, backendMetrics]);

  // 2. Chart Data: Monthly Purchase vs Sales (Mock history)
  const chartDataPurchaseSales = [
    { name: 'Apr 26', Purchase: 820000, Sales: 650000 },
    { name: 'May 26', Purchase: 1100000, Sales: 980000 },
    { name: 'Jun 26', Purchase: 1450000, Sales: 1650000 },
    { name: 'Jul 26', Purchase: 950000, Sales: 1200000 },
    { name: 'Aug 26', Purchase: metrics.totalPurchase, Sales: metrics.totalSales }
  ];

  // Chart Data: Commodity-wise pricing vs purchase cost
  const pricingChartData = useMemo(() => {
    return db.commodities.map(c => ({
      name: c.name.split(' ')[0], // short name
      Cost: c.purchaseCost,
      Market: c.currentMarketPrice
    }));
  }, [db]);

  // 3. Profit Sourcing Opportunities
  const profitOpportunities = useMemo(() => {
    return db.commodities
      .map(c => {
        const diff = c.currentMarketPrice - c.purchaseCost;
        const potentialProfit = diff * c.stockQty;
        return {
          ...c,
          diff,
          potentialProfit
        };
      })
      .filter(c => c.diff > 0 && c.stockQty > 0)
      .sort((a, b) => b.potentialProfit - a.potentialProfit);
  }, [db]);

  // Filter notifications by role keywords
  const filteredNotifications = useMemo(() => {
    if (currentUserRole === 'Super Admin') return notifications;
    const pmKeywords = ['purchase', 'enquiry', 'quality', 'qc', 'supplier', 'farmer', 'commodity', 'rate'];
    const whKeywords = ['warehouse', 'silo', 'bin', 'stock', 'dispatch', 'vehicle', 'driver', 'challan', 'qc'];
    const acctKeywords = ['invoice', 'payment', 'due', 'balance', 'voucher', 'ledger', 'tax', 'dispute'];

    let keywords: string[] = [];
    if (currentUserRole === 'Purchase Manager') keywords = pmKeywords;
    else if (currentUserRole === 'Warehouse Staff') keywords = whKeywords;
    else if (currentUserRole === 'Accountant') keywords = acctKeywords;

    return notifications.filter(n =>
      keywords.some(kw => n.message.toLowerCase().includes(kw))
    );
  }, [notifications, currentUserRole]);

  // Recent combined transactions feed filtered by role
  const recentTransactions = useMemo(() => {
    const list: { id: string; type: string; details: string; date: string; amount?: number; badgeColor: string }[] = [];

    // Purchase Orders (Admin, PM, Accountant)
    if (['Super Admin', 'Purchase Manager', 'Accountant'].includes(currentUserRole)) {
      db.purchaseOrders.slice(0, 3).forEach(po => {
        const partyName = db.suppliers.find(s => s.id === po.partyId)?.name || db.farmers.find(f => f.id === po.partyId)?.name || '';
        list.push({
          id: po.id,
          type: 'Purchase Order',
          details: `${po.poNo} - ${partyName}`,
          date: po.date,
          amount: po.total,
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        });
      });
    }

    // Sales Orders (Admin, Accountant)
    if (['Super Admin', 'Accountant'].includes(currentUserRole)) {
      db.salesOrders.slice(0, 3).forEach(so => {
        const cust = db.customers.find(c => c.id === so.customerId)?.name || '';
        list.push({
          id: so.id,
          type: 'Sales Order',
          details: `${so.soNo} - ${cust}`,
          date: so.date,
          amount: so.total,
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        });
      });
    }

    // Vouchers (Admin, Accountant)
    if (['Super Admin', 'Accountant'].includes(currentUserRole)) {
      db.vouchers.slice(0, 3).forEach(v => {
        const party = db.customers.find(c => c.id === v.partyId)?.name || db.suppliers.find(s => s.id === v.partyId)?.name || '';
        list.push({
          id: v.id,
          type: `${v.voucherType} Voucher`,
          details: `${v.voucherNo} - ${party}`,
          date: v.date,
          amount: v.amount,
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
        });
      });
    }

    // Delivery Challans (Warehouse Staff)
    if (currentUserRole === 'Warehouse Staff') {
      db.deliveryChallans.slice(0, 5).forEach(dc => {
        const order = db.salesOrders.find(so => so.id === dc.soId);
        const party = order ? (db.customers.find(c => c.id === order.customerId)?.name || '') : '';
        list.push({
          id: dc.id,
          type: 'Dispatch Challan',
          details: `${dc.dcNo} - ${party}`,
          date: dc.dispatchDate,
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
        });
      });
    }

    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [db, currentUserRole]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">ERP Business Dashboard</h1>
          <p className="text-xs font-medium text-slate-400">Trading summary, warehouse levels, and profit arbitrage trackers.</p>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          📍 Operations: Patna & Bihta Hubs
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['Super Admin', 'Purchase Manager', 'Accountant'].includes(currentUserRole) && (
          <StatCard
            title="Total Purchases"
            value={`₹${metrics.totalPurchase.toLocaleString()}`}
            icon={ShoppingCart}
            trend={{ value: 8.4, label: 'vs last month', type: 'positive' }}
            color="primary"
          />
        )}
        {['Super Admin', 'Accountant'].includes(currentUserRole) && (
          <StatCard
            title="Total Sales"
            value={`₹${metrics.totalSales.toLocaleString()}`}
            icon={TrendingUp}
            trend={{ value: 12.1, label: 'vs last month', type: 'positive' }}
            color="success"
          />
        )}
        {['Super Admin', 'Purchase Manager', 'Warehouse Staff'].includes(currentUserRole) && (
          <StatCard
            title="Current Stock Value"
            value={`₹${metrics.stockValue.toLocaleString()}`}
            icon={Warehouse}
            subtext={`${db.stockItems.reduce((sum, i) => sum + i.quantity, 0)} MT Commodities`}
            color="info"
          />
        )}
        {['Super Admin', 'Purchase Manager', 'Warehouse Staff'].includes(currentUserRole) && (
          <StatCard
            title="WH Capacity Used"
            value={`${metrics.whUtilization}%`}
            icon={Warehouse}
            subtext="Occupied / Total Capacity"
            color="warning"
          />
        )}
        {['Super Admin', 'Accountant'].includes(currentUserRole) && (
          <StatCard
            title="Receivables (Due)"
            value={`₹${metrics.receivables.toLocaleString()}`}
            icon={Landmark}
            subtext="Outstanding from Customers"
            color="danger"
          />
        )}
        {['Super Admin', 'Purchase Manager', 'Accountant'].includes(currentUserRole) && (
          <StatCard
            title="Payables (Due)"
            value={`₹${metrics.payables.toLocaleString()}`}
            icon={Landmark}
            subtext="Due to Farmers & Suppliers"
            color="warning"
          />
        )}
        {['Super Admin', 'Warehouse Staff'].includes(currentUserRole) && (
          <StatCard
            title="Today's Dispatches"
            value={`${metrics.dispatchesToday}`}
            icon={Truck}
            subtext="Vehicles dispatched today"
            color="info"
          />
        )}
        {['Super Admin', 'Accountant'].includes(currentUserRole) && (
          <StatCard
            title="Today's Collection"
            value={`₹${metrics.collectionsToday.toLocaleString()}`}
            icon={Landmark}
            subtext="Receipt vouchers cleared today"
            color="success"
          />
        )}
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Purchase vs Sales */}
        {['Super Admin', 'Purchase Manager', 'Accountant'].includes(currentUserRole) && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {currentUserRole === 'Purchase Manager' ? 'Purchases Trend' : 'Purchases vs Sales Trend'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Comparative performance analysis across fiscal months</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataPurchaseSales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend iconSize={12} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  <Bar dataKey="Purchase" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  {currentUserRole !== 'Purchase Manager' && <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart 2: Cost Price vs Market Price */}
        {['Super Admin', 'Purchase Manager', 'Warehouse Staff'].includes(currentUserRole) && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Commodity Market vs Stock Cost</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Monitor current wholesale market rates against average purchase cost</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pricingChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend iconSize={12} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  <Line type="monotone" dataKey="Cost" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Market" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Sourcing Profit Opportunities */}
      {['Super Admin', 'Purchase Manager'].includes(currentUserRole) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Commodity Selling Profit Opportunities</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Commodities where market rates are currently higher than average purchase costs.</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
              💹 Arbitrage Active
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="p-3">Commodity</th>
                  <th className="p-3 text-right">Avg Cost</th>
                  <th className="p-3 text-right">Current Market</th>
                  <th className="p-3 text-right">Arbitrage Gap</th>
                  <th className="p-3 text-right">Stock Level</th>
                  <th className="p-3 text-right">Est. Unreleased Profit</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                {profitOpportunities.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="p-3 text-right text-slate-500">₹{(c.purchaseCost / 10).toLocaleString()}/qtl</td>
                    <td className="p-3 text-right text-blue-600 font-semibold">₹{(c.currentMarketPrice / 10).toLocaleString()}/qtl</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">
                      <span className="inline-flex items-center gap-0.5">
                        <ArrowUpRight size={14} /> ₹{(c.diff / 10).toLocaleString()}/qtl
                      </span>
                    </td>
                    <td className="p-3 text-right">{c.stockQty} {c.unit}</td>
                    <td className="p-3 text-right text-slate-800 font-bold">₹{c.potentialProfit.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => router.push(`/sales/quotations?action=new&commodity=${c.id}&qty=${c.stockQty}&rate=${c.currentMarketPrice}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer shadow-sm transition"
                      >
                        <PlayCircle size={12} />
                        <span>Sell Stock</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts and Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Alerts list (2 cols on large) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-800">Operations & Logistics Alerts</h3>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {filteredNotifications.length} Pending
            </span>
          </div>

          <div className="space-y-3">
            {filteredNotifications.slice(0, 4).map(notif => (
              <div
                key={notif.id}
                className={`p-3 rounded-lg border flex items-start gap-3 transition ${notif.type === 'danger' ? 'bg-red-50/50 border-red-100 text-red-700' :
                    notif.type === 'warning' ? 'bg-amber-50/50 border-amber-100 text-amber-700' :
                      notif.type === 'success' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700' :
                        'bg-blue-50/50 border-blue-100 text-blue-700'
                  }`}
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-[11px] font-semibold leading-normal">{notif.message}</p>
                  <span className="text-[9px] opacity-70 block font-medium">Logged: {notif.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-800">Recent Transactions</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Latest documents and events</p>
          </div>

          <div className="space-y-4">
            {recentTransactions.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <span className={`inline-block px-1.5 py-0.2 text-[9px] font-bold rounded-md border ${t.badgeColor}`}>
                    {t.type}
                  </span>
                  <p className="font-bold text-slate-700 truncate max-w-[180px]">{t.details}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 block">
                    {t.amount ? `₹${t.amount.toLocaleString()}` : 'Recorded'}
                  </span>
                  <span className="text-[9px] text-slate-400 block font-medium">{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
