'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { Voucher, SalesInvoice, PurchaseInvoice } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { 
  Landmark, ArrowDownRight, ArrowUpRight, FileSpreadsheet, 
  Building2, Tractor, Users, ShoppingCart, ShoppingBag, 
  FlaskConical, Eye, X, Printer, Download, Search, CheckCircle2,
  AlertCircle, FileText, ArrowRight
} from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

export default function LedgerOutstandingPage() {
  const { db } = useErp();
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables' | 'register' | 'ledger'>('receivables');
  const [selectedParty, setSelectedParty] = useState<{
    id: string;
    name: string;
    type: 'customer' | 'supplier' | 'farmer';
    gstin?: string;
    state?: string;
    phone?: string;
    email?: string;
    balance: number;
  } | null>(null);

  const customers = db.customers || [];
  const suppliers = db.suppliers || [];
  const farmers = db.farmers || [];
  const vouchers = db.vouchers || [];
  const salesInvoices = db.salesInvoices || [];
  const purchaseInvoices = db.purchaseInvoices || [];
  const salesOrders = db.salesOrders || [];
  const purchaseOrders = db.purchaseOrders || [];
  const commodities = db.commodities || [];

  // 1. Receivables data (Customers outstandings)
  const receivablesData = useMemo(() => {
    return customers.map(c => {
      // Find all invoices for this customer
      const custInvoices = salesInvoices.filter(inv => inv.customerId === c.id);
      const totalInvoiced = custInvoices.reduce((sum, inv) => sum + (inv.grandTotal || inv.taxableAmount || 0), 0);
      
      // Fallback if no invoices yet, check sales orders
      const custOrders = salesOrders.filter(so => so.customerId === c.id);
      const totalOrdered = custOrders.reduce((sum, so) => sum + (so.total || 0), 0);
      const effectiveSales = totalInvoiced > 0 ? totalInvoiced : totalOrdered;

      // Find all receipts for this customer
      const customerReceipts = vouchers.filter(v => v.partyId === c.id && v.voucherType === 'Receipt');
      const totalCollected = customerReceipts.reduce((sum, v) => sum + v.amount, 0);
      
      const calculatedBalance = effectiveSales - totalCollected;
      const displayBalance = c.balance !== undefined ? c.balance : calculatedBalance;

      return {
        id: c.id,
        name: c.name,
        gstin: c.gstin || 'Unregistered',
        state: c.state || 'Bihar',
        phone: c.phone || '',
        email: c.email || '',
        totalInvoiced: effectiveSales,
        totalCollected,
        invoiceCount: custInvoices.length || custOrders.length,
        receiptCount: customerReceipts.length,
        outstanding: displayBalance
      };
    });
  }, [customers, salesInvoices, salesOrders, vouchers]);

  // 2. Payables data (Suppliers & Farmers outstandings)
  const payablesData = useMemo(() => {
    const list: any[] = [];
    
    suppliers.forEach(s => {
      // Find all Purchase Invoices for supplier
      const piList = purchaseInvoices.filter(pi => pi.supplierId === s.id && pi.partyType === 'supplier');
      const totalGross = piList.reduce((sum, pi) => sum + (pi.baseSubtotal || pi.subtotal || 0), 0);
      const totalQcSavings = piList.reduce((sum, pi) => sum + (pi.qualityRebateDeduction || 0), 0);
      const totalInvoiced = piList.reduce((sum, pi) => sum + (pi.grandTotal || (pi.subtotal - (pi.qualityRebateDeduction || 0))), 0);

      // Check POs
      const poList = purchaseOrders.filter(po => po.partyId === s.id);
      const totalPOs = poList.reduce((sum, po) => sum + (po.total || 0), 0);
      const effectiveSourced = totalInvoiced > 0 ? totalInvoiced : totalPOs;

      const supplierPayments = vouchers.filter(v => v.partyId === s.id && v.voucherType === 'Payment');
      const totalPaid = supplierPayments.reduce((sum, v) => sum + v.amount, 0);

      const calculatedBalance = effectiveSourced - totalPaid;
      const displayBalance = s.balance !== undefined ? s.balance : calculatedBalance;

      list.push({
        id: s.id,
        name: s.name,
        type: 'Supplier' as const,
        partyType: 'supplier' as const,
        details: `GSTIN: ${s.gstin || 'N/A'}`,
        gstin: s.gstin,
        state: s.state,
        phone: s.phone,
        email: s.email,
        grossSourced: totalGross > 0 ? totalGross : totalPOs,
        qcSavings: totalQcSavings,
        totalPurchased: effectiveSourced,
        totalPaid,
        invoiceCount: piList.length || poList.length,
        paymentCount: supplierPayments.length,
        outstanding: displayBalance
      });
    });

    farmers.forEach(f => {
      const piList = purchaseInvoices.filter(pi => pi.supplierId === f.id && pi.partyType === 'farmer');
      const totalGross = piList.reduce((sum, pi) => sum + (pi.baseSubtotal || pi.subtotal || 0), 0);
      const totalQcSavings = piList.reduce((sum, pi) => sum + (pi.qualityRebateDeduction || 0), 0);
      const totalInvoiced = piList.reduce((sum, pi) => sum + (pi.grandTotal || (pi.subtotal - (pi.qualityRebateDeduction || 0))), 0);

      const poList = purchaseOrders.filter(po => po.partyId === f.id);
      const totalPOs = poList.reduce((sum, po) => sum + (po.total || 0), 0);
      const effectiveSourced = totalInvoiced > 0 ? totalInvoiced : totalPOs;

      const farmerPayments = vouchers.filter(v => v.partyId === f.id && v.voucherType === 'Payment');
      const totalPaid = farmerPayments.reduce((sum, v) => sum + v.amount, 0);

      const calculatedBalance = effectiveSourced - totalPaid;
      const displayBalance = f.balance !== undefined ? f.balance : calculatedBalance;

      list.push({
        id: f.id,
        name: f.name,
        type: 'Farmer' as const,
        partyType: 'farmer' as const,
        details: `Address: ${f.address || ''}, State: ${f.state || 'Bihar'}`,
        state: f.state,
        phone: f.phone,
        grossSourced: totalGross > 0 ? totalGross : totalPOs,
        qcSavings: totalQcSavings,
        totalPurchased: effectiveSourced,
        totalPaid,
        invoiceCount: piList.length || poList.length,
        paymentCount: farmerPayments.length,
        outstanding: displayBalance
      });
    });

    return list;
  }, [suppliers, farmers, purchaseInvoices, purchaseOrders, vouchers]);

  // 3. Unified Sales & Purchases Register
  const salesPurchasesRegister = useMemo(() => {
    const list: Array<{
      id: string;
      docNo: string;
      date: string;
      docType: 'Sales Invoice' | 'Sales Order' | 'Purchase Invoice' | 'Purchase Order';
      partyName: string;
      partyType: 'Customer' | 'Supplier' | 'Farmer';
      commodityName: string;
      quantity: number;
      rate: number;
      grossAmount: number;
      qcRebate: number;
      netAmount: number;
      status: string;
    }> = [];

    // Sales Invoices
    salesInvoices.forEach(inv => {
      const cust = customers.find(c => c.id === inv.customerId);
      const firstItem = inv.items?.[0];
      const comm = commodities.find(c => c.id === firstItem?.commodityId);
      const qty = inv.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
      const rate = firstItem?.rate || 0;
      const gross = inv.taxableAmount || (qty * rate);

      list.push({
        id: inv.id,
        docNo: inv.invoiceNo,
        date: inv.invoiceDate || '',
        docType: 'Sales Invoice',
        partyName: cust?.name || 'Customer Buyer',
        partyType: 'Customer',
        commodityName: comm?.name || 'Commodity Goods',
        quantity: qty,
        rate,
        grossAmount: gross,
        qcRebate: 0,
        netAmount: inv.grandTotal || gross,
        status: inv.paymentStatus || 'Approved'
      });
    });

    // Purchase Invoices
    purchaseInvoices.forEach(inv => {
      const supName = inv.partyType === 'supplier'
        ? suppliers.find(s => s.id === inv.supplierId)?.name
        : farmers.find(f => f.id === inv.supplierId)?.name;
      
      const comm = commodities.find(c => c.id === inv.items?.[0]?.item || (c as any)._id === inv.items?.[0]?.item);
      const item = inv.items?.[0];
      const qty = item?.invoiceQty || item?.receivedQty || 0;
      const rate = item?.baseRate || item?.rate || 0;
      const gross = inv.baseSubtotal || inv.subtotal || (qty * rate);
      const rebate = inv.qualityRebateDeduction || 0;

      list.push({
        id: inv.id,
        docNo: inv.invoiceNo,
        date: inv.invoiceDate || '',
        docType: 'Purchase Invoice',
        partyName: supName || 'Vendor Sourcing',
        partyType: inv.partyType === 'supplier' ? 'Supplier' : 'Farmer',
        commodityName: comm?.name || 'Commodity Material',
        quantity: qty,
        rate,
        grossAmount: gross,
        qcRebate: rebate,
        netAmount: inv.grandTotal || (gross - rebate),
        status: inv.status || 'Approved'
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [salesInvoices, purchaseInvoices, customers, suppliers, farmers, commodities]);

  // Overall Financial Totals
  const totalReceivables = useMemo(() => receivablesData.reduce((sum, r) => sum + Math.max(0, r.outstanding), 0), [receivablesData]);
  const totalPayables = useMemo(() => payablesData.reduce((sum, p) => sum + Math.max(0, p.outstanding), 0), [payablesData]);
  const totalQcRebateSavings = useMemo(() => payablesData.reduce((sum, p) => sum + p.qcSavings, 0), [payablesData]);
  const totalVoucherTurnover = useMemo(() => vouchers.reduce((sum, v) => sum + v.amount, 0), [vouchers]);

  // Selected Party Detailed Transaction Statement
  const partyStatement = useMemo(() => {
    if (!selectedParty) return null;

    const entries: Array<{
      date: string;
      docNo: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
      type: 'Invoice' | 'Payment' | 'Receipt' | 'QC Adjustment' | 'Order';
    }> = [];

    let runningBalance = 0;

    if (selectedParty.type === 'customer') {
      // 1. Sales Invoices
      salesInvoices
        .filter(inv => inv.customerId === selectedParty.id || (inv as any).partyId === selectedParty.id)
        .forEach(inv => {
          entries.push({
            date: inv.invoiceDate || '',
            docNo: inv.invoiceNo,
            description: `Sales Invoice - Commodity dispatch`,
            debit: inv.grandTotal || inv.taxableAmount || 0,
            credit: 0,
            balance: 0,
            type: 'Invoice'
          });
        });

      // 2. Receipt Vouchers
      vouchers
        .filter(v => v.partyId === selectedParty.id && v.voucherType === 'Receipt')
        .forEach(v => {
          entries.push({
            date: v.date,
            docNo: v.voucherNo,
            description: `Receipt Collection (${v.paymentMode || 'Bank'}) - ${v.narration || 'Payment received'}`,
            debit: 0,
            credit: v.amount,
            balance: 0,
            type: 'Receipt'
          });
        });

      // Sort chronologically ascending
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      entries.forEach(e => {
        runningBalance += (e.debit - e.credit);
        e.balance = runningBalance;
      });
    } else {
      // Vendor (Supplier / Farmer)
      // 1. Purchase Invoices
      purchaseInvoices
        .filter(pi => 
          pi.supplierId === selectedParty.id || 
          (pi as any).partyId === selectedParty.id ||
          (pi as any).supplierId === (selectedParty as any)._id
        )
        .forEach(pi => {
          const gross = pi.baseSubtotal || pi.subtotal || 0;
          const rebate = pi.qualityRebateDeduction || 0;
          const net = pi.grandTotal || (gross - rebate);

          entries.push({
            date: pi.invoiceDate || '',
            docNo: pi.invoiceNo,
            description: rebate > 0 
              ? `Purchase Invoice (Gross: ₹${gross.toLocaleString()}, QC Rebate: -₹${rebate.toLocaleString()})`
              : `Purchase Invoice - Sourcing procurement`,
            debit: 0,
            credit: net,
            balance: 0,
            type: 'Invoice'
          });
        });

      // 2. Payment Vouchers
      vouchers
        .filter(v => 
          (v.partyId === selectedParty.id || (selectedParty as any)._id && v.partyId === (selectedParty as any)._id) && 
          v.voucherType === 'Payment'
        )
        .forEach(v => {
          entries.push({
            date: v.date,
            docNo: v.voucherNo,
            description: `Payment Settled (${v.paymentMode || 'Bank'}) - ${v.narration || 'Vendor payment'}`,
            debit: v.amount,
            credit: 0,
            balance: 0,
            type: 'Payment'
          });
        });

      // Sort chronologically ascending
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance (Credit increases payable, Debit decreases payable)
      entries.forEach(e => {
        runningBalance += (e.credit - e.debit);
        e.balance = runningBalance;
      });
    }

    return {
      entries,
      closingBalance: runningBalance
    };
  }, [selectedParty, salesInvoices, purchaseInvoices, vouchers]);

  // Columns configuration
  const receivableCols: any[] = [
    { header: 'Customer Name', accessor: 'name' as any, sortable: true },
    { header: 'GSTIN / State', accessor: (row: any) => `${row.gstin} (${row.state})` },
    { 
      header: 'Total Invoiced', 
      accessor: (row: any) => (
        <span className="font-mono font-semibold text-slate-800">
          ₹{row.totalInvoiced.toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Total Collected', 
      accessor: (row: any) => (
        <span className="font-mono text-emerald-700 font-semibold">
          ₹{row.totalCollected.toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Outstanding Balance', 
      accessor: (row: any) => (
        <span className={`font-mono font-bold ${row.outstanding > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
          ₹{row.outstanding.toLocaleString()}
        </span>
      ),
      csvAccessor: (row: any) => String(row.outstanding)
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <button
          onClick={() => setSelectedParty({
            id: row.id,
            name: row.name,
            type: 'customer',
            gstin: row.gstin,
            state: row.state,
            phone: row.phone,
            email: row.email,
            balance: row.outstanding
          })}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-primary-50 hover:text-primary-700 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200"
        >
          <Eye size={12} />
          <span>Statement</span>
        </button>
      )
    }
  ];

  const payableCols: any[] = [
    { header: 'Vendor Name', accessor: 'name' as any, sortable: true },
    { 
      header: 'Channel', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.type === 'Supplier' 
            ? 'bg-blue-50 text-blue-700 border-blue-200' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {row.type}
        </span>
      )
    },
    { 
      header: 'Sourced Purchases', 
      accessor: (row: any) => (
        <span className="font-mono font-semibold text-slate-800">
          ₹{row.totalPurchased.toLocaleString()}
        </span>
      )
    },
    { 
      header: 'QC Savings', 
      accessor: (row: any) => row.qcSavings > 0 ? (
        <span className="font-mono text-emerald-700 font-bold">
          -₹{row.qcSavings.toLocaleString()}
        </span>
      ) : (
        <span className="text-slate-400 font-mono">-</span>
      )
    },
    { 
      header: 'Total Paid Out', 
      accessor: (row: any) => (
        <span className="font-mono text-slate-700 font-semibold">
          ₹{row.totalPaid.toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Outstanding Payable', 
      accessor: (row: any) => (
        <span className={`font-mono font-bold ${row.outstanding > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
          ₹{row.outstanding.toLocaleString()}
        </span>
      ),
      csvAccessor: (row: any) => String(row.outstanding)
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <button
          onClick={() => setSelectedParty({
            id: row.id,
            name: row.name,
            type: row.partyType,
            gstin: row.gstin,
            state: row.state,
            phone: row.phone,
            balance: row.outstanding
          })}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-primary-50 hover:text-primary-700 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200"
        >
          <Eye size={12} />
          <span>Statement</span>
        </button>
      )
    }
  ];

  const registerCols: any[] = [
    {
      header: 'Type',
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.docType.startsWith('Sales')
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {row.docType}
        </span>
      )
    },
    { header: 'Doc Number', accessor: 'docNo' as any, sortable: true },
    { header: 'Posting Date', accessor: 'date' as any, sortable: true },
    { header: 'Party Name', accessor: 'partyName' as any },
    { header: 'Commodity', accessor: 'commodityName' as any },
    { header: 'Quantity (MT)', accessor: (row: any) => `${row.quantity} MT` },
    { header: 'Rate (₹/MT)', accessor: (row: any) => `₹${row.rate.toLocaleString()}` },
    { 
      header: 'Gross Value', 
      accessor: (row: any) => `₹${row.grossAmount.toLocaleString()}` 
    },
    { 
      header: 'QC Rebate', 
      accessor: (row: any) => row.qcRebate > 0 ? (
        <span className="text-emerald-700 font-bold font-mono">-₹{row.qcRebate.toLocaleString()}</span>
      ) : '-' 
    },
    { 
      header: 'Net Settled Value', 
      accessor: (row: any) => (
        <span className="font-mono font-bold text-slate-900">
          ₹{row.netAmount.toLocaleString()}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: (row: any) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          {row.status}
        </span>
      )
    }
  ];

  const ledgerCols: any[] = [
    { header: 'Voucher No', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Posting Date', accessor: 'date' as keyof Voucher },
    { header: 'Debit Account', accessor: 'debitAccount' as keyof Voucher },
    { header: 'Credit Account', accessor: 'creditAccount' as keyof Voucher },
    { 
      header: 'Voucher Type', 
      accessor: (row: Voucher) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.voucherType === 'Receipt' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : row.voucherType === 'Payment'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-purple-50 text-purple-700 border-purple-200'
        }`}>
          {row.voucherType}
        </span>
      )
    },
    { 
      header: 'Voucher Value', 
      accessor: (row: Voucher) => (
        <span className="font-mono font-bold text-slate-800">
          ₹{row.amount.toLocaleString()}
        </span>
      )
    },
    { header: 'Narration / Notes', accessor: 'narration' as keyof Voucher, className: 'max-w-[220px] truncate' }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Ledger &amp; Financial Outstandings</h1>
          <p className="text-xs font-medium text-slate-400">
            Real-time accounts receivable, vendor accounts payable, double entry general ledger, and sales/purchases register.
          </p>
        </div>
      </div>

      {/* KPI Cards Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Receivables</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Users size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-900 block font-mono">₹{totalReceivables.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {receivablesData.filter(r => r.outstanding > 0).length} Customers with dues
            </span>
          </div>
        </div>

        {/* Total Payables */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Payables</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Building2 size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-900 block font-mono">₹{totalPayables.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {payablesData.filter(p => p.outstanding > 0).length} Vendors awaiting settlement
            </span>
          </div>
        </div>

        {/* QC Deductions Savings */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quality QC Savings</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><FlaskConical size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-emerald-700 block font-mono">₹{totalQcRebateSavings.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
              Rebate deductions on procurement
            </span>
          </div>
        </div>

        {/* Ledger Turnover */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cleared Vouchers</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600"><Landmark size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-900 block font-mono">₹{totalVoucherTurnover.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {vouchers.length} Total posted double-entry entries
            </span>
          </div>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveTab('receivables')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'receivables' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShoppingCart size={13} />
          <span>Outstanding Receivables ({receivablesData.filter(r => r.outstanding > 0).length} Customers)</span>
        </button>
        <button
          onClick={() => setActiveTab('payables')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'payables' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShoppingBag size={13} />
          <span>Outstanding Payables ({payablesData.filter(p => p.outstanding > 0).length} Vendors)</span>
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'register' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText size={13} />
          <span>Sales &amp; Purchases Register ({salesPurchasesRegister.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ledger' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Landmark size={13} />
          <span>General Ledger Book ({vouchers.length} entries)</span>
        </button>
      </div>

      {/* Tables Grid */}
      <div className="space-y-4">
        {activeTab === 'receivables' && (
          <DataTable
            data={receivablesData}
            columns={receivableCols}
            searchPlaceholder="Search customer by name or GSTIN..."
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

        {activeTab === 'register' && (
          <DataTable
            data={salesPurchasesRegister}
            columns={registerCols}
            searchPlaceholder="Search sales or purchase document..."
            searchField="docNo"
            exportFileName="sales_and_purchases_register"
          />
        )}

        {activeTab === 'ledger' && (
          <DataTable
            data={vouchers}
            columns={ledgerCols}
            searchPlaceholder="Search ledger voucher by number or account..."
            searchField="voucherNo"
            exportFileName="general_ledger_journal"
          />
        )}
      </div>

      {/* Detailed Party Account Statement Modal */}
      {selectedParty && partyStatement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${
                  selectedParty.type === 'customer' ? 'bg-indigo-600' : 'bg-amber-600'
                }`}>
                  {selectedParty.type === 'customer' ? <Users size={18} /> : <Building2 size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedParty.name}</h3>
                  <p className="text-xs text-slate-400 capitalize">
                    {selectedParty.type} Account Statement &bull; GSTIN: {selectedParty.gstin || 'N/A'} &bull; State: {selectedParty.state || 'Bihar'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition cursor-pointer"
                  title="Print Statement"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => setSelectedParty(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Balance Summary Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {selectedParty.type === 'customer' ? 'Total Sales Billed' : 'Total Material Sourced'}
                  </span>
                  <span className="text-base font-bold text-slate-800 font-mono block mt-1">
                    ₹{partyStatement.entries.reduce((s, e) => s + (selectedParty.type === 'customer' ? e.debit : e.credit), 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {selectedParty.type === 'customer' ? 'Total Collections Received' : 'Total Payments Cleared'}
                  </span>
                  <span className="text-base font-bold text-emerald-700 font-mono block mt-1">
                    ₹{partyStatement.entries.reduce((s, e) => s + (selectedParty.type === 'customer' ? e.credit : e.debit), 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {selectedParty.type === 'customer' ? 'Net Outstanding Due' : 'Net Outstanding Payable'}
                  </span>
                  <span className={`text-base font-bold font-mono block mt-1 ${
                    partyStatement.closingBalance > 0 
                      ? (selectedParty.type === 'customer' ? 'text-rose-600' : 'text-amber-600')
                      : 'text-slate-600'
                  }`}>
                    ₹{partyStatement.closingBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Doc No</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">
                        {selectedParty.type === 'customer' ? 'Debit (Billed ₹)' : 'Debit (Paid ₹)'}
                      </th>
                      <th className="p-2.5 text-right">
                        {selectedParty.type === 'customer' ? 'Credit (Paid ₹)' : 'Credit (Billed ₹)'}
                      </th>
                      <th className="p-2.5 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partyStatement.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          No accounting transactions posted for this party yet.
                        </td>
                      </tr>
                    ) : (
                      partyStatement.entries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{entry.date || '-'}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{entry.docNo}</td>
                          <td className="p-2.5 text-slate-700">{entry.description}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-800">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-emerald-700">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            ₹{entry.balance.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setSelectedParty(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
