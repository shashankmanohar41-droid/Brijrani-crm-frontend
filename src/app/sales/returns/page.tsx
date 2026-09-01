'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService, saveDb } from '../../../services/erpService';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Plus, ShieldCheck, FileCheck, HelpCircle } from 'lucide-react';

function ReturnsPageContent() {
  const { db, refreshDb, showToast } = useErp();
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states (Return Request)
  const [customerId, setCustomerId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [batchNo, setBatchNo] = useState('');
  const [reason, setReason] = useState('');

  // Form states (Inspection)
  const [condition, setCondition] = useState('Resale Condition');
  const [result, setResult] = useState<'Accepted' | 'Rejected' | 'Repair' | 'Replacement' | 'Scrap'>('Accepted');

  const customers = db.customers;
  const commodities = db.commodities;

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId || !quantity || !rate || !reason) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const dbStore = db;
    const returnNo = `SRN-2026-${String((dbStore.salesReturns || []).length + 1).padStart(5, '0')}`;
    const newReturn = {
      id: `SRN-${Date.now()}`,
      returnNo,
      customerId,
      invoiceNo,
      date: new Date().toISOString().split('T')[0],
      reason,
      items: [{ commodityId, quantity, rate, batchNo: batchNo || 'BAT-RETURN' }],
      status: 'Requested'
    };

    dbStore.salesReturns = dbStore.salesReturns || [];
    dbStore.salesReturns.push(newReturn);
    saveDb(dbStore);

    refreshDb();
    setIsCreateOpen(false);
    setSelectedReturn(newReturn);
    showToast(`Return Request ${returnNo} logged successfully. Pending inspection.`, 'success');
  };

  const handleCompleteInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;

    const dbStore = db;
    const returnItem = selectedReturn.items[0];

    // Create inspection record
    const inspectionNo = `INS-2026-${String((dbStore.returnInspections || []).length + 1).padStart(5, '0')}`;
    const newInspection = {
      id: `INS-${Date.now()}`,
      inspectionNo,
      returnId: selectedReturn.id,
      date: new Date().toISOString().split('T')[0],
      inspector: 'Quality Inspector',
      items: [{
        commodityId: returnItem.commodityId,
        quantity: returnItem.quantity,
        condition,
        result
      }],
      status: 'Completed'
    };

    dbStore.returnInspections = dbStore.returnInspections || [];
    dbStore.returnInspections.push(newInspection);

    // If accepted, add stock back to stock items
    if (result === 'Accepted') {
      const dummyBin = dbStore.bins[0];
      dbStore.stockItems.push({
        id: `STK-${Date.now()}`,
        commodityId: returnItem.commodityId,
        batchNo: returnItem.batchNo || 'BAT-RETURN',
        warehouseId: dummyBin?.warehouseId || 'WH-001',
        binId: dummyBin?.id || 'BIN-001',
        quantity: returnItem.quantity,
        unit: 'MT',
        purchaseCost: returnItem.rate,
        averageCost: returnItem.rate,
        entryDate: new Date().toISOString().split('T')[0]
      });

      // Issue Credit Note & Adjust Outstanding
      const creditNoteNo = `CN-2026-${String((dbStore.creditNotes || []).length + 1).padStart(5, '0')}`;
      const relatedComm = db.commodities.find(c => c.id === returnItem.commodityId || c._id === returnItem.commodityId);
      const gstRate = relatedComm?.defaultGst !== undefined ? relatedComm.defaultGst : 5;
      const taxableAmount = returnItem.quantity * returnItem.rate;
      const tax = taxableAmount * (gstRate / 100);
      const totalAmount = taxableAmount + tax;

      const newCN = {
        id: `CN-${Date.now()}`,
        creditNoteNo,
        returnId: selectedReturn.id,
        customerId: selectedReturn.customerId,
        date: new Date().toISOString().split('T')[0],
        reason: selectedReturn.reason,
        taxableAmount,
        cgst: tax / 2,
        sgst: tax / 2,
        igst: 0,
        totalAmount,
        status: 'Approved'
      };

      dbStore.creditNotes = dbStore.creditNotes || [];
      dbStore.creditNotes.push(newCN);

      // Reduce customer balance
      const customer = dbStore.customers.find(c => c.id === selectedReturn.customerId);
      if (customer) {
        customer.balance = Math.max(0, customer.balance - totalAmount);
      }
    }

    // Update return status
    const targetReturn = dbStore.salesReturns.find((r: any) => r.id === selectedReturn.id);
    if (targetReturn) {
      targetReturn.status = 'Completed';
    }

    saveDb(dbStore);
    refreshDb();
    setIsInspectOpen(false);
    setSelectedReturn(targetReturn);
    showToast(`Inspection completed. Credit Note generated for accepted stock.`, 'success');
  };

  const filteredReturns = statusFilter === 'All'
    ? (db.salesReturns || [])
    : (db.salesReturns || []).filter((r: any) => r.status === statusFilter);

  const columns: any[] = [
    { header: 'Return Number', accessor: 'returnNo', sortable: true },
    { 
      header: 'Customer', 
      accessor: (row: any) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: any) => commodities.find(c => c.id === row.items[0]?.commodityId)?.name || 'Unknown'
    },
    { header: 'Qty (MT)', accessor: (row: any) => row.items[0]?.quantity || 0 },
    { header: 'Reason', accessor: 'reason' },
    { header: 'Date', accessor: (row: any) => formatDate(row.date) },
    { 
      header: 'Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-250' :
          'bg-amber-50 text-amber-600 border-amber-250'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Returns & QC</h1>
          <p className="text-xs font-medium text-slate-400">Log customer return claims, run quality inspection checks, and generate Credit Notes.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Return Request</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Pending', 'Completed'].map(status => {
              const count = status === 'All' 
                ? (db.salesReturns || []).length 
                : (db.salesReturns || []).filter((r: any) => r.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === status 
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40 font-extrabold' 
                      : 'hover:text-slate-700'
                  }`}
                >
                  {status} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          <DataTable
            data={filteredReturns}
            columns={columns}
            searchPlaceholder="Search return request..."
            searchField="returnNo"
            onRowClick={(row) => setSelectedReturn(row)}
            exportFileName="sales_returns_register"
          />
        </div>

        {/* Selected Return Details */}
        <div>
          {selectedReturn ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedReturn.returnNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Date: {formatDate(selectedReturn.date)}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  selectedReturn.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-250' :
                  'bg-amber-50 text-amber-600 border-amber-250'
                }`}>
                  {selectedReturn.status}
                </span>
              </div>

              <div className="space-y-3 text-xs font-semibold text-slate-650">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Customer:</span>
                  <span>{customers.find(c => c.id === selectedReturn.customerId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Commodity:</span>
                  <span>{commodities.find(c => c.id === selectedReturn.items[0]?.commodityId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Returned Quantity:</span>
                  <span>{selectedReturn.items[0]?.quantity} MT</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Ref Invoice No:</span>
                  <span>{selectedReturn.invoiceNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between pb-1.5">
                  <span className="text-slate-400">Reason:</span>
                  <span>{selectedReturn.reason}</span>
                </div>
              </div>

              {selectedReturn.status === 'Requested' && (
                <div className="pt-2">
                  <button
                    onClick={() => setIsInspectOpen(true)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
                  >
                    <ShieldCheck size={14} />
                    <span>Run Quality Inspection</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-xl p-8 text-center text-xs text-slate-450 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <ShieldCheck size={24} className="text-slate-350" />
              <span>Select a Return Request row to grade commodity quality.</span>
            </div>
          )}
        </div>
      </div>

      {/* New Return Request Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">File Return Request</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Register customer return details.</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateReturn} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Customer *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Ref Invoice / Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    placeholder="INV/BR/2026-27/001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Billing Rate (₹/MT) *</label>
                  <input
                    type="number"
                    value={rate}
                    onChange={e => setRate(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={batchNo}
                    onChange={e => setBatchNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    placeholder="BAT-2026-01"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Return Reason *</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  placeholder="e.g. Commodity damaged during transport or high moisture levels."
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold"
                >
                  File Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC Inspection Modal */}
      {isInspectOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Quality Inspection Verification</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Grade incoming return cargo weights and moisture metrics.</p>
              </div>
              <button onClick={() => setIsInspectOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCompleteInspection} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Inspection Condition Description</label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="Resale Condition">Good / Resale Eligible</option>
                  <option value="Minor Damage">Minor Spoilage (Needs Drying)</option>
                  <option value="Major Moisture Spoilage">High Moisture Mold (Scrap)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Inspection Verdict *</label>
                <select
                  value={result}
                  onChange={e => setResult(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white font-medium"
                  required
                >
                  <option value="Accepted">Accept & Credit Note (Re-enter Inventory)</option>
                  <option value="Scrap">Scrap (Discard Commodity)</option>
                  <option value="Rejected">Reject Claim (No Credit Note)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInspectOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                >
                  Approve Verdict
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesReturnsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <ReturnsPageContent />
    </React.Suspense>
  );
}
