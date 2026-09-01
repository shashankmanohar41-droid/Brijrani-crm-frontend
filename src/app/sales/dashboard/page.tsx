'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  TrendingUp, 
  ShoppingBag, 
  FileText, 
  AlertCircle, 
  ArrowUpRight, 
  Users, 
  Package, 
  DollarSign 
} from 'lucide-react';

export default function SalesDashboardPage() {
  const { db } = useErp();
  const [dateFilter, setDateFilter] = useState('This Month');

  const invoices = db.salesInvoices || [];
  const orders = db.salesOrders || [];
  const quotations = db.salesQuotations || [];
  const customers = db.customers || [];
  const commodities = db.commodities || [];

  // Metrics calculation
  const totalSales = invoices.reduce((sum, item) => sum + item.grandTotal, 0);
  const totalGST = invoices.reduce((sum, item) => sum + (item.cgst + item.sgst + item.igst), 0);
  const totalOutstanding = invoices
    .filter(inv => inv.paymentStatus !== 'Paid')
    .reduce((sum, item) => sum + item.grandTotal, 0);
  
  const completedOrders = orders.filter(o => o.status === 'Completed').length;
  const pendingOrders = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length;

  const pendingQuotes = quotations.filter(q => q.status === 'Sent' || q.status === 'Draft').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Dashboard</h1>
          <p className="text-xs font-medium text-slate-400">Monitor sales orders, pipeline conversions, tax summaries, and customer collections.</p>
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
                  : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
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
            <span className="text-[10px] text-slate-400 font-medium">Pending cash collection</span>
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
            <span className="text-[10px] text-slate-400 font-medium">{completedOrders} fulfilled successfully</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GST Tax Collections</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FileText size={16} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-bold text-slate-800">₹{totalGST.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-medium">SGST + CGST + IGST liability</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Pipeline Funnel Statuses */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sales Pipeline Funnel</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="text-xl font-bold text-slate-800">{db.salesEnquiries?.length || 0}</span>
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-1">Enquiries</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="text-xl font-bold text-slate-800">{quotations.length}</span>
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-1">Quotations</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="text-xl font-bold text-slate-800">{orders.length}</span>
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-1">Orders</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="text-xl font-bold text-slate-800">{invoices.length}</span>
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-1">Invoices</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-850">Recent Transactions Log</h4>
            <div className="divide-y divide-slate-100 font-medium text-xs text-slate-650">
              {invoices.slice(0, 4).map((inv, idx) => (
                <div key={idx} className="flex justify-between py-2.5">
                  <div className="space-y-0.5">
                    <span className="font-mono text-slate-800 font-bold block">{inv.invoiceNo}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{customers.find(c => c.id === inv.customerId)?.name}</span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="font-bold text-slate-800">₹{inv.grandTotal.toLocaleString()}</span>
                    <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full block ${
                      inv.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                    }`}>{inv.paymentStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Summary items */}
        <div className="space-y-6">
          {/* Top Selling Commodities */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Commodities Sales</h3>
            <div className="space-y-3 font-semibold text-xs text-slate-650">
              {commodities.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-50 rounded-lg text-slate-450 border border-slate-100">
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
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-[11px] flex gap-2 font-semibold text-indigo-750">
                <Users size={14} className="shrink-0" />
                <span>{customers.filter(c => c.balance > (c.creditLimit || 0)).length} Customers are currently exceeding credit limits!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
