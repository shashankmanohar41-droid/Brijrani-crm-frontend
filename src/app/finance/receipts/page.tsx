'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { Voucher } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Landmark, Plus, ArrowDownLeft, FileCheck } from 'lucide-react';

function ReceiptsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI'>('Bank Transfer');
  const [cashBankLink, setCashBankLink] = useState('HDFC Bank Main A/c');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  // Handle URL query parameters from Invoice screen
  const invQuery = searchParams.get('invoice');
  const amtQuery = searchParams.get('amount');
  const custQuery = searchParams.get('customer');

  useEffect(() => {
    if (invQuery) {
      if (custQuery) setPartyId(custQuery);
      if (amtQuery) setAmount(Number(amtQuery));
      setReferenceNo(invQuery);
      setNarration(`Received payment against invoice ${invQuery}.`);
      setIsCreateOpen(true);
    }
  }, [invQuery, amtQuery, custQuery]);

  const customers = db.customers;

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      showToast('Please select a customer', 'error');
      return;
    }

    const vch = erpService.postVoucher({
      voucherType: 'Receipt',
      date: new Date().toISOString().split('T')[0],
      referenceNo,
      partyId,
      partyType: 'customer',
      amount: Number(amount),
      paymentMode,
      cashBankLink,
      debitAccount: cashBankLink,
      creditAccount: `${customers.find(c => c.id === partyId)?.name} Accounts Receivable`,
      narration
    }, currentUserRole);

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Receipt voucher ${vch.voucherNo} posted. Customer ledger updated.`, 'success');
    setSelectedVoucher(vch);
  };

  const columns = [
    { header: 'Voucher Number', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Date', accessor: 'date' as keyof Voucher },
    { 
      header: 'Customer', 
      accessor: (row: Voucher) => customers.find(c => c.id === row.partyId)?.name || 'Unknown'
    },
    { 
      header: 'Collection Value', 
      accessor: (row: Voucher) => `₹${row.amount.toLocaleString()}`
    },
    { header: 'Payment Mode', accessor: 'paymentMode' as keyof Voucher },
    { header: 'Ledger Reference', accessor: 'referenceNo' as keyof Voucher },
    { 
      header: 'Status', 
      accessor: (row: Voucher) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
          {row.status}
        </span>
      )
    }
  ];

  const receiptsList = db.vouchers.filter(v => v.voucherType === 'Receipt');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Receipt Vouchers (Collection)</h1>
          <p className="text-xs font-medium text-slate-400">Record customer collections, clear outstanding bills, and reconcile bank deposits.</p>
        </div>
        <button
          onClick={() => {
            setPartyId('');
            setAmount(50000);
            setReferenceNo('');
            setNarration('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Post Receipt Voucher</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={receiptsList}
            columns={columns}
            searchPlaceholder="Search voucher or reference..."
            searchField="voucherNo"
            onRowClick={(row) => setSelectedVoucher(row)}
            exportFileName="receipt_vouchers_register"
          />
        </div>

        {/* Selected Voucher info */}
        <div>
          {selectedVoucher ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedVoucher.voucherNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Post Date: {formatDate(selectedVoucher.date)}</span>
              </div>

              {/* Accounts mapping */}
              <div className="space-y-3.5 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Double Entry Ledger Breakdown</span>
                
                <div className="text-xs space-y-1.5 font-semibold text-slate-650">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Debit (Assets +):</span>
                    <span>{selectedVoucher.debitAccount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credit (Receivables -):</span>
                    <span>{selectedVoucher.creditAccount}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/50 pt-2 font-bold text-slate-800">
                    <span>Net Amount:</span>
                    <span>₹{selectedVoucher.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Customer:</span>
                  <span>{customers.find(c => c.id === selectedVoucher.partyId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span>{selectedVoucher.paymentMode}</span>
                </div>
                {selectedVoucher.referenceNo && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Bill Invoice Ref:</span>
                    <span className="font-mono">{selectedVoucher.referenceNo}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Posted By:</span>
                  <span>{selectedVoucher.createdBy}</span>
                </div>
              </div>

              {selectedVoucher.narration && (
                <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 italic border border-slate-100">
                  Narration: "{selectedVoucher.narration}"
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <ArrowDownLeft size={24} className="text-slate-300" />
              <span>Select a Receipt row to display financial double entry journal records.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Post Receipt Voucher</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Post customer collections, clear ledger receivables, and update SBI/HDFC books.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Customer */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer Account *</label>
                  <select
                    value={partyId}
                    onChange={e => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Due: ₹{c.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Collection Value (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={amount}
                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Mode */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="Cash">Cash Ledger</option>
                  </select>
                </div>

                {/* Bank / Cash ledger */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Deposit To Link</label>
                  <select
                    value={cashBankLink}
                    onChange={e => setCashBankLink(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="HDFC Bank Main A/c">HDFC Bank Main A/c</option>
                    <option value="SBI Working Cap A/c">SBI Working Cap A/c</option>
                    <option value="Petty Cash Ledger">Petty Cash Ledger</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Invoice Ref */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Invoice InvoiceNo Reference</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    placeholder="e.g. INV/BR/2026-27/001"
                  />
                </div>
              </div>

              {/* Narration */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Narration / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 min-h-[60px]"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="Record additional information about this deposit..."
                />
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Post Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function ReceiptsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <ReceiptsPageContent />
    </React.Suspense>
  );
}
