'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Printer, FileSpreadsheet } from 'lucide-react';

function ReportsPageContent() {
  const { db } = useErp();
  const [selectedTab, setSelectedTab] = useState<'aging' | 'statement'>('aging');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const customers = db.customers;
  const invoices = db.salesInvoices;
  const vouchers = db.vouchers;
  const creditNotes = db.creditNotes || [];

  // Aging logic
  const now = new Date();
  const agingData = customers.map(cust => {
    const custInvoices = invoices.filter(inv => inv.customerId === cust.id && inv.paymentStatus !== 'Paid');
    
    let current = 0;
    let d1_30 = 0;
    let d31_60 = 0;
    let d61_90 = 0;
    let d91_180 = 0;
    let d180plus = 0;

    custInvoices.forEach(inv => {
      const diffTime = Math.abs(now.getTime() - new Date(inv.invoiceDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const amount = inv.grandTotal;

      if (diffDays <= 0) current += amount;
      else if (diffDays <= 30) d1_30 += amount;
      else if (diffDays <= 60) d31_60 += amount;
      else if (diffDays <= 90) d61_90 += amount;
      else if (diffDays <= 180) d91_180 += amount;
      else d180plus += amount;
    });

    const totalOutstanding = current + d1_30 + d31_60 + d61_90 + d91_180 + d180plus;

    return {
      id: cust.id,
      customerName: cust.name,
      company: cust.companyName || 'Individual',
      creditLimit: cust.creditLimit || 0,
      totalOutstanding,
      current,
      '1-30 Days': d1_30,
      '31-60 Days': d31_60,
      '61-90 Days': d61_90,
      '91-180 Days': d91_180,
      '180+ Days': d180plus
    };
  }).filter(r => r.totalOutstanding > 0);

  // Statement logic
  const activeCustomer = customers.find(c => c.id === selectedCustomerId);
  const statementLedger: any[] = [];

  if (activeCustomer) {
    // Collect invoices
    invoices.filter(inv => inv.customerId === activeCustomer.id).forEach(inv => {
      statementLedger.push({
        date: inv.invoiceDate,
        type: 'Invoice',
        docNo: inv.invoiceNo,
        debit: inv.grandTotal,
        credit: 0
      });
    });

    // Collect receipt vouchers
    vouchers.filter(v => v.partyId === activeCustomer.id && v.partyType === 'customer' && v.status === 'Approved').forEach(v => {
      statementLedger.push({
        date: v.date,
        type: v.voucherType,
        docNo: v.voucherNo,
        debit: v.voucherType === 'Payment' ? v.amount : 0,
        credit: v.voucherType === 'Receipt' ? v.amount : 0
      });
    });

    // Collect credit notes
    creditNotes.filter((cn: any) => cn.customerId === activeCustomer.id).forEach((cn: any) => {
      statementLedger.push({
        date: cn.date,
        type: 'Credit Note',
        docNo: cn.creditNoteNo,
        debit: 0,
        credit: cn.totalAmount
      });
    });

    statementLedger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = activeCustomer.balance - statementLedger.reduce((sum, item) => sum + item.debit - item.credit, 0);
    statementLedger.forEach(row => {
      runningBalance += row.debit - row.credit;
      row.balance = runningBalance;
    });
  }

  const columnsAging: any[] = [
    { header: 'Customer Name', accessor: 'customerName', sortable: true },
    { header: 'Company', accessor: 'company' },
    { header: 'Current (₹)', accessor: (row: any) => `₹${row.current.toLocaleString()}` },
    { header: '1-30 Days (₹)', accessor: (row: any) => `₹${row['1-30 Days'].toLocaleString()}` },
    { header: '31-60 Days (₹)', accessor: (row: any) => `₹${row['31-60 Days'].toLocaleString()}` },
    { header: '61-90 Days (₹)', accessor: (row: any) => `₹${row['61-90 Days'].toLocaleString()}` },
    { header: '91-180 Days (₹)', accessor: (row: any) => `₹${row['91-180 Days'].toLocaleString()}` },
    { header: '180+ Days (₹)', accessor: (row: any) => `₹${row['180+ Days'].toLocaleString()}` },
    { header: 'Outstanding (₹)', accessor: (row: any) => `₹${row.totalOutstanding.toLocaleString()}`, sortable: true }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Reports & Statements</h1>
        <p className="text-xs font-medium text-slate-400">Generate receivable aging analyses, view customer statement ledger books, and download reports.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setSelectedTab('aging')}
          className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
            selectedTab === 'aging' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Receivables Aging Report
        </button>
        <button
          onClick={() => setSelectedTab('statement')}
          className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
            selectedTab === 'statement' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Customer Ledger Statement
        </button>
      </div>

      {/* Aging View */}
      {selectedTab === 'aging' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receivables Aging Analysis</h3>
            </div>
            <DataTable
              data={agingData}
              columns={columnsAging}
              searchPlaceholder="Search customer..."
              searchField="customerName"
              exportFileName="receivables_aging_report"
            />
          </div>
        </div>
      )}

      {/* Statement View */}
      {selectedTab === 'statement' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-1/3">
                <label className="text-[10px] font-bold text-slate-405 block mb-1">Select Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {activeCustomer ? (
              <div className="space-y-6 pt-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{activeCustomer.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{activeCustomer.companyName || 'Individual'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Current Balance</span>
                    <span className="text-lg font-bold text-slate-800">₹{activeCustomer.balance.toLocaleString()}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-450 border-b border-slate-200/80 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Transaction Type</th>
                        <th className="py-2.5 px-3">Document Number</th>
                        <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                        <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                        <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {statementLedger.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">{formatDate(row.date)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              row.type === 'Invoice' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                              row.type === 'Receipt' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                              'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{row.docNo}</td>
                          <td className="py-2.5 px-3 text-right text-slate-800">{row.debit > 0 ? `₹${row.debit.toLocaleString()}` : '-'}</td>
                          <td className="py-2.5 px-3 text-right text-slate-800">{row.credit > 0 ? `₹${row.credit.toLocaleString()}` : '-'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">₹{row.balance.toLocaleString()}</td>
                        </tr>
                      ))}
                      {statementLedger.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                            No ledger transactions recorded for this customer period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-350 rounded-xl p-8 text-center text-xs text-slate-450 font-semibold h-[200px] flex flex-col items-center justify-center gap-2">
                <FileText size={24} className="text-slate-300" />
                <span>Select a customer above to build their running ledger account statement.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesReportsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <ReportsPageContent />
    </React.Suspense>
  );
}
