'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import api from '../../../services/axios';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchaseOrder, GRN } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Plus, Landmark, CheckCircle, AlertTriangle, HelpCircle, Download, FileCheck, ArrowRight, ShieldCheck, Edit3, Wallet, Eye, Trash2, Truck, Clock, Lock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Matched' | 'Mismatch' | 'Approved' | 'Paid' | 'Disputed'>('All');

  // Form states for Invoice Header
  const [invoiceNo, setInvoiceNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [qcId, setQcId] = useState('');
  const [qcNo, setQcNo] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [freight, setFreight] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [qcList, setQcList] = useState<any[]>([]);

  // Vehicle & Logistics states
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [transporter, setTransporter] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [netWeight, setNetWeight] = useState<number>(0);

  const handleGrossWeightChange = (val: number) => {
    setGrossWeight(val);
    setNetWeight(Math.max(0, val - (tareWeight || 0)));
  };

  const handleTareWeightChange = (val: number) => {
    setTareWeight(val);
    setNetWeight(Math.max(0, (grossWeight || 0) - val));
  };

  // Form items list
  const [itemsList, setItemsList] = useState<PurchaseInvoiceItem[]>([]);

  // Sourcing master selectors
  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const commodities = db.commodities;

  // Load QC list on mount
  useEffect(() => {
    api.get('/quality-control').then(res => {
      if (res.data?.data) setQcList(res.data.data);
    }).catch(() => null);
  }, []);

  // Filters POs and GRNs for selector (Exclude already invoiced/completed POs & GRNs)
  const availablePOs = useMemo(() => {
    return db.purchaseOrders.filter(p => {
      const validStatus = p.status === 'Approved' || p.status === 'Sent' || p.status === 'Partially Received' || p.status === 'Received';
      if (!validStatus) return false;

      // Allow linked PO if editing or viewing the existing invoice
      if (selectedInvoice && (selectedInvoice.poNumber === p.poNo || selectedInvoice.poNumber === p.id)) {
        return true;
      }

      // Exclude POs that already have an active (non-cancelled) Purchase Invoice
      const hasActiveInvoice = db.purchaseInvoices.some(inv => 
        (inv.poNumber === p.poNo || inv.poNumber === p.id) && inv.status !== 'Cancelled'
      );
      if (hasActiveInvoice) return false;

      return true;
    });
  }, [db.purchaseOrders, db.purchaseInvoices, selectedInvoice]);

  const availableGRNs = useMemo(() => {
    if (!poNo) return [];
    const po = db.purchaseOrders.find(p => p.poNo === poNo || p.id === poNo);
    if (!po) return [];
    return db.grns.filter(g => {
      if (g.poId !== po.id && g.poNo !== po.poNo) return false;
      if (g.qualityStatus === 'Pending') return false;

      // If editing/viewing, allow the currently linked GRN
      if (selectedInvoice && (selectedInvoice.grnNumber === g.grnNo || selectedInvoice.grnNumber === g.id)) {
        return true;
      }

      // Exclude GRNs that already have an active invoice
      const hasActiveInvoice = db.purchaseInvoices.some(inv => 
        (inv.grnNumber === g.grnNo || inv.grnNumber === g.id) && inv.status !== 'Cancelled'
      );
      if (hasActiveInvoice) return false;

      return true;
    });
  }, [poNo, db.purchaseOrders, db.grns, db.purchaseInvoices, selectedInvoice]);

  // Helper to populate items directly from PO
  const populateItemsFromPo = (po: PurchaseOrder) => {
    const invoiceItems: PurchaseInvoiceItem[] = (po.items || []).map(poItem => {
      const rate = poItem.rate || 0;
      const discountAmt = poItem.discount || 0;
      const commodity = db.commodities.find(c => 
        c.id === poItem.item || 
        c._id === poItem.item || 
        (c.name && poItem.description && c.name.toLowerCase() === poItem.description.toLowerCase()) || 
        (c.name && typeof poItem.item === 'string' && c.name.toLowerCase() === poItem.item.toLowerCase())
      );

      let taxRate = 0;
      if (commodity?.defaultGst !== undefined) {
        taxRate = Number(commodity.defaultGst);
      } else if (poItem?.taxPercent !== undefined) {
        taxRate = Number(poItem.taxPercent);
      }

      const invoiceQty = poItem.quantity;
      const sub = invoiceQty * rate;
      const taxVal = Math.round(sub * (taxRate / 100));

      return {
        item: poItem.item,
        poQty: poItem.quantity,
        receivedQty: poItem.quantity,
        invoiceQty,
        rate,
        baseRate: rate,
        qualityRebatePerUnit: 0,
        qualityRebateTotal: 0,
        settledRate: rate,
        discount: discountAmt,
        taxPercent: taxRate,
        taxAmount: taxVal,
        amount: sub + taxVal - discountAmt
      };
    });

    setItemsList(invoiceItems);
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFreight(po.freight || 0);
    setOtherCharges(po.otherCharges || 0);
    setDiscount(po.discount || 0);
  };

  // Load PO details and auto-populate items & vehicle when PO selection changes
  const handlePoChange = (selectedPoNo: string) => {
    setPoNo(selectedPoNo);
    setGrnNo('');
    const po = db.purchaseOrders.find(p => p.poNo === selectedPoNo || p.id === selectedPoNo);
    if (po) {
      populateItemsFromPo(po);
    } else {
      setItemsList([]);
    }
  };

  // Pre-fill / update invoice item structures & vehicle info when GRN selection changes
  const handleGrnChange = (selectedGrnNo: string) => {
    setGrnNo(selectedGrnNo);
    const po = db.purchaseOrders.find(p => p.poNo === poNo || p.id === poNo);
    if (po) {
      populateItemsFromPo(po);
    }
    const grn = db.grns.find(g => g.grnNo === selectedGrnNo || g.id === selectedGrnNo);
    if (grn) {
      if (grn.vehicleNo) setVehicleNo(grn.vehicleNo);
      if (grn.driverName) setDriverName(grn.driverName);
      if (grn.transporter) setTransporter(grn.transporter);
      if (grn.grossWeight) setGrossWeight(grn.grossWeight);
      if (grn.tareWeight) setTareWeight(grn.tareWeight);
      if (grn.netWeight) setNetWeight(grn.netWeight);
    }
  };

  // Handle URL query parameters for direct PO conversion
  const poQueryParam = searchParams.get('po');
  const actionQueryParam = searchParams.get('action');
  useEffect(() => {
    if (poQueryParam) {
      const po = db.purchaseOrders.find(p => p.id === poQueryParam || p.poNo === poQueryParam);
      if (po) {
        setPoNo(po.poNo);
        setGrnNo('');
        populateItemsFromPo(po);
        const matchedGrn = db.grns.find(g => (g.poNo === po.poNo || g.poId === po.id));
        if (matchedGrn) {
          if (matchedGrn.vehicleNo) setVehicleNo(matchedGrn.vehicleNo);
          if (matchedGrn.driverName) setDriverName(matchedGrn.driverName);
          if (matchedGrn.transporter) setTransporter(matchedGrn.transporter);
          if (matchedGrn.grossWeight) setGrossWeight(matchedGrn.grossWeight);
          if (matchedGrn.tareWeight) setTareWeight(matchedGrn.tareWeight);
          if (matchedGrn.netWeight) setNetWeight(matchedGrn.netWeight);
        }
        setIsCreateOpen(true);
      }
    } else if (actionQueryParam === 'new') {
      setIsCreateOpen(true);
    }
  }, [poQueryParam, actionQueryParam, db.purchaseOrders]);

  // Edit quantity or rate inside invoice form
  const handleItemValueChange = (index: number, field: 'invoiceQty' | 'rate' | 'discount' | 'taxPercent', val: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'invoiceQty') item.invoiceQty = val;
      if (field === 'rate') {
        item.rate = val;
        item.baseRate = val;
        item.settledRate = val;
      }
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
  const subtotal = itemsList.reduce((sum, i) => sum + (i.invoiceQty * (i.rate || 0)), 0);
  const totalTax = itemsList.reduce((sum, i) => sum + i.taxAmount, 0);
  const totalCharges = Number(freight) + Number(otherCharges);
  const grandTotal = subtotal + totalTax + totalCharges - Number(discount);
  const baseSubtotal = subtotal;
  const totalQualityRebateDeduction = 0;

  // Find active QC record if selected
  const activeQc = useMemo(() => {
    if (!qcId && !qcNo) return null;
    return (qcList || []).find((q: any) => (q._id || q.id) === qcId || q.qcNumber === qcNo);
  }, [qcId, qcNo, qcList]);

  const handleOpenEdit = () => {
    if (!selectedInvoice) return;
    setInvoiceNo(selectedInvoice.invoiceNo);
    setPoNo(selectedInvoice.poNumber);
    setGrnNo(selectedInvoice.grnNumber || '');
    setDueDate(selectedInvoice.dueDate || '');
    setFreight(selectedInvoice.freight || 0);
    setOtherCharges(selectedInvoice.otherCharges || 0);
    setDiscount(selectedInvoice.discount || 0);
    setRemarks(selectedInvoice.remarks || '');
    setVehicleNo(selectedInvoice.vehicleNo || '');
    setDriverName(selectedInvoice.driverName || '');
    setDriverPhone(selectedInvoice.driverPhone || '');
    setTransporter(selectedInvoice.transporter || '');
    setLrNumber(selectedInvoice.lrNumber || '');
    setLrDate(selectedInvoice.lrDate || '');
    setEwayBillNo(selectedInvoice.ewayBillNo || '');
    setGrossWeight(selectedInvoice.grossWeight || 0);
    setTareWeight(selectedInvoice.tareWeight || 0);
    setNetWeight(selectedInvoice.netWeight || 0);
    setItemsList(selectedInvoice.items || []);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleOpenView = () => {
    if (!selectedInvoice) return;
    setInvoiceNo(selectedInvoice.invoiceNo);
    setPoNo(selectedInvoice.poNumber);
    setGrnNo(selectedInvoice.grnNumber || '');
    setDueDate(selectedInvoice.dueDate || '');
    setFreight(selectedInvoice.freight || 0);
    setOtherCharges(selectedInvoice.otherCharges || 0);
    setDiscount(selectedInvoice.discount || 0);
    setRemarks(selectedInvoice.remarks || '');
    setVehicleNo(selectedInvoice.vehicleNo || '');
    setDriverName(selectedInvoice.driverName || '');
    setDriverPhone(selectedInvoice.driverPhone || '');
    setTransporter(selectedInvoice.transporter || '');
    setLrNumber(selectedInvoice.lrNumber || '');
    setLrDate(selectedInvoice.lrDate || '');
    setEwayBillNo(selectedInvoice.ewayBillNo || '');
    setGrossWeight(selectedInvoice.grossWeight || 0);
    setTareWeight(selectedInvoice.tareWeight || 0);
    setNetWeight(selectedInvoice.netWeight || 0);
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
    if (!invoiceNo || (!poNo && !qcId && !qcNo) || itemsList.length === 0) {
      showToast('Please fill all mandatory fields (Invoice No, Reference PO / QC) and configure items', 'error');
      return;
    }

    const po = db.purchaseOrders.find(p => p.poNo === poNo || p.id === poNo);
    const grn = grnNo ? db.grns.find(g => g.grnNo === grnNo) : null;
    const qc = (qcId || qcNo) ? (qcList || []).find((q: any) => (q._id || q.id) === qcId || q.qcNumber === qcNo) : null;

    if (isEditMode && selectedInvoice) {
      const updatedInvoice: PurchaseInvoice = {
        ...selectedInvoice,
        invoiceNo,
        poNumber: po ? po.poNo : selectedInvoice.poNumber,
        qcNumber: qc ? qc.qcNumber : (qcNo || selectedInvoice.qcNumber),
        qcId: qc ? (qc._id || qc.id) : selectedInvoice.qcId,
        grnNumber: grn ? grn.grnNo : (grnNo || undefined),
        dueDate,
        freight: Number(freight),
        otherCharges: Number(otherCharges),
        discount: Number(discount),
        remarks,
        vehicleNo,
        driverName,
        driverPhone,
        transporter,
        lrNumber,
        lrDate,
        ewayBillNo,
        grossWeight: Number(grossWeight || 0),
        tareWeight: Number(tareWeight || 0),
        netWeight: Number(netWeight || (grossWeight && tareWeight ? Math.max(0, grossWeight - tareWeight) : 0)),
        isFinalInvoice: false,
        invoiceType: 'Preliminary',
        subtotal,
        baseSubtotal,
        qualityRebateDeduction: totalQualityRebateDeduction,
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
      setQcId('');
      setQcNo('');
      setGrnNo('');
      setVehicleNo('');
      setDriverName('');
      setDriverPhone('');
      setTransporter('');
      setLrNumber('');
      setLrDate('');
      setEwayBillNo('');
      setGrossWeight(0);
      setTareWeight(0);
      setNetWeight(0);
      setItemsList([]);
      setSelectedInvoice(updatedInvoice);
      showToast(`Invoice ${invoiceNo} updated successfully! Status: ${updatedInvoice.status}`, 'success');
      return;
    }

    const id = `INV-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const partyId = po ? po.partyId : (qc?.partyId || (db.farmers[0]?.id || db.farmers[0]?._id));
    const partyType = po ? po.partyType : (qc?.partyType || 'farmer');
    const poNumber = po ? po.poNo : (qc?.poNumber || qc?.referenceNumber || `QC-${qc?.qcNumber || 'DIRECT'}`);
    const supplierGSTIN = partyType === 'supplier'
      ? (suppliers.find(s => s.id === partyId || (s as any)._id === partyId)?.gstin || '')
      : '';

    const newInvoice: PurchaseInvoice = {
      id,
      invoiceNo,
      invoiceDate: date,
      supplierId: partyId,
      partyType,
      poNumber,
      qcId: qc ? (qc._id || qc.id) : undefined,
      qcNumber: qc ? qc.qcNumber : (qcNo || undefined),
      grnNumber: grn ? grn.grnNo : (grnNo || undefined),
      dueDate,
      paymentTerms: po?.paymentTerms || '30 Days',
      supplierGSTIN,
      billingAddress: po?.billingAddress || 'Patna Silos Facility',
      shippingAddress: po?.shippingAddress || 'Patna Silos Facility',
      taxType: 'GST',
      subtotal,
      baseSubtotal,
      qualityRebateDeduction: totalQualityRebateDeduction,
      discount,
      cgst: Math.round(totalTax / 2),
      sgst: Math.round(totalTax / 2),
      igst: 0,
      freight: Number(freight),
      otherCharges: Number(otherCharges),
      roundOff: 0,
      grandTotal,
      vehicleNo,
      driverName,
      driverPhone,
      transporter,
      lrNumber,
      lrDate,
      ewayBillNo,
      grossWeight: Number(grossWeight || 0),
      tareWeight: Number(tareWeight || 0),
      netWeight: Number(netWeight || (grossWeight && tareWeight ? Math.max(0, grossWeight - tareWeight) : 0)),
      isFinalInvoice: false,
      invoiceType: 'Preliminary',
      status: 'Matched',
      items: itemsList,
      remarks
    };

    // Run Match validation immediately
    const checkMatch = erpService.verifyThreeWayMatch(newInvoice);
    if (!checkMatch.isMatch && po) {
      newInvoice.status = 'Mismatch';
      newInvoice.mismatchReason = checkMatch.details.join('; ');
    } else {
      newInvoice.status = 'Matched';
    }

    erpService.purchaseInvoices.create(newInvoice);
    refreshDb();
    setIsCreateOpen(false);
    setInvoiceNo('');
    setPoNo('');
    setQcId('');
    setQcNo('');
    setGrnNo('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setTransporter('');
    setLrNumber('');
    setLrDate('');
    setEwayBillNo('');
    setGrossWeight(0);
    setTareWeight(0);
    setNetWeight(0);
    setItemsList([]);
    setSelectedInvoice(newInvoice);
    showToast(`Purchase Invoice ${invoiceNo} generated directly from Purchase Order ${poNumber}!`, 'success');
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

  // Verification results
  const verificationResult = useMemo(() => {
    if (!selectedInvoice) return null;
    return erpService.verifyThreeWayMatch(selectedInvoice);
  }, [selectedInvoice, db]);

  // Find linked GRN record if any exists
  const linkedGrn = useMemo(() => {
    if (!selectedInvoice) return null;
    return db.grns.find(g => 
      (selectedInvoice.grnNumber && g.grnNo === selectedInvoice.grnNumber) || 
      (selectedInvoice.id && g.invoiceId === selectedInvoice.id) ||
      (selectedInvoice.invoiceNo && g.invoiceNo === selectedInvoice.invoiceNo) ||
      (selectedInvoice.poNumber && g.poNo === selectedInvoice.poNumber)
    ) || null;
  }, [selectedInvoice, db.grns]);

  const isGrnInwarded = useMemo(() => {
    if (!linkedGrn) return false;
    return linkedGrn.inwardStatus === 'Completed' || linkedGrn.status === 'Completed' || linkedGrn.status === 'Accepted';
  }, [linkedGrn]);

  // Tab filter logic: Preliminary only (not Final)
  const preliminaryInvoices = useMemo(() => {
    return (db.purchaseInvoices || []).filter(inv => !inv.isFinalInvoice && inv.invoiceType !== 'Final');
  }, [db.purchaseInvoices]);

  const filteredInvoices = useMemo(() => {
    if (activeTab === 'All') return preliminaryInvoices;
    return preliminaryInvoices.filter(inv => inv.status === activeTab);
  }, [preliminaryInvoices, activeTab]);

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
    { 
      header: 'Purchase Order (PO)', 
      accessor: (row: PurchaseInvoice) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.poNumber || '-'}</span>
      )
    },
    { 
      header: 'Vehicle / Transport', 
      accessor: (row: PurchaseInvoice) => {
        const veh = row.vehicleNo || (db.grns.find(g => (row.grnNumber && g.grnNo === row.grnNumber) || g.poNo === row.poNumber)?.vehicleNo);
        const trans = row.transporter || (db.grns.find(g => (row.grnNumber && g.grnNo === row.grnNumber) || g.poNo === row.poNumber)?.transporter);
        if (!veh && !trans) return <span className="text-slate-300 font-mono text-[10px]">-</span>;
        return (
          <div className="text-xs">
            {veh && <div className="font-mono text-[11px] font-bold text-slate-800 flex items-center gap-1"><Truck size={12} className="text-primary-600 shrink-0" />{veh}</div>}
            {trans && <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{trans}</div>}
          </div>
        );
      }
    },
    { 
      header: 'GRN Status', 
      accessor: (row: PurchaseInvoice) => {
        const grn = db.grns.find(g => 
          (row.grnNumber && g.grnNo === row.grnNumber) || 
          g.poNo === row.poNumber || 
          g.invoiceId === row.id || 
          g.invoiceNo === row.invoiceNo
        );
        if (!grn) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Awaiting GRN
            </span>
          );
        }
        if (grn.inwardStatus === 'Completed' || grn.status === 'Completed' || grn.status === 'Accepted') {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              GRN Inwarded
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            GRN In-Progress
          </span>
        );
      }
    },
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
    doc.text(`PO Number:      ${invoice.poNumber || 'N/A'}`, 14, 64);
    doc.text(`GRN Number:     ${invoice.grnNumber || 'N/A'}`, 14, 70);
    doc.text(`Match Status:   ${invoice.status}`, 14, 76);

    // Vehicle Details in PDF on right column
    if (invoice.vehicleNo || invoice.transporter || invoice.lrNumber || invoice.ewayBillNo) {
      doc.setFont("Helvetica", "bold");
      doc.text("VEHICLE & LOGISTICS:", 115, 46);
      doc.setFont("Helvetica", "normal");
      if (invoice.vehicleNo) doc.text(`Vehicle No:    ${invoice.vehicleNo}`, 115, 52);
      if (invoice.driverName) doc.text(`Driver:        ${invoice.driverName}${invoice.driverPhone ? ' (' + invoice.driverPhone + ')' : ''}`, 115, 58);
      if (invoice.transporter) doc.text(`Transporter:   ${invoice.transporter}`, 115, 64);
      if (invoice.lrNumber) doc.text(`LR/Bilty No:   ${invoice.lrNumber}`, 115, 70);
      if (invoice.ewayBillNo) doc.text(`E-Way Bill:    ${invoice.ewayBillNo}`, 115, 76);
      if (invoice.netWeight) doc.text(`Net Weight:    ${invoice.netWeight} MT`, 115, 82);
    }

    const supName = invoice.partyType === 'supplier'
      ? suppliers.find(s => s.id === invoice.supplierId)?.name
      : farmers.find(f => f.id === invoice.supplierId)?.name;

    doc.setFont("Helvetica", "bold");
    doc.text("SUPPLIER / SOURCING PARTY:", 14, 94);
    doc.setFont("Helvetica", "normal");
    doc.text(supName || 'Unknown Vendor', 14, 100);
    doc.text(`GSTIN: ${invoice.supplierGSTIN || 'N/A'}`, 14, 106);

    // Items table header
    const tableTop = 118;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Item Details", 16, tableTop + 5.5);
    doc.text("Billed Qty", 95, tableTop + 5.5, { align: "right" });
    doc.text("Unit Rate", 130, tableTop + 5.5, { align: "right" });
    doc.text("GST Tax", 160, tableTop + 5.5, { align: "right" });
    doc.text("Line Total", 194, tableTop + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    let itemY = tableTop + 14;
    invoice.items.forEach(it => {
      const commName = commodities.find(c => c.id === it.item || c._id === it.item)?.name || it.item;
      const unitR = it.rate || it.settledRate || it.baseRate || 0;

      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${it.invoiceQty}`, 95, itemY, { align: "right" });
      doc.text(`₹${unitR.toLocaleString()}`, 130, itemY, { align: "right" });
      doc.text(`₹${(it.taxAmount || 0).toLocaleString()}`, 160, itemY, { align: "right" });
      doc.text(`₹${it.amount.toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    doc.line(14, itemY - 3, 196, itemY - 3);

    const summaryX = 130;
    doc.text("Subtotal:", summaryX, itemY + 2);
    doc.text(`₹${invoice.subtotal.toLocaleString()}`, 194, itemY + 2, { align: "right" });
    
    doc.text("Freight charges:", summaryX, itemY + 8);
    doc.text(`₹${invoice.freight.toLocaleString()}`, 194, itemY + 8, { align: "right" });

    doc.text("GST Taxes:", summaryX, itemY + 14);
    doc.text(`₹${(invoice.cgst * 2).toLocaleString()}`, 194, itemY + 14, { align: "right" });

    if (invoice.discount && invoice.discount > 0) {
      doc.text("Discount:", summaryX, itemY + 20);
      doc.text(`-₹${invoice.discount.toLocaleString()}`, 194, itemY + 20, { align: "right" });
      itemY += 6;
    }

    doc.line(120, itemY + 18, 196, itemY + 18);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Grand Total Pay:", summaryX, itemY + 23);
    doc.text(`₹${invoice.grandTotal.toLocaleString()}`, 194, itemY + 23, { align: "right" });

    const cleanFileName = `purchase_invoice_${(invoice.invoiceNo || 'voucher').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', cleanFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      doc.save(cleanFileName);
    }
    showToast(`Invoice PDF Voucher downloaded (${cleanFileName})`, 'success');
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Purchase Invoices (Without QC)</h1>
          <p className="text-xs font-medium text-slate-400">Log preliminary vendor commercial bills against Purchase Orders prior to Quality Control and GRN weighbridge inward.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setInvoiceNo('');
            setPoNo('');
            setQcId('');
            setQcNo('');
            setGrnNo('');
            setDueDate('');
            setFreight(0);
            setOtherCharges(0);
            setDiscount(0);
            setRemarks('');
            setVehicleNo('');
            setDriverName('');
            setDriverPhone('');
            setTransporter('');
            setLrNumber('');
            setLrDate('');
            setEwayBillNo('');
            setGrossWeight(0);
            setTareWeight(0);
            setNetWeight(0);
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
                  <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded font-bold">{selectedInvoice.poNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GRN Link:</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded font-bold">{selectedInvoice.grnNumber || 'N/A'}</span>
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

              {/* Vehicle & Logistics Details */}
              {(selectedInvoice.vehicleNo || selectedInvoice.transporter || selectedInvoice.driverName || selectedInvoice.lrNumber || selectedInvoice.ewayBillNo || linkedGrn?.vehicleNo) && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
                      <Truck size={14} className="text-primary-600" />
                      <span>Vehicle & Transport Logistics</span>
                    </div>
                    {(selectedInvoice.vehicleNo || linkedGrn?.vehicleNo) && (
                      <span className="font-mono text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded">
                        {selectedInvoice.vehicleNo || linkedGrn?.vehicleNo}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-600 pt-1 border-t border-slate-200/60">
                    {selectedInvoice.driverName && (
                      <div>
                        <span className="text-slate-400 block">Driver</span>
                        <span className="text-slate-800 font-bold">{selectedInvoice.driverName} {selectedInvoice.driverPhone ? `(${selectedInvoice.driverPhone})` : ''}</span>
                      </div>
                    )}
                    {selectedInvoice.transporter && (
                      <div>
                        <span className="text-slate-400 block">Transporter / Carrier</span>
                        <span className="text-slate-800 font-bold">{selectedInvoice.transporter}</span>
                      </div>
                    )}
                    {selectedInvoice.lrNumber && (
                      <div>
                        <span className="text-slate-400 block">LR / Bilty No</span>
                        <span className="text-slate-800 font-bold">{selectedInvoice.lrNumber} {selectedInvoice.lrDate ? `(${formatDate(selectedInvoice.lrDate)})` : ''}</span>
                      </div>
                    )}
                    {selectedInvoice.ewayBillNo && (
                      <div>
                        <span className="text-slate-400 block">E-Way Bill</span>
                        <span className="text-slate-800 font-bold">{selectedInvoice.ewayBillNo}</span>
                      </div>
                    )}
                    {((selectedInvoice.netWeight && selectedInvoice.netWeight > 0) || (selectedInvoice.grossWeight && selectedInvoice.grossWeight > 0)) && (
                      <div className="col-span-2 bg-white p-2 rounded-lg border border-slate-200/80 flex justify-between items-center text-[10px] mt-1">
                        <span>Gross: <b>{selectedInvoice.grossWeight || 0} MT</b></span>
                        <span>Tare: <b>{selectedInvoice.tareWeight || 0} MT</b></span>
                        <span className="text-emerald-700 font-extrabold">Net Wt: {selectedInvoice.netWeight || ((selectedInvoice.grossWeight || 0) - (selectedInvoice.tareWeight || 0))} MT</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed Invoice Items</span>
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {selectedInvoice.items.map((item, idx) => {
                    const unitRate = item.rate || item.settledRate || item.baseRate || 0;
                    return (
                      <div key={idx} className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0 space-y-1">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{commodities.find(c => c.id === item.item || c._id === item.item)?.name || item.item}</span>
                          <span>₹{unitRate.toLocaleString()} / Unit</span>
                        </div>
                        <div className="grid grid-cols-3 text-[10px] font-semibold text-slate-500 leading-tight">
                          <span>PO Ordered: {item.poQty}</span>
                          <span>GRN Accepted: {item.receivedQty}</span>
                          <span className="text-primary-600">Billed: {item.invoiceQty}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between items-center font-bold text-xs text-slate-800">
                  <span>Grand Total Pay:</span>
                  <span>₹{(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Summary */}
              {['Approved', 'Partially Paid', 'Paid'].includes(selectedInvoice.status) && (
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs font-semibold text-slate-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Status</span>
                    <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${
                      selectedInvoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                      selectedInvoice.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedInvoice.status === 'Paid' ? 'Fully Settled' : selectedInvoice.status === 'Partially Paid' ? 'Partially Paid' : 'Pending Payment'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Invoice Amount:</span>
                    <span className="text-slate-800">₹{(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Total Preliminary Value:</span>
                    <span>₹{(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Next Workflow Steps: Pre-QC Invoice progresses to QC and Inward GRN */}
              <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11px]">
                  <ArrowRight size={13} className="text-blue-600" />
                  <span>Next Procurement Steps</span>
                </div>
                <p className="text-[10px] text-blue-700">
                  This is a <b>Pre-QC Preliminary Invoice</b>. Final settled billing and vendor payment clearance will be processed in <b>Final Invoices (With QC)</b> &amp; <b>Vendor Payments</b>.
                </p>
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    onClick={() => router.push(`/procurement/qc?invoice=${selectedInvoice.invoiceNo}&po=${selectedInvoice.poNumber}`)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <span>Step 5: Perform Quality Inspection (QC)</span>
                  </button>
                  <button
                    onClick={() => router.push(`/procurement/grn?invoice=${selectedInvoice.invoiceNo}&po=${selectedInvoice.poNumber}`)}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer"
                  >
                    <span>Step 6: Inward Vehicle at GRN Gate</span>
                  </button>
                </div>
              </div>

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

                {(selectedInvoice.status === 'Matched' || selectedInvoice.status === 'Mismatch' || selectedInvoice.status === 'Disputed') && currentUserRole === 'Super Admin' && (
                  <div className="flex gap-2 animate-fade-in pt-1">
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
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Supplier Invoice: ${selectedInvoice?.invoiceNo}` : isViewMode ? `View Supplier Invoice: ${selectedInvoice?.invoiceNo}` : 'Process Supplier Billing Invoice (From Purchase Order)'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify billing parameters received from supplier invoice.' : isViewMode ? 'Detailed view of the billing invoice.' : 'Select Purchase Order (PO) to auto-populate items, quantities, rates, and register vendor billing.'}</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); setIsViewMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Purchase Order (PO) *</label>
                  <select
                    value={poNo}
                    onChange={e => handlePoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    disabled={isViewMode}
                    required
                  >
                    <option value="">Select Purchase Order</option>
                    {availablePOs.map(po => {
                      const partyName = po.partyType === 'supplier' ? suppliers.find(s => s.id === po.partyId)?.name : farmers.find(f => f.id === po.partyId)?.name;
                      return (
                        <option key={po.id} value={po.poNo}>{po.poNo} - {partyName || 'Vendor'} (₹{(po.total || 0).toLocaleString()})</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Supplier Invoice No *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-4589"
                    required
                    disabled={isViewMode}
                  />
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
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Other charges (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={otherCharges || ''}
                    onChange={e => setOtherCharges(Number(e.target.value))}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Vehicle & Logistics Section */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Truck size={15} className="text-primary-600" />
                    <span>Vehicle & Transport Logistics</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Inward transport, bilty & weighbridge scale readings</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Vehicle / Truck No</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={vehicleNo}
                      onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                      placeholder="e.g. BR-01-GB-4590"
                      disabled={isViewMode}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Driver Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      disabled={isViewMode}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Driver Phone / Mobile</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Transporter / Carrier</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={transporter}
                      onChange={e => setTransporter(e.target.value)}
                      placeholder="e.g. Patna Roadways Logistics"
                      disabled={isViewMode}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">LR / Bilty Number</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={lrNumber}
                      onChange={e => setLrNumber(e.target.value)}
                      placeholder="e.g. LR-98342"
                      disabled={isViewMode}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">LR Date</label>
                    <IndianDateInput
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={lrDate}
                      onChange={val => setLrDate(val)}
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">E-Way Bill No</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={ewayBillNo}
                      onChange={e => setEwayBillNo(e.target.value)}
                      placeholder="e.g. 581290384192"
                      disabled={isViewMode}
                    />
                  </div>

                  <div className="sm:col-span-3 grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200/80 items-end">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Gross Wt (MT)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                        value={grossWeight || ''}
                        onChange={e => handleGrossWeightChange(Number(e.target.value))}
                        placeholder="0.00"
                        disabled={isViewMode}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Tare Wt (MT)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                        value={tareWeight || ''}
                        onChange={e => handleTareWeightChange(Number(e.target.value))}
                        placeholder="0.00"
                        disabled={isViewMode}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-emerald-600 uppercase block mb-1">Net Wt (MT)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-emerald-200 bg-emerald-50/40 text-emerald-800 rounded-lg text-xs font-bold"
                        value={netWeight || (grossWeight && tareWeight ? Math.max(0, grossWeight - tareWeight) : '') || ''}
                        onChange={e => setNetWeight(Number(e.target.value))}
                        placeholder="0.00"
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Items grid */}
              {itemsList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Configure billed quantities & unit rates</span>
                  
                  <div className="space-y-3 font-semibold text-xs text-slate-700">
                    {itemsList.map((item, idx) => {
                      const comm = commodities.find(c => c.id === item.item || c._id === item.item || c.name?.toLowerCase() === (item.item || '').toLowerCase());

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
                                GST: {item.taxPercent || 0}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold space-x-2">
                              <span>PO Ordered: {item.poQty} MT</span>
                              {item.receivedQty > 0 ? (
                                <span className="text-emerald-600">GRN Inwarded: {item.receivedQty} MT</span>
                              ) : (
                                <span className="text-amber-600 font-medium">Awaiting GRN Inward</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-3">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Billed Qty (MT) *</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                                value={item.invoiceQty || ''}
                                onChange={e => handleItemValueChange(idx, 'invoiceQty', Number(e.target.value))}
                                required
                                disabled={isViewMode}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Unit Rate (₹) *</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                                value={item.rate || ''}
                                onChange={e => handleItemValueChange(idx, 'rate', Number(e.target.value))}
                                required
                                disabled={isViewMode}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Discount (₹)</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                                value={item.discount || 0}
                                onChange={e => handleItemValueChange(idx, 'discount', Number(e.target.value))}
                                disabled={isViewMode}
                              />
                            </div>
                            <div className="col-span-3 text-right">
                              <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Line Total (incl. GST)</span>
                              <span className="font-extrabold text-slate-800 block text-xs">₹{(item.amount ?? 0).toLocaleString()}</span>
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
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Billed Grand Total Payable</span>
                  <span className="text-sm font-bold text-emerald-700">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-500 leading-normal font-semibold">
                  <span>Items Subtotal: ₹{subtotal.toLocaleString()}</span> <br />
                  <span>Freight Charges: ₹{totalCharges.toLocaleString()}</span> <br />
                  <span>GST Taxes: ₹{totalTax.toLocaleString()}</span>
                  {Number(discount) > 0 && <><br /><span className="text-rose-600">Discount: -₹{Number(discount).toLocaleString()}</span></>}
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
    </div>
  );
}
