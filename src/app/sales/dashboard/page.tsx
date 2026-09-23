'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useErp } from '../../../context/ErpContext';
import { 
  TrendingUp, 
  ShoppingBag, 
  FileText, 
  AlertCircle, 
  ArrowUpRight, 
  Users, 
  Package, 
  DollarSign,
  FlaskConical,
  Truck,
  RotateCcw,
  ClipboardList,
  Layers,
  FileCheck,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

export default function SalesDashboardPage() {
  const { db } = useErp();
  const [dateFilter, setDateFilter] = useState('This Month');

  const enquiries = db.salesEnquiries || [];
  const quotations = db.salesQuotations || [];
  const orders = db.salesOrders || [];
  const invoices = db.salesInvoices || [];
  const qcList = (db as any).salesQcList || db.qualityInspections || [];
  const challans = db.deliveryChallans || [];
  const returns = db.salesReturns || [];
  const customers = db.customers || [];
  const commodities = db.commodities || [];

  // Metrics calculation
  const totalSales = invoices.reduce((sum, item) => sum + item.grandTotal, 0);
  const totalGST = invoices.reduce((sum, item) => sum + (item.cgst + item.sgst + item.igst), 0);
  const totalOutstanding = invoices
    .filter(inv => inv.paymentStatus !== 'Paid')
    .reduce((sum, item) => sum + (item.remainingAmount !== undefined ? item.remainingAmount : item.grandTotal), 0);
  
  const completedOrders = orders.filter(o => o.status === 'Completed' || o.status === 'Shipped').length;
  const pendingOrders = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length;
  const pendingQuotes = quotations.filter(q => q.status === 'Sent' || q.status === 'Draft').length;

  const pipelineStages = [
    { name: '1. Enquiry', count: enquiries.length, subtext: 'Active buyer enquiries', link: '/sales/enquiries', desc: 'Identify buyer demand and target price.', color: 'border-blue-200 hover:border-blue-400 bg-blue-50/70 text-blue-900', badgeColor: 'bg-blue-600 text-white' },
    { name: '2. Quotations', count: quotations.length, subtext: 'Offered rate quotes', link: '/sales/quotations', desc: 'Price negotiation & benchmark margins.', color: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/70 text-indigo-900', badgeColor: 'bg-indigo-600 text-white' },
    { name: '3. Sales Orders', count: orders.length, subtext: 'GT & WH bookings', link: '/sales/orders', desc: 'Signed contracts with GT / WH option.', color: 'border-violet-200 hover:border-violet-400 bg-violet-50/70 text-violet-900', badgeColor: 'bg-violet-600 text-white' },
    { name: '4. Sales Invoices', count: invoices.length, subtext: 'Commercial bills', link: '/sales/invoices', desc: 'Tax invoice generated from SO.', color: 'border-amber-200 hover:border-amber-400 bg-amber-50/70 text-amber-900', badgeColor: 'bg-amber-600 text-white' },
    { name: '5. Quality Control', count: qcList.length, subtext: 'Outward QC audits', link: '/sales/qc', desc: 'Moisture, broken & purity certification.', color: 'border-pink-200 hover:border-pink-400 bg-pink-50/70 text-pink-900', badgeColor: 'bg-pink-600 text-white' },
    { name: '6. GRN Outward', count: challans.length, subtext: 'Gate dispatch slips', link: '/sales/delivery-challans', desc: 'Weighbridge check, trucks & challans.', color: 'border-purple-200 hover:border-purple-400 bg-purple-50/70 text-purple-900', badgeColor: 'bg-purple-600 text-white' },
    { name: '7. Returns & Receipts', count: returns.length, subtext: 'Collections & Returns', link: '/sales/returns', desc: 'Customer collection & credit notes.', color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/70 text-emerald-900', badgeColor: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <ClipboardList className="text-primary-600" size={24} />
            <span>Sales & Distribution Lifecycle Hub</span>
          </h1>
          <p className="text-xs font-medium text-slate-400">
            Monitor sales enquiries, quotations, GT/WH sales orders, outward QC laboratory tests, and weighbridge gate dispatches.
          </p>
        </div>
        
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          {['Today', 'This Week', 'This Month', 'This Year'].map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                dateFilter === filter 
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Sales Turnover</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-bold text-slate-800">₹{totalSales.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight size={12} />
              <span>+12.4% vs last period</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Outstanding Receivables</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-bold text-slate-800">₹{totalOutstanding.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-medium">Pending customer collections</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Sales Orders</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-bold text-slate-800">{pendingOrders}</span>
            <span className="text-[10px] text-slate-400 font-medium">{completedOrders} fulfilled & dispatched</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GST Tax Liability</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FileText size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-bold text-slate-800">₹{totalGST.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-medium">SGST + CGST billed on orders</span>
          </div>
        </div>
      </div>

      {/* Interactive Sales Pipeline Funnel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Interactive Sales & Distribution Pipeline</h3>
          <p className="text-xs text-slate-500 mt-0.5">7-Stage systematic workflow from initial enquiry to final customer payment collection.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {pipelineStages.map((stage, idx) => (
            <Link 
              href={stage.link}
              key={idx}
              className={`border rounded-lg p-3 flex flex-col justify-between transition h-32 cursor-pointer shadow-2xs hover:scale-[1.02] hover:shadow-md ${stage.color}`}
            >
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold block opacity-80">{stage.name}</span>
                <span className="text-[10px] mt-1 block leading-tight opacity-75 font-medium">{stage.desc}</span>
              </div>
              <div className="flex justify-between items-end border-t border-slate-200/50 pt-2">
                <span className="text-[10px] font-bold opacity-60">{stage.subtext}</span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-black/5 shadow-2xs ${stage.badgeColor}`}>
                  {stage.count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions Log */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Invoiced Orders</h3>
            <Link href="/sales/invoices" className="text-primary-600 hover:underline font-bold text-xs">View All</Link>
          </div>
          <div className="divide-y divide-slate-100 font-medium text-xs text-slate-600">
            {invoices.slice(0, 5).map((inv, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-800 font-bold">{inv.invoiceNo}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">{inv.orderType || 'WH'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">{customers.find(c => c.id === inv.customerId)?.name}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="font-bold text-slate-800 block">₹{inv.grandTotal.toLocaleString()}</span>
                  <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full inline-block ${
                    inv.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>{inv.paymentStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Summary items */}
        <div className="space-y-6">
          {/* Top Selling Commodities */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Commodities Inventory</h3>
            <div className="space-y-3 font-semibold text-xs text-slate-600">
              {commodities.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 border border-slate-100">
                      <Package size={13} />
                    </div>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-slate-800 font-bold">{item.stockQty} MT in stock</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Alerts */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Sales Alerts</h3>
            <div className="space-y-2.5">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] flex gap-2 font-semibold text-amber-700">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pendingQuotes} Quotations require immediate customer acceptance followup.</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-[11px] flex gap-2 font-semibold text-indigo-800">
                <Users size={14} className="shrink-0" />
                <span>{customers.filter(c => (c.balance || 0) > (c.creditLimit || 500000)).length} Customers are currently exceeding credit limits!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
