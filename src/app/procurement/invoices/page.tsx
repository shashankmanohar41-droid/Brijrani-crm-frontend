'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import api from '../../../services/axios';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchaseOrder, GRN } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Plus, Landmark, CheckCircle, AlertTriangle, HelpCircle, Download, FileCheck, ArrowRight, ShieldCheck, Edit3, Wallet, Eye, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function PurchaseInvoicesPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Matched' | 'Mismatch' | 'Approved' | 'Paid' | 'Disputed'>('All');

  // Payment tracking states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer');
  const [paymentAccount, setPaymentAccount] = useState<string>('HDFC Bank A/c');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Form states for Invoice Header
  const [invoiceNo, setInvoiceNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [freight, setFreight] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [remarks, setRemarks] = useState('');

  // Form items list
  const [itemsList, setItemsList] = useState<PurchaseInvoiceItem[]>([]);

  // Sourcing master selectors
  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const commodities = db.commodities;

  // Filters POs and GRNs for selector
  const availablePOs = db.purchaseOrders.filter(p => p.status === 'Received' || p.status === 'Partially Received' || p.status === 'Approved');
  const availableGRNs = useMemo(() => {
    if (!poNo) return [];
    const po = db.purchaseOrders.find(p => p.poNo === poNo);
    if (!po) return [];
    return db.grns.filter(g => g.poId === po.id && g.qualityStatus !== 'Pending');
  }, [poNo, db.purchaseOrders, db.grns]);

  // Load PO details when PO selection changes
  const handlePoChange = (selectedPoNo: string) => {
    setPoNo(selectedPoNo);
    setGrnNo('');
    setItemsList([]);
  };

  // Load GRN items and pre-fill invoice item structures when GRN selection changes
  const handleGrnChange = (selectedGrnNo: string) => {
    setGrnNo(selectedGrnNo);
    const po = db.purchaseOrders.find(p => p.poNo === poNo);
    const grn = db.grns.find(g => g.grnNo === selectedGrnNo);

    if (po && grn) {
      const invoiceItems: PurchaseInvoiceItem[] = grn.items.map(grnItem => {
        const poItem = po.items?.find(i => i.item === grnItem.item || String(i.item) === String(grnItem.item));
        const rate = poItem ? poItem.rate : 0;
        const discountAmt = poItem ? poItem.discount : 0;
        const commodity = db.commodities.find(c => 
          c.id === grnItem.item || 
          c._id === grnItem.item || 
          (c.name && poItem?.description && c.name.toLowerCase() === poItem.description.toLowerCase()) || 
          (c.name && typeof grnItem.item === 'string' && c.name.toLowerCase() === grnItem.item.toLowerCase())
        );

        let taxRate = 0;
        if (commodity?.defaultGst !== undefined) {
          taxRate = Number(commodity.defaultGst);
        } else if (poItem?.taxPercent !== undefined) {
          taxRate = Number(poItem.taxPercent);
        }

        const sub = grnItem.acceptedQuantity * rate;
        const taxVal = Math.round(sub * (taxRate / 100));

        return {
          item: grnItem.item,
          poQty: poItem ? poItem.quantity : 0,
          receivedQty: grnItem.acceptedQuantity,
          invoiceQty: grnItem.acceptedQuantity, // Default to accepted qty
          rate: rate,
          discount: discountAmt,
          taxPercent: taxRate,
          taxAmount: taxVal,
          amount: sub + taxVal - discountAmt
        };
      });

      setItemsList(invoiceItems);
      
      // Auto pre-fill header info
      setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 30 days due
      setFreight(po.freight || 0);
      setDiscount(po.discount || 0);
    } else {
      setItemsList([]);
    }
  };

  // Edit quantity or rate inside invoice form
  const handleItemValueChange = (index: number, field: 'invoiceQty' | 'rate' | 'discount' | 'taxPercent', val: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'invoiceQty') item.invoiceQty = val;
      if (field === 'rate') item.rate = val;
      if (field === 'discount') item.discount = val;
      if (field === 'taxPercent') item.taxPercent = Math.max(0, val);

      const sub = (item.invoiceQty || 0) * (item.rate || 0);
      const taxRate = item.taxPercent !== undefined ? item.taxPercent : 0;
      item.taxAmount = Math.round(sub * (taxRate / 100));
      item.amount = sub + item.taxAmount - (item.discount || 0);
      updated[index] = item;
      return updated;
    });
  };

  // Totals calculations
  const subtotal = itemsList.reduce((sum, i) => sum + (i.invoiceQty * i.rate), 0);
  const totalTax = itemsList.reduce((sum, i) => sum + i.taxAmount, 0);
  const totalCharges = Number(freight) + Number(otherCharges);
  const grandTotal = subtotal + totalTax + totalCharges - Number(discount);

  const handleOpenEdit = () => {
    if (!selectedInvoice) return;
    setInvoiceNo(selectedInvoice.invoiceNo);
    setPoNo(selectedInvoice.poNumber);
    setGrnNo(selectedInvoice.grnNumber);
    setDueDate(selectedInvoice.dueDate || '');
    setFreight(selectedInvoice.freight || 0);
    setOtherCharges(selectedInvoice.otherCharges || 0);
    setDiscount(selectedInvoice.discount || 0);
    setRemarks(selectedInvoice.remarks || '');
    setItemsList(selectedInvoice.items || []);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleOpenView = () => {
    if (!selectedInvoice) return;
    setInvoiceNo(selectedInvoice.invoiceNo);
    setPoNo(selectedInvoice.poNumber);
    setGrnNo(selectedInvoice.grnNumber);
    setDueDate(selectedInvoice.dueDate || '');
    setFreight(selectedInvoice.freight || 0);
    setOtherCharges(selectedInvoice.otherCharges || 0);
    setDiscount(selectedInvoice.discount || 0);
    setRemarks(selectedInvoice.remarks || '');
    setItemsList(selectedInvoice.items || []);
    setIsEditMode(false);
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  const handleDeleteInvoice = () => {
    if (!selectedInvoice) return;
    if (!confirm('Are you sure you want to delete this Invoice?')) return;
    erpService.purchaseInvoices.delete(selectedInvoice.id);
    refreshDb();
    setSelectedInvoice(null);
    showToast('Invoice deleted successfully', 'success');
  };

  // Submit invoice
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNo || !poNo || !grnNo || itemsList.length === 0) {
      showToast('Please fill all mandatory fields and configure items', 'error');
      return;
    }

    if (isEditMode && selectedInvoice) {
      const po = db.purchaseOrders.find(p => p.poNo === poNo);
      const grn = db.grns.find(g => g.grnNo === grnNo);
      if (!po || !grn) return;

      const updatedInvoice: PurchaseInvoice = {
        ...selectedInvoice,
        invoiceNo,
        poNumber: poNo,
        grnNumber: grnNo,
        dueDate,
        freight: Number(freight),
        otherCharges: Number(otherCharges),
        discount: Number(discount),
        remarks,
        subtotal,
        grandTotal,
        items: itemsList
      };

      const checkMatch = erpService.verifyThreeWayMatch(updatedInvoice);
      updatedInvoice.status = checkMatch.isMatch ? 'Matched' : 'Mismatch';
      updatedInvoice.mismatchReason = checkMatch.isMatch ? undefined : checkMatch.details.join('; ');

      erpService.purchaseInvoices.update(updatedInvoice);
      refreshDb();
      setIsCreateOpen(false);
      setIsEditMode(false);
      setInvoiceNo('');
      setPoNo('');
      setGrnNo('');
      setItemsList([]);
      setSelectedInvoice(updatedInvoice);
      showToast(`Invoice ${invoiceNo} updated successfully! Status: ${updatedInvoice.status}`, 'success');
      return;
    }

    const po = db.purchaseOrders.find(p => p.poNo === poNo);
    const grn = db.grns.find(g => g.grnNo === grnNo);
    if (!po || !grn) return;

    const id = `INV-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const partyName = po.partyType === 'supplier'
      ? suppliers.find(s => s.id === po.partyId)?.name
      : farmers.find(f => f.id === po.partyId)?.name;

    const supplierGSTIN = po.partyType === 'supplier'
      ? suppliers.find(s => s.id === po.partyId)?.gstin
      : '';

    const newInvoice: PurchaseInvoice = {
      id,
      invoiceNo,
      invoiceDate: date,
      supplierId: po.partyId,
      partyType: po.partyType,
      poNumber: poNo,
      grnNumber: grnNo,
      dueDate,
      paymentTerms: po.paymentTerms || '30 Days',
      supplierGSTIN,
      billingAddress: po.billingAddress || 'Patna Silos Facility',
      shippingAddress: po.shippingAddress || 'Patna Silos Facility',
      taxType: 'GST',
      subtotal,
      discount,
      cgst: Math.round(totalTax / 2),
      sgst: Math.round(totalTax / 2),
      igst: 0,
      freight: Number(freight),
      otherCharges: Number(otherCharges),
      roundOff: 0,
      grandTotal,
      status: 'Pending Verification',
      items: itemsList
    };

    // Run 3-Way Match validation immediately
    const checkMatch = erpService.verifyThreeWayMatch(newInvoice);
    newInvoice.status = checkMatch.isMatch ? 'Matched' : 'Mismatch';
    newInvoice.mismatchReason = checkMatch.isMatch ? undefined : checkMatch.details.join('; ');

    erpService.purchaseInvoices.create(newInvoice);
    refreshDb();
    setIsCreateOpen(false);
    setInvoiceNo('');
    setPoNo('');
    setGrnNo('');
    setItemsList([]);
    setSelectedInvoice(newInvoice);
    showToast(`Invoice ${invoiceNo} logged as ${newInvoice.status}!`, 'success');
  };

  // Accountant Actions
  const handleApproveInvoice = () => {
    if (!selectedInvoice) return;

    const isBackendId = selectedInvoice.id.match(/^[0-9a-fA-F]{24}$/);
    if (!isBackendId) {
      // Local fallback for local draft invoices
      const po = db.purchaseOrders.find(p => p.poNo === selectedInvoice.poNumber);
      if (po) {
        if (selectedInvoice.partyType === 'supplier') {
          const sup = db.suppliers.find(s => s.id === selectedInvoice.supplierId);
          if (sup) sup.balance += selectedInvoice.grandTotal;
        } else {
          const farmer = db.farmers.find(f => f.id === selectedInvoice.supplierId);
          if (farmer) farmer.balance += selectedInvoice.grandTotal;
        }
      }
      const updated = { ...selectedInvoice, status: 'Approved' as const };
      erpService.purchaseInvoices.update(updated);
      refreshDb();
      setSelectedInvoice(updated);
      showToast(`Purchase Invoice ${selectedInvoice.invoiceNo} Approved locally.`, 'success');
      return;
    }

    api.patch(`/procurement/invoices/${selectedInvoice.id}/approve`)
      .then(() => {
        const updated = { ...selectedInvoice, status: 'Approved' as const };
        erpService.purchaseInvoices.update(updated);
        refreshDb();
        setSelectedInvoice(updated);
        showToast(`Purchase Invoice ${selectedInvoice.invoiceNo} Approved permanently.`, 'success');
      })
      .catch(err => {
        console.error('Failed to approve invoice:', err);
        showToast('Failed to approve invoice in backend database', 'error');
      });
  };

  const handleDisputeInvoice = () => {
    if (!selectedInvoice) return;
    const updated = { ...selectedInvoice, status: 'Disputed' as const };
    erpService.purchaseInvoices.update(updated);
    refreshDb();
    setSelectedInvoice(updated);
    showToast(`Invoice marked as Disputed`, 'error');
  };

  // Submit payment tracking record
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const remaining = selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal;
    if (paymentAmount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    if (paymentAmount > remaining) {
      showToast(`Payment amount cannot exceed remaining balance (₹${remaining.toLocaleString()})`, 'error');
      return;
    }

    const currentPaid = selectedInvoice.amountPaid || 0;
    const newPaid = currentPaid + paymentAmount;
    const newRemaining = remaining - paymentAmount;
    const newStatus = newRemaining === 0 ? 'Paid' : 'Partially Paid';

    const newPayment = {
      date: paymentDate,
      reference: paymentReference,
      mode: paymentMode,
      account: paymentAccount,
      amount: paymentAmount,
      notes: paymentNotes
    };

    const updatedInvoice: PurchaseInvoice = {
      ...selectedInvoice,
      amountPaid: newPaid,
      remainingAmount: newRemaining,
      status: newStatus,
      paymentHistory: [...(selectedInvoice.paymentHistory || []), newPayment]
    };

    // Update Invoice in ERP DB
    erpService.purchaseInvoices.update(updatedInvoice);

    // Deduct from supplier / farmer accounts payable balance (Business Rule 9)
    if (selectedInvoice.partyType === 'supplier') {
      const sup = db.suppliers.find(s => s.id === selectedInvoice.supplierId);
      if (sup) {
        sup.balance = Math.max(0, sup.balance - paymentAmount);
        erpService.suppliers.update(sup);
      }
    } else {
      const farmer = db.farmers.find(f => f.id === selectedInvoice.supplierId);
      if (farmer) {
        farmer.balance = Math.max(0, farmer.balance - paymentAmount);
        erpService.farmers.update(farmer);
      }
    }

    // Refresh, close, and reset
    refreshDb();
    setSelectedInvoice(updatedInvoice);
    setIsPaymentModalOpen(false);
    setPaymentAmount(0);
    setPaymentReference('');
    setPaymentNotes('');
    showToast(`Payment of ₹${paymentAmount.toLocaleString()} recorded successfully!`, 'success');
  };

  // Verification results
  const verificationResult = useMemo(() => {
    if (!selectedInvoice) return null;
    return erpService.verifyThreeWayMatch(selectedInvoice);
  }, [selectedInvoice, db]);

  // Tab filter logic
  const filteredInvoices = useMemo(() => {
    if (activeTab === 'All') return db.purchaseInvoices;
    return db.purchaseInvoices.filter(inv => inv.status === activeTab);
  }, [db.purchaseInvoices, activeTab]);

  const columns = [
    { header: 'Invoice Number', accessor: 'invoiceNo' as keyof PurchaseInvoice, sortable: true },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: PurchaseInvoice) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.supplierId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.supplierId)?.name || 'Unknown';
      }
    },
    { header: 'PO Ref', accessor: 'poNumber' as keyof PurchaseInvoice },
    { header: 'GRN Ref', accessor: 'grnNumber' as keyof PurchaseInvoice },
    { header: 'Grand Total', accessor: (row: PurchaseInvoice) => `₹${(row.grandTotal ?? 0).toLocaleString()}` },
    { header: 'Due Date', accessor: 'dueDate' as keyof PurchaseInvoice },
    { 
      header: 'Verification Status', 
      accessor: (row: PurchaseInvoice) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Matched' || row.status === 'Approved' || row.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-200' :
          row.status === 'Mismatch' || row.status === 'Disputed' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  // PDF generator voucher print
  const handleDownloadPDF = (invoice: PurchaseInvoice) => {
    const doc = new jsPDF();
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
    doc.setTextColor(30, 41, 59);
    doc.text("3-WAY MATCH PURCHASE INVOICE VOUCHER", 14, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice No:     ${invoice.invoiceNo}`, 14, 46);
    doc.text(`Invoice Date:   ${formatDate(invoice.invoiceDate)}`, 14, 52);
    doc.text(`Due Date:       ${formatDate(invoice.dueDate)}`, 14, 58);
    doc.text(`PO Number:      ${invoice.poNumber}`, 14, 64);
    doc.text(`GRN Number:     ${invoice.grnNumber}`, 14, 70);
    doc.text(`Match Status:   ${invoice.status}`, 14, 76);

    const supName = invoice.partyType === 'supplier'
      ? suppliers.find(s => s.id === invoice.supplierId)?.name
      : farmers.find(f => f.id === invoice.supplierId)?.name;

    doc.setFont("Helvetica", "bold");
    doc.text("SUPPLIER / SOURCING PARTY:", 14, 88);
    doc.setFont("Helvetica", "normal");
    doc.text(supName || 'Unknown Vendor', 14, 94);
    doc.text(`GSTIN: ${invoice.supplierGSTIN || 'N/A'}`, 14, 100);

    // Items table header
    const tableTop = 112;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Item Details", 16, tableTop + 5.5);
    doc.text("PO Qty", 90, tableTop + 5.5, { align: "right" });
    doc.text("GRN Qty", 115, tableTop + 5.5, { align: "right" });
    doc.text("Billed Qty", 140, tableTop + 5.5, { align: "right" });
    doc.text("Billed Rate", 165, tableTop + 5.5, { align: "right" });
    doc.text("Line Total", 194, tableTop + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    let itemY = tableTop + 14;
    invoice.items.forEach(it => {
      const commName = commodities.find(c => c.id === it.item)?.name || it.item;
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${it.poQty}`, 90, itemY, { align: "right" });
      doc.text(`${it.receivedQty}`, 115, itemY, { align: "right" });
      doc.text(`${it.invoiceQty}`, 140, itemY, { align: "right" });
      doc.text(`₹${it.rate.toLocaleString()}`, 165, itemY, { align: "right" });
      doc.text(`₹${it.amount.toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    doc.line(14, itemY - 3, 196, itemY - 3);

    const summaryX = 135;
    doc.text("Subtotal:", summaryX, itemY + 2);
    doc.text(`₹${invoice.subtotal.toLocaleString()}`, 194, itemY + 2, { align: "right" });
    
    doc.text("Freight charges:", summaryX, itemY + 8);
    doc.text(`₹${invoice.freight.toLocaleString()}`, 194, itemY + 8, { align: "right" });

    doc.text("GST Taxes:", summaryX, itemY + 14);
    doc.text(`₹${(invoice.cgst * 2).toLocaleString()}`, 194, itemY + 14, { align: "right" });

    doc.line(120, itemY + 18, 196, itemY + 18);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Grand Total Pay:", summaryX, itemY + 23);
    doc.text(`₹${invoice.grandTotal.toLocaleString()}`, 194, itemY + 23, { align: "right" });

    doc.save(`purchase_invoice_${invoice.invoiceNo}.pdf`);
    showToast(`Invoice PDF Voucher downloaded.`, 'success');
  };

  if (!['Super Admin', 'Purchase Manager', 'Accountant'].includes(currentUserRole)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto mt-20 space-y-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-lg font-bold">✕</div>
        <h2 className="text-sm font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-400 font-semibold leading-normal">Your account role ({currentUserRole}) does not have permission to access the Purchase Invoices module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Purchase Invoices (3-Way Matching)</h1>
          <p className="text-xs font-medium text-slate-400">Log supplier invoices, run 3-way match audits (PO vs GRN vs Invoice), and verify accounts payable.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setInvoiceNo('');
            setPoNo('');
            setGrnNo('');
            setDueDate('');
            setFreight(0);
            setOtherCharges(0);
            setDiscount(0);
            setRemarks('');
            setIsEditMode(false);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Purchase Invoice</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 rounded-lg gap-1.5">
        {(['All', 'Matched', 'Mismatch', 'Approved', 'Paid', 'Disputed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeTab === tab
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={filteredInvoices}
            columns={columns}
            searchPlaceholder="Search invoice number..."
            searchField="invoiceNo"
            onRowClick={(row) => setSelectedInvoice(row)}
            exportFileName="purchase_invoices_list"
          />
        </div>

        {/* Selected Invoice details */}
        <div>
          {selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedInvoice.invoiceNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Date Billed: {formatDate(selectedInvoice.invoiceDate)}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                  selectedInvoice.status === 'Matched' || selectedInvoice.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
                  selectedInvoice.status === 'Mismatch' || selectedInvoice.status === 'Disputed' ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {selectedInvoice.status.toUpperCase()}
                </span>
              </div>

              {/* 3-Way Match Verification Widget */}
              {verificationResult && (
                <div className={`border rounded-xl p-4 space-y-2.5 ${
                  verificationResult.isMatch 
                    ? 'border-emerald-200 bg-emerald-50/30 text-emerald-800' 
                    : 'border-red-200 bg-red-50/20 text-red-800'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {verificationResult.isMatch ? (
                      <>
                        <ShieldCheck size={15} className="text-emerald-600 animate-pulse" />
                        <span>3-Way Match Verification Passed</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={15} className="text-red-500" />
                        <span>3-Way Match Discrepancy Found</span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] font-medium leading-normal space-y-1">
                    {verificationResult.details.map((warn, idx) => (
                      <div key={idx} className="flex gap-1.5 items-start">
                        <span>•</span>
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Header Info */}
              <div className="space-y-2 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Supplier:</span>
                  <span className="text-slate-800">
                    {selectedInvoice.partyType === 'supplier'
                      ? suppliers.find(s => s.id === selectedInvoice.supplierId)?.name
                      : farmers.find(f => f.id === selectedInvoice.supplierId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PO Link:</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded font-bold">{selectedInvoice.poNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GRN Link:</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded font-bold">{selectedInvoice.grnNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Due Date:</span>
                  <span>{formatDate(selectedInvoice.dueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Terms:</span>
                  <span>{selectedInvoice.paymentTerms}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed Invoice Items</span>
                <div className="space-y-3 max-h-[140px] overflow-y-auto pr-1">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0 space-y-1">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{commodities.find(c => c.id === item.item)?.name || item.item}</span>
                        <span>₹{(item.rate ?? 0).toLocaleString()} / Unit</span>
                      </div>
                      <div className="grid grid-cols-3 text-[10px] font-semibold text-slate-500 leading-tight">
                        <span>PO Ordered: {item.poQty}</span>
                        <span>GRN Accepted: {item.receivedQty}</span>
                        <span className="text-primary-600">Billed: {item.invoiceQty}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between items-center font-bold text-xs text-slate-800">
                  <span>Grand Total Pay:</span>
                  <span>₹{(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Summary */}
              {['Approved', 'Partially Paid', 'Paid'].includes(selectedInvoice.status) && (
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs font-semibold text-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Status</span>
                  <div className="flex justify-between">
                    <span>Total Invoice Amount:</span>
                    <span className="text-slate-800">₹{(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Total Paid:</span>
                    <span>₹{(selectedInvoice.amountPaid ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold border-t border-slate-100 pt-1.5 mt-1.5">
                    <span>Outstanding Balance:</span>
                    <span>₹{(selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Payment History Log */}
              {selectedInvoice.paymentHistory && selectedInvoice.paymentHistory.length > 0 && (
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment History logs</span>
                  <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                    {selectedInvoice.paymentHistory.map((p, idx) => (
                      <div key={idx} className="text-[10px] border-b border-slate-100/50 pb-2 last:border-0 last:pb-0 space-y-0.5 leading-normal font-semibold">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{p.mode} ({p.account})</span>
                          <span className="text-emerald-600 font-extrabold">₹{p.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Ref: {p.reference || 'N/A'}</span>
                          <span>{formatDate(p.date)}</span>
                        </div>
                        {p.notes && <div className="text-slate-400 italic">"{p.notes}"</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenView}
                    className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-slate-600/10 cursor-pointer transition"
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={handleDeleteInvoice}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-755 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
                {(selectedInvoice.status === 'Pending Verification' || selectedInvoice.status === 'Mismatch' || selectedInvoice.status === 'Disputed') && (
                  <button
                    onClick={handleOpenEdit}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition mb-2"
                  >
                    <Edit3 size={14} />
                    <span>Edit Invoice</span>
                  </button>
                )}
                {['Approved', 'Partially Paid'].includes(selectedInvoice.status) && (
                  <button
                    onClick={() => {
                      const remaining = selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal;
                      setPaymentAmount(remaining);
                      setIsPaymentModalOpen(true);
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition mb-2"
                  >
                    <Wallet size={14} />
                    <span>Record Invoice Payment</span>
                  </button>
                )}
                {(selectedInvoice.status === 'Matched' || selectedInvoice.status === 'Mismatch' || selectedInvoice.status === 'Disputed') && currentUserRole === 'Super Admin' && (
                  <div className="flex gap-2 animate-fade-in">
                    <button
                      onClick={handleApproveInvoice}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition shadow-md shadow-emerald-600/10"
                    >
                      <CheckCircle size={14} />
                      <span>Approve Invoice</span>
                    </button>
                    {selectedInvoice.status !== 'Disputed' && (
                      <button
                        onClick={handleDisputeInvoice}
                        className="flex-1 py-2 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <span>Raise Dispute</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download Invoice voucher PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select a Purchase Invoice to verify 3-way match values, approve payables, or export receipts.</span>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Supplier Invoice: ${selectedInvoice?.invoiceNo}` : isViewMode ? `View Supplier Invoice: ${selectedInvoice?.invoiceNo}` : 'Process Supplier Billing Invoice'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify billing parameters received from supplier invoice.' : isViewMode ? 'Detailed view of the billing invoice.' : 'Input billing parameters received from supplier invoice to run 3-way match validation.'}</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); setIsViewMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supplier Invoice Number *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-4589"
                    required
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reference Purchase Order (PO) *</label>
                  <select
                    value={poNo}
                    onChange={e => handlePoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select PO</option>
                    {availablePOs.map(po => (
                      <option key={po.id} value={po.poNo}>{po.poNo} - {po.partyType === 'supplier' ? suppliers.find(s => s.id === po.partyId)?.name : farmers.find(f => f.id === po.partyId)?.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reference Inward GRN *</label>
                  <select
                    value={grnNo}
                    onChange={e => handleGrnChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select GRN</option>
                    {availableGRNs.map(g => (
                      <option key={g.id} value={g.grnNo}>{g.grnNo} (Accepted: {g.acceptedQty} MT)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Invoice Due Date *</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={dueDate}
                    onChange={val => setDueDate(val)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight Transport (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={freight || ''}
                    onChange={e => setFreight(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Other charges (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={otherCharges || ''}
                    onChange={e => setOtherCharges(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Items grid */}
              {itemsList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Configure billed quantities & unit rates</span>
                  
                  <div className="space-y-3 font-semibold text-xs text-slate-700">
                    {itemsList.map((item, idx) => {
                      const comm = commodities.find(c => c.id === item.item || c._id === item.item || c.name.toLowerCase() === (item.item || '').toLowerCase());
                      const baseSub = (item.invoiceQty || 0) * (item.rate || 0);
                      return (
                        <div key={idx} className="bg-white p-3.5 border border-slate-100 rounded-lg space-y-3 shadow-xs">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{comm?.name || item.item}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                item.taxPercent === 0 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                Base GST: {item.taxPercent || 0}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold space-x-2">
                              <span>PO Ordered: {item.poQty}</span>
                              <span>GRN Passed QC: {item.receivedQty}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-4">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Billed quantity *</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                                value={item.invoiceQty || ''}
                                onChange={e => handleItemValueChange(idx, 'invoiceQty', Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Billed rate (₹) *</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                                value={item.rate || ''}
                                onChange={e => handleItemValueChange(idx, 'rate', Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">GST Rate (%)</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                                value={item.taxPercent !== undefined ? item.taxPercent : 0}
                                onChange={e => handleItemValueChange(idx, 'taxPercent', Number(e.target.value))}
                              />
                            </div>
                            <div className="col-span-3 text-right">
                              <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Subtotal (with GST)</span>
                              <span className="font-extrabold text-slate-800 block text-xs">₹{(item.amount ?? 0).toLocaleString()}</span>
                              {item.taxAmount > 0 && (
                                <span className="text-[9px] text-slate-400 font-medium">(Base: ₹{baseSub.toLocaleString()} + Tax: ₹{item.taxAmount.toLocaleString()})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order total preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Billed Grand Total</span>
                  <span className="text-sm font-bold text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base Items: ₹{subtotal.toLocaleString()}</span> <br />
                  <span>Freight Transport: ₹{totalCharges.toLocaleString()}</span> <br />
                  <span>GST Taxes ({itemsList.length > 0 ? Array.from(new Set(itemsList.map(i => i.taxPercent))).map(t => `${t}%`).join(', ') : '5%'}): ₹{totalTax.toLocaleString()}</span>
                </div>
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                {isViewMode ? (
                  <button
                    type="button"
                    onClick={() => { setIsCreateOpen(false); setIsViewMode(false); }}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-md"
                  >
                    Close View
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setIsCreateOpen(false); setIsEditMode(false); }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                    >
                      Verify & Log Invoice
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Record Outgoing Payment</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Log voucher payment against invoice {selectedInvoice.invoiceNo}.</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Outstanding Balance</label>
                <div className="text-sm font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                  ₹{(selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal).toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Amount Paid (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                    max={selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Date *</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                    value={paymentDate}
                    onChange={val => setPaymentDate(val)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                    required
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank / Cash Account *</label>
                  <select
                    value={paymentAccount}
                    onChange={e => setPaymentAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                    required
                  >
                    {paymentMode === 'Cash' ? (
                      <option value="Petty Cash">Petty Cash</option>
                    ) : (
                      <>
                        <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                        <option value="SBI Account">SBI Account</option>
                        <option value="ICICI Current A/c">ICICI Current A/c</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transaction Ref / Cheque No *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="e.g. TXN-928301"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Notes / Narration</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none h-16 resize-none"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Payment remarks..."
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 transition"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
