'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo, useEffect } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { PurchaseQuotation, PurchaseQuotationItem, PurchaseOrder, PurchaseOrderItem } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileSpreadsheet, Plus, HelpCircle, FileCheck, ArrowDown, Download, Info, GitCompare, Edit3, CheckCircle, Eye, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function PurchaseQuotationsPage() {
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const [selectedPQ, setSelectedPQ] = useState<PurchaseQuotation | null>(null);
  
  // Sourcing tab: 'List' or 'Comparison'
  const [activeTab, setActiveTab] = useState<'list' | 'compare'>('list');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [pqFilter, setpqFilter] = useState<string>('All');

  // Sourcing Comparison states
  const [compareEnquiryNo, setCompareEnquiryNo] = useState('');

  // Form states for Header
  const [quotationNo, setQuotationNo] = useState('');
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [partyId, setPartyId] = useState('');
  const [referenceEnquiry, setReferenceEnquiry] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [deliveryDays, setDeliveryDays] = useState(5);
  const [freight, setFreight] = useState(0);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [remarks, setRemarks] = useState('');

  // Form states for item rates
  const [itemsList, setItemsList] = useState<PurchaseQuotationItem[]>([]);
  // We can also have negotiated rates per supplier in comparison view
  const [negotiatedRates, setNegotiatedRates] = useState<Record<string, number>>({});

  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const commodities = db.commodities;
  const enquiries = useMemo(() => {
    return (db.purchaseEnquiries || []).filter(e => {
      const validStatus = e.status === 'Draft' || (e.status as string) === 'Approved';
      if (!validStatus) return false;
      // Exclude enquiries that already have an active quotation
      const hasQuotation = db.purchaseQuotations.some(pq => 
        (pq.enquiryNo === e.enquiryNo || (pq as any).referenceEnquiry === e.enquiryNo) && pq.status !== 'Rejected'
      );
      return !hasQuotation;
    });
  }, [db.purchaseEnquiries, db.purchaseQuotations]);

  // Load items from reference enquiry when selected
  useEffect(() => {
    if (referenceEnquiry) {
      const enquiry = db.purchaseEnquiries.find(e => e.enquiryNo === referenceEnquiry);
      if (enquiry) {
        const mappedItems: PurchaseQuotationItem[] = enquiry.items.map(item => {
          const commodity = db.commodities.find(c => c.id === item.item || c._id === item.item);
          const gstRate = commodity?.defaultGst !== undefined ? commodity.defaultGst : 5;
          return {
            item: item.item,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.estimatedRate,
            discount: 0,
            taxPercent: gstRate,
            taxAmount: Math.round(item.estimatedAmount * (gstRate / 100)),
            lineTotal: Math.round(item.estimatedAmount * (1 + gstRate / 100)),
            deliveryDate: item.requiredDate
          };
        });
        setItemsList(mappedItems);
        setWarehouseId(enquiry.warehouseId);
      }
    } else {
      setItemsList([]);
    }
  }, [referenceEnquiry, db.purchaseEnquiries]);

  const [warehouseId, setWarehouseId] = useState('WH-001');

  // Handle single item price update in the creation form
  const handleItemRateChange = (index: number, newRate: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = updated[index];
      item.rate = newRate;
      const discount = item.discount || 0;
      const taxable = Math.max(0, (item.quantity * newRate) - discount);
      item.taxAmount = Math.round(taxable * (item.taxPercent / 100));
      item.lineTotal = Math.round(taxable + item.taxAmount);
      return updated;
    });
  };

  const handleItemDiscountChange = (index: number, newDiscount: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = updated[index];
      item.discount = newDiscount;
      const taxable = Math.max(0, (item.quantity * item.rate) - newDiscount);
      item.taxAmount = Math.round(taxable * (item.taxPercent / 100));
      item.lineTotal = Math.round(taxable + item.taxAmount);
      return updated;
    });
  };

  // Calculate totals
  const subtotal = itemsList.reduce((sum, i) => sum + (i.quantity * i.rate), 0);
  const totalTax = itemsList.reduce((sum, i) => sum + i.taxAmount, 0);
  const extraCharges = Number(freight);
  const grandTotal = subtotal + totalTax + extraCharges - Number(headerDiscount);

  const handleOpenEdit = () => {
    if (!selectedPQ) return;
    setQuotationNo(selectedPQ.quotationNo);
    setPartyType(selectedPQ.partyType);
    setPartyId(selectedPQ.partyId);
    setReferenceEnquiry(selectedPQ.enquiryNo || '');
    setPaymentTerms(selectedPQ.paymentTerms || '30 Days');
    setDeliveryDays(selectedPQ.deliveryDays || 5);
    setFreight(selectedPQ.freight || 0);
    setHeaderDiscount(selectedPQ.discount || 0);
    setValidUntil(selectedPQ.validUntil || '');
    setRemarks(selectedPQ.remarks || '');
    setItemsList(selectedPQ.items || []);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleOpenView = () => {
    if (!selectedPQ) return;
    setQuotationNo(selectedPQ.quotationNo);
    setPartyType(selectedPQ.partyType);
    setPartyId(selectedPQ.partyId);
    setReferenceEnquiry(selectedPQ.enquiryNo || '');
    setPaymentTerms(selectedPQ.paymentTerms || '30 Days');
    setDeliveryDays(selectedPQ.deliveryDays || 5);
    setFreight(selectedPQ.freight || 0);
    setHeaderDiscount(selectedPQ.discount || 0);
    setValidUntil(selectedPQ.validUntil || '');
    setRemarks(selectedPQ.remarks || '');
    setItemsList(selectedPQ.items || []);
    setIsEditMode(false);
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  const handleDeletePQ = () => {
    if (!selectedPQ) return;
    if (!confirm('Are you sure you want to delete this quotation?')) return;
    erpService.purchaseQuotations.delete(selectedPQ.id);
    refreshDb();
    setSelectedPQ(null);
    showToast('Purchase Quotation deleted successfully', 'success');
  };

  // Submit quotation
  const handleCreatePQ = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !quotationNo) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    if (isEditMode && selectedPQ) {
      const updatedPQ: PurchaseQuotation = {
        ...selectedPQ,
        quotationNo,
        enquiryNo: referenceEnquiry || undefined,
        partyType,
        partyId,
        validUntil: validUntil || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentTerms,
        deliveryDays: Number(deliveryDays),
        freight: Number(freight),
        discount: Number(headerDiscount),
        tax: totalTax,
        grandTotal,
        remarks,
        items: itemsList,
        commodityId: itemsList[0]?.item || '',
        quantity: itemsList.reduce((sum, i) => sum + i.quantity, 0),
        rate: itemsList[0]?.rate || 0,
        transportCost: Number(freight),
        total: grandTotal
      };
      erpService.purchaseQuotations.update(updatedPQ);
      
      // Update enquiry status to RFQ Created if linked
      if (referenceEnquiry) {
        const enquiry = db.purchaseEnquiries.find(e => e.enquiryNo === referenceEnquiry);
        if (enquiry && enquiry.status === 'Approved') {
          enquiry.status = 'RFQ Created';
          erpService.purchaseEnquiries.update(enquiry);
        }
      }

      refreshDb();
      setIsCreateOpen(false);
      setIsEditMode(false);
      setSelectedPQ(updatedPQ);
      setQuotationNo('');
      setReferenceEnquiry('');
      setRemarks('');
      showToast(`Quotation ${quotationNo} updated successfully!`, 'success');
      return;
    }

    const id = `PQ-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const firstItem = itemsList[0];

    const newPQ: PurchaseQuotation = {
      id,
      quotationNo,
      enquiryNo: referenceEnquiry || undefined,
      date,
      partyType,
      partyId,
      validUntil: validUntil || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms,
      deliveryDays: Number(deliveryDays),
      freight: Number(freight),
      discount: Number(headerDiscount),
      tax: totalTax,
      grandTotal,
      remarks,
      status: 'Received',
      items: itemsList,
      // Fallbacks
      commodityId: firstItem?.item || '',
      quantity: itemsList.reduce((sum, i) => sum + i.quantity, 0),
      rate: firstItem?.rate || 0,
      transportCost: Number(freight),
      loadingCost: 0,
      otherCharges: 0,
      gstPercent: 5,
      total: grandTotal
    };

    erpService.purchaseQuotations.create(newPQ);
    
    // Update enquiry status to RFQ Created if linked
    if (referenceEnquiry) {
      const enquiry = db.purchaseEnquiries.find(e => e.enquiryNo === referenceEnquiry);
      if (enquiry && enquiry.status === 'Approved') {
        enquiry.status = 'RFQ Created';
        erpService.purchaseEnquiries.update(enquiry);
      }
    }

    refreshDb();
    setIsCreateOpen(false);
    setSelectedPQ(newPQ);
    setQuotationNo('');
    setReferenceEnquiry('');
    setRemarks('');
    showToast(`Quotation ${quotationNo} logged successfully!`, 'success');
  };

  // Convert to PO helper
  const handleConvertPO = (pq: PurchaseQuotation, finalRates?: Record<string, number>) => {
    const poNo = `PO-2026-${String(db.purchaseOrders.length + 1).padStart(4, '0')}`;
    const id = `PO-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const poItems: PurchaseOrderItem[] = pq.items.map(item => {
      // Use negotiated rate if provided
      const finalRate = finalRates && finalRates[item.item] ? finalRates[item.item] : item.rate;
      const amt = item.quantity * finalRate;
      const taxAmt = Math.round(amt * (item.taxPercent / 100));
      return {
        item: item.item,
        description: item.description || commodities.find(c => c.id === item.item)?.name || 'Commodity',
        quantity: item.quantity,
        unit: item.unit,
        rate: finalRate,
        discount: item.discount,
        taxPercent: item.taxPercent,
        taxAmount: taxAmt,
        amount: amt + taxAmt - item.discount,
        expectedDelivery: item.deliveryDate
      };
    });

    const sub = poItems.reduce((sum, i) => sum + (i.quantity * i.rate), 0);
    const tax = poItems.reduce((sum, i) => sum + i.taxAmount, 0);
    const finalTotal = sub + tax + pq.freight - pq.discount;

    const needsApproval = finalTotal >= 500000; // Manager limit check
    const status = needsApproval ? 'Pending Approval' : 'Approved';

    const newPO: PurchaseOrder = {
      id,
      poNo,
      quotationNo: pq.quotationNo,
      referenceQuotation: pq.quotationNo,
      date,
      partyType: pq.partyType,
      partyId: pq.partyId,
      expectedDelivery: pq.validUntil,
      paymentTerms: pq.paymentTerms,
      currency: 'INR',
      buyer: 'Purchasing Department',
      department: 'Purchase',
      freight: pq.freight,
      otherCharges: 0,
      discount: pq.discount,
      tax,
      total: finalTotal,
      status,
      notes: pq.remarks,
      items: poItems,
      approvalHistory: [
        { step: 'Creation', user: 'Purchasing Agent', action: 'Created', date }
      ],
      // Fallbacks
      commodityId: pq.commodityId,
      quantity: pq.quantity,
      rate: poItems[0]?.rate || 0,
      transportCost: pq.freight,
      gstPercent: 5,
      warehouseId: warehouseId || 'WH-001'
    };

    erpService.purchaseOrders.create(newPO);
    
    // Mark Quotation as Converted
    pq.status = 'Converted';
    erpService.purchaseQuotations.update(pq);

    // If quotation has reference enquiry, close the enquiry
    if (pq.enquiryNo) {
      const enquiry = db.purchaseEnquiries.find(e => e.enquiryNo === pq.enquiryNo);
      if (enquiry) {
        enquiry.status = 'Closed';
        erpService.purchaseEnquiries.update(enquiry);
      }
    }

    refreshDb();
    showToast(`Quotation approved and converted to Purchase Order ${poNo}!`, 'success');
    router.push('/procurement/orders');
  };

  const handleDownloadPDF = (quote: PurchaseQuotation) => {
    const doc = new jsPDF();

    // Fonts and Branding
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    // Subtitle
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 25);
    doc.text("Email: procurement@brijranierp.com | Phone: +91 9988776655", 14, 29);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("SUPPLIER PRICE QUOTATION SLIP", 14, 42);

    // Metadata
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Quotation No:   ${quote.quotationNo}`, 14, 50);
    doc.text(`Date Received:  ${formatDate(quote.date)}`, 14, 56);
    doc.text(`Valid Until:    ${formatDate(quote.validUntil)}`, 14, 62);
    doc.text(`Ref Enquiry No: ${quote.enquiryNo || 'N/A'}`, 14, 68);
    doc.text(`Doc Status:     ${quote.status}`, 14, 74);

    const vendorName = quote.partyType === 'supplier'
      ? suppliers.find(s => s.id === quote.partyId)?.name
      : farmers.find(f => f.id === quote.partyId)?.name;
    const vendorGSTIN = quote.partyType === 'supplier'
      ? suppliers.find(s => s.id === quote.partyId)?.gstin
      : 'Farmer (URP)';

    // Vendor Block
    doc.setFont("Helvetica", "bold");
    doc.text("SUPPLIER / SOURCING VENDOR DETAILS:", 14, 86);
    doc.setFont("Helvetica", "normal");
    doc.text(vendorName || 'Unknown Vendor', 14, 92);
    doc.text(`GSTIN: ${vendorGSTIN || 'N/A'}`, 14, 98);

    // Items table header
    const tableTop = 108;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Sourced Commodity", 16, tableTop + 5.5);
    doc.text("Quantity", 90, tableTop + 5.5, { align: "right" });
    doc.text("Offered Rate", 125, tableTop + 5.5, { align: "right" });
    doc.text("Discount", 150, tableTop + 5.5, { align: "right" });
    doc.text("Line Total", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Item rows
    let itemY = tableTop + 14;
    (quote.items || []).forEach(item => {
      const commName = commodities.find(c => c.id === item.item)?.name || 'Commodity';
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${item.quantity} ${item.unit}`, 90, itemY, { align: "right" });
      doc.text(`₹${(item.rate ?? 0).toLocaleString()} / ${item.unit}`, 125, itemY, { align: "right" });
      doc.text(`₹${(item.discount ?? 0).toLocaleString()}`, 150, itemY, { align: "right" });
      doc.text(`₹${(item.lineTotal ?? 0).toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    // Summary block
    doc.line(14, itemY - 3, 196, itemY - 3);

    const summaryX = 135;
    const baseValue = (quote.items || []).reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    doc.text("Base Value:", summaryX, itemY + 2);
    doc.text(`₹${baseValue.toLocaleString()}`, 194, itemY + 2, { align: "right" });

    doc.text("Freight & Loading:", summaryX, itemY + 8);
    doc.text(`₹${(quote.freight ?? 0).toLocaleString()}`, 194, itemY + 8, { align: "right" });

    if (quote.discount > 0) {
      doc.text("Discount:", summaryX, itemY + 14);
      doc.text(`-₹${(quote.discount ?? 0).toLocaleString()}`, 194, itemY + 14, { align: "right" });
    }

    doc.text("Taxes:", summaryX, itemY + 20);
    doc.text(`₹${(quote.tax ?? 0).toLocaleString()}`, 194, itemY + 20, { align: "right" });

    // Grand total
    doc.line(120, itemY + 24, 196, itemY + 24);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Grand Total:", summaryX, itemY + 29);
    doc.text(`₹${(quote.grandTotal ?? 0).toLocaleString()}`, 194, itemY + 29, { align: "right" });

    // Terms
    let termsY = itemY + 45;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COMMERCIAL TERMS:", 14, termsY);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment Terms: ${quote.paymentTerms || 'Standard Terms'}`, 14, termsY + 6);
    doc.text(`Delivery Time: ${quote.deliveryDays || 5} Days`, 14, termsY + 12);
    if (quote.remarks) {
      doc.text(`Remarks: ${quote.remarks}`, 14, termsY + 18);
    }

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an electronically generated purchase quotation record. BrijRani Agro Foods ERP.", 14, 280);

    doc.save(`purchase_quotation_${quote.quotationNo.replace(/\//g, '_')}.pdf`);
    showToast(`Quotation PDF downloaded successfully!`, 'success');
  };

  // Sourcing Comparison Logic
  const quotationsForComparison = useMemo(() => {
    if (!compareEnquiryNo) return [];
    return db.purchaseQuotations.filter(q => q.enquiryNo === compareEnquiryNo);
  }, [db.purchaseQuotations, compareEnquiryNo]);

  const recommendedQuotation = useMemo(() => {
    if (quotationsForComparison.length === 0) return null;
    return [...quotationsForComparison].sort((a, b) => a.grandTotal - b.grandTotal)[0];
  }, [quotationsForComparison]);

  const pqFilterTabs = [
    { label: 'All', value: 'All' },
    { label: 'Under Review', value: 'Under Review' },
    { label: 'Selected', value: 'Selected' },
    { label: 'Converted', value: 'Converted' },
    { label: 'Rejected', value: 'Rejected' },
  ];

  const filteredPQs = useMemo(() => {
    if (pqFilter === 'All') return db.purchaseQuotations;
    return db.purchaseQuotations.filter(q => q.status === pqFilter);
  }, [db.purchaseQuotations, pqFilter]);

  const columns = [
    { header: 'Quotation No', accessor: 'quotationNo' as keyof PurchaseQuotation, sortable: true },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: PurchaseQuotation) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { header: 'Ref Enquiry', accessor: 'enquiryNo' as keyof PurchaseQuotation },
    { header: 'Validity', accessor: 'validUntil' as keyof PurchaseQuotation },
    { header: 'Payment Terms', accessor: 'paymentTerms' as keyof PurchaseQuotation },
    { header: 'Grand Value', accessor: (row: PurchaseQuotation) => `₹${(row.grandTotal ?? 0).toLocaleString()}` },
    { 
      header: 'Status', 
      accessor: (row: PurchaseQuotation) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Converted' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Selected' ? 'bg-green-50 text-green-600 border-green-200' :
          row.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  if (!['Super Admin', 'Purchase Manager'].includes(currentUserRole)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto mt-20 space-y-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-lg font-bold">✕</div>
        <h2 className="text-sm font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-400 font-semibold leading-normal">Your account role ({currentUserRole}) does not have permission to access the Supplier Quotations module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Supplier Quotations</h1>
          <p className="text-xs font-medium text-slate-400">Record supplier responses, run price-comparison matrices, and convert approved quotes to official Purchase Orders.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setQuotationNo('');
            setReferenceEnquiry('');
            setRemarks('');
            setPaymentTerms('30 Days');
            setDeliveryDays(5);
            setFreight(0);
            setHeaderDiscount(0);
            setValidUntil('');
            setPartyId('');
            setIsEditMode(false);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record Supplier Quote</span>
        </button>
      </div>

      {/* Sourcing Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 rounded-lg gap-1.5">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'list'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Quotations Archive</span>
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'compare'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <GitCompare size={14} />
          <span>Quotation Comparison</span>
        </button>
      </div>

      {activeTab === 'list' ? (
        /* Archive View */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-3">
            {/* Status Filter Tabs */}
            <div className="bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1 flex-wrap">
              {pqFilterTabs.map(tab => {
                const count = tab.value === 'All'
                  ? db.purchaseQuotations.length
                  : db.purchaseQuotations.filter(q => q.status === tab.value).length;
                const isActive = pqFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setpqFilter(tab.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-slate-800 border border-slate-200 shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && !isActive && (
                      <span className="ml-1 text-[10px] text-slate-400">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            <DataTable
              data={filteredPQs}
              columns={columns}
              searchPlaceholder="Search quotations..."
              searchField="quotationNo"
              onRowClick={(row) => setSelectedPQ(row)}
              exportFileName="purchase_quotations_list"
            />
          </div>

          {/* Details Drawer */}
          <div>
            {selectedPQ ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{selectedPQ.quotationNo}</h3>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Date Received: {formatDate(selectedPQ.date)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 block">₹{(selectedPQ.grandTotal ?? 0).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-400 block font-semibold">Taxes: ₹{(selectedPQ.tax ?? 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Sourcing details */}
                <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Supplier:</span>
                    <span className="text-slate-800">
                      {selectedPQ.partyType === 'supplier' 
                        ? suppliers.find(s => s.id === selectedPQ.partyId)?.name 
                        : farmers.find(f => f.id === selectedPQ.partyId)?.name}
                    </span>
                  </div>
                  {selectedPQ.enquiryNo && (
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">Ref Enquiry:</span>
                      <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded font-bold">{selectedPQ.enquiryNo}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Validity:</span>
                    <span>{formatDate(selectedPQ.validUntil)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Payment Terms:</span>
                    <span>{selectedPQ.paymentTerms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivery Lead-Time:</span>
                    <span>{selectedPQ.deliveryDays} Days</span>
                  </div>
                </div>

                {/* Sourced Items Card */}
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Items & Rates</span>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {(selectedPQ.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100/50 pb-2 last:border-0 last:pb-0">
                        <div>
                          <span className="font-bold text-slate-800 block">
                            {commodities.find(c => c.id === item.item)?.name || 'Commodity'}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Rate: ₹{(item.rate ?? 0).toLocaleString()} / {item.unit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-700 block">{item.quantity} {item.unit}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">₹{(item.lineTotal ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-slate-100 pt-2.5 space-y-1 text-[11px] font-medium text-slate-500">
                    <div className="flex justify-between">
                      <span>Freight Charges:</span>
                      <span>₹{(selectedPQ.freight ?? 0).toLocaleString()}</span>
                    </div>
                    {selectedPQ.discount > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>Discount:</span>
                        <span>-₹{(selectedPQ.discount ?? 0).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-100/30">
                      <span>Grand Total Value:</span>
                      <span>₹{(selectedPQ.grandTotal ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Conversion Buttons */}
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
                      onClick={handleDeletePQ}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-750 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                  {selectedPQ.status !== 'Converted' && (
                    <button
                      onClick={handleOpenEdit}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition mb-2"
                    >
                      <Edit3 size={14} />
                      <span>Edit Quotation</span>
                    </button>
                  )}
                  {selectedPQ.status !== 'Converted' ? (
                    <button
                      onClick={() => handleConvertPO(selectedPQ)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                    >
                      <FileCheck size={14} />
                      <span>Convert to Purchase Order (PO)</span>
                    </button>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[10px] text-slate-400 font-semibold leading-normal">
                      ✅ Already approved and converted to Purchase Order.
                    </div>
                  )}

                  <button
                    onClick={() => handleDownloadPDF(selectedPQ)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Download size={14} className="text-red-500" />
                    <span>Download Quotation PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
                <FileSpreadsheet size={24} className="text-slate-300" />
                <span>Select a Sourcing Quotation to view detailed item rates and convert to PO.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Comparison Sourcing Matrix */
        <div className="space-y-6">
          {/* Enquiry Select Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Sourcing Reference Enquiry:</span>
              <select
                value={compareEnquiryNo}
                onChange={e => {
                  setCompareEnquiryNo(e.target.value);
                  setNegotiatedRates({});
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-bold focus:outline-none"
              >
                <option value="">-- Choose Approved Enquiry --</option>
                {db.purchaseEnquiries.map(pe => (
                  <option key={pe.id} value={pe.enquiryNo}>{pe.enquiryNo} - {pe.department} ({pe.items.length} Items)</option>
                ))}
              </select>
            </div>

            {compareEnquiryNo && quotationsForComparison.length === 0 && (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-semibold">
                ⚠️ No suppliers have submitted quotations against enquiry {compareEnquiryNo} yet. Go to Enquiries to dispatch RFQs, or log quotations.
              </div>
            )}
          </div>

          {compareEnquiryNo && quotationsForComparison.length > 0 && (
            <div className="space-y-6">
              {/* Sourcing Summary Alert */}
              {recommendedQuotation && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center text-xs text-emerald-800 font-semibold">
                  <div className="space-y-1">
                    <span className="font-extrabold flex items-center gap-1">
                      <CheckCircle size={14} className="text-emerald-600 animate-pulse" /> Sourcing Recommendation Engine
                    </span>
                    <p className="font-medium text-emerald-700">
                      The best price is offered by <span className="font-extrabold">
                        {recommendedQuotation.partyType === 'supplier'
                          ? suppliers.find(s => s.id === recommendedQuotation.partyId)?.name
                          : farmers.find(f => f.id === recommendedQuotation.partyId)?.name}
                      </span> at a Grand Total of <span className="font-extrabold text-emerald-800">₹{recommendedQuotation.grandTotal.toLocaleString()}</span>.
                    </p>
                  </div>
                  <button
                    onClick={() => handleConvertPO(recommendedQuotation)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition"
                  >
                    Accept recommended quote
                  </button>
                </div>
              )}

              {/* Sourcing Comparison Grid Matrix */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-xs text-left text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                      <th className="px-4 py-3">Supplier / terms</th>
                      {quotationsForComparison.map(q => {
                        const name = q.partyType === 'supplier'
                          ? suppliers.find(s => s.id === q.partyId)?.name
                          : farmers.find(f => f.id === q.partyId)?.name;
                        const isCheapest = recommendedQuotation && recommendedQuotation.id === q.id;
                        return (
                          <th key={q.id} className={`px-4 py-3 border-l border-slate-100 ${isCheapest ? 'bg-emerald-50/40 text-emerald-950 font-extrabold' : ''}`}>
                            <div className="flex flex-col">
                              <span>{name}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{q.quotationNo}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-bold text-slate-500">Delivery Speed</td>
                      {quotationsForComparison.map(q => (
                        <td key={q.id} className="px-4 py-2.5 border-l border-slate-100 font-semibold">{q.deliveryDays} Days</td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-bold text-slate-500">Payment Conditions</td>
                      {quotationsForComparison.map(q => (
                        <td key={q.id} className="px-4 py-2.5 border-l border-slate-100 font-semibold">{q.paymentTerms}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-bold text-slate-500">Freight Transport</td>
                      {quotationsForComparison.map(q => (
                        <td key={q.id} className="px-4 py-2.5 border-l border-slate-100">₹{q.freight.toLocaleString()}</td>
                      ))}
                    </tr>
                    
                    {/* Header item rates comparison */}
                    <tr className="bg-slate-50/50 border-b border-slate-200 font-extrabold text-slate-500">
                      <td className="px-4 py-2">Item rate comparison</td>
                      {quotationsForComparison.map(q => (
                        <td key={q.id} className="px-4 py-2 border-l border-slate-100"></td>
                      ))}
                    </tr>

                    {/* Loop over enquiry items */}
                    {db.purchaseEnquiries.find(e => e.enquiryNo === compareEnquiryNo)?.items.map(enqItem => {
                      const comm = commodities.find(c => c.id === enqItem.item);
                      return (
                        <tr key={enqItem.item} className="border-b border-slate-100">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-800 block">{comm?.name || enqItem.description}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Qty Required: {enqItem.quantity} {enqItem.unit}</span>
                          </td>
                          {quotationsForComparison.map(q => {
                            const qItem = q.items.find(i => i.item === enqItem.item);
                            const negotiatedVal = negotiatedRates[`${q.id}-${enqItem.item}`];
                            return (
                              <td key={q.id} className="px-4 py-3 border-l border-slate-100">
                                {qItem ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                      <span>₹{(negotiatedVal !== undefined ? negotiatedVal : qItem.rate).toLocaleString()}</span>
                                      <span className="text-[10px] text-slate-400 font-normal">/ {qItem.unit}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                      <span>Original Rate: ₹{qItem.rate}</span>
                                    </div>
                                    <div className="flex items-center gap-1 pt-1">
                                      <Edit3 size={10} className="text-slate-400" />
                                      <input
                                        type="number"
                                        placeholder="Negotiate"
                                        className="w-16 px-1 py-0.5 border border-slate-200 rounded text-[9px] focus:outline-none"
                                        value={negotiatedVal || ''}
                                        onChange={e => {
                                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                                          setNegotiatedRates(prev => ({
                                            ...prev,
                                            [`${q.id}-${enqItem.item}`]: val as any
                                          }));
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-red-500 font-semibold italic text-[10px]">No bid offered</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                      <td className="px-4 py-3 text-sm">Grand Sourced Value</td>
                      {quotationsForComparison.map(q => {
                        // Calculate grand total incorporating negotiated rates
                        const isCheapest = recommendedQuotation && recommendedQuotation.id === q.id;
                        let customGrand = q.grandTotal;
                        let negDiff = 0;
                        q.items.forEach(it => {
                          const negVal = negotiatedRates[`${q.id}-${it.item}`];
                          if (negVal !== undefined) {
                            negDiff += (negVal - it.rate) * it.quantity;
                          }
                        });
                        customGrand = Math.round(customGrand + negDiff * 1.05); // including GST difference

                        return (
                          <td key={q.id} className={`px-4 py-3 border-l border-slate-100 text-sm font-extrabold ${isCheapest ? 'text-emerald-700 bg-emerald-50/40' : ''}`}>
                            <span className="block">₹{customGrand.toLocaleString()}</span>
                            {negDiff !== 0 && (
                              <span className="text-[9px] text-indigo-500 font-semibold block pt-0.5">Negotiated Draft</span>
                            )}
                            <button
                              onClick={() => {
                                // Compile negotiated rates map for this supplier
                                const finalRates: Record<string, number> = {};
                                q.items.forEach(it => {
                                  const neg = negotiatedRates[`${q.id}-${it.item}`];
                                  finalRates[it.item] = neg !== undefined ? neg : it.rate;
                                });
                                handleConvertPO(q, finalRates);
                              }}
                              className="mt-2 flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded cursor-pointer transition shadow shadow-indigo-600/10"
                            >
                              <FileCheck size={10} />
                              <span>Select Supplier</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Quotation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Supplier Quote: ${selectedPQ?.quotationNo}` : isViewMode ? `View Supplier Quote: ${selectedPQ?.quotationNo}` : 'Log Supplier Price Offer (Quotation)'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify logged quotation details, payment terms, or rates.' : isViewMode ? 'Detailed view of the price quotation.' : 'Record bid rates and credit terms received from suppliers.'}</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); setIsViewMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreatePQ} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quotation Number Reference *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={quotationNo}
                    onChange={e => setQuotationNo(e.target.value)}
                    placeholder="e.g. SUP-A-458"
                    required
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Link Reference Enquiry</label>
                  <select
                    value={referenceEnquiry}
                    onChange={e => setReferenceEnquiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    disabled={isViewMode}
                  >
                    <option value="">No Enquiry Link (Ad-hoc)</option>
                    {enquiries.map(pe => (
                      <option key={pe.id} value={pe.enquiryNo}>{pe.enquiryNo} - {pe.department}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supplier / Sourcing Partner *</label>
                  <select
                    value={partyId}
                    onChange={e => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                    disabled={isViewMode}
                  >
                    <option value="">Select Partner</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Supplier)</option>
                    ))}
                    {farmers.map(f => (
                      <option key={f.id} value={f.id}>{f.name} (Farmer)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Offer Valid Until *</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={validUntil}
                    onChange={val => setValidUntil(val)}
                    required
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Terms</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    placeholder="e.g. 30 Days"
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight Transport (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={freight || ''}
                    onChange={e => setFreight(Number(e.target.value))}
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Speed (Days)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={deliveryDays}
                    onChange={e => setDeliveryDays(Number(e.target.value))}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Sourced Items list */}
              {itemsList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Item rates submitted by supplier</span>
                  
                  <div className="space-y-3">
                    {itemsList.map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-center bg-white p-3 border border-slate-100 rounded-lg">
                        <div className="flex-1">
                          <span className="font-bold text-slate-800 text-xs block">
                            {commodities.find(c => c.id === item.item)?.name || 'Commodity'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Qty: {item.quantity} {item.unit} | Need date: {formatDate(item.deliveryDate)}
                          </span>
                        </div>
                        <div className="w-28">
                          <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Rate / {item.unit} *</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold"
                            value={item.rate || ''}
                            onChange={e => handleItemRateChange(idx, Number(e.target.value))}
                            required
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Line discount (₹)</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
                            value={item.discount || ''}
                            onChange={e => handleItemDiscountChange(idx, Number(e.target.value))}
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">Line Total</span>
                          <span className="font-extrabold text-slate-700 text-xs">₹{item.lineTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order total preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Estimated Grand Total</span>
                  <span className="text-sm font-bold text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base Items: ₹{subtotal.toLocaleString()}</span> <br />
                  <span>Freight Transport: ₹{extraCharges.toLocaleString()}</span> <br />
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
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 cursor-pointer transition"
                    >
                      Save Supplier Offer
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
