'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { Voucher, PurchaseInvoice, PurchaseOrder, Supplier, Farmer } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import IndianDateInput from '../../../components/shared/IndianDateInput';
import { jsPDF } from 'jspdf';
import { 
  CreditCard, Landmark, Plus, ArrowUpRight, CheckCircle2, 
  Clock, Download, Eye, FileText, Filter, Receipt, Search, 
  Sparkles, Wallet, AlertCircle, Building2, UserCheck, ShieldCheck,
  FileSpreadsheet, ShoppingCart, Check, Info, ArrowRight, X
} from 'lucide-react';

export default function VendorPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [activeTab, setActiveTab] = useState<'All Payments' | 'Pending Final Invoices' | 'Pending Preliminary Invoices' | 'Open Purchase Orders'>('All Payments');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states for Recording Vendor Payment
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [partyId, setPartyId] = useState('');
  
  // Selected Linked Document: 'final_inv:<id>', 'prelim_inv:<id>', 'po:<id>', or ''
  const [selectedDocKey, setSelectedDocKey] = useState('');
  
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Bank Transfer' | 'Cash' | 'Cheque' | 'UPI'>('Bank Transfer');
  const [cashBankLink, setCashBankLink] = useState('HDFC Bank Oper A/c');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');

  const suppliers = db.suppliers || [];
  const farmers = db.farmers || [];
  const activeParties = partyType === 'supplier' ? suppliers : farmers;

  // Final Invoices list
  const finalInvoices = useMemo(() => {
    return (db.purchaseInvoices || []).filter(inv => inv.isFinalInvoice === true || inv.invoiceType === 'Final');
  }, [db.purchaseInvoices]);

  // Preliminary Invoices list
  const preliminaryInvoices = useMemo(() => {
    return (db.purchaseInvoices || []).filter(inv => !inv.isFinalInvoice && inv.invoiceType !== 'Final');
  }, [db.purchaseInvoices]);

  // Unpaid or Partially Paid Final Invoices
  const pendingFinalInvoices = useMemo(() => {
    return finalInvoices.filter(inv => inv.status !== 'Paid' && (inv.remainingAmount === undefined || inv.remainingAmount > 0));
  }, [finalInvoices]);

  // Unpaid or Partially Paid Preliminary Invoices
  const pendingPreliminaryInvoices = useMemo(() => {
    return preliminaryInvoices.filter(inv => inv.status !== 'Paid' && (inv.remainingAmount === undefined || inv.remainingAmount > 0));
  }, [preliminaryInvoices]);

  // Approved / Open Purchase Orders
  const openPurchaseOrders = useMemo(() => {
    return (db.purchaseOrders || []).filter(po => 
      po.status === 'Approved' || po.status === 'Sent' || po.status === 'Partially Received' || po.status === 'Received'
    );
  }, [db.purchaseOrders]);

  // Vouchers of type 'Payment' (Procurement Vendor Payments)
  const paymentVouchers = useMemo(() => {
    return (db.vouchers || []).filter(v => v.voucherType === 'Payment');
  }, [db.vouchers]);

  // Summary Metrics
  const totalFinalPayableOutstanding = useMemo(() => {
    return pendingFinalInvoices.reduce((sum, inv) => sum + (inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal), 0);
  }, [pendingFinalInvoices]);

  const totalPrelimPayableOutstanding = useMemo(() => {
    return pendingPreliminaryInvoices.reduce((sum, inv) => sum + (inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal), 0);
  }, [pendingPreliminaryInvoices]);

  const totalPaymentsSettled = useMemo(() => {
    return paymentVouchers.reduce((sum, v) => sum + (v.amount || 0), 0);
  }, [paymentVouchers]);

  // Look up selected linked document details for UI preview
  const linkedDocInfo = useMemo(() => {
    if (!selectedDocKey) return null;
    const [docType, docId] = selectedDocKey.split(':');

    if (docType === 'final_inv') {
      const inv = finalInvoices.find(i => i.id === docId || i.invoiceNo === docId);
      if (!inv) return null;
      const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
      const paid = inv.amountPaid || 0;
      return {
        type: 'Final Purchase Invoice',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        docNo: inv.invoiceNo,
        poNumber: inv.poNumber,
        qcNumber: inv.qcNumber,
        total: inv.grandTotal,
        paid,
        remaining,
        date: inv.invoiceDate,
        raw: inv,
        docType
      };
    }

    if (docType === 'prelim_inv') {
      const inv = preliminaryInvoices.find(i => i.id === docId || i.invoiceNo === docId);
      if (!inv) return null;
      const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
      const paid = inv.amountPaid || 0;
      return {
        type: 'Preliminary Purchase Invoice',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
        docNo: inv.invoiceNo,
        poNumber: inv.poNumber,
        qcNumber: inv.qcNumber,
        total: inv.grandTotal,
        paid,
        remaining,
        date: inv.invoiceDate,
        raw: inv,
        docType
      };
    }

    if (docType === 'po') {
      const po = (db.purchaseOrders || []).find(p => p.id === docId || p.poNo === docId);
      if (!po) return null;
      const poTotal = Number(po.total || (po as any).grandTotal || 0);
      return {
        type: 'Purchase Order (Advance)',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
        docNo: po.poNo,
        poNumber: po.poNo,
        qcNumber: undefined,
        total: poTotal,
        paid: 0,
        remaining: poTotal,
        date: po.date,
        raw: po,
        docType
      };
    }

    return null;
  }, [selectedDocKey, finalInvoices, preliminaryInvoices, db.purchaseOrders]);

  // Handle party change in form
  const handlePartyChange = (newPartyId: string) => {
    setPartyId(newPartyId);
    setSelectedDocKey('');
    setAmount(0);
  };

  // Handle document selection in form
  const handleDocumentSelect = (key: string) => {
    setSelectedDocKey(key);
    if (!key) {
      setAmount(0);
      return;
    }

    const [docType, docId] = key.split(':');

    if (docType === 'final_inv') {
      const inv = finalInvoices.find(i => i.id === docId || i.invoiceNo === docId);
      if (inv) {
        setPartyType(inv.partyType === 'farmer' ? 'farmer' : 'supplier');
        setPartyId(inv.supplierId);
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
        setAmount(remaining);
        setReferenceNo(`TXN-${inv.invoiceNo.replace(/[^a-zA-Z0-9]/g, '')}`);
        setNarration(`Payment settlement for Final Invoice ${inv.invoiceNo} (PO Ref: ${inv.poNumber || 'N/A'}${inv.qcNumber ? `, QC: ${inv.qcNumber}` : ''})`);
      }
    } else if (docType === 'prelim_inv') {
      const inv = preliminaryInvoices.find(i => i.id === docId || i.invoiceNo === docId);
      if (inv) {
        setPartyType(inv.partyType === 'farmer' ? 'farmer' : 'supplier');
        setPartyId(inv.supplierId);
        const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
        setAmount(remaining);
        setReferenceNo(`TXN-${inv.invoiceNo.replace(/[^a-zA-Z0-9]/g, '')}`);
        setNarration(`Direct Payment against Preliminary Invoice ${inv.invoiceNo} (PO Ref: ${inv.poNumber || 'N/A'})`);
      }
    } else if (docType === 'po') {
      const po = (db.purchaseOrders || []).find(p => p.id === docId || p.poNo === docId);
      if (po) {
        setPartyType(po.partyType === 'farmer' ? 'farmer' : 'supplier');
        setPartyId(po.partyId);
        const poTotal = Number(po.total || (po as any).grandTotal || 0);
        setAmount(poTotal);
        setReferenceNo(`ADV-${po.poNo.replace(/[^a-zA-Z0-9]/g, '')}`);
        setNarration(`Advance payment disbursement against Purchase Order ${po.poNo}`);
      }
    }
  };

  // Open payment modal for a specific final invoice directly
  const handlePayFinalInvoice = (inv: PurchaseInvoice) => {
    setPartyType(inv.partyType === 'farmer' ? 'farmer' : 'supplier');
    setPartyId(inv.supplierId);
    setSelectedDocKey(`final_inv:${inv.id}`);
    const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
    setAmount(remaining);
    setReferenceNo(`TXN-${inv.invoiceNo.replace(/[^a-zA-Z0-9]/g, '')}`);
    setNarration(`Settlement against Final Purchase Invoice ${inv.invoiceNo} (PO: ${inv.poNumber || 'N/A'})`);
    setIsCreateOpen(true);
  };

  // Open payment modal for a specific preliminary invoice directly
  const handlePayPrelimInvoice = (inv: PurchaseInvoice) => {
    setPartyType(inv.partyType === 'farmer' ? 'farmer' : 'supplier');
    setPartyId(inv.supplierId);
    setSelectedDocKey(`prelim_inv:${inv.id}`);
    const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
    setAmount(remaining);
    setReferenceNo(`TXN-${inv.invoiceNo.replace(/[^a-zA-Z0-9]/g, '')}`);
    setNarration(`Payment settlement for Preliminary Invoice ${inv.invoiceNo} (PO: ${inv.poNumber || 'N/A'})`);
    setIsCreateOpen(true);
  };

  // Open payment modal for a specific PO (Advance Payment)
  const handlePayPO = (po: PurchaseOrder) => {
    setPartyType(po.partyType === 'farmer' ? 'farmer' : 'supplier');
    setPartyId(po.partyId);
    setSelectedDocKey(`po:${po.id}`);
    const poTotal = Number(po.total || (po as any).grandTotal || 0);
    setAmount(poTotal);
    setReferenceNo(`ADV-${po.poNo.replace(/[^a-zA-Z0-9]/g, '')}`);
    setNarration(`Advance payment against Purchase Order ${po.poNo}`);
    setIsCreateOpen(true);
  };

  // Submit Payment Handler
  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      showToast('Please select a vendor (Supplier / Farmer)', 'error');
      return;
    }
    if (amount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    const partyName = partyType === 'supplier' 
      ? suppliers.find(s => s.id === partyId || (s as any)._id === partyId)?.name || 'Supplier'
      : farmers.find(f => f.id === partyId || (f as any)._id === partyId)?.name || 'Farmer';

    let referenceDocNo = '';

    // Handle Linked Invoice Updates
    if (selectedDocKey.startsWith('final_inv:') || selectedDocKey.startsWith('prelim_inv:')) {
      const isFinal = selectedDocKey.startsWith('final_inv:');
      const docId = selectedDocKey.split(':')[1];
      const targetInvoice = (isFinal ? finalInvoices : preliminaryInvoices).find(i => i.id === docId || i.invoiceNo === docId);

      if (targetInvoice) {
        referenceDocNo = targetInvoice.invoiceNo;
        const remaining = targetInvoice.remainingAmount !== undefined ? targetInvoice.remainingAmount : targetInvoice.grandTotal;
        if (amount > remaining) {
          showToast(`Payment amount (₹${amount.toLocaleString()}) cannot exceed invoice remaining balance (₹${remaining.toLocaleString()})`, 'error');
          return;
        }

        const currentPaid = targetInvoice.amountPaid || 0;
        const newPaid = currentPaid + amount;
        const newRemaining = remaining - amount;
        const newStatus = newRemaining <= 0 ? 'Paid' : 'Partially Paid';

        const paymentRecord = {
          date: paymentDate,
          reference: referenceNo,
          mode: paymentMode,
          account: cashBankLink,
          amount: amount,
          notes: narration
        };

        const updatedInvoice: PurchaseInvoice = {
          ...targetInvoice,
          amountPaid: newPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentHistory: [...(targetInvoice.paymentHistory || []), paymentRecord]
        };

        erpService.purchaseInvoices.update(updatedInvoice);
      }
    } else if (selectedDocKey.startsWith('po:')) {
      const docId = selectedDocKey.split(':')[1];
      const targetPO = (db.purchaseOrders || []).find(p => p.id === docId || p.poNo === docId);
      if (targetPO) {
        referenceDocNo = targetPO.poNo;
      }
    }

    // Post Payment Voucher to Finance Ledger
    const vch = erpService.postVoucher({
      voucherType: 'Payment',
      date: paymentDate || new Date().toISOString().split('T')[0],
      referenceNo: referenceNo || (referenceDocNo ? referenceDocNo : `PAY-${Date.now()}`),
      partyId,
      partyType,
      amount: Number(amount),
      paymentMode,
      cashBankLink,
      debitAccount: `${partyName} Accounts Payable`,
      creditAccount: cashBankLink,
      narration: narration || `Payment to ${partyName}${referenceDocNo ? ` against ${referenceDocNo}` : ''}`
    }, currentUserRole);

    refreshDb();
    setIsCreateOpen(false);
    setSelectedVoucher(vch);
    showToast(`Payment voucher ${vch.voucherNo} of ₹${amount.toLocaleString()} posted successfully!`, 'success');
  };

  // PDF Export
  const handleDownloadVoucherPDF = (voucher: Voucher) => {
    const doc = new jsPDF();
    const partyName = voucher.partyType === 'supplier'
      ? suppliers.find(s => s.id === voucher.partyId || (s as any)._id === voucher.partyId)?.name || 'Supplier'
      : farmers.find(f => f.id === voucher.partyId || (f as any)._id === voucher.partyId)?.name || 'Farmer';

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 25);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text("VENDOR PAYMENT RECEIPT / VOUCHER", 14, 34);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Voucher Number: ${voucher.voucherNo}`, 14, 46);
    doc.text(`Payment Date: ${formatDate(voucher.date)}`, 14, 52);
    doc.text(`Payment Mode: ${voucher.paymentMode}`, 14, 58);
    doc.text(`Bank / Cash A/c: ${voucher.creditAccount || voucher.cashBankLink || 'Bank A/c'}`, 14, 64);
    doc.text(`Transaction Ref / UTR: ${voucher.referenceNo || 'N/A'}`, 14, 70);

    doc.text(`Beneficiary / Vendor: ${partyName}`, 120, 46);
    doc.text(`Party Type: ${voucher.partyType?.toUpperCase() || 'SUPPLIER'}`, 120, 52);
    doc.text(`Ledger Debit: ${voucher.debitAccount}`, 120, 58);
    doc.text(`Status: ${voucher.status}`, 120, 64);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, 78, 182, 24, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text("TOTAL AMOUNT DISBURSED", 20, 87);
    doc.setFontSize(15);
    doc.setFont("Helvetica", "bold");
    doc.text(`INR ₹${Number(voucher.amount || 0).toLocaleString('en-IN')}`, 20, 96);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Narration / Remarks: ${voucher.narration || 'Commercial procurement settlement payment.'}`, 14, 114);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Authorized Signatory: _______________________", 14, 140);
    doc.text("Vendor Receiver Signature: _______________________", 120, 140);

    doc.save(`Vendor_Payment_${voucher.voucherNo}.pdf`);
    showToast(`Payment receipt ${voucher.voucherNo} downloaded`, 'success');
  };

  // Data Table Columns
  const voucherColumns = [
    { header: 'Voucher No', accessor: 'voucherNo' as keyof Voucher, sortable: true },
    { header: 'Date', accessor: (row: Voucher) => formatDate(row.date) },
    { 
      header: 'Vendor Name', 
      accessor: (row: Voucher) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId || (s as any)._id === row.partyId)?.name || 'Supplier';
        }
        return farmers.find(f => f.id === row.partyId || (f as any)._id === row.partyId)?.name || 'Farmer';
      }
    },
    { 
      header: 'Amount Paid', 
      accessor: (row: Voucher) => (
        <span className="font-extrabold text-xs text-emerald-800">₹{(row.amount || 0).toLocaleString()}</span>
      )
    },
    { header: 'Mode', accessor: 'paymentMode' as keyof Voucher },
    { header: 'Bank / Cash Account', accessor: (row: Voucher) => row.cashBankLink || row.creditAccount || 'Bank A/c' },
    { header: 'Ref / UTR No', accessor: 'referenceNo' as keyof Voucher },
    { 
      header: 'Status', 
      accessor: (row: Voucher) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
          <CheckCircle2 size={11} />
          {row.status || 'Posted'}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: (row: Voucher) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setSelectedVoucher(row)}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
            title="View Voucher"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => handleDownloadVoucherPDF(row)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <Download size={11} className="text-emerald-600" />
            <span>Receipt</span>
          </button>
        </div>
      )
    }
  ];

  const pendingFinalInvoiceColumns = [
    { 
      header: 'Final Invoice No', 
      accessor: (row: PurchaseInvoice) => (
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-900">{row.invoiceNo}</span>
          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">QC Verified</span>
        </div>
      ), 
      sortable: true 
    },
    { header: 'PO Ref', accessor: 'poNumber' as keyof PurchaseInvoice },
    { header: 'QC Ref', accessor: (row: PurchaseInvoice) => row.qcNumber || 'N/A' },
    { 
      header: 'Vendor', 
      accessor: (row: PurchaseInvoice) => {
        if (row.partyType === 'farmer') {
          return farmers.find(f => f.id === row.supplierId || (f as any)._id === row.supplierId)?.name || 'Farmer';
        }
        return suppliers.find(s => s.id === row.supplierId || (s as any)._id === row.supplierId)?.name || 'Supplier';
      }
    },
    { 
      header: 'Settled Grand Total', 
      accessor: (row: PurchaseInvoice) => `₹${(row.grandTotal ?? 0).toLocaleString()}`
    },
    { 
      header: 'Already Paid', 
      accessor: (row: PurchaseInvoice) => `₹${(row.amountPaid ?? 0).toLocaleString()}`
    },
    { 
      header: 'Net Due', 
      accessor: (row: PurchaseInvoice) => (
        <span className="font-extrabold text-xs text-rose-600">
          ₹{(row.remainingAmount !== undefined ? row.remainingAmount : row.grandTotal).toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Action', 
      accessor: (row: PurchaseInvoice) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePayFinalInvoice(row);
          }}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer"
        >
          <Wallet size={12} />
          <span>Pay Vendor</span>
        </button>
      )
    }
  ];

  const pendingPreliminaryInvoiceColumns = [
    { 
      header: 'Prelim Invoice No', 
      accessor: (row: PurchaseInvoice) => (
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-900">{row.invoiceNo}</span>
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded">Preliminary</span>
        </div>
      ), 
      sortable: true 
    },
    { header: 'PO Ref', accessor: 'poNumber' as keyof PurchaseInvoice },
    { 
      header: 'Vendor', 
      accessor: (row: PurchaseInvoice) => {
        if (row.partyType === 'farmer') {
          return farmers.find(f => f.id === row.supplierId || (f as any)._id === row.supplierId)?.name || 'Farmer';
        }
        return suppliers.find(s => s.id === row.supplierId || (s as any)._id === row.supplierId)?.name || 'Supplier';
      }
    },
    { 
      header: 'Billed Total', 
      accessor: (row: PurchaseInvoice) => `₹${(row.grandTotal ?? 0).toLocaleString()}`
    },
    { 
      header: 'Already Paid', 
      accessor: (row: PurchaseInvoice) => `₹${(row.amountPaid ?? 0).toLocaleString()}`
    },
    { 
      header: 'Outstanding Due', 
      accessor: (row: PurchaseInvoice) => (
        <span className="font-extrabold text-xs text-rose-600">
          ₹{(row.remainingAmount !== undefined ? row.remainingAmount : row.grandTotal).toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Action', 
      accessor: (row: PurchaseInvoice) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePayPrelimInvoice(row);
          }}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer"
        >
          <Wallet size={12} />
          <span>Pay Vendor</span>
        </button>
      )
    }
  ];

  const openPOColumns = [
    { header: 'PO Number', accessor: 'poNo' as keyof PurchaseOrder, sortable: true },
    { header: 'Date', accessor: (row: PurchaseOrder) => formatDate(row.date) },
    { 
      header: 'Vendor', 
      accessor: (row: PurchaseOrder) => {
        if (row.partyType === 'farmer') {
          return farmers.find(f => f.id === row.partyId || (f as any)._id === row.partyId)?.name || 'Farmer';
        }
        return suppliers.find(s => s.id === row.partyId || (s as any)._id === row.partyId)?.name || 'Supplier';
      }
    },
    { 
      header: 'PO Grand Total', 
      accessor: (row: PurchaseOrder) => `₹${Number(row.total || (row as any).grandTotal || 0).toLocaleString()}`
    },
    { 
      header: 'Status', 
      accessor: (row: PurchaseOrder) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          {row.status}
        </span>
      )
    },
    { 
      header: 'Action', 
      accessor: (row: PurchaseOrder) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePayPO(row);
          }}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer"
        >
          <Wallet size={12} />
          <span>Pay Advance</span>
        </button>
      )
    }
  ];

  // Available linkable documents filtered by current vendor if selected
  const availableFinalInvoices = useMemo(() => {
    return finalInvoices.filter(inv => {
      const matchParty = !partyId || inv.supplierId === partyId;
      const hasBalance = inv.status !== 'Paid' && (inv.remainingAmount === undefined || inv.remainingAmount > 0);
      return matchParty && hasBalance;
    });
  }, [finalInvoices, partyId]);

  const availablePrelimInvoices = useMemo(() => {
    return preliminaryInvoices.filter(inv => {
      const matchParty = !partyId || inv.supplierId === partyId;
      const hasBalance = inv.status !== 'Paid' && (inv.remainingAmount === undefined || inv.remainingAmount > 0);
      return matchParty && hasBalance;
    });
  }, [preliminaryInvoices, partyId]);

  const availablePOs = useMemo(() => {
    return openPurchaseOrders.filter(po => {
      const matchParty = !partyId || po.partyId === partyId;
      return matchParty;
    });
  }, [openPurchaseOrders, partyId]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment to Vendor</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Procurement Settlements
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Disburse payments to grain suppliers &amp; farmers against verified Final Invoices, Preliminary Invoices, or PO Advances.</p>
        </div>
        <button
          onClick={() => {
            setSelectedDocKey('');
            setPartyId('');
            setAmount(0);
            setReferenceNo('');
            setNarration('');
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Record Vendor Payment</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Final Invoices Due</span>
            <div className="text-xl font-extrabold text-rose-600 mt-1">₹{totalFinalPayableOutstanding.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{pendingFinalInvoices.length} Verified Invoices pending</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Payments Settled</span>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">₹{totalPaymentsSettled.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{paymentVouchers.length} Vouchers recorded</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prelim Invoices Due</span>
            <div className="text-xl font-extrabold text-blue-600 mt-1">₹{totalPrelimPayableOutstanding.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{pendingPreliminaryInvoices.length} Invoices pending</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileSpreadsheet size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Open POs (Advance Link)</span>
            <div className="text-xl font-extrabold text-purple-700 mt-1">{openPurchaseOrders.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Approved &amp; active contracts</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShoppingCart size={20} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('All Payments')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'All Payments'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Payment Vouchers ({paymentVouchers.length})
        </button>
        <button
          onClick={() => setActiveTab('Pending Final Invoices')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'Pending Final Invoices'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Pending Final Invoices ({pendingFinalInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab('Pending Preliminary Invoices')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'Pending Preliminary Invoices'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Pending Preliminary Invoices ({pendingPreliminaryInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab('Open Purchase Orders')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'Open Purchase Orders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Open Purchase Orders ({openPurchaseOrders.length})
        </button>
      </div>

      {/* Main Grid / Tables */}
      {activeTab === 'All Payments' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <DataTable
            columns={voucherColumns}
            data={paymentVouchers}
            onRowClick={row => setSelectedVoucher(row)}
          />
        </div>
      )}

      {activeTab === 'Pending Final Invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <DataTable
            columns={pendingFinalInvoiceColumns}
            data={pendingFinalInvoices}
            onRowClick={row => handlePayFinalInvoice(row)}
          />
        </div>
      )}

      {activeTab === 'Pending Preliminary Invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <DataTable
            columns={pendingPreliminaryInvoiceColumns}
            data={pendingPreliminaryInvoices}
            onRowClick={row => handlePayPrelimInvoice(row)}
          />
        </div>
      )}

      {activeTab === 'Open Purchase Orders' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <DataTable
            columns={openPOColumns}
            data={openPurchaseOrders}
            onRowClick={row => handlePayPO(row)}
          />
        </div>
      )}

      {/* Make Vendor Payment Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Record Payment to Vendor</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Settle balance against linked invoices, purchase orders, or direct on-account payments.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)} 
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              
              {/* Linking Document Selector */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-emerald-600" />
                    <span>Link to Document (Invoice / PO)</span>
                  </label>
                  {selectedDocKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDocKey('');
                        setAmount(0);
                      }}
                      className="text-[10px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear Link
                    </button>
                  )}
                </div>

                <select
                  value={selectedDocKey}
                  onChange={e => handleDocumentSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Direct Payment (No Document Linked / On Account) --</option>
                  
                  {availableFinalInvoices.length > 0 && (
                    <optgroup label="Final Purchase Invoices (Verified QC)">
                      {availableFinalInvoices.map(inv => {
                        const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
                        return (
                          <option key={`final_${inv.id}`} value={`final_inv:${inv.id}`}>
                            Final Invoice: {inv.invoiceNo} (PO: {inv.poNumber || 'N/A'}) &minus; Due: ₹{rem.toLocaleString()}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  {availablePrelimInvoices.length > 0 && (
                    <optgroup label="Preliminary Purchase Invoices (Direct Bills)">
                      {availablePrelimInvoices.map(inv => {
                        const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : inv.grandTotal;
                        return (
                          <option key={`prelim_${inv.id}`} value={`prelim_inv:${inv.id}`}>
                            Prelim Invoice: {inv.invoiceNo} (PO: {inv.poNumber || 'N/A'}) &minus; Due: ₹{rem.toLocaleString()}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  {availablePOs.length > 0 && (
                    <optgroup label="Purchase Orders (Advance / Contract)">
                      {availablePOs.map(po => {
                        const poTotal = Number(po.total || (po as any).grandTotal || 0);
                        return (
                          <option key={`po_${po.id}`} value={`po:${po.id}`}>
                            PO: {po.poNo} &minus; Total: ₹{poTotal.toLocaleString()} ({po.status})
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>

                {/* Linked Document Info Card */}
                {linkedDocInfo && (
                  <div className="mt-2 p-3 bg-white border border-emerald-200 rounded-lg shadow-xs space-y-2 text-xs animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${linkedDocInfo.badgeColor}`}>
                        {linkedDocInfo.type}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">Ref: {linkedDocInfo.docNo}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Amount</span>
                        <span className="font-bold text-slate-800">₹{linkedDocInfo.total.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Paid So Far</span>
                        <span className="font-bold text-slate-600">₹{linkedDocInfo.paid.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Outstanding Net</span>
                        <span className="font-extrabold text-rose-600">₹{linkedDocInfo.remaining.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAmount(linkedDocInfo.remaining)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={11} /> Pay Full Balance (₹{linkedDocInfo.remaining.toLocaleString()})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmount(Math.round(linkedDocInfo.remaining / 2))}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-200 transition cursor-pointer"
                      >
                        Pay 50% (₹{Math.round(linkedDocInfo.remaining / 2).toLocaleString()})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Vendor Type *</label>
                  <select
                    value={partyType}
                    onChange={e => {
                      setPartyType(e.target.value as any);
                      setPartyId('');
                      setSelectedDocKey('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="supplier">Corporate Supplier</option>
                    <option value="farmer">Farmer / Mandi</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Select Vendor *</label>
                  <select
                    value={partyId}
                    onChange={e => handlePartyChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  >
                    <option value="">-- Choose Vendor --</option>
                    {activeParties.map(p => (
                      <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>
                        {p.name} (Balance: ₹{(p.balance || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-extrabold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    value={amount || ''}
                    onChange={e => setAmount(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Payment Date *</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={paymentDate}
                    onChange={val => setPaymentDate(val)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / IMPS</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="Cash">Cash Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Disbursing Account *</label>
                  <select
                    value={cashBankLink}
                    onChange={e => setCashBankLink(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    {paymentMode === 'Cash' ? (
                      <option value="Petty Cash A/c">Petty Cash A/c</option>
                    ) : (
                      <>
                        <option value="HDFC Bank Oper A/c">HDFC Bank Oper A/c</option>
                        <option value="SBI Working Cap A/c">SBI Working Cap A/c</option>
                        <option value="ICICI Current A/c">ICICI Current A/c</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Reference / UTR / Cheque No *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="e.g. UTR-8293849102"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Narration / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none h-16 resize-none"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="Commercial payment settlement notes..."
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 transition cursor-pointer"
                >
                  Confirm &amp; Disburse Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher View Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Receipt size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Payment Voucher: {selectedVoucher.voucherNo}</h3>
                  <p className="text-[10px] text-slate-500">{formatDate(selectedVoucher.date)} &bull; {selectedVoucher.status || 'Posted'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVoucher(null)} 
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Total Disbursed</span>
                  <div className="text-2xl font-black text-emerald-700 mt-0.5">₹{(selectedVoucher.amount || 0).toLocaleString()}</div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                  {selectedVoucher.paymentMode}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-3">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Beneficiary / Vendor</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedVoucher.partyType === 'supplier'
                      ? suppliers.find(s => s.id === selectedVoucher.partyId || (s as any)._id === selectedVoucher.partyId)?.name || 'Supplier'
                      : farmers.find(f => f.id === selectedVoucher.partyId || (f as any)._id === selectedVoucher.partyId)?.name || 'Farmer'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Type: {selectedVoucher.partyType?.toUpperCase()}</span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Disbursed From</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedVoucher.creditAccount || selectedVoucher.cashBankLink || 'Bank A/c'}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Ref: {selectedVoucher.referenceNo || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Narration</span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs">
                  {selectedVoucher.narration || 'Commercial procurement payment voucher.'}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadVoucherPDF(selectedVoucher)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download Voucher PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
