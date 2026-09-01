'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Voucher } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Landmark, ArrowDownRight, ArrowUpRight, FileSpreadsheet } from 'lucide-react';

export default function LedgerOutstandingPage() {
  const { db } = useErp();
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables' | 'ledger'>('receivables');

  const customers = db.customers;
  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const vouchers = db.vouchers;

  // 1. Receivables data (Customers outstandings)
  const receivablesData = useMemo(() => {
    return customers.map(c => {
      // Find all invoices for this customer
      const invoices = db.salesInvoices.filter(inv => inv.customerId === c.id);
      const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
      
      // Find all receipts for this customer
      const customerReceipts = vouchers.filter(v => v.partyId === c.id && v.voucherType === 'Receipt');
      const totalCollected = customerReceipts.reduce((sum, v) => sum + v.amount, 0);
      
      return {
        id: c.id,
        name: c.name,
        gstin: c.gstin,
        state: c.state,
        totalInvoiced,
        totalCollected,
        outstanding: c.balance // current balance
      };
    });
  }, [customers, db.salesInvoices, vouchers]);

  // 2. Payables data (Suppliers & Farmers outstandings)
  const payablesData = useMemo(() => {
    const list: any[] = [];
    
    suppliers.forEach(s => {
      // Find all GRNs or Purchase Invoices for supplier
      const poList = db.purchaseOrders.filter(po => po.partyId === s.id && po.status === 'Received');
      const totalPurchased = poList.reduce((sum, po) => sum + po.total, 0);

      const supplierPayments = vouchers.filter(v => v.partyId === s.id && v.voucherType === 'Payment');
      const totalPaid = supplierPayments.reduce((sum, v) => sum + v.amount, 0);

      list.push({
        id: s.id,
        name: s.name,
        type: 'Supplier',
        details: `GSTIN: ${s.gstin}`,
        totalPurchased,
        totalPaid,
        outstanding: s.balance
      });
    });

    farmers.forEach(f => {
      const poList = db.purchaseOrders.filter(po => po.partyId === f.id && po.status === 'Received');
      const totalPurchased = poList.reduce((sum, po) => sum + po.total, 0);

      const farmerPayments = vouchers.filter(v => v.partyId === f.id && v.voucherType === 'Payment');
      const totalPaid = farmerPayments.reduce((sum, v) => sum + v.amount, 0);

      list.push({
        id: f.id,
        name: f.name,
        type: 'Farmer',
        details: `State: ${f.state}`,
        totalPurchased,
        totalPaid,
        outstanding: f.balance
      });
    });

    return list;
  }, [suppliers, farmers, db.purchaseOrders, vouchers]);

  // 3. Columns configuration
  const receivableCols: any[] = [
    { header: 'Customer Name', accessor: 'name' as any, sortable: true },
    { header: 'GSTIN / State', accessor: (row: any) => `${row.gstin} (${row.state})` },
    { header: 'Total Invoiced', accessor: (row: any) => `₹${row.totalInvoiced.toLocaleString()}` },
    { header: 'Total Collected', accessor: (row: any) => `₹${row.totalCollected.toLocaleString()}` },
    { 
      header: 'Outstanding Balance', 
      accessor: (row: any) => (
        <span className={`font-bold ${row.outstanding > 0 ? 'text-red-600' : 'text-slate-650'}`}>
          ₹{row.outstanding.toLocaleString()}
        </span>
      ),
      csvAccessor: (row: any) => String(row.outstanding)
    }
  ];

  const payableCols: any[] = [
    { header: 'Vendor Name', accessor: 'name' as any, sortable: true },
    { header: 'Vendor Channel', accessor: 'type' as any },
    { header: 'Additional Info', accessor: 'details' as any },
    { header: 'Total Sourced Value', accessor: (row: any) => `₹${row.totalPurchased.toLocaleString()}` },
    { header: 'Total Paid Out', accessor: (row: any) => `₹${row.totalPaid.toLocaleString()}` },
    { 
      header: 'Outstanding Payable', 
      accessor: (row: any) => (
        <span className={`font-bold ${row.outstanding > 0 ? 'text-amber-600' : 'text-slate-655'}`}>
          ₹{row.outstanding.toLocaleString()}
        </span>
      ),
      csvAccessor: (row: any) => String(row.outstanding)
    }
  ];

  const ledgerCols: any[] = [
    { header: 'Voucher No', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Posting Date', accessor: 'date' as keyof Voucher },
    { header: 'Debit Account', accessor: 'debitAccount' as keyof Voucher },
    { header: 'Credit Account', accessor: 'creditAccount' as keyof Voucher },
    { header: 'Voucher Type', accessor: 'voucherType' as keyof Voucher },
    { 
      header: 'Voucher Value', 
      accessor: (row: Voucher) => `₹${row.amount.toLocaleString()}`
    },
    { header: 'Narration / Notes', accessor: 'narration' as keyof Voucher, className: 'max-w-[200px]' }
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Ledger & Outstanding Balances</h1>
        <p className="text-xs font-medium text-slate-400">Track company accounts receivables, vendor accounts payables, and check double entry ledger records.</p>
      </div>

      {/* Tabs bar */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('receivables')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'receivables' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Outstanding Receivables ({receivablesData.filter(r => r.outstanding > 0).length} Customers)
        </button>
        <button
          onClick={() => setActiveTab('payables')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'payables' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Outstanding Payables ({payablesData.filter(p => p.outstanding > 0).length} Vendors)
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'ledger' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          General Ledger Book ({vouchers.length} entries)
        </button>
      </div>

      {/* Tables Grid */}
      <div className="space-y-4">
        {activeTab === 'receivables' && (
          <DataTable
            data={receivablesData}
            columns={receivableCols}
            searchPlaceholder="Search customer..."
            searchField="name"
            exportFileName="customer_outstanding_receivables"
          />
        )}

        {activeTab === 'payables' && (
          <DataTable
            data={payablesData}
            columns={payableCols}
            searchPlaceholder="Search supplier or farmer..."
            searchField="name"
            exportFileName="vendor_outstanding_payables"
          />
        )}

        {activeTab === 'ledger' && (
          <DataTable
            data={vouchers}
            columns={ledgerCols}
            searchPlaceholder="Search ledger voucher..."
            searchField="voucherNo"
            exportFileName="general_ledger_journal"
          />
        )}
      </div>
    </div>
  );
}
