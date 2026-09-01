'use client';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { Voucher } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Landmark, Plus, ArrowUpRight } from 'lucide-react';

export default function PaymentsPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI'>('Bank Transfer');
  const [cashBankLink, setCashBankLink] = useState('SBI Working Cap A/c');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const activeParties = partyType === 'supplier' ? suppliers : farmers;

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      showToast('Please select a vendor', 'error');
      return;
    }

    const partyName = partyType === 'supplier' 
      ? suppliers.find(s => s.id === partyId)?.name 
      : farmers.find(f => f.id === partyId)?.name;

    const vch = erpService.postVoucher({
      voucherType: 'Payment',
      date: new Date().toISOString().split('T')[0],
      referenceNo,
      partyId,
      partyType,
      amount: Number(amount),
      paymentMode,
      cashBankLink,
      debitAccount: `${partyName} Accounts Payable`,
      creditAccount: cashBankLink,
      narration
    }, currentUserRole);

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Payment voucher ${vch.voucherNo} posted. Accounts payable reconciled.`, 'success');
    setSelectedVoucher(vch);
  };

  const columns = [
    { header: 'Voucher Number', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Date', accessor: 'date' as keyof Voucher },
    { 
      header: 'Vendor Name', 
      accessor: (row: Voucher) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown Supplier';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown Farmer';
      },
      csvAccessor: (row: Voucher) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { 
      header: 'Cleared Value', 
      accessor: (row: Voucher) => `₹${row.amount.toLocaleString()}`
    },
    { header: 'Payment Mode', accessor: 'paymentMode' as keyof Voucher },
    { header: 'Reference', accessor: 'referenceNo' as keyof Voucher },
    { 
      header: 'Status', 
      accessor: (row: Voucher) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
          {row.status}
        </span>
      )
    }
  ];

  const paymentsList = db.vouchers.filter(v => v.voucherType === 'Payment');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Payment Vouchers (Vendor Clearance)</h1>
          <p className="text-xs font-medium text-slate-400">Record payments to farmers or suppliers and balance trade accounts payables.</p>
        </div>
        <button
          onClick={() => {
            setPartyId('');
            setAmount(100000);
            setReferenceNo('');
            setNarration('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Post Payment Voucher</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={paymentsList}
            columns={columns}
            searchPlaceholder="Search voucher or reference..."
            searchField="voucherNo"
            onRowClick={(row) => setSelectedVoucher(row)}
            exportFileName="payment_vouchers_register"
          />
        </div>

        {/* Selected Voucher details */}
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
                    <span className="text-slate-400">Debit (Payables -):</span>
                    <span>{selectedVoucher.debitAccount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credit (Assets -):</span>
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
                  <span className="text-slate-400">Vendor Channel:</span>
                  <span className="capitalize">{selectedVoucher.partyType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Vendor Name:</span>
                  <span>
                    {selectedVoucher.partyType === 'supplier' 
                      ? suppliers.find(s => s.id === selectedVoucher.partyId)?.name 
                      : farmers.find(f => f.id === selectedVoucher.partyId)?.name}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span>{selectedVoucher.paymentMode}</span>
                </div>
                {selectedVoucher.referenceNo && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Reference / Instrument No:</span>
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
              <ArrowUpRight size={24} className="text-slate-300" />
              <span>Select a Payment row to display financial double entry journal records.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Post Payment Voucher</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Post payouts to suppliers/farmers and reconcile cash/bank reserves.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Channel type */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vendor Channel</label>
                  <select
                    value={partyType}
                    onChange={e => {
                      setPartyType(e.target.value as 'supplier' | 'farmer');
                      setPartyId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="supplier">Commercial Supplier</option>
                    <option value="farmer">Direct Farmer Sourced</option>
                  </select>
                </div>

                {/* Vendor selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vendor Account *</label>
                  <select
                    value={partyId}
                    onChange={e => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Vendor</option>
                    {activeParties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Payable: ₹{p.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payout Value (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={amount}
                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                {/* Mode */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cash">Cash Ledger</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Bank / Cash ledger */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Debit From Link</label>
                  <select
                    value={cashBankLink}
                    onChange={e => setCashBankLink(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="SBI Working Cap A/c">SBI Working Cap A/c</option>
                    <option value="HDFC Bank Main A/c">HDFC Bank Main A/c</option>
                    <option value="Petty Cash Ledger">Petty Cash Ledger</option>
                  </select>
                </div>

                {/* Reference No */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Instrument / Cheque No Reference</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    placeholder="e.g. CHQ-893012"
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
                  placeholder="Record transaction audit remarks..."
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
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
