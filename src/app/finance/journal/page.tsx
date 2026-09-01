'use client';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { Voucher } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Landmark, Plus, FileSpreadsheet } from 'lucide-react';

export default function JournalPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [amount, setAmount] = useState(0);
  const [debitAccount, setDebitAccount] = useState('Office Rent Expense A/c');
  const [creditAccount, setCreditAccount] = useState('HDFC Bank Main A/c');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  const commonAccounts = [
    'Purchase Account',
    'Sales Revenue A/c',
    'SBI Working Cap A/c',
    'HDFC Bank Main A/c',
    'Petty Cash Ledger',
    'Office Rent Expense A/c',
    'Labor Wages Expense A/c',
    'GST Payable A/c',
    'GST Input Credit A/c',
    'Miscellaneous Expense A/c'
  ];

  const handleCreateJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (debitAccount === creditAccount) {
      showToast('Debit and Credit accounts must be different.', 'error');
      return;
    }

    const vch = erpService.postVoucher({
      voucherType: 'Journal',
      date: new Date().toISOString().split('T')[0],
      referenceNo,
      partyId: 'none',
      partyType: 'none',
      amount: Number(amount),
      paymentMode: 'Bank Transfer', // standard mode default
      cashBankLink: creditAccount,
      debitAccount,
      creditAccount,
      narration
    }, currentUserRole);

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Journal voucher ${vch.voucherNo} posted successfully. General ledger updated.`, 'success');
    setSelectedVoucher(vch);
  };

  const columns = [
    { header: 'Voucher Number', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Date', accessor: 'date' as keyof Voucher },
    { header: 'Debit Ledger (Dr)', accessor: 'debitAccount' as keyof Voucher },
    { header: 'Credit Ledger (Cr)', accessor: 'creditAccount' as keyof Voucher },
    { 
      header: 'Adjusted Value', 
      accessor: (row: Voucher) => `₹${row.amount.toLocaleString()}`
    },
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

  const journalList = db.vouchers.filter(v => v.voucherType === 'Journal');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Journal Vouchers (Adjustment Entries)</h1>
          <p className="text-xs font-medium text-slate-400">Post non-cash transactions, tax adjustments, deprecations, and inter-ledger audit corrections.</p>
        </div>
        <button
          onClick={() => {
            setAmount(25000);
            setReferenceNo('');
            setNarration('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Post Journal Voucher</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={journalList}
            columns={columns}
            searchPlaceholder="Search journal voucher number..."
            searchField="voucherNo"
            onRowClick={(row) => setSelectedVoucher(row)}
            exportFileName="journal_vouchers_register"
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
                    <span className="text-slate-400">Debit (Dr):</span>
                    <span className="text-slate-800 font-bold">{selectedVoucher.debitAccount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credit (Cr):</span>
                    <span className="text-slate-800 font-bold">{selectedVoucher.creditAccount}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/50 pt-2 font-bold text-slate-850">
                    <span>Adjusted Amount:</span>
                    <span>₹{selectedVoucher.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Voucher Type:</span>
                  <span>Journal Adjustment</span>
                </div>
                {selectedVoucher.referenceNo && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Reference No:</span>
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
              <FileSpreadsheet size={24} className="text-slate-300" />
              <span>Select a Journal row to display ledger debit/credit mapping.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Post Journal Voucher</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Post non-cash transactions and ledger corrections to book entry records.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateJournal} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Debit Account */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Debit Account (Dr) *</label>
                  <select
                    value={debitAccount}
                    onChange={e => setDebitAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    {commonAccounts.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                </div>

                {/* Credit Account */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Credit Account (Cr) *</label>
                  <select
                    value={creditAccount}
                    onChange={e => setCreditAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    {commonAccounts.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Adjustment Value (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={amount}
                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                {/* Reference No */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Audit Reference No / Ref ID</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    placeholder="e.g. ADJ-8930 or GST-2026"
                  />
                </div>
              </div>

              {/* Narration */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Narration / Notes *</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 min-h-[60px]"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="Explain the purpose of this double-entry adjustment..."
                  required
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
                  Post Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
