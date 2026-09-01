'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import api from '../../services/axios';
import Link from 'next/link';
import { 
  ShoppingCart, FileText, FileCheck, CheckCircle2, 
  Clock, Plus, Search, ArrowRight, User, Package, Scale,
  Warehouse, ArrowUpRight, DollarSign, RefreshCw, ChevronRight, AlertTriangle
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

export default function ProcurementDashboardPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  
  // Loading states and API data
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [qis, setQis] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [enqRes, quoRes, ordRes, grnRes, qcRes, invRes, retRes] = await Promise.all([
        api.get('/procurement/enquiries').catch(() => ({ data: { data: [] } })),
        api.get('/procurement/quotations').catch(() => ({ data: { data: [] } })),
        api.get('/procurement/orders').catch(() => ({ data: { data: [] } })),
        api.get('/procurement/grns').catch(() => ({ data: { data: [] } })),
        api.get('/procurement/quality-inspections').catch(() => ({ data: { data: [] } })),
        api.get('/procurement/purchase-invoices').catch(() => ({ data: { data: [] } })),
        api.get('/procurement/purchase-returns').catch(() => ({ data: { data: [] } }))
      ]);

      setEnquiries(enqRes.data?.data || []);
      setQuotations(quoRes.data?.data || []);
      setOrders(ordRes.data?.data || []);
      setGrns(grnRes.data?.data || []);
      setQis(qcRes.data?.data || []);
      setInvoices(invRes.data?.data || []);
      setReturns(retRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load procurement dashboard details:', err);
      showToast('Error syncing dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Summary Metrics
  const activeEnquiries = enquiries.filter(e => e.status === 'Active' || e.status === 'Draft').length;
  const pendingQuotations = quotations.filter(q => q.status === 'Received' || q.status === 'Draft').length;
  const activeOrders = orders.filter(o => o.status === 'Draft' || o.status === 'Pending Approval' || o.status === 'Approved').length;
  const pendingQcCount = qis.filter(q => q.status === 'Draft' || q.status === 'Pending').length;
  const unpaidInvoices = invoices.filter(i => i.paymentStatus !== 'Paid').length;
  const draftReturns = returns.filter(r => r.status === 'Draft' || r.status === 'Submitted').length;

  const totalProcuredAmount = useMemo(() => {
    return orders
      .filter(o => o.status === 'Approved' || o.status === 'Completed' || o.status === 'Dispatched')
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  }, [orders]);

  // Combine and sort recent actions/documents across the lifecycle
  const recentTransactions = useMemo(() => {
    const list: any[] = [];
    enquiries.forEach(e => list.push({ type: 'Enquiry', id: e.enquiryNo || e._id, no: e.enquiryNo, date: e.createdAt, status: e.status, amount: null, link: '/procurement/enquiries' }));
    quotations.forEach(q => list.push({ type: 'Quotation', id: q.quotationNo || q._id, no: q.quotationNo, date: q.createdAt, status: q.status, amount: q.grandTotal, link: '/procurement/quotations' }));
    orders.forEach(o => list.push({ type: 'Purchase Order', id: o.poNo || o._id, no: o.poNo, date: o.createdAt, status: o.status, amount: o.grandTotal, link: '/procurement/orders' }));
    grns.forEach(g => list.push({ type: 'GRN (Gate Entry)', id: g.grnNo || g._id, no: g.grnNo, date: g.createdAt, status: g.status || 'Received', amount: null, link: '/procurement/grn' }));
    qis.forEach(q => list.push({ type: 'QC Certificate', id: q.inspectionNo || q._id, no: q.inspectionNo || `QC-${q.grnNo}`, date: q.createdAt, status: q.status, amount: null, link: '/procurement/qc' }));
    invoices.forEach(i => list.push({ type: 'Invoice', id: i.invoiceNo || i._id, no: i.invoiceNo, date: i.createdAt, status: i.paymentStatus || i.status, amount: i.grandTotal, link: '/procurement/invoices' }));
    returns.forEach(r => list.push({ type: 'Return Request', id: r.returnNumber || r._id, no: r.returnNumber, date: r.createdAt, status: r.status, amount: r.grandTotal, link: '/procurement/returns' }));

    return list
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7);
  }, [enquiries, quotations, orders, grns, qis, invoices, returns]);

  // Visual Pipeline Stages data
  const pipelineStages = [
    { name: '1. Enquiry', count: activeEnquiries, subtext: 'Active requests', link: '/procurement/enquiries', desc: 'Identify sourcing needs and contact suppliers.', color: 'border-blue-200 hover:border-blue-400 bg-blue-50 text-blue-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-blue-600 text-white' },
    { name: '2. Quotations', count: pendingQuotations, subtext: 'Pending reviews', link: '/procurement/quotations', desc: 'Collect and compare quotes to pick the best rate.', color: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50 text-indigo-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-indigo-600 text-white' },
    { name: '3. Purchase Orders', count: activeOrders, subtext: 'Open POs', link: '/procurement/orders', desc: 'Release signed purchasing agreements.', color: 'border-violet-200 hover:border-violet-400 bg-violet-50 text-violet-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-violet-600 text-white' },
    { name: '4. Inward (GRN)', count: grns.filter(g => g.inwardStatus !== 'Completed').length, subtext: 'Pending inwarding', link: '/procurement/grn', desc: 'Log cargo entry & vehicle weighing at the gate.', color: 'border-purple-200 hover:border-purple-400 bg-purple-50 text-purple-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-purple-600 text-white' },
    { name: '5. Quality Control', count: pendingQcCount, subtext: 'Awaiting QC', link: '/procurement/qc', desc: 'Run laboratory parameters test checks.', color: 'border-pink-200 hover:border-pink-400 bg-pink-50 text-pink-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-pink-600 text-white' },
    { name: '6. Invoices', count: unpaidInvoices, subtext: 'Unpaid bills', link: '/procurement/invoices', desc: 'Match vendor billing details for clearance.', color: 'border-amber-200 hover:border-amber-400 bg-amber-50 text-amber-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-amber-600 text-white' },
    { name: '7. Returns', count: draftReturns, subtext: 'Active returns', link: '/procurement/returns', desc: 'Send back defective stock & book debit notes.', color: 'border-rose-200 hover:border-rose-400 bg-rose-50 text-rose-900 hover:shadow-md hover:scale-[1.02]', badgeColor: 'bg-rose-600 text-white' },
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Top Banner */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="text-primary-600" size={24} />
            <span>Procurement Lifecycle Hub</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track grains purchase orders, track gate inward GRNs, monitor laboratory QC results, and manage supplier debit notes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg transition animate-none"
            title="Sync live status"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link 
            href="/procurement/orders"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} /> Create Purchase Order
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Sourcing Valuation</span>
            <span className="text-xl font-extrabold text-slate-800 block mt-1">INR {totalProcuredAmount.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">From approved & completed POs</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Awaiting Laboratory QC</span>
            <span className="text-xl font-extrabold text-slate-800 block mt-1">{pendingQcCount} Cargo Lots</span>
            <span className="text-[10px] text-rose-500 font-semibold block mt-0.5">High Priority QC Check</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
            <Scale size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Active PO Agreements</span>
            <span className="text-xl font-extrabold text-slate-800 block mt-1">{activeOrders} Contracts</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">In negotiation or approved</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pending Bills to Match</span>
            <span className="text-xl font-extrabold text-slate-800 block mt-1">{unpaidInvoices} Invoices</span>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Reconciliation needed</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <FileCheck size={20} />
          </div>
        </div>
      </div>

      {/* Unified Workflow Pipeline Tracker */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Interactive Procurement Pipeline</h3>
          <p className="text-xs text-slate-500 mt-0.5">Logical flow from initial enquiry to final invoice settlement or quality return.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {pipelineStages.map((stage, idx) => (
            <Link 
              href={stage.link}
              key={idx}
              className={`border rounded-lg p-3 flex flex-col justify-between transition h-32 cursor-pointer shadow-2xs ${stage.color}`}
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

      {/* Two Column Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Recent Activity Feed */}
        <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Recent Lifecycle Transactions</h3>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Updated Real-Time</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-400 uppercase font-bold border-b border-slate-100 pb-2">
                  <th className="py-2.5">Document Type</th>
                  <th>ID / Reference</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Valuation</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">Loading live entries...</td>
                  </tr>
                ) : recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold">No recent transactions found</td>
                  </tr>
                ) : (
                  recentTransactions.map((tr) => (
                    <tr key={tr.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 font-bold text-slate-700">{tr.type}</td>
                      <td className="font-semibold text-primary-600">{tr.no || 'N/A'}</td>
                      <td className="text-slate-500">{formatDate(tr.date)}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          ['Approved', 'Paid', 'Completed', 'Active'].includes(tr.status) 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                            : ['Rejected', 'Cancelled', 'Failed'].includes(tr.status)
                            ? 'bg-rose-50 text-rose-700 border border-rose-150'
                            : 'bg-amber-50 text-amber-700 border border-amber-150'
                        }`}>
                          {tr.status}
                        </span>
                      </td>
                      <td className="text-right font-bold text-slate-800">
                        {typeof tr.amount === 'number' ? `INR ${tr.amount.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="text-center">
                        <Link 
                          href={tr.link}
                          className="inline-flex items-center gap-0.5 font-bold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
                        >
                          <span>Open</span>
                          <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Shortcuts & Sourcing Summary */}
        <div className="md:col-span-4 space-y-6">
          {/* Quick Sourcing Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Quick Sourcing Tasks</h3>
            <div className="space-y-2">
              <Link 
                href="/procurement/enquiries" 
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/10 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 text-xs block group-hover:text-primary-700">New Purchase Enquiry</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Inquire commodity prices</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-primary-600 transition" />
              </Link>

              <Link 
                href="/procurement/orders" 
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/10 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-violet-50 text-violet-600 flex items-center justify-center">
                    <ShoppingCart size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 text-xs block group-hover:text-primary-700">Release Purchase Order</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Release formal purchase contract</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-primary-600 transition" />
              </Link>

              <Link 
                href="/procurement/grn" 
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/10 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Warehouse size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 text-xs block group-hover:text-primary-700">Log Gate Entry (GRN)</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Book arriving transport vehicle</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-primary-600 transition" />
              </Link>

              <Link 
                href="/procurement/returns" 
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/10 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 text-xs block group-hover:text-primary-700">Initiate Return Request</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Flag sub-standard stock cargo</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-primary-600 transition" />
              </Link>
            </div>
          </div>

          {/* Sourcing Summary Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Grains Inventory Levels</h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Silos</span>
            </div>

            <div className="space-y-3 text-xs">
              {db.commodities.slice(0, 3).map((comm) => {
                const percentage = Math.min(Math.round((comm.stockQty / (comm.minStockLevel * 8 || 100)) * 100), 100);
                return (
                  <div key={comm.id} className="space-y-1">
                    <div className="flex justify-between text-slate-600 font-semibold">
                      <span>{comm.name}</span>
                      <span className="text-slate-800 font-bold">{comm.stockQty || 0} MT / {comm.minStockLevel || 10} MT (Min)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentage < 30 ? 'bg-rose-500' : percentage < 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
