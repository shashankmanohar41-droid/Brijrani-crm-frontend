'use client';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { Expense } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Plus, IndianRupee, Image, Upload, FileText } from 'lucide-react';

export default function ExpensesPage() {
  const { db, refreshDb, showToast } = useErp();

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [category, setCategory] = useState('Fuel & Transport');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank Transfer' | 'UPI'>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  const gstAmount = Math.round(amount * (gstPercent / 100));
  const totalAmount = amount + gstAmount;

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) {
      showToast('Please enter a vendor name', 'error');
      return;
    }

    const expenseNo = `EXP/2026/${String(db.expenses.length + 1).padStart(3, '0')}`;
    const id = `EXP-${Date.now()}`;

    const newExpense: Expense = {
      id,
      expenseNo,
      category,
      vendor,
      amount,
      gstAmount,
      totalAmount,
      paymentMode,
      date: new Date().toISOString().split('T')[0],
      referenceNo,
      narration
    };

    erpService.expenses.create(newExpense);
    refreshDb();
    setIsCreateOpen(false);
    showToast(`Expense voucher ${expenseNo} recorded. Cash reserves debited.`, 'success');
    setSelectedExpense(newExpense);
  };

  const columns = [
    { header: 'Expense Ref', accessor: 'expenseNo' as keyof Expense, sortable: true },
    { header: 'Posting Date', accessor: 'date' as keyof Expense },
    { header: 'Category', accessor: 'category' as keyof Expense },
    { header: 'Paid To (Vendor)', accessor: 'vendor' as keyof Expense },
    { header: 'Base Amount', accessor: (row: Expense) => `₹${row.amount.toLocaleString()}` },
    { header: 'GST Tax', accessor: (row: Expense) => `₹${row.gstAmount.toLocaleString()}` },
    { header: 'Total Payout', accessor: (row: Expense) => `₹${row.totalAmount.toLocaleString()}` },
    { header: 'Payment Mode', accessor: 'paymentMode' as keyof Expense }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Operational Expenses Log</h1>
          <p className="text-xs font-medium text-slate-400">Record administrative costs, warehouse rent outlays, fuel receipts, and labor salaries.</p>
        </div>
        <button
          onClick={() => {
            setVendor('');
            setAmount(5000);
            setReferenceNo('');
            setNarration('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record Expense Payout</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.expenses}
            columns={columns}
            searchPlaceholder="Search expense voucher..."
            searchField="expenseNo"
            onRowClick={(row) => setSelectedExpense(row)}
            exportFileName="operational_expenses_journal"
          />
        </div>

        {/* Selected Expense info */}
        <div>
          {selectedExpense ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedExpense.expenseNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Category: {selectedExpense.category}</span>
              </div>

              {/* Expense bill details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-655">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Paid To:</span>
                  <span>{selectedExpense.vendor}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Base Cost:</span>
                  <span>₹{selectedExpense.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">GST Tax:</span>
                  <span>₹{selectedExpense.gstAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5 text-sm font-bold text-slate-800">
                  <span>Total Amount Paid:</span>
                  <span>₹{selectedExpense.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reference:</span>
                  <span className="font-mono">{selectedExpense.referenceNo || 'None'}</span>
                </div>
              </div>

              {/* Attachment preview */}
              <div className="border border-slate-150 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 text-center text-[10px] text-slate-400 bg-slate-50/50">
                <Image size={24} className="text-slate-350" />
                <span className="font-bold">Mock Bill Receipt Uploaded</span>
                <span className="text-primary-600 cursor-pointer font-semibold">View invoice attachment.pdf</span>
              </div>

              {selectedExpense.narration && (
                <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 italic border border-slate-100">
                  Remarks: "{selectedExpense.narration}"
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <IndianRupee size={24} className="text-slate-300" />
              <span>Select an expense row to review categories, verify tax deductions, and examine voucher attachments.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Record Operational Expense</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Post payouts for fuels, bills, and office outlays.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expense Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="Fuel & Transport">Fuel & Transport</option>
                    <option value="Warehouse Maintenance">Warehouse Maintenance</option>
                    <option value="Labor Wages">Labor Wages</option>
                    <option value="Office Administrative">Office Administrative</option>
                    <option value="Licenses & Taxes">Licenses & Taxes</option>
                  </select>
                </div>

                {/* Paid To */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Paid To (Vendor Name) *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={vendor}
                    onChange={e => setVendor(e.target.value)}
                    placeholder="e.g. Bharat Petroleum, Danapur"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Base Amount (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={amount}
                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                {/* GST */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST Tax Rate (%)</label>
                  <select
                    value={gstPercent}
                    onChange={e => setGstPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="0">Exempt (0%)</option>
                    <option value="5">GST 5%</option>
                    <option value="12">GST 12%</option>
                    <option value="18">GST 18%</option>
                    <option value="28">GST 28%</option>
                  </select>
                </div>

                {/* Mode */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="UPI">UPI Payment</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash Ledger</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Instrument Reference */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">UPI ID / Instrument Ref</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    placeholder="e.g. UPI-BP-2019"
                  />
                </div>

                {/* Attachment placeholder */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attach Invoice Receipt</label>
                  <label className="w-full flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs bg-white font-bold text-slate-500 cursor-pointer transition select-none">
                    <Upload size={14} />
                    <span>Upload Receipt</span>
                  </label>
                </div>
              </div>

              {/* Narration */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Narration / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 min-h-[60px]"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                />
              </div>

              {/* Payout totals preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Total Payout</span>
                  <span className="text-sm font-bold text-slate-800">₹{totalAmount.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base: ₹{amount.toLocaleString()}</span> <br />
                  <span>GST ({gstPercent}%): ₹{gstAmount.toLocaleString()}</span>
                </div>
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
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
