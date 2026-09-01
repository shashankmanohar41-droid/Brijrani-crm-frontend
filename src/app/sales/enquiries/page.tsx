'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService, saveDb } from '../../../services/erpService';
import { SalesEnquiry } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Plus, Layers, FileCheck, ArrowRight } from 'lucide-react';

function EnquiriesPageContent() {
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedEnquiry, setSelectedEnquiry] = useState<SalesEnquiry | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [expectedRate, setExpectedRate] = useState(0);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');

  const customers = db.customers;
  const commodities = db.commodities;

  const filteredEnquiries = statusFilter === 'All'
    ? (db.salesEnquiries || [])
    : (db.salesEnquiries || []).filter((e: any) => e.status === statusFilter);

  const handleCreateEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId || !deliveryLocation || !requiredDate) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const dbStore = db;
    const enquiryNo = `SEQ-2026-${String((dbStore.salesEnquiries || []).length + 1).padStart(5, '0')}`;
    const newEnq: SalesEnquiry = {
      id: `SEQ-${Date.now()}`,
      enquiryNo,
      date: new Date().toISOString().split('T')[0],
      customerId,
      commodityId,
      quantity,
      expectedRate,
      requiredDeliveryDate: requiredDate,
      deliveryLocation,
      notes,
      status: 'Sent'
    };

    dbStore.salesEnquiries = dbStore.salesEnquiries || [];
    dbStore.salesEnquiries.push(newEnq);
    saveDb(dbStore);

    refreshDb();
    setIsCreateOpen(false);
    setSelectedEnquiry(newEnq);
    showToast(`Sales Enquiry ${enquiryNo} registered successfully.`, 'success');
  };

  const handleConvertToQuotation = (enq: SalesEnquiry) => {
    // Redirect to quotations form prefilled
    router.push(`/sales/quotations?enquiry=${enq.enquiryNo}&customer=${enq.customerId}&commodity=${enq.commodityId}&qty=${enq.quantity}&rate=${enq.expectedRate}`);
  };

  const columns: any[] = [
    { header: 'Enquiry Number', accessor: 'enquiryNo' as keyof SalesEnquiry, sortable: true },
    { 
      header: 'Customer', 
      accessor: (row: SalesEnquiry) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: SalesEnquiry) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Qty (MT)', accessor: 'quantity' as keyof SalesEnquiry },
    { header: 'Target Rate', accessor: (row: SalesEnquiry) => `₹${row.expectedRate.toLocaleString()}` },
    { header: 'Required Date', accessor: (row: SalesEnquiry) => formatDate(row.requiredDeliveryDate) },
    { 
      header: 'Status', 
      accessor: (row: SalesEnquiry) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Converted' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Enquiries</h1>
          <p className="text-xs font-medium text-slate-400">Log incoming buyer requirements, record commodity bids, and initialize quotes.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Sales Enquiry</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Sent', 'Converted', 'Cancelled'].map(status => {
              const count = status === 'All' 
                ? (db.salesEnquiries || []).length 
                : (db.salesEnquiries || []).filter((e: any) => e.status === status).length;
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
            data={filteredEnquiries}
            columns={columns}
            searchPlaceholder="Search enquiry number..."
            searchField="enquiryNo"
            onRowClick={(row) => setSelectedEnquiry(row)}
            exportFileName="sales_enquiries_register"
          />
        </div>

        {/* Details Card */}
        <div>
          {selectedEnquiry ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedEnquiry.enquiryNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Logged: {formatDate(selectedEnquiry.date)}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  selectedEnquiry.status === 'Converted' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  'bg-amber-50 text-amber-600 border-amber-200'
                }`}>
                  {selectedEnquiry.status}
                </span>
              </div>

              <div className="space-y-3 text-xs font-semibold text-slate-650">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Customer:</span>
                  <span>{customers.find(c => c.id === selectedEnquiry.customerId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Commodity:</span>
                  <span>{commodities.find(c => c.id === selectedEnquiry.commodityId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Quantity (MT):</span>
                  <span>{selectedEnquiry.quantity} MT</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Expected Rate:</span>
                  <span>₹{selectedEnquiry.expectedRate.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Delivery Location:</span>
                  <span>{selectedEnquiry.deliveryLocation}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Required By:</span>
                  <span>{formatDate(selectedEnquiry.requiredDeliveryDate)}</span>
                </div>
                {selectedEnquiry.notes && (
                  <div className="pt-1.5">
                    <span className="text-slate-400 block mb-1">Notes:</span>
                    <p className="text-slate-600 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">{selectedEnquiry.notes}</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                {selectedEnquiry.status !== 'Converted' ? (
                  <button
                    onClick={() => handleConvertToQuotation(selectedEnquiry)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
                  >
                    <span>Generate Quotation</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <div className="bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-lg p-2.5 text-center text-xs font-bold">
                    Enquiry converted into active quotation
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-xl p-8 text-center text-xs text-slate-450 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Layers size={24} className="text-slate-300" />
              <span>Select an Enquiry to view details or convert to Quotation.</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Log Sales Enquiry</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Register buyer requirements and target price bidding.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateEnquiry} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Customer *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white text-slate-700 font-medium"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-255 rounded-lg text-xs bg-white text-slate-700 font-medium"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Expected Rate (₹) *</label>
                  <input
                    type="number"
                    value={expectedRate}
                    onChange={e => setExpectedRate(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Delivery Location *</label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={e => setDeliveryLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                  placeholder="e.g. Fatuha Factory Gate 1, Patna"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Required Delivery Date *</label>
                <input
                  type="date"
                  value={requiredDate}
                  onChange={e => setRequiredDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Remarks / Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Save Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesEnquiriesPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <EnquiriesPageContent />
    </React.Suspense>
  );
}
