'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { POD } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Plus, CheckCircle, Upload } from 'lucide-react';

function ProofOfDeliveryPageContent() {
  const searchParams = useSearchParams();
  const { db, refreshDb, showToast } = useErp();

  const [selectedPOD, setSelectedPOD] = useState<POD | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [dcNo, setDcNo] = useState('');
  const [deliveredQty, setDeliveredQty] = useState(0);
  const [receivedBy, setReceivedBy] = useState('');
  const [status, setStatus] = useState<'Delivered' | 'Partially Delivered' | 'Rejected'>('Delivered');
  const [remarks, setRemarks] = useState('Goods received in proper packaging and moisture checked.');

  // Handle URL query parameters for direct logging from Challans
  const dcQuery = searchParams.get('dc');
  useEffect(() => {
    if (dcQuery) {
      setDcNo(dcQuery);
      const dc = db.deliveryChallans.find(d => d.dcNo === dcQuery);
      if (dc) {
        setDeliveredQty(dc.quantity);
        setIsCreateOpen(true);
      }
    }
  }, [dcQuery, db.deliveryChallans]);

  const dispatchedChallans = db.deliveryChallans.filter(d => d.status === 'Dispatched');

  const handleCreatePOD = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dcNo || !receivedBy) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    erpService.deliverOrder(
      dcNo,
      deliveredQty,
      receivedBy,
      status,
      remarks
    );

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Proof of Delivery registered for Challan ${dcNo}. Stock records decremented!`, 'success');
  };

  const columns = [
    { header: 'POD Number', accessor: 'podNo' as keyof POD, sortable: true },
    { header: 'Challan Reference', accessor: 'dcNo' as keyof POD },
    { header: 'Invoice Number', accessor: 'invoiceNo' as keyof POD },
    { header: 'Consignee (Customer)', accessor: 'customerName' as keyof POD },
    { header: 'Delivered Qty', accessor: (row: POD) => `${row.deliveredQty} MT` },
    { header: 'Received By', accessor: 'receivedBy' as keyof POD },
    { header: 'Delivery Date', accessor: 'deliveryDate' as keyof POD },
    { 
      header: 'Delivery Status', 
      accessor: (row: POD) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Partially Delivered' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          'bg-red-50 text-red-600 border-red-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Proof of Delivery (POD)</h1>
          <p className="text-xs font-medium text-slate-400">Record customer acknowledgments, log discrepancies, and close shipping cycles.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Post Proof of Delivery</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.pods}
            columns={columns}
            searchPlaceholder="Search POD or Challan..."
            searchField="podNo"
            onRowClick={(row) => setSelectedPOD(row)}
            exportFileName="proof_of_delivery_log"
          />
        </div>

        {/* Selected POD details */}
        <div>
          {selectedPOD ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedPOD.podNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Challan Ref: {selectedPOD.dcNo}</span>
              </div>

              {/* Delivery stats */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-655">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Customer:</span>
                  <span>{selectedPOD.customerName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Quantity Delivered:</span>
                  <span className="text-emerald-600 font-bold">{selectedPOD.deliveredQty} MT</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Received By:</span>
                  <span>{selectedPOD.receivedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Handover Date:</span>
                  <span>{formatDate(selectedPOD.deliveryDate)}</span>
                </div>
              </div>

              {/* Remarks */}
              {selectedPOD.remarks && (
                <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 italic border border-slate-100">
                  Customer Remarks: "{selectedPOD.remarks}"
                </div>
              )}

              {/* Document upload state */}
              <div className="border border-slate-150 rounded-lg p-3 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                <span>📁 Customer Signature.png</span>
                <span className="text-primary-600 font-bold">Uploaded</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select a Proof of Delivery row to view customer signatures, delivery photos, and discrepancies.</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Drawer */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Record Proof of Delivery</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Approve transit completion and decrease active inventory levels.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePOD} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Dispatched Challan *</label>
                <select
                  value={dcNo}
                  onChange={e => {
                    setDcNo(e.target.value);
                    const dc = db.deliveryChallans.find(d => d.dcNo === e.target.value);
                    if (dc) setDeliveredQty(dc.quantity);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  required
                >
                  <option value="">Select Challan</option>
                  {dispatchedChallans.map(d => (
                    <option key={d.dcNo} value={d.dcNo}>{d.dcNo} - {db.customers.find(c => c.id === d.customerId)?.name} ({d.quantity} MT)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Delivered quantity */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivered Net Quantity (MT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={deliveredQty}
                    onChange={e => setDeliveredQty(Number(e.target.value))}
                    required
                  />
                </div>

                {/* Received By */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Received By Name (Store Manager) *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={receivedBy}
                    onChange={e => setReceivedBy(e.target.value)}
                    placeholder="e.g. S.K. Sen (Warehouse In-charge)"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 font-semibold"
                  >
                    <option value="Delivered">Delivered (Intact)</option>
                    <option value="Partially Delivered">Partially Delivered (Discrepancy)</option>
                    <option value="Rejected">Rejected & Cancelled</option>
                  </select>
                </div>

                {/* Signature upload placeholder */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Upload Customer Signature Scan</label>
                  <label className="w-full flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs bg-white font-bold text-slate-500 cursor-pointer transition select-none">
                    <Upload size={14} />
                    <span>Upload PNG / PDF</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Acknowledgement Remarks</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 min-h-[60px]"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Submit POD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function ProofOfDeliveryPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <ProofOfDeliveryPageContent />
    </React.Suspense>
  );
}
