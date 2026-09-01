'use client';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { Voucher } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Landmark, Plus, ArrowLeftRight } from 'lucide-react';

export default function ContraPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI'>('Bank Transfer');
  const [debitAccount, setDebitAccount] = useState('HDFC Bank Main A/c');
  const [creditAccount, setCreditAccount] = useState('Petty Cash Ledger');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  const accounts = [
    'SBI Working Cap A/c',
    'HDFC Bank Main A/c',
    'Petty Cash Ledger'
  ];

  const handleCreateContra = (e: React.FormEvent) => {
    e.preventDefault();
    if (debitAccount === creditAccount) {
      showToast('Debit and Credit accounts must be different.', 'error');
      return;
    }

    const vch = erpService.postVoucher({
      voucherType: 'Contra',
      date: new Date().toISOString().split('T')[0],
      referenceNo,
      partyId: 'none',
      partyType: 'none',
      amount: Number(amount),
      paymentMode,
      cashBankLink: creditAccount, // Source account
      debitAccount,
      creditAccount,
      narration
    }, currentUserRole);

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Contra voucher ${vch.voucherNo} posted. Cash/Bank accounts updated.`, 'success');
    setSelectedVoucher(vch);
  };

  const columns = [
    { header: 'Voucher Number', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Date', accessor: 'date' as keyof Voucher },
    { header: 'From (Credit)', accessor: 'creditAccount' as keyof Voucher },
    { header: 'To (Debit)', accessor: 'debitAccount' as keyof Voucher },
    { 
      header: 'Transfer Value', 
      accessor: (row: Voucher) => `₹${row.amount.toLocaleString()}`
    },
    { header: 'Mode', accessor: 'paymentMode' as keyof Voucher },
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

  const contraList = db.vouchers.filter(v => v.voucherType === 'Contra');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Contra Vouchers (Cash/Bank Transfers)</h1>
          <p className="text-xs font-medium text-slate-400">Record transfers between bank accounts or cash vaults without impacting party ledgers.</p>
        </div>
        <button
          onClick={() => {
            setAmount(50000);
            setReferenceNo('');
            setNarration('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Post Contra Voucher</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={contraList}
            columns={columns}
            searchPlaceholder="Search voucher or account..."
            searchField="voucherNo"
            onRowClick={(row) => setSelectedVoucher(row)}
            exportFileName="contra_vouchers_register"
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
                    <span className="text-slate-400">Debit Account (To):</span>
                    <span className="text-slate-800">{selectedVoucher.debitAccount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credit Account (From):</span>
                    <span className="text-slate-800">{selectedVoucher.creditAccount}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/50 pt-2 font-bold text-slate-800">
                    <span>Transfer Amount:</span>
                    <span>₹{selectedVoucher.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Voucher Type:</span>
                  <span>Contra Transfer</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span>{selectedVoucher.paymentMode}</span>
                </div>
                {selectedVoucher.referenceNo && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Reference / Ref No:</span>
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
              <ArrowLeftRight size={24} className="text-slate-300" />
              <span>Select a Contra row to display double entry cash/bank audit log.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Post Contra Voucher</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Move funds between bank accounts or record cash deposits/withdrawals.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateContra} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Credit Account (Source) */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Source Account (Credit) *</label>
                  <select
                    value={creditAccount}
                    onChange={e => setCreditAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                </div>

                {/* Debit Account (Destination) */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Account (Debit) *</label>
                  <select
                    value={debitAccount}
                    onChange={e => setDebitAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transfer Value (₹) *</label>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transfer Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI Transfer</option>
                    <option value="Cheque">Self Cheque</option>
                    <option value="Cash">Cash Handover</option>
                  </select>
                </div>
              </div>

              {/* Reference No */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transaction Ref / Cheque No Reference</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="e.g. TXN-192830 or CHQ-901823"
                />
              </div>

              {/* Narration */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Narration / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 min-h-[60px]"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="e.g. Cash deposited in HDFC Main Bank account from Petty Cash vault..."
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
                  Post Contra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
