'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import api from '../../../services/axios';
import { 
  FileText, ShieldAlert, CheckCircle2, Clock, 
  Plus, Search, ArrowRight, User, Package, Scale,
  Warehouse, ArrowUpRight, DollarSign, Printer, ListFilter,
  Check, Play, CreditCard, XCircle, Eye, Trash2, Sparkles,
  RefreshCw, AlertTriangle, ShieldCheck, FileSpreadsheet, Download, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function PurchaseReturnsPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const [returns, setReturns] = useState<any[]>([]);
  const [qis, setQis] = useState<any[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'All Returns' | 'QC Rejections' | 'Inward GRNs' | 'Invoices'>('All Returns');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Form states for Logging Return Request
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  
  // Selected Linked Document Key: 'qc:<id>', 'grn:<id>', 'inv:<id>', or ''
  const [selectedDocKey, setSelectedDocKey] = useState('');

  const [returnType, setReturnType] = useState<'Full' | 'Partial' | 'Quality'>('Quality');
  const [reason, setReason] = useState('Quality Rejection');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Item Details
  const [selectedCommodityId, setSelectedCommodityId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [selectedBinId, setSelectedBinId] = useState('');
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returnRate, setReturnRate] = useState<number>(0); // Rate per Quintal
  const [gstPercent, setGstPercent] = useState<number>(5);

  const suppliers = db.suppliers || [];
  const farmers = db.farmers || [];
  const activeParties = partyType === 'supplier' ? suppliers : farmers;
  const commodities = db.commodities || [];
  const warehouses = db.warehouses || [];
  const bins = db.bins || [];

  const loadReturnsData = async () => {
    try {
      const res = await api.get('/procurement/purchase-returns');
      if (res.data?.success) setReturns(res.data.data);

      const qisRes = await api.get('/procurement/quality-inspections');
      if (qisRes.data?.success) setQis(qisRes.data.data);
    } catch (err) {
      console.error('Failed to load purchase returns:', err);
    }
  };

  useEffect(() => {
    loadReturnsData();
  }, []);

  // Filtered QC inspections that have quality rejections or rejected quantities
  const qcRejections = useMemo(() => {
    const list = qis.length > 0 ? qis : (db.qualityInspections || []);
    return list.filter(q => 
      q.decision === 'REJECT' || 
      q.decision === 'PARTIAL ACCEPT' || 
      q.decision === 'HOLD' ||
      (q.rejectedQuantity && q.rejectedQuantity > 0) ||
      (q.items && q.items.some((it: any) => it.status === 'Rejected' || it.grade === 'Rejected'))
    );
  }, [qis, db.qualityInspections]);

  // Calculations for active form
  const subtotal = useMemo(() => {
    return Number(((returnQty * returnRate) / 100).toFixed(2));
  }, [returnQty, returnRate]);

  const tax = useMemo(() => {
    return Number(((subtotal * gstPercent) / 100).toFixed(2));
  }, [subtotal, gstPercent]);

  const grandTotal = useMemo(() => {
    return Number((subtotal + tax).toFixed(2));
  }, [subtotal, tax]);

  // Lookup selected linked document details for modal preview card
  const linkedDocInfo = useMemo(() => {
    if (!selectedDocKey) return null;
    const [docType, docId] = selectedDocKey.split(':');

    if (docType === 'qc') {
      const qc = (qis.length > 0 ? qis : (db.qualityInspections || [])).find((q: any) => (q.id === docId || q._id === docId || q.qcNo === docId));
      if (!qc) return null;
      return {
        type: 'Quality Inspection (Rejection)',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
        docNo: qc.qcNo || 'QC Doc',
        grnNo: qc.grnNo || 'N/A',
        poNo: qc.poNo || 'N/A',
        receivedQty: qc.receivedQuantity || qc.quantity || 0,
        rejectedQty: qc.rejectedQuantity || qc.damagedQuantity || 0,
        decision: qc.decision || 'REJECT',
        date: qc.date,
        raw: qc
      };
    }

    if (docType === 'grn') {
      const grn = (db.grns || []).find(g => g.id === docId || g._id === docId || g.grnNo === docId);
      if (!grn) return null;
      const grnItem = grn.items?.[0];
      const rejQty = (grnItem as any)?.rejectedQuantity || (grnItem as any)?.rejectedQty || grn.rejectedQty || 0;
      return {
        type: 'Inward Goods Receipt (GRN)',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
        docNo: grn.grnNo,
        grnNo: grn.grnNo,
        poNo: grn.poNo || 'N/A',
        receivedQty: grnItem?.receivedNow || grn.weight || 0,
        rejectedQty: rejQty,
        decision: grn.qualityStatus || 'Pending',
        date: grn.date || grn.arrivalDate,
        raw: grn
      };
    }

    if (docType === 'inv') {
      const inv = (db.purchaseInvoices || []).find(i => i.id === docId || i.invoiceNo === docId);
      if (!inv) return null;
      const invItem = inv.items?.[0];
      return {
        type: 'Purchase Invoice (Debit)',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        docNo: inv.invoiceNo,
        grnNo: inv.grnNumber || 'N/A',
        poNo: inv.poNumber || 'N/A',
        receivedQty: invItem?.invoiceQty || 0,
        rejectedQty: 0,
        decision: inv.status,
        date: inv.invoiceDate,
        raw: inv
      };
    }

    return null;
  }, [selectedDocKey, qis, db.qualityInspections, db.grns, db.purchaseInvoices]);

  // Handle Document Selection in Create Form
  const handleDocumentSelect = (key: string) => {
    setSelectedDocKey(key);
    if (!key) {
      setReturnQty(0);
      setReturnRate(0);
      return;
    }

    const [docType, docId] = key.split(':');

    if (docType === 'qc') {
      const qc = (qis.length > 0 ? qis : (db.qualityInspections || [])).find((q: any) => (q.id === docId || q._id === docId || q.qcNo === docId));
      if (qc) {
        setPartyType(qc.partyType === 'farmer' ? 'farmer' : 'supplier');
        setSupplierId(qc.partyId || '');
        setReturnType('Quality');
        setReason('Quality Rejection');

        const rejQty = qc.rejectedQuantity || qc.damagedQuantity || (qc.receivedQuantity ? Math.round(qc.receivedQuantity * 0.1) : 0);
        setReturnQty(rejQty);

        const grn = (db.grns || []).find(g => g.grnNo === qc.grnNo || g.id === qc.grnId || g._id === qc.grnId);
        if (grn) {
          setWarehouseId(grn.warehouseId || (warehouses[0]?.id || ''));
          const grnItem = grn.items?.[0];
          if (grnItem) {
            setSelectedCommodityId(grnItem.item);
            setBatchNo(grnItem.batchNo || `LOT-${grn.grnNo}`);
            
            const matchingBin = bins.find(b => String(b.allowedCommodityId) === String(grnItem.item));
            setSelectedBinId(matchingBin?.id || bins[0]?.id || 'BIN-001');
          }
        }

        const po = (db.purchaseOrders || []).find(p => p.poNo === qc.poNo || p.id === qc.poId);
        if (po) {
          const poItem = po.items?.[0];
          setReturnRate(poItem?.rate || 2500);
        } else {
          setReturnRate(qc.basePrice || qc.finalPrice || 2500);
        }

        setRemarks(`Return initiated against Quality Inspection ${qc.qcNo || 'QC'} (GRN: ${qc.grnNo || 'N/A'}, PO: ${qc.poNo || 'N/A'}). Policy Decision: ${qc.decision || 'REJECT'}. Notes: ${qc.notes || 'Specifications out of limits.'}`);
      }
    } else if (docType === 'grn') {
      const grn = (db.grns || []).find(g => g.id === docId || g._id === docId || g.grnNo === docId);
      if (grn) {
        setPartyType(grn.partyType === 'farmer' ? 'farmer' : 'supplier');
        setSupplierId(grn.partyId || '');
        setWarehouseId(grn.warehouseId || (warehouses[0]?.id || ''));

        const grnItem = grn.items?.[0];
        if (grnItem) {
          setSelectedCommodityId(grnItem.item);
          setBatchNo(grnItem.batchNo || `LOT-${grn.grnNo}`);
          const rejQty = (grnItem as any).rejectedQuantity || (grnItem as any).rejectedQty || grn.rejectedQty || 0;
          setReturnQty(rejQty > 0 ? rejQty : (grnItem.receivedNow || 0));
          setReturnType(rejQty > 0 ? 'Quality' : 'Full');
          setReason(rejQty > 0 ? 'Quality Rejection' : 'Excess Quantity');

          const matchingBin = bins.find(b => String(b.allowedCommodityId) === String(grnItem.item));
          setSelectedBinId(matchingBin?.id || bins[0]?.id || 'BIN-001');
        }

        const po = (db.purchaseOrders || []).find(p => p.poNo === grn.poNo);
        if (po) {
          const poItem = po.items?.[0];
          setReturnRate(poItem?.rate || 2500);
        } else {
          setReturnRate(2500);
        }

        setRemarks(`Return from Inward GRN ${grn.grnNo} (Vehicle: ${grn.vehicleNo || 'N/A'}, PO: ${grn.poNo || 'N/A'}).`);
      }
    } else if (docType === 'inv') {
      const inv = (db.purchaseInvoices || []).find(i => i.id === docId || i.invoiceNo === docId);
      if (inv) {
        setPartyType(inv.partyType === 'farmer' ? 'farmer' : 'supplier');
        setSupplierId(inv.supplierId);
        setReturnType('Partial');
        setReason('Damaged Goods');

        const invItem = inv.items?.[0];
        if (invItem) {
          setSelectedCommodityId(invItem.item);
          setReturnQty(invItem.invoiceQty || 100);
          setReturnRate(invItem.rate || 2500);
        }
        setRemarks(`Debit Note / Return against Purchase Invoice ${inv.invoiceNo} (PO: ${inv.poNumber || 'N/A'}).`);
      }
    }
  };

  // Quick Open Modal Helpers
  const handleInitiateReturnFromQC = (qc: any) => {
    setSelectedDocKey(`qc:${qc.id || qc._id || qc.qcNo}`);
    handleDocumentSelect(`qc:${qc.id || qc._id || qc.qcNo}`);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleInitiateReturnFromGRN = (grn: any) => {
    setSelectedDocKey(`grn:${grn.id || grn._id || grn.grnNo}`);
    handleDocumentSelect(`grn:${grn.id || grn._id || grn.grnNo}`);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleInitiateReturnFromInvoice = (inv: any) => {
    setSelectedDocKey(`inv:${inv.id || inv.invoiceNo}`);
    handleDocumentSelect(`inv:${inv.id || inv.invoiceNo}`);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  // View Details Modal
  const handleOpenView = (r: any) => {
    setSelectedReturn(r);
    setSupplierId(r.supplierId || '');
    setWarehouseId(r.warehouseId || '');
    setReturnType(r.returnType || 'Quality');
    setReason(r.reason || 'Quality Rejection');
    setRemarks(r.remarks || '');
    
    const item = r.items?.[0];
    if (item) {
      setSelectedCommodityId(item.commodityId || '');
      setBatchNo(item.batchNo || '');
      setSelectedBinId(item.binId || '');
      setReturnQty(item.quantity || 0);
      setReturnRate(item.rate || 0);
    }
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  // Workflow Handlers
  const handleWorkflowAction = async (id: string, action: 'submit' | 'approve' | 'reject' | 'dispatch' | 'complete') => {
    try {
      const res = await api.post(`/procurement/purchase-returns/${id}/${action}`);
      if (res.data?.success) {
        showToast(`Return request updated: ${action.toUpperCase()}`, 'success');
        loadReturnsData();
        refreshDb();
        setSelectedReturn(null);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to perform workflow ${action}`, 'error');
    }
  };

  const handleDeleteReturn = async (r: any) => {
    if (!confirm(`Are you sure you want to delete Purchase Return Request ${r.returnNumber}?`)) return;
    try {
      await api.delete(`/procurement/purchase-returns/${r.id || r._id}`);
      showToast('Purchase Return Request deleted successfully', 'success');
      setSelectedReturn(null);
      loadReturnsData();
      refreshDb();
    } catch (err) {
      showToast('Failed to delete Purchase Return Request', 'error');
    }
  };

  // Submit Handler for Logging Return
  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || returnQty <= 0) {
      showToast('Please select a vendor and specify valid return quantity', 'error');
      return;
    }

    try {
      let grnRefId: string | undefined;
      let grnRefNo: string | undefined;
      let poRefId: string | undefined;
      let invRefId: string | undefined;

      if (selectedDocKey.startsWith('qc:')) {
        const qcId = selectedDocKey.split(':')[1];
        const qc = (qis.length > 0 ? qis : (db.qualityInspections || [])).find((q: any) => (q.id === qcId || q._id === qcId || q.qcNo === qcId));
        if (qc) {
          grnRefNo = qc.grnNo;
          grnRefId = qc.grnId;
          poRefId = qc.poId;
        }
      } else if (selectedDocKey.startsWith('grn:')) {
        const grnId = selectedDocKey.split(':')[1];
        const grn = (db.grns || []).find(g => g.id === grnId || g._id === grnId || g.grnNo === grnId);
        if (grn) {
          grnRefId = grn._id || grn.id;
          grnRefNo = grn.grnNo;
          poRefId = grn.poId;
        }
      } else if (selectedDocKey.startsWith('inv:')) {
        const invId = selectedDocKey.split(':')[1];
        const inv = (db.purchaseInvoices || []).find(i => i.id === invId || i.invoiceNo === invId);
        if (inv) {
          invRefId = inv.id;
        }
      }

      const payload = {
        supplierId,
        grnId: grnRefId,
        grnNo: grnRefNo,
        purchaseOrderId: poRefId,
        purchaseInvoiceId: invRefId,
        warehouseId: warehouseId || warehouses[0]?.id || 'WH-01',
        returnType,
        reason,
        remarks: remarks || `Return request for lot ${batchNo || 'N/A'}`,
        returnDate,
        subtotal,
        tax,
        grandTotal,
        items: [{
          commodityId: selectedCommodityId || commodities[0]?.id || 'WHEAT',
          batchNo: batchNo || `LOT-${Date.now()}`,
          binId: selectedBinId || bins[0]?.id || 'BIN-001',
          quantity: returnQty,
          unit: 'KG',
          rate: returnRate,
          taxableAmount: subtotal,
          taxAmount: tax,
          totalAmount: grandTotal,
          reason
        }]
      };

      await api.post('/procurement/purchase-returns', payload);
      showToast('Purchase Return request logged as Draft', 'success');
      setIsCreateOpen(false);
      loadReturnsData();
      refreshDb();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create return request', 'error');
    }
  };

  const getSupplierName = (id: string) => {
    return db.suppliers.find(s => s.id === id || s._id === id)?.name || 
           db.farmers.find(f => f.id === id || f._id === id)?.name || 'Supplier / Mandi';
  };

  const getCommodityName = (id: string) => {
    return db.commodities.find(c => c.id === id || c._id === id)?.name || 'Grain Lot';
  };

  // PDF Debit Note Generator
  const handlePrintDebitNote = (pr: any) => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('BRIJRANI AGRO FOODS LIMITED', 14, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Patna Bypass Road, Didarganj, Patna, Bihar, 800008', 14, 25);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(225, 29, 72); // Rose
    doc.text(`OFFICIAL DEBIT NOTE: ${pr.debitNoteId || 'PENDING DISPATCH'}`, 14, 34);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Debit Note Ref: ${pr.debitNoteId || 'N/A'}`, 14, 46);
    doc.text(`Return Voucher: ${pr.returnNumber}`, 14, 52);
    doc.text(`Return Date: ${formatDate(pr.returnDate)}`, 14, 58);
    doc.text(`Reason Category: ${pr.reason || 'Quality Rejection'}`, 14, 64);

    doc.text(`Vendor / Payee: ${getSupplierName(pr.supplierId)}`, 120, 46);
    doc.text(`Return Type: ${pr.returnType?.toUpperCase() || 'QUALITY'}`, 120, 52);
    doc.text(`Status: ${pr.status}`, 120, 58);
    doc.text(`Warehouse: ${pr.warehouseId || 'Main Silo'}`, 120, 64);

    doc.setFillColor(255, 241, 242);
    doc.roundedRect(14, 72, 182, 24, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(159, 18, 57);
    doc.text('TOTAL REVERSED DEBIT VALUE', 20, 81);
    doc.setFontSize(15);
    doc.setFont('Helvetica', 'bold');
    doc.text(`INR ₹${Number(pr.grandTotal || 0).toLocaleString('en-IN')}`, 20, 90);

    const item = pr.items?.[0] || {};
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('RETURNED ITEM & STOCK BREAKDOWN:', 14, 108);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Item Description: ${getCommodityName(item.commodityId)}`, 14, 116);
    doc.text(`Stock Batch / Lot: ${item.batchNo || 'LOT'}`, 14, 122);
    doc.text(`Quantity Returned: ${Number(item.quantity || 0).toLocaleString()} ${item.unit || 'KG'}`, 14, 128);
    doc.text(`Rate / Cost: INR ₹${Number(item.rate || 0).toLocaleString()} / Quintal`, 14, 134);
    doc.text(`Taxable Subtotal: INR ₹${Number(pr.subtotal || 0).toLocaleString()}`, 14, 140);
    doc.text(`GST Tax: INR ₹${Number(pr.tax || 0).toLocaleString()}`, 14, 146);

    doc.text(`Remarks: ${pr.remarks || 'Standard commercial stock return.'}`, 14, 158);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Authorized Commercial Officer: _______________________', 14, 185);
    doc.text('Vendor Acknowledgment: _______________________', 120, 185);

    doc.save(`Debit_Note_${pr.returnNumber}.pdf`);
    showToast(`Debit note ${pr.returnNumber} PDF downloaded`, 'success');
  };

  // Filtered Returns List
  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      const matchSearch = (r.returnNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          getSupplierName(r.supplierId).toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.debitNoteId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'All' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [returns, searchQuery, filterStatus]);

  // Metrics
  const totalCompletedDebitValue = useMemo(() => {
    return returns
      .filter(r => r.status === 'Completed')
      .reduce((sum, r) => sum + (r.grandTotal || 0), 0);
  }, [returns]);

  const pendingApprovalReturnsCount = useMemo(() => {
    return returns.filter(r => r.status === 'Submitted' || r.status === 'Draft').length;
  }, [returns]);

  // Table Columns
  const returnColumns = [
    { 
      header: 'Return No', 
      accessor: (row: any) => (
        <div>
          <span className="font-bold text-slate-900">{row.returnNumber}</span>
          {row.debitNoteId && (
            <span className="block text-[10px] font-semibold text-rose-600">DN: {row.debitNoteId}</span>
          )}
        </div>
      ), 
      sortable: true 
    },
    { header: 'Date', accessor: (row: any) => formatDate(row.returnDate) },
    { header: 'Vendor', accessor: (row: any) => getSupplierName(row.supplierId) },
    { 
      header: 'Item Lot', 
      accessor: (row: any) => (
        <div>
          <span className="font-semibold text-slate-800">{getCommodityName(row.items?.[0]?.commodityId)}</span>
          <span className="block text-[10px] text-slate-400">Batch: {row.items?.[0]?.batchNo || 'Lot'}</span>
        </div>
      )
    },
    { 
      header: 'Qty Returned', 
      accessor: (row: any) => (
        <span className="font-bold text-slate-700">{row.items?.[0]?.quantity || 0} {row.items?.[0]?.unit || 'KG'}</span>
      )
    },
    { 
      header: 'Debit Total', 
      accessor: (row: any) => (
        <span className="font-extrabold text-xs text-rose-600">₹{(row.grandTotal || 0).toLocaleString()}</span>
      )
    },
    { 
      header: 'Workflow Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${
          row.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          row.status === 'Goods Outward' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          row.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          row.status === 'Submitted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
          'bg-slate-50 text-slate-600 border-slate-200'
        }`}>
          {row.status === 'Completed' && <CheckCircle2 size={11} />}
          {row.status === 'Goods Outward' && <ArrowUpRight size={11} />}
          {row.status || 'Draft'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleOpenView(row)}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
            title="View Details"
          >
            <Eye size={13} />
          </button>
          {row.status === 'Completed' && (
            <button
              onClick={() => handlePrintDebitNote(row)}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border border-rose-200"
            >
              <Download size={11} />
              <span>Debit Note</span>
            </button>
          )}
          {row.status === 'Draft' && (
            <button
              onClick={() => handleDeleteReturn(row)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Returns &amp; Debit Notes</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Procurement Reversals
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Initiate supplier returns against failed QC inspections, damaged inward goods, or invoice discrepancies.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedDocKey('');
            setSupplierId('');
            setReturnQty(0);
            setReturnRate(0);
            setRemarks('');
            setIsViewMode(false);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/10 cursor-pointer transition self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Log Purchase Return</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Failed QC Lots</span>
            <div className="text-xl font-extrabold text-rose-600 mt-1">{qcRejections.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Awaiting return initiation</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Approvals</span>
            <div className="text-xl font-extrabold text-amber-600 mt-1">{pendingApprovalReturnsCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Draft / Submitted requests</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Debit Value</span>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">₹{totalCompletedDebitValue.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Adjusted against payables</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Return Vouchers</span>
            <div className="text-xl font-extrabold text-slate-800 mt-1">{returns.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">All logged returns</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <FileSpreadsheet size={20} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('All Returns')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'All Returns'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Return Requests ({returns.length})
        </button>
        <button
          onClick={() => setActiveTab('QC Rejections')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'QC Rejections'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          QC Rejections Pending Return ({qcRejections.length})
        </button>
        <button
          onClick={() => setActiveTab('Inward GRNs')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'Inward GRNs'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Inward GRNs ({(db.grns || []).length})
        </button>
        <button
          onClick={() => setActiveTab('Invoices')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'Invoices'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Purchase Invoices ({(db.purchaseInvoices || []).length})
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'All Returns' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex gap-1.5 overflow-x-auto">
                {['All', 'Draft', 'Submitted', 'Approved', 'Goods Outward', 'Completed'].map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition whitespace-nowrap ${
                      filterStatus === st 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-48">
                <input 
                  type="text" 
                  placeholder="Search returns..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
              </div>
            </div>

            <DataTable
              columns={returnColumns}
              data={filteredReturns}
              onRowClick={row => setSelectedReturn(row)}
            />
          </div>

          {/* Right Side Workflow Execution Panel */}
          <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText size={17} className="text-rose-600" />
              <span>Return Workflow &amp; Debit Note Actions</span>
            </h3>

            {selectedReturn ? (
              <div className="space-y-4 text-xs animate-fade-in">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Return Number</span>
                    <span className="font-bold text-slate-800">{selectedReturn.returnNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Status</span>
                    <span className="font-bold text-rose-600">{selectedReturn.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Debit Value</span>
                    <span className="font-extrabold text-emerald-700">₹{(selectedReturn.grandTotal || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Debit Note Ref</span>
                    <span className="font-bold text-indigo-600">{selectedReturn.debitNoteId || 'Pending Outward'}</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                  <div className="font-bold text-slate-700 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                    <span>Returned Lot Details</span>
                    <span className="text-[10px] font-normal text-slate-400">Date: {formatDate(selectedReturn.returnDate)}</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vendor:</span>
                      <span className="font-bold text-slate-800">{getSupplierName(selectedReturn.supplierId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Item:</span>
                      <span className="font-bold text-slate-800">{getCommodityName(selectedReturn.items?.[0]?.commodityId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Batch:</span>
                      <span className="font-mono text-slate-700">{selectedReturn.items?.[0]?.batchNo || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Quantity:</span>
                      <span className="font-extrabold text-slate-800">{selectedReturn.items?.[0]?.quantity || 0} {selectedReturn.items?.[0]?.unit || 'KG'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rate:</span>
                      <span className="font-bold text-slate-700">₹{selectedReturn.items?.[0]?.rate || 0} / Qtl</span>
                    </div>
                  </div>
                </div>

                {/* Workflow Buttons */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenView(selectedReturn)}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>View Form</span>
                    </button>
                    {selectedReturn.status === 'Draft' && (
                      <button
                        onClick={() => handleDeleteReturn(selectedReturn)}
                        className="p-2 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-lg text-xs flex items-center justify-center transition cursor-pointer"
                        title="Delete Request"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {selectedReturn.status === 'Draft' && (
                    <button 
                      onClick={() => handleWorkflowAction(selectedReturn._id, 'submit')}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Play size={14} /> Submit Return for Admin Approval
                    </button>
                  )}

                  {selectedReturn.status === 'Submitted' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleWorkflowAction(selectedReturn._id, 'approve')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Check size={14} /> Approve Return
                      </button>
                      <button 
                        onClick={() => handleWorkflowAction(selectedReturn._id, 'reject')}
                        className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition flex items-center justify-center cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {selectedReturn.status === 'Approved' && (
                    <button 
                      onClick={() => handleWorkflowAction(selectedReturn._id, 'dispatch')}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <ArrowUpRight size={14} /> Goods Outward (Deduct Warehouse Stock)
                    </button>
                  )}

                  {selectedReturn.status === 'Goods Outward' && (
                    <button 
                      onClick={() => handleWorkflowAction(selectedReturn._id, 'complete')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <CreditCard size={14} /> Complete &amp; Issue Debit Note (Adjust Payables)
                    </button>
                  )}

                  {selectedReturn.status === 'Completed' && (
                    <button 
                      onClick={() => handlePrintDebitNote(selectedReturn)}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/10"
                    >
                      <Download size={14} /> Download Debit Note PDF
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-xs text-slate-400 font-medium">
                Select a purchase return request from the list to execute approval workflows, manage outward dispatch, and issue debit notes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* QC Rejections Tab */}
      {activeTab === 'QC Rejections' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Quality Inspections Awaiting Return / Debit Note</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Failed or rejected QC lots that can be immediately converted into Purchase Return requests.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {qcRejections.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No failed quality inspections found.</div>
            ) : (
              qcRejections.map((qc: any) => (
                <div key={qc.id || qc._id || qc.qcNo} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{qc.qcNo || 'QC Doc'}</span>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full border border-rose-200">
                        {qc.decision || 'REJECTED'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      GRN: <span className="font-semibold">{qc.grnNo || 'N/A'}</span> &bull; PO: <span className="font-semibold">{qc.poNo || 'N/A'}</span> &bull; Vendor: <span className="font-semibold">{getSupplierName(qc.partyId)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Received Qty: <span className="font-bold text-slate-700">{qc.receivedQuantity || qc.quantity || 0} KG</span> | Rejected Qty: <span className="font-extrabold text-rose-600">{qc.rejectedQuantity || qc.damagedQuantity || 0} KG</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInitiateReturnFromQC(qc)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm cursor-pointer"
                  >
                    <XCircle size={13} />
                    <span>Initiate Return</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Inward GRNs Tab */}
      {activeTab === 'Inward GRNs' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Inward Goods Receipt Notes (GRN)</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Select a GRN to return damaged, non-conforming, or excess stock lots.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {(db.grns || []).map((grn: any) => (
              <div key={grn.id || grn._id || grn.grnNo} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{grn.grnNo}</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                      Vehicle: {grn.vehicleNo || 'N/A'}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      QC: {grn.qualityStatus || 'Pending'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    PO Ref: <span className="font-semibold">{grn.poNo}</span> &bull; Vendor: <span className="font-semibold">{getSupplierName(grn.partyId)}</span> &bull; Inward Date: {formatDate(grn.date || grn.arrivalDate)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Item: {getCommodityName(grn.items?.[0]?.item)} | Inward Qty: {grn.items?.[0]?.receivedNow || grn.weight || 0} KG
                  </div>
                </div>

                <button
                  onClick={() => handleInitiateReturnFromGRN(grn)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm cursor-pointer"
                >
                  <ArrowUpRight size={13} />
                  <span>Log Return from GRN</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'Invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Purchase Invoices (Debit Notes)</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Create debit notes and stock returns directly against billed invoices.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {(db.purchaseInvoices || []).map((inv: any) => (
              <div key={inv.id || inv.invoiceNo} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{inv.invoiceNo}</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                      Total: ₹{(inv.grandTotal || 0).toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      Status: {inv.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    PO Ref: <span className="font-semibold">{inv.poNumber || 'N/A'}</span> &bull; Vendor: <span className="font-semibold">{getSupplierName(inv.supplierId)}</span> &bull; Date: {formatDate(inv.invoiceDate)}
                  </div>
                </div>

                <button
                  onClick={() => handleInitiateReturnFromInvoice(inv)}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm cursor-pointer"
                >
                  <DollarSign size={13} />
                  <span>Debit Note / Return</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / LOG PURCHASE RETURN MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-center items-center z-[9999] p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[88vh] animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                  <XCircle className="text-rose-600" size={17} />
                  <span>{isViewMode ? 'View ' : 'Log '}Purchase Return &amp; Debit Note</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Reverse inward goods, log reason codes, and issue debit notes.</p>
              </div>
              <button 
                onClick={() => { setIsCreateOpen(false); setSelectedDocKey(''); setIsViewMode(false); }}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateReturn} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs min-h-0">
                
                {/* Multi-Document Linking Selector */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-rose-600" />
                      <span>Link to Inward Document (QC / GRN / Invoice)</span>
                    </label>
                    {selectedDocKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocKey('');
                          setReturnQty(0);
                          setReturnRate(0);
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
                    disabled={isViewMode}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="">-- Direct Entry (Manual Return / No Document Link) --</option>
                    
                    {qcRejections.length > 0 && (
                      <optgroup label="Quality Inspections (Failed / Rejected Lots)">
                        {qcRejections.map((qc: any) => (
                          <option key={`qc_${qc.id || qc._id || qc.qcNo}`} value={`qc:${qc.id || qc._id || qc.qcNo}`}>
                            QC: {qc.qcNo || 'QC'} &minus; Decision: {qc.decision || 'REJECT'} &minus; Rej: {qc.rejectedQuantity || qc.damagedQuantity || 0} KG
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {(db.grns || []).length > 0 && (
                      <optgroup label="Inward Goods Receipts (GRNs)">
                        {(db.grns || []).map((grn: any) => (
                          <option key={`grn_${grn.id || grn._id || grn.grnNo}`} value={`grn:${grn.id || grn._id || grn.grnNo}`}>
                            GRN: {grn.grnNo} &minus; PO: {grn.poNo} &minus; Vehicle: {grn.vehicleNo}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {(db.purchaseInvoices || []).length > 0 && (
                      <optgroup label="Purchase Invoices (Debit Notes)">
                        {(db.purchaseInvoices || []).map((inv: any) => (
                          <option key={`inv_${inv.id || inv.invoiceNo}`} value={`inv:${inv.id || inv.invoiceNo}`}>
                            Invoice: {inv.invoiceNo} &minus; PO: {inv.poNumber} &minus; Total: ₹{(inv.grandTotal || 0).toLocaleString()}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Linked Document Card */}
                  {linkedDocInfo && (
                    <div className="mt-2 p-3 bg-white border border-rose-200 rounded-lg shadow-xs space-y-2 text-xs animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${linkedDocInfo.badgeColor}`}>
                          {linkedDocInfo.type}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700">Ref: {linkedDocInfo.docNo}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Received Lot</span>
                          <span className="font-bold text-slate-800">{linkedDocInfo.receivedQty} KG</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Rejected Lot</span>
                          <span className="font-extrabold text-rose-600">{linkedDocInfo.rejectedQty} KG</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">PO / GRN Ref</span>
                          <span className="font-bold text-slate-700">{linkedDocInfo.grnNo}</span>
                        </div>
                      </div>

                      {!isViewMode && linkedDocInfo.rejectedQty > 0 && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setReturnQty(linkedDocInfo.rejectedQty)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-bold rounded border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={11} /> Return All Rejected ({linkedDocInfo.rejectedQty} KG)
                          </button>
                          {linkedDocInfo.receivedQty > 0 && (
                            <button
                              type="button"
                              onClick={() => setReturnQty(linkedDocInfo.receivedQty)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-200 transition cursor-pointer"
                            >
                              Return Full Lot ({linkedDocInfo.receivedQty} KG)
                            </button>
                          )}
                        </div>
                      )}
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
                        setSupplierId('');
                      }}
                      disabled={isViewMode}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      <option value="supplier">Corporate Supplier</option>
                      <option value="farmer">Farmer / Mandi</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Select Vendor *</label>
                    <select
                      value={supplierId}
                      onChange={e => setSupplierId(e.target.value)}
                      disabled={isViewMode}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Return Type *</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none"
                      value={returnType}
                      onChange={e => setReturnType(e.target.value as any)}
                      disabled={isViewMode}
                    >
                      <option value="Quality">Quality Rejection</option>
                      <option value="Full">Full Lot Return</option>
                      <option value="Partial">Partial Lot Return</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Reason Category *</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      disabled={isViewMode}
                    >
                      <option value="Quality Rejection">Quality Rejection</option>
                      <option value="Damaged Goods">Damaged Goods</option>
                      <option value="Wrong Item">Wrong Item</option>
                      <option value="Excess Quantity">Excess Quantity</option>
                      <option value="Expired Goods">Expired Goods</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Return Date *</label>
                    <IndianDateInput
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                      value={returnDate}
                      onChange={val => setReturnDate(val)}
                      disabled={isViewMode}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Commodity / Item *</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none"
                      value={selectedCommodityId}
                      onChange={e => setSelectedCommodityId(e.target.value)}
                      disabled={isViewMode}
                      required
                    >
                      <option value="">-- Choose Commodity --</option>
                      {commodities.map(c => (
                        <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                          {c.name} ({c.sku || 'Lot'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Batch / Lot No</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-mono text-slate-800 focus:outline-none"
                      value={batchNo}
                      onChange={e => setBatchNo(e.target.value)}
                      placeholder="e.g. LOT-2026-001"
                      disabled={isViewMode}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Dispatch Bin</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none"
                      value={selectedBinId}
                      onChange={e => setSelectedBinId(e.target.value)}
                      disabled={isViewMode}
                    >
                      {bins.map(b => (
                        <option key={b.id || (b as any)._id} value={b.id || (b as any)._id}>
                          {b.binCode || b.name} ({b.warehouseId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Return Qty (KG) *</label>
                    <input 
                      type="number" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-extrabold text-rose-700 focus:outline-none text-sm"
                      value={returnQty || ''}
                      onChange={e => setReturnQty(Number(e.target.value))}
                      min={1}
                      disabled={isViewMode}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Cost Rate (₹/QTL) *</label>
                    <input 
                      type="number" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-extrabold text-slate-800 focus:outline-none text-sm"
                      value={returnRate || ''}
                      onChange={e => setReturnRate(Number(e.target.value))}
                      min={0}
                      disabled={isViewMode}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Calculated Debit Value (₹)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-rose-200 bg-rose-50/50 rounded-lg text-xs font-black text-rose-700 text-sm"
                      value={`₹${grandTotal.toLocaleString()}`}
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Return Remarks &amp; Reason Description *</label>
                  <textarea 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none h-16 resize-none"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Details regarding quality failure, damage inspection, or debit terms..."
                    disabled={isViewMode}
                    required
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                {isViewMode ? (
                  <button
                    type="button"
                    onClick={() => { setIsCreateOpen(false); setSelectedDocKey(''); setIsViewMode(false); }}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    Close View
                  </button>
                ) : (
                  <>
                    <button 
                      type="button" 
                      onClick={() => { setIsCreateOpen(false); setSelectedDocKey(''); }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md shadow-rose-600/10 cursor-pointer transition"
                    >
                      Save Draft Return Request
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
