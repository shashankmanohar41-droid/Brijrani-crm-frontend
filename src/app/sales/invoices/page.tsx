'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { SalesInvoice, SalesInvoiceItem, SalesOrder, DeliveryChallan } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { 
  Layers, FileText, IndianRupee, Printer, CheckCircle, Plus, Download, 
  FlaskConical, Truck, Wallet, ShieldCheck, Eye, Trash2, Edit3, Clock,
  Building2, Handshake, CheckCircle2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

function SalesInvoicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Payment receipt recording state (Post-Outward)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptMode, setReceiptMode] = useState<string>('Bank Transfer');
  const [receiptAccount, setReceiptAccount] = useState<string>('HDFC Bank Collection A/c');
  const [receiptRef, setReceiptRef] = useState<string>('');
  const [receiptNotes, setReceiptNotes] = useState<string>('');

  // Form states
  const [soId, setSoId] = useState('');
  const [soNo, setSoNo] = useState('');
  const [orderType, setOrderType] = useState<'GT' | 'WH'>('WH');
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [freight, setFreight] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Check URL query parameters for auto-creating invoice from SO
  const soQueryParam = searchParams.get('so');
  const actionQueryParam = searchParams.get('action');

  const customers = db.customers;
  const commodities = db.commodities;
  const approvedSOs = useMemo(() => {
    return (db.salesOrders || []).filter(s => {
      const validStatus = s.status === 'Approved' || s.status === 'Packing' || s.status === 'Shipped' || s.status === 'Completed';
      if (!validStatus) return false;

      // Allow linked SO if viewing or editing the current invoice
      if (selectedInvoice && (selectedInvoice.soId === s.id || selectedInvoice.soNo === s.soNo)) {
        return true;
      }

      // Exclude SOs that already have an active (non-cancelled) Sales Invoice
      const hasInvoice = (db.salesInvoices || []).some(inv => 
        (inv.soId === s.id || inv.soNo === s.soNo) && (inv as any).status !== 'Cancelled'
      );
      if (hasInvoice) return false;

      return true;
    });
  }, [db.salesOrders, db.salesInvoices, selectedInvoice]);

  // Prepopulate form when Sales Order is selected
  const handleSelectSO = (selectedSoId: string) => {
    setSoId(selectedSoId);
    if (!selectedSoId) {
      setSoNo('');
      return;
    }
    const so = db.salesOrders.find(s => s.id === selectedSoId || s.soNo === selectedSoId);
    if (so) {
      setSoNo(so.soNo);
      setOrderType(so.orderType || 'WH');
      setCustomerId(so.customerId);
      setCommodityId(so.commodityId);
      setQuantity(so.quantity);
      setRate(so.rate);
      setFreight(so.freightCost || 0);
      setDiscountAmount(0);
      setRemarks(`Billed against Sales Order ${so.soNo} (${so.orderType === 'GT' ? 'General Trade' : 'Warehouse Sourced'})`);
    }
  };

  useEffect(() => {
    if (soQueryParam) {
      handleSelectSO(soQueryParam);
      setIsCreateOpen(true);
    } else if (actionQueryParam === 'new') {
      setIsCreateOpen(true);
    }
  }, [soQueryParam, actionQueryParam, db.salesOrders]);

  // Compute totals
  const subtotal = quantity * rate;
  const taxable = Math.max(0, subtotal - Number(discountAmount));
  const comm = commodities.find(c => c.id === commodityId);
  const gstRate = comm?.defaultGst !== undefined ? comm.defaultGst : 5;
  const cgst = Math.round(taxable * (gstRate / 2) / 100);
  const sgst = Math.round(taxable * (gstRate / 2) / 100);
  const igst = 0;
  const grandTotal = taxable + cgst + sgst + igst + Number(freight) + Number(otherCharges);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId || quantity <= 0) {
      showToast('Please fill all mandatory fields (Customer, Commodity, Quantity)', 'error');
      return;
    }

    const selectedCust = customers.find(c => c.id === customerId);
    if (!selectedCust) return;

    const selectedCmd = commodities.find(c => c.id === commodityId);
    if (!selectedCmd) return;

    const invoiceNo = `INV/BR/2026-27/${String(db.salesInvoices.length + 1).padStart(3, '0')}`;
    const id = `INV-${Date.now()}`;
    const invoiceDate = new Date().toISOString().split('T')[0];

    const invoiceItem: SalesInvoiceItem = {
      commodityId,
      hsn: selectedCmd.hsn || '10019910',
      quantity,
      rate,
      baseRate: rate,
      discount: Number(discountAmount),
      taxableAmount: taxable,
      cgst,
      sgst,
      igst,
      total: taxable + cgst + sgst + igst
    };

    const newInvoice: SalesInvoice = {
      id,
      invoiceNo,
      invoiceDate,
      soId: soId || undefined,
      soNo: soNo || (soId ? db.salesOrders.find(s => s.id === soId)?.soNo : undefined),
      orderType,
      customerId,
      gstin: selectedCust.gstin || '10MOCKGSTIN123Z',
      billingAddress: selectedCust.address || 'Patna Facility',
      shippingAddress: selectedCust.address || 'Patna Facility',
      items: [invoiceItem],
      taxableAmount: taxable,
      baseSubtotal: subtotal,
      cgst,
      sgst,
      igst,
      freight: Number(freight),
      otherCharges: Number(otherCharges),
      grandTotal,
      dueDate,
      paymentStatus: 'Unpaid',
      remarks
    };

    erpService.salesInvoices.create(newInvoice);

    // Update customer outstanding receivable balance
    selectedCust.balance = (selectedCust.balance || 0) + grandTotal;
    erpService.customers.update(selectedCust);

    refreshDb();
    setIsCreateOpen(false);
    setSelectedInvoice(newInvoice);
    showToast(`Commercial Sales Invoice ${invoiceNo} generated directly from SO ${soNo || 'Direct'}!`, 'success');
  };

  // Find linked documents for selected invoice
  const linkedSO = useMemo(() => {
    if (!selectedInvoice) return null;
    return db.salesOrders.find(s => s.id === selectedInvoice.soId || s.soNo === selectedInvoice.soNo) || null;
  }, [selectedInvoice, db.salesOrders]);

  const linkedQC = useMemo(() => {
    if (!selectedInvoice) return null;
    const qcList = (db as any).salesQcList || db.qualityInspections || [];
    return qcList.find((q: any) => 
      q.invoiceId === selectedInvoice.id || 
      q.invoiceNo === selectedInvoice.invoiceNo || 
      (selectedInvoice.soNo && (q.soNumber === selectedInvoice.soNo || q.referenceNumber === selectedInvoice.soNo))
    ) || null;
  }, [selectedInvoice, db]);

  const linkedDC = useMemo(() => {
    if (!selectedInvoice) return null;
    return db.deliveryChallans.find(d => 
      d.invoiceId === selectedInvoice.id || 
      d.invoiceNo === selectedInvoice.invoiceNo || 
      (selectedInvoice.soNo && d.soNo === selectedInvoice.soNo)
    ) || null;
  }, [selectedInvoice, db.deliveryChallans]);

  const isOutwardDone = useMemo(() => {
    if (!linkedDC) return false;
    return linkedDC.outwardStatus === 'Completed' || linkedDC.status === 'Dispatched' || linkedDC.status === 'Delivered' || linkedDC.status === 'Completed';
  }, [linkedDC]);

  // Record customer payment collection (Post-Outward)
  const handleRecordReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || receiptAmount <= 0) {
      showToast('Please enter a valid receipt amount', 'error');
      return;
    }

    const currentPaid = selectedInvoice.amountPaid || 0;
    const remaining = selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal;

    if (receiptAmount > remaining) {
      showToast(`Receipt amount cannot exceed remaining balance (₹${remaining.toLocaleString()})`, 'error');
      return;
    }

    const newPaid = currentPaid + receiptAmount;
    const newRemaining = remaining - receiptAmount;
    const newStatus = newRemaining === 0 ? 'Paid' : 'Partially Paid';

    const newPaymentLog = {
      date: receiptDate,
      reference: receiptRef || `REC-${Date.now().toString().slice(-6)}`,
      mode: receiptMode,
      account: receiptAccount,
      amount: receiptAmount,
      notes: receiptNotes
    };

    const updatedInvoice: SalesInvoice = {
      ...selectedInvoice,
      amountPaid: newPaid,
      remainingAmount: newRemaining,
      paymentStatus: newStatus,
      paymentHistory: [...(selectedInvoice.paymentHistory || []), newPaymentLog]
    };

    erpService.salesInvoices.update(updatedInvoice);

    // Deduct from customer receivable balance
    const cust = db.customers.find(c => c.id === selectedInvoice.customerId);
    if (cust) {
      cust.balance = Math.max(0, cust.balance - receiptAmount);
      erpService.customers.update(cust);
    }

    // Automatically post Receipt Voucher to Finance (/finance/receipts & /finance/ledger)
    erpService.postVoucher({
      voucherType: 'Receipt',
      date: receiptDate,
      referenceNo: selectedInvoice.invoiceNo,
      partyId: selectedInvoice.customerId,
      partyType: 'customer',
      amount: receiptAmount,
      paymentMode: receiptMode as any,
      cashBankLink: receiptAccount,
      debitAccount: receiptAccount,
      creditAccount: `${cust?.name || 'Customer'} Accounts Receivable`,
      narration: `Customer payment received for Sales Invoice ${selectedInvoice.invoiceNo} (SO Ref: ${selectedInvoice.soNo || 'N/A'})${receiptNotes ? ' - ' + receiptNotes : ''}`
    }, currentUserRole);

    refreshDb();
    setSelectedInvoice(updatedInvoice);
    setIsReceiptModalOpen(false);
    setReceiptAmount(0);
    setReceiptRef('');
    setReceiptNotes('');
    showToast(`Payment receipt of ₹${receiptAmount.toLocaleString()} recorded & posted to Finance Module!`, 'success');
  };

  const handleDownloadPDF = (invoice: SalesInvoice) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 25);
    doc.text("Email: sales@brijrani.com | Phone: +91 9988776655 | GSTIN: 10AABCB1234F1Z8", 14, 30);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 35, 196, 35);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("TAX INVOICE (COMMERCIAL SALE)", 14, 45);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice No:     ${invoice.invoiceNo}`, 14, 53);
    doc.text(`Invoice Date:   ${formatDate(invoice.invoiceDate)}`, 14, 59);
    doc.text(`SO Ref:         ${invoice.soNo || 'N/A (Direct)'}`, 14, 65);
    doc.text(`Trade Type:     ${invoice.orderType === 'GT' ? 'GT (General Trade)' : 'WH (Warehouse Sourced)'}`, 14, 71);
    doc.text(`Due Date:       ${formatDate(invoice.dueDate)}`, 14, 77);
    doc.text(`Status:         ${invoice.paymentStatus}`, 14, 83);

    const cust = customers.find(c => c.id === invoice.customerId);
    doc.setFont("Helvetica", "bold");
    doc.text("BILLED TO (CUSTOMER):", 110, 53);
    doc.setFont("Helvetica", "normal");
    doc.text(cust?.name || 'Customer Name', 110, 59);
    doc.text(`GSTIN: ${invoice.gstin || cust?.gstin || 'N/A'}`, 110, 65);
    doc.text(`Address: ${invoice.billingAddress || 'Patna Facility'}`, 110, 71);

    const tableTop = 95;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Product Commodity", 16, tableTop + 5.5);
    doc.text("Qty", 85, tableTop + 5.5, { align: "right" });
    doc.text("Rate / MT", 115, tableTop + 5.5, { align: "right" });
    doc.text("Taxable Val", 150, tableTop + 5.5, { align: "right" });
    doc.text("Line Total", 194, tableTop + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    let itemY = tableTop + 14;
    invoice.items.forEach(it => {
      const commName = commodities.find(c => c.id === it.commodityId)?.name || 'Commodity';
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${it.quantity} MT`, 85, itemY, { align: "right" });
      doc.text(`₹${it.rate.toLocaleString()}`, 115, itemY, { align: "right" });
      doc.text(`₹${it.taxableAmount.toLocaleString()}`, 150, itemY, { align: "right" });
      doc.text(`₹${it.total.toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    doc.line(14, itemY - 2, 196, itemY - 2);

    const summaryX = 130;
    doc.text("Taxable Subtotal:", summaryX, itemY + 4);
    doc.text(`₹${invoice.taxableAmount.toLocaleString()}`, 194, itemY + 4, { align: "right" });

    if (invoice.cgst > 0) {
      doc.text("CGST (2.5%):", summaryX, itemY + 10);
      doc.text(`₹${invoice.cgst.toLocaleString()}`, 194, itemY + 10, { align: "right" });
    }
    if (invoice.sgst > 0) {
      doc.text("SGST (2.5%):", summaryX, itemY + 16);
      doc.text(`₹${invoice.sgst.toLocaleString()}`, 194, itemY + 16, { align: "right" });
    }
    if (invoice.freight > 0) {
      doc.text("Freight charges:", summaryX, itemY + 22);
      doc.text(`₹${invoice.freight.toLocaleString()}`, 194, itemY + 22, { align: "right" });
    }

    doc.line(120, itemY + 26, 196, itemY + 26);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Grand Total:", summaryX, itemY + 31);
    doc.text(`₹${invoice.grandTotal.toLocaleString()}`, 194, itemY + 31, { align: "right" });

    doc.save(`sales_invoice_${invoice.invoiceNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    showToast(`Sales Invoice PDF exported successfully`, 'success');
  };

  const filteredInvoices = statusFilter === 'All'
    ? db.salesInvoices
    : db.salesInvoices.filter(i => i.paymentStatus === statusFilter);

  const columns: any[] = [
    { header: 'Invoice No', accessor: 'invoiceNo' as keyof SalesInvoice, sortable: true },
    { 
      header: 'Trade Mode', 
      accessor: (row: SalesInvoice) => (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          row.orderType === 'GT' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          {row.orderType === 'GT' ? 'GT' : 'WH'}
        </span>
      )
    },
    { 
      header: 'Sales Order (SO)', 
      accessor: (row: SalesInvoice) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.soNo || '-'}</span>
      )
    },
    { 
      header: 'Customer', 
      accessor: (row: SalesInvoice) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Grand Total', 
      accessor: (row: SalesInvoice) => `₹${row.grandTotal.toLocaleString()}`
    },
    { header: 'Due Date', accessor: (row: SalesInvoice) => formatDate(row.dueDate) },
    { 
      header: 'Status', 
      accessor: (row: SalesInvoice) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.paymentStatus === 'Partially Paid' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          row.paymentStatus === 'Overdue' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
        }`}>
          {row.paymentStatus}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Invoices (From Sales Orders)</h1>
          <p className="text-xs font-medium text-slate-400">Generate tax-compliant commercial invoices linked directly to approved Sales Orders (SO). Payments are received post-outward dispatch.</p>
        </div>
        <button
          onClick={() => {
            setSoId('');
            setSoNo('');
            setCustomerId('');
            setCommodityId('');
            setQuantity(0);
            setRate(0);
            setFreight(0);
            setDiscountAmount(0);
            setRemarks('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Sales Invoice</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Unpaid', 'Partially Paid', 'Paid'].map(status => {
              const count = status === 'All' 
                ? db.salesInvoices.length 
                : db.salesInvoices.filter(i => i.paymentStatus === status).length;
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
            data={filteredInvoices}
            columns={columns}
            searchPlaceholder="Search invoice number or customer..."
            searchField="invoiceNo"
            onRowClick={(row) => setSelectedInvoice(row)}
            exportFileName="sales_invoices_register"
          />
        </div>

        {/* Invoice details drawer */}
        <div>
          {selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedInvoice.invoiceNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Dated: {formatDate(selectedInvoice.invoiceDate)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{selectedInvoice.grandTotal.toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block mt-0.5 ${
                    selectedInvoice.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    selectedInvoice.paymentStatus === 'Partially Paid' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {selectedInvoice.paymentStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Header Details */}
              <div className="space-y-2 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-slate-800 font-bold">{customers.find(c => c.id === selectedInvoice.customerId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sales Order (SO):</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold">{selectedInvoice.soNo || 'Direct Invoice'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trade Channel:</span>
                  <span>{selectedInvoice.orderType === 'GT' ? 'GT (General Trade)' : 'WH (Warehouse Sourced)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Due Date:</span>
                  <span>{formatDate(selectedInvoice.dueDate)}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-150 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed Products</span>
                {selectedInvoice.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-semibold">
                    <div>
                      <span className="font-bold text-slate-800 block">{commodities.find(c => c.id === it.commodityId)?.name || 'Commodity'}</span>
                      <span className="text-[10px] text-slate-400">{it.quantity} MT @ ₹{it.rate.toLocaleString()}/MT</span>
                    </div>
                    <span className="font-bold text-slate-800">₹{it.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Payment Summary */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs font-semibold text-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Collection</span>
                  <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${
                    selectedInvoice.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                    isOutwardDone ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedInvoice.paymentStatus === 'Paid' ? 'Fully Collected' : isOutwardDone ? 'Ready for Collection' : 'Awaiting Outward'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Billed:</span>
                  <span className="text-slate-800 font-bold">₹{selectedInvoice.grandTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Total Received:</span>
                  <span>₹{(selectedInvoice.amountPaid || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold border-t border-slate-100 pt-1 mt-1">
                  <span>Balance Receivable:</span>
                  <span>₹{(selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {/* Post-Outward Payment Rule */}
                {!isOutwardDone ? (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Clock size={15} className="text-amber-600 shrink-0" />
                      <span>Collection Locked: Gate Outward (GRN) Pending</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-normal font-medium">
                      As per standard sales protocol, customer payment collection is recorded <strong>after Gate Outward (Delivery Challan) dispatch</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => router.push(`/sales/qc?action=new&so=${selectedInvoice.soNo}&invoice=${selectedInvoice.id}`)}
                        className="py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                      >
                        <FlaskConical size={13} />
                        <span>Sales QC (Step 2)</span>
                      </button>
                      <button
                        onClick={() => router.push(`/sales/delivery-challans?action=new&so=${selectedInvoice.soNo}&invoice=${selectedInvoice.id}`)}
                        className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                      >
                        <Truck size={13} />
                        <span>Gate Outward (Step 3)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 font-medium flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span><strong>Gate Outward Dispatched ({linkedDC?.dcNo || 'Done'}):</strong> Cargo on route. Payment collection unlocked.</span>
                    </div>
                    {selectedInvoice.paymentStatus !== 'Paid' ? (
                      <button
                        onClick={() => {
                          const remaining = selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal;
                          setReceiptAmount(remaining);
                          setIsReceiptModalOpen(true);
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                      >
                        <Wallet size={14} />
                        <span>Receive Customer Payment (Post-Outward)</span>
                      </button>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center text-xs font-bold text-blue-800 flex items-center justify-center gap-1.5">
                        <CheckCircle size={14} className="text-blue-600" />
                        <span>Customer Paid in Full (Account Settled)</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download Sales Invoice PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select a Sales Invoice to inspect line items, record payment collections, or download PDF vouchers.</span>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Process Commercial Sales Invoice (From Sales Order)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Select approved Sales Order (SO) to auto-populate customer details, commodity, rate, and terms.</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Sales Order Reference (SO) *</label>
                  <select
                    value={soId}
                    onChange={e => handleSelectSO(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="">Select Sales Order (or Direct Invoice)</option>
                    {approvedSOs.map(s => {
                      const custName = customers.find(c => c.id === s.customerId)?.name || 'Customer';
                      return (
                        <option key={s.id} value={s.id}>
                          {s.soNo} - {custName} ({s.quantity} MT @ ₹{s.rate.toLocaleString()}) [{s.orderType || 'WH'}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer / Buyer *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    value={quantity || ''}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rate / MT (₹) *</label>
                  <input
                    type="number"
                    value={rate || ''}
                    onChange={e => setRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight (₹)</label>
                  <input
                    type="number"
                    value={freight || ''}
                    onChange={e => setFreight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={discountAmount || ''}
                    onChange={e => setDiscountAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Due Date *</label>
                  <IndianDateInput
                    value={dueDate}
                    onChange={val => setDueDate(val)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              {/* Total calculation preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Grand Total Payable</span>
                  <span className="text-base font-extrabold text-emerald-700">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-500 leading-normal">
                  <span>Taxable Subtotal: ₹{taxable.toLocaleString()}</span> <br />
                  <span>GST Taxes (5%): ₹{(cgst + sgst).toLocaleString()}</span> <br />
                  <span>Freight: ₹{Number(freight).toLocaleString()}</span>
                </div>
              </div>

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
                  Confirm & Log Sales Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Customer Payment Receipt Modal */}
      {isReceiptModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Receive Customer Payment (Post-Outward)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Post payment receipt voucher against invoice {selectedInvoice.invoiceNo}.</p>
              </div>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleRecordReceipt} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Outstanding Balance</label>
                <div className="text-sm font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                  ₹{(selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal).toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Receipt Amount (₹) *</label>
                  <input
                    type="number"
                    value={receiptAmount || ''}
                    onChange={e => setReceiptAmount(Number(e.target.value))}
                    max={selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal}
                    min={1}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Receipt Date *</label>
                  <IndianDateInput
                    value={receiptDate}
                    onChange={val => setReceiptDate(val)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Mode *</label>
                  <select
                    value={receiptMode}
                    onChange={e => setReceiptMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                    required
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash Receipt</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank / Cash Account *</label>
                  <select
                    value={receiptAccount}
                    onChange={e => setReceiptAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                    required
                  >
                    <option value="HDFC Bank Collection A/c">HDFC Bank Collection A/c</option>
                    <option value="SBI Current A/c">SBI Current A/c</option>
                    <option value="ICICI Bank A/c">ICICI Bank A/c</option>
                    <option value="Petty Cash A/c">Petty Cash A/c</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transaction Ref / UTR *</label>
                <input
                  type="text"
                  value={receiptRef}
                  onChange={e => setReceiptRef(e.target.value)}
                  placeholder="e.g. UTR-998822"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 transition"
                >
                  Submit Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesInvoicesPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <SalesInvoicesPageContent />
    </React.Suspense>
  );
}
