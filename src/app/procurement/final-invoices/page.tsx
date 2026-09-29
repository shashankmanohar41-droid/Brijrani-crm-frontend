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
import { FileText, Plus, Landmark, CheckCircle, AlertTriangle, HelpCircle, Download, FileCheck, ArrowRight, ShieldCheck, Edit3, Wallet, Eye, Trash2, Truck, Clock, Lock, Sparkles, Scale, DollarSign } from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function FinalPurchaseInvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Form states for Final Invoice Header
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

  const [selectedSource, setSelectedSource] = useState<string>('');

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

  const availableQCs = useMemo(() => {
    return (qcList || []).filter((q: any) => q.status === 'Approved' || q.status === 'Submitted');
  }, [qcList]);

  const availablePOs = useMemo(() => {
    return db.purchaseOrders.filter(p => {
      return p.status === 'Approved' || p.status === 'Sent' || p.status === 'Partially Received' || p.status === 'Received';
    });
  }, [db.purchaseOrders]);

  const availableGRNs = useMemo(() => {
    return db.grns.filter(g => g.inwardStatus === 'Completed' || g.status === 'Completed' || g.status === 'Accepted' || g.invoiceNo || g.poNo);
  }, [db.grns]);

  const availablePreliminaryInvoices = useMemo(() => {
    return (db.purchaseInvoices || []).filter(i => !i.isFinalInvoice && i.invoiceType !== 'Final');
  }, [db.purchaseInvoices]);

  // Generate unique auto invoice number
  const generateAutoInvoiceNo = (refCode?: string) => {
    const yearMonth = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `FIN-${yearMonth}-${rand}`;
  };

  // Helper to populate items directly from QC with auto quality rebate deduction & Master Hub Tax
  const populateItemsFromQC = (qc: any) => {
    if (!qc) return;
    setQcId(qc._id || qc.id);
    setQcNo(qc.qcNumber || '');
    if (qc.poNumber || qc.referenceNumber) setPoNo(qc.poNumber || qc.referenceNumber);
    if (qc.grnNumber) setGrnNo(qc.grnNumber);
    if (qc.vehicleNo || qc.vehicleNumber) setVehicleNo(qc.vehicleNo || qc.vehicleNumber);
    if (qc.driverName) setDriverName(qc.driverName);
    if (qc.transporter) setTransporter(qc.transporter);
    if (qc.grossWeight) setGrossWeight(qc.grossWeight);
    if (qc.tareWeight) setTareWeight(qc.tareWeight);
    if (qc.netWeight) setNetWeight(qc.netWeight);

    // Fetch Master Hub Commodity for Tax Rate and HSN
    const comm = db.commodities.find(c => 
      (qc.commodityId && (c.id === qc.commodityId || c._id === qc.commodityId)) ||
      (qc.commodityName && c.name?.toLowerCase() === qc.commodityName?.toLowerCase())
    ) || db.commodities[0];

    const taxRate = comm?.defaultGst !== undefined ? Number(comm.defaultGst) : 5;
    const baseRate = Number(qc.baseRate || 0);
    const rebatePerUnit = Number(qc.totalRebate || 0);
    const settledRate = Number(qc.finalRate !== undefined ? qc.finalRate : (baseRate - rebatePerUnit));
    const invoiceQty = Number(qc.quantity || 0);
    const sub = invoiceQty * settledRate;
    const taxVal = Math.round(sub * (taxRate / 100));

    const invoiceItems: PurchaseInvoiceItem[] = [{
      item: comm?.id || comm?._id || qc.commodityName || 'MAIZE',
      poQty: invoiceQty,
      receivedQty: invoiceQty,
      invoiceQty: invoiceQty,
      baseRate: baseRate,
      qualityRebatePerUnit: rebatePerUnit,
      qualityRebateTotal: Number(qc.totalDeduction || (rebatePerUnit * invoiceQty)),
      settledRate: settledRate,
      rate: settledRate,
      discount: 0,
      taxPercent: taxRate,
      taxAmount: taxVal,
      amount: sub + taxVal
    }];

    setItemsList(invoiceItems);
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFreight(0);
    setOtherCharges(0);
    setDiscount(0);
    if (!invoiceNo) {
      setInvoiceNo(generateAutoInvoiceNo(qc.qcNumber));
    }
    setRemarks(`Final Settlement Invoice after QC deduction (QC Slip: ${qc.qcNumber} - Base Rate: ₹${baseRate}/MT, QC Rebate: -₹${rebatePerUnit}/MT, Final Net Rate: ₹${settledRate}/MT)`);
  };

  const handleQcChange = (selectedQcId: string) => {
    setQcId(selectedQcId);
    if (!selectedQcId) {
      setQcNo('');
      return;
    }
    const qc = (qcList || []).find((q: any) => (q._id || q.id) === selectedQcId || q.qcNumber === selectedQcId);
    if (qc) {
      populateItemsFromQC(qc);
    }
  };

  const handleGrnChange = (selectedRef: string) => {
    if (!selectedRef) {
      setGrnNo('');
      return;
    }

    const grn = db.grns.find(g => g.grnNo === selectedRef || g.id === selectedRef || g.invoiceNo === selectedRef);
    const prelimInv = db.purchaseInvoices.find(i => i.invoiceNo === selectedRef || i.id === selectedRef);

    if (grn) {
      setGrnNo(grn.grnNo);
      if (grn.poNo) setPoNo(grn.poNo);
      if (!invoiceNo) setInvoiceNo(generateAutoInvoiceNo(grn.grnNo));

      // Check if there is an approved QC for this GRN / PO / Invoice
      const matchedQc = (qcList || []).find((q: any) => 
        (q.grnNumber === grn.grnNo || q.poNumber === grn.poNo || q.referenceNumber === grn.poNo || (grn.invoiceNo && q.invoiceNo === grn.invoiceNo)) &&
        (q.status === 'Approved' || q.status === 'Submitted')
      );

      if (matchedQc) {
        populateItemsFromQC(matchedQc);
        setGrnNo(grn.grnNo);
        if (!invoiceNo) setInvoiceNo(generateAutoInvoiceNo(matchedQc.qcNumber));
      } else {
        // Fallback: Populate directly from GRN / PO / preliminary invoice with Master Hub Tax
        const linkedInv = (grn.invoiceId || grn.invoiceNo)
          ? db.purchaseInvoices.find(i => i.id === grn.invoiceId || i.invoiceNo === grn.invoiceNo)
          : db.purchaseInvoices.find(i => i.poNumber === grn.poNo);

        const linkedPo = db.purchaseOrders.find(p => p.poNo === grn.poNo || p.id === grn.poId);

        const comm = db.commodities.find(c => 
          c.id === grn.commodityId || c.id === grn.items?.[0]?.item || (linkedInv && c.id === linkedInv.items?.[0]?.item)
        ) || db.commodities[0];

        const qty = Number(grn.netWeight || grn.acceptedQty || grn.items?.[0]?.acceptedQuantity || grn.receivedQty || linkedInv?.items?.[0]?.invoiceQty || linkedPo?.items?.[0]?.quantity || 100);
        const bRate = Number(linkedInv?.items?.[0]?.baseRate || linkedInv?.items?.[0]?.rate || linkedPo?.items?.[0]?.rate || 25000);
        const taxRate = comm?.defaultGst !== undefined ? Number(comm.defaultGst) : 5;
        const taxVal = Math.round(qty * bRate * (taxRate / 100));

        const invoiceItems: PurchaseInvoiceItem[] = [{
          item: comm?.id || comm?._id || 'MAIZE',
          poQty: qty,
          receivedQty: qty,
          invoiceQty: qty,
          baseRate: bRate,
          qualityRebatePerUnit: 0,
          qualityRebateTotal: 0,
          settledRate: bRate,
          rate: bRate,
          discount: 0,
          taxPercent: taxRate,
          taxAmount: taxVal,
          amount: (qty * bRate) + taxVal
        }];

        setItemsList(invoiceItems);
        setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setRemarks(`Final Settlement Invoice for GRN ${grn.grnNo} (PO: ${grn.poNo || 'N/A'}, Invoice Ref: ${grn.invoiceNo || 'N/A'})`);
      }
    } else if (prelimInv) {
      if (prelimInv.poNumber) setPoNo(prelimInv.poNumber);
      if (prelimInv.grnNumber) setGrnNo(prelimInv.grnNumber);
      if (prelimInv.qcNumber) setQcNo(prelimInv.qcNumber);
      if (prelimInv.qcId) setQcId(prelimInv.qcId);
      if (!invoiceNo) setInvoiceNo(generateAutoInvoiceNo(prelimInv.invoiceNo));

      const matchedQc = (qcList || []).find((q: any) => 
        (q.invoiceNo === prelimInv.invoiceNo || q.poNumber === prelimInv.poNumber || q.referenceNumber === prelimInv.poNumber || (prelimInv.qcNumber && q.qcNumber === prelimInv.qcNumber)) &&
        (q.status === 'Approved' || q.status === 'Submitted')
      );

      if (matchedQc) {
        populateItemsFromQC(matchedQc);
      } else if (prelimInv.items && prelimInv.items.length > 0) {
        setItemsList(prelimInv.items.map(it => {
          const comm = db.commodities.find(c => c.id === it.item || c._id === it.item) || db.commodities[0];
          const taxRate = comm?.defaultGst !== undefined ? Number(comm.defaultGst) : (it.taxPercent || 5);
          const bRate = it.baseRate !== undefined ? it.baseRate : it.rate;
          const qDed = it.qualityRebatePerUnit || 0;
          const sRate = it.settledRate !== undefined ? it.settledRate : Math.max(0, bRate - qDed);
          const sub = (it.invoiceQty || 0) * sRate;
          const tax = Math.round(sub * (taxRate / 100));
          return {
            ...it,
            baseRate: bRate,
            qualityRebatePerUnit: qDed,
            qualityRebateTotal: qDed * (it.invoiceQty || 0),
            settledRate: sRate,
            rate: sRate,
            taxPercent: taxRate,
            taxAmount: tax,
            amount: sub + tax - (it.discount || 0)
          };
        }));
        setDueDate(prelimInv.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setRemarks(`Final Settlement Invoice referencing ${prelimInv.invoiceNo} (PO: ${prelimInv.poNumber || 'N/A'})`);
      }
    }
  };

  // Unified single source selection handler
  const handleSourceSelection = (val: string) => {
    setSelectedSource(val);
    if (!val) {
      setQcId('');
      setQcNo('');
      setGrnNo('');
      setPoNo('');
      setItemsList([]);
      return;
    }
    const [type, ...rest] = val.split(':');
    const id = rest.join(':');

    if (type === 'qc') {
      const q = (qcList || []).find((x: any) => (x._id || x.id) === id || x.qcNumber === id);
      if (q) {
        populateItemsFromQC(q);
      } else {
        handleQcChange(id);
      }
    } else if (type === 'grn') {
      handleGrnChange(id);
    } else if (type === 'inv') {
      handleGrnChange(id);
    }
  };

  // Handle URL query parameters for direct QC/GRN/PO conversion
  const poQueryParam = searchParams.get('po');
  const qcQueryParam = searchParams.get('qc');
  const grnQueryParam = searchParams.get('grn');
  const invoiceQueryParam = searchParams.get('invoice');
  const actionQueryParam = searchParams.get('action');

  useEffect(() => {
    if (qcQueryParam) {
      api.get(`/quality-control/${qcQueryParam}`).then(res => {
        if (res.data?.data) {
          populateItemsFromQC(res.data.data);
          setIsCreateOpen(true);
        }
      }).catch(() => {
        const found = (qcList || []).find((q: any) => (q._id || q.id) === qcQueryParam || q.qcNumber === qcQueryParam);
        if (found) {
          populateItemsFromQC(found);
          setIsCreateOpen(true);
        }
      });
    } else if (grnQueryParam) {
      handleGrnChange(grnQueryParam);
      setIsCreateOpen(true);
    } else if (invoiceQueryParam) {
      handleGrnChange(invoiceQueryParam);
      setIsCreateOpen(true);
    } else if (actionQueryParam === 'new') {
      setIsCreateOpen(true);
    }
  }, [poQueryParam, qcQueryParam, grnQueryParam, invoiceQueryParam, actionQueryParam, qcList]);

  // Edit quantity or rate inside invoice form
  const handleItemValueChange = (index: number, field: 'invoiceQty' | 'rate' | 'baseRate' | 'qualityRebatePerUnit' | 'discount' | 'taxPercent', val: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'invoiceQty') item.invoiceQty = val;
      if (field === 'baseRate') {
        item.baseRate = val;
        item.settledRate = Math.max(0, val - (item.qualityRebatePerUnit || 0));
        item.rate = item.settledRate;
      }
      if (field === 'qualityRebatePerUnit') {
        item.qualityRebatePerUnit = val;
        const bRate = item.baseRate !== undefined ? item.baseRate : item.rate;
        item.settledRate = Math.max(0, bRate - val);
        item.rate = item.settledRate;
      }
      if (field === 'rate') {
        item.rate = val;
        item.settledRate = val;
      }
      if (field === 'discount') item.discount = val;
      if (field === 'taxPercent') item.taxPercent = Math.max(0, val);

      const netRate = item.settledRate !== undefined ? item.settledRate : item.rate;
      const sub = (item.invoiceQty || 0) * netRate;
      const taxRate = item.taxPercent !== undefined ? item.taxPercent : 0;
      item.taxAmount = Math.round(sub * (taxRate / 100));
      item.amount = sub + item.taxAmount - (item.discount || 0);
      item.qualityRebateTotal = (item.qualityRebatePerUnit || 0) * (item.invoiceQty || 0);
      updated[index] = item;
      return updated;
    });
  };

  // Comprehensive totals calculations
  const baseSubtotal = itemsList.reduce((sum, i) => sum + (i.invoiceQty * (i.baseRate !== undefined ? i.baseRate : i.rate || 0)), 0);
  const totalQualityRebateDeduction = itemsList.reduce((sum, i) => sum + (i.qualityRebateTotal !== undefined ? i.qualityRebateTotal : ((i.qualityRebatePerUnit || 0) * i.invoiceQty)), 0);
  const subtotal = itemsList.reduce((sum, i) => sum + (i.invoiceQty * (i.settledRate !== undefined ? i.settledRate : i.rate || 0)), 0);
  const totalTax = itemsList.reduce((sum, i) => sum + i.taxAmount, 0);
  const totalCharges = Number(freight) + Number(otherCharges);
  const grandTotal = subtotal + totalTax + totalCharges - Number(discount);

  // Active QC record
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
    if (!confirm('Are you sure you want to delete this Final Invoice?')) return;
    erpService.purchaseInvoices.delete(selectedInvoice.id);
    refreshDb();
    setSelectedInvoice(null);
    showToast('Final Invoice deleted successfully', 'success');
  };

  // Submit Final Invoice
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNo || itemsList.length === 0) {
      showToast('Please fill all mandatory fields (Invoice No, Items) and verify rates', 'error');
      return;
    }

    const po = db.purchaseOrders.find(p => p.poNo === poNo || p.id === poNo);
    const grn = grnNo ? db.grns.find(g => g.grnNo === grnNo) : null;
    const qc = (qcId || qcNo) ? (qcList || []).find((q: any) => (q._id || q.id) === qcId || q.qcNumber === qcNo) : null;

    if (isEditMode && selectedInvoice) {
      const updatedInvoice: PurchaseInvoice = {
        ...selectedInvoice,
        invoiceNo,
        poNumber: po ? po.poNo : (selectedInvoice.poNumber || poNo),
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
        isFinalInvoice: true,
        invoiceType: 'Final',
        baseSubtotal,
        qualityRebateDeduction: totalQualityRebateDeduction,
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
      setSelectedInvoice(updatedInvoice);
      showToast(`Final Invoice ${invoiceNo} updated successfully!`, 'success');
      return;
    }

    const id = `INV-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];
    const partyId = po ? po.partyId : (qc?.partyId || (db.farmers[0]?.id || db.farmers[0]?._id));
    const partyType = po ? po.partyType : (qc?.partyType || 'farmer');
    const poNumber = po ? po.poNo : (qc?.poNumber || qc?.referenceNumber || poNo || 'DIRECT');
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
      baseSubtotal,
      qualityRebateDeduction: totalQualityRebateDeduction,
      subtotal,
      discount,
      cgst: Math.round(totalTax / 2),
      sgst: Math.round(totalTax / 2),
      igst: 0,
      freight: Number(freight),
      otherCharges: Number(otherCharges),
      roundOff: 0,
      grandTotal,
      isFinalInvoice: true,
      invoiceType: 'Final',
      status: 'Matched',
      items: itemsList,
      remarks
    };

    const checkMatch = erpService.verifyThreeWayMatch(newInvoice);
    newInvoice.status = checkMatch.isMatch ? 'Matched' : 'Mismatch';
    if (!checkMatch.isMatch) newInvoice.mismatchReason = checkMatch.details.join('; ');

    erpService.purchaseInvoices.create(newInvoice);
    refreshDb();
    setIsCreateOpen(false);
    setSelectedInvoice(newInvoice);
    showToast(`Final Settlement Invoice ${invoiceNo} generated with QC deductions applied!`, 'success');
  };

  // Record Payment Handler
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

    erpService.purchaseInvoices.update(updatedInvoice);

    // Post Payment Voucher to Finance Ledger
    const partyName = selectedInvoice.partyType === 'supplier'
      ? suppliers.find(s => s.id === selectedInvoice.supplierId)?.name || 'Supplier'
      : farmers.find(f => f.id === selectedInvoice.supplierId)?.name || 'Farmer';

    erpService.postVoucher({
      voucherType: 'Payment',
      date: paymentDate || new Date().toISOString().split('T')[0],
      referenceNo: selectedInvoice.invoiceNo,
      partyId: selectedInvoice.supplierId,
      partyType: selectedInvoice.partyType || 'supplier',
      amount: paymentAmount,
      paymentMode: paymentMode as any,
      cashBankLink: paymentAccount || 'HDFC Bank Oper A/c',
      debitAccount: `${partyName} Accounts Payable`,
      creditAccount: paymentAccount || 'HDFC Bank Oper A/c',
      narration: `Final Invoice Settlement for ${selectedInvoice.invoiceNo} (PO: ${selectedInvoice.poNumber || 'N/A'})${paymentNotes ? ' - ' + paymentNotes : ''}`
    }, currentUserRole);

    refreshDb();
    setSelectedInvoice(updatedInvoice);
    setIsPaymentModalOpen(false);
    setPaymentAmount(0);
    setPaymentReference('');
    setPaymentNotes('');
    showToast(`Payment of ₹${paymentAmount.toLocaleString()} recorded & posted to Finance!`, 'success');
  };

  // Download PDF
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
    doc.text("FINAL COMMERCIAL PURCHASE INVOICE & QC SETTLEMENT", 14, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice No:     ${invoice.invoiceNo}`, 14, 46);
    doc.text(`Invoice Date:   ${formatDate(invoice.invoiceDate)}`, 14, 52);
    doc.text(`Due Date:       ${formatDate(invoice.dueDate)}`, 14, 58);
    doc.text(`PO Number:      ${invoice.poNumber || 'N/A'}`, 14, 64);
    doc.text(`GRN Link:       ${invoice.grnNumber || 'N/A'}`, 14, 70);
    doc.text(`QC Slip:        ${invoice.qcNumber || 'Approved'}`, 14, 76);
    doc.text(`Settlement:     ${invoice.status}`, 14, 82);

    const supName = invoice.partyType === 'supplier'
      ? suppliers.find(s => s.id === invoice.supplierId)?.name
      : farmers.find(f => f.id === invoice.supplierId)?.name;

    doc.setFont("Helvetica", "bold");
    doc.text("SUPPLIER / FARMER:", 120, 46);
    doc.setFont("Helvetica", "normal");
    doc.text(supName || 'Vendor', 120, 52);
    doc.text(`GSTIN: ${invoice.supplierGSTIN || 'N/A'}`, 120, 58);
    doc.text(`Terms: ${invoice.paymentTerms || '30 Days'}`, 120, 64);

    const tableTop = 96;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Item Description", 16, tableTop + 5.5);
    doc.text("Qty (MT)", 75, tableTop + 5.5, { align: "right" });
    doc.text("Base Rate", 102, tableTop + 5.5, { align: "right" });
    doc.text("QC Rebate", 130, tableTop + 5.5, { align: "right" });
    doc.text("Settled Rate", 160, tableTop + 5.5, { align: "right" });
    doc.text("Line Total (₹)", 194, tableTop + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    let itemY = tableTop + 14;
    invoice.items.forEach(it => {
      const commName = commodities.find(c => c.id === it.item || c._id === it.item)?.name || it.item;
      const bRate = it.baseRate !== undefined ? it.baseRate : it.rate;
      const qRebate = it.qualityRebatePerUnit || 0;
      const sRate = it.settledRate !== undefined ? it.settledRate : it.rate;

      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${it.invoiceQty}`, 75, itemY, { align: "right" });
      doc.text(`₹${bRate.toLocaleString()}`, 102, itemY, { align: "right" });
      doc.text(qRebate > 0 ? `-₹${qRebate.toLocaleString()}` : "₹0", 130, itemY, { align: "right" });
      doc.text(`₹${sRate.toLocaleString()}`, 160, itemY, { align: "right" });
      doc.text(`₹${it.amount.toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    doc.line(14, itemY - 3, 196, itemY - 3);

    const pdfBaseSub = invoice.baseSubtotal !== undefined ? invoice.baseSubtotal : (invoice.subtotal + (invoice.qualityRebateDeduction || 0));
    const pdfQcDeduction = invoice.qualityRebateDeduction || 0;

    const summaryX = 120;
    doc.text("Original Base Total:", summaryX, itemY + 2);
    doc.text(`₹${pdfBaseSub.toLocaleString()}`, 194, itemY + 2, { align: "right" });

    if (pdfQcDeduction > 0) {
      doc.setTextColor(225, 29, 72);
      doc.text("Less: QC Deduction:", summaryX, itemY + 7);
      doc.text(`-₹${pdfQcDeduction.toLocaleString()}`, 194, itemY + 7, { align: "right" });
      doc.setTextColor(71, 85, 105);
      itemY += 5;
    }

    doc.text("Net Settled Subtotal:", summaryX, itemY + 7);
    doc.text(`₹${invoice.subtotal.toLocaleString()}`, 194, itemY + 7, { align: "right" });
    
    doc.text("Freight & Charges:", summaryX, itemY + 12);
    doc.text(`₹${((invoice.freight || 0) + (invoice.otherCharges || 0)).toLocaleString()}`, 194, itemY + 12, { align: "right" });

    doc.text("GST Taxes:", summaryX, itemY + 17);
    doc.text(`₹${(((invoice.cgst || 0) * 2) || (invoice.igst || 0)).toLocaleString()}`, 194, itemY + 17, { align: "right" });

    doc.line(115, itemY + 21, 196, itemY + 21);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text("Grand Total Pay:", summaryX, itemY + 27);
    doc.text(`₹${invoice.grandTotal.toLocaleString()}`, 194, itemY + 27, { align: "right" });
    doc.setTextColor(71, 85, 105);

    // Payment History on PDF
    if (invoice.paymentHistory && invoice.paymentHistory.length > 0) {
      let payY = itemY + 38;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("PAYMENT SETTLEMENT HISTORY:", 14, payY);
      payY += 6;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      invoice.paymentHistory.forEach((p, pIdx) => {
        doc.text(`${pIdx + 1}. ${formatDate(p.date)} - ${p.mode} (${p.account}) - Ref: ${p.reference || 'N/A'}: Rs. ${p.amount.toLocaleString()}`, 14, payY);
        payY += 5;
      });
      doc.setFont("Helvetica", "bold");
      const paid = invoice.amountPaid || 0;
      const bal = invoice.remainingAmount !== undefined ? invoice.remainingAmount : (invoice.grandTotal - paid);
      doc.text(`Total Paid: Rs. ${paid.toLocaleString()} | Outstanding Balance: Rs. ${bal.toLocaleString()}`, 14, payY + 2);
    }

    const cleanFileName = `final_invoice_${(invoice.invoiceNo || 'voucher').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    doc.save(cleanFileName);
    showToast(`Final Invoice PDF downloaded (${cleanFileName})`, 'success');
  };

  const columns = [
    { header: 'Final Invoice No', accessor: 'invoiceNo' as keyof PurchaseInvoice, sortable: true },
    { 
      header: 'Supplier / Farmer', 
      accessor: (row: PurchaseInvoice) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.supplierId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.supplierId)?.name || 'Unknown';
      }
    },
    { 
      header: 'Reference PO / GRN', 
      accessor: (row: PurchaseInvoice) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-800">{row.poNumber || '-'}</span>
          {row.grnNumber && <div className="text-[10px] text-slate-400 font-medium">GRN: {row.grnNumber}</div>}
        </div>
      )
    },
    { 
      header: 'Original Base Price', 
      accessor: (row: PurchaseInvoice) => {
        const baseAmt = row.baseSubtotal !== undefined ? row.baseSubtotal : (row.subtotal + (row.qualityRebateDeduction || 0));
        return (
          <div>
            <div className="text-xs font-bold text-slate-700">₹{baseAmt.toLocaleString()}</div>
            {row.items?.[0]?.baseRate ? (
              <div className="text-[10px] text-slate-400 font-medium">@ ₹{row.items[0].baseRate.toLocaleString()}/MT</div>
            ) : null}
          </div>
        );
      }
    },
    { 
      header: 'QC Deduction', 
      accessor: (row: PurchaseInvoice) => {
        const ded = row.qualityRebateDeduction || 0;
        return (
          <div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              ded > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {ded > 0 ? `-₹${ded.toLocaleString()}` : '₹0 (No ded.)'}
            </span>
            {row.items?.[0]?.qualityRebatePerUnit ? (
              <div className="text-[9px] text-rose-600 font-semibold mt-0.5">(-₹{row.items[0].qualityRebatePerUnit}/MT)</div>
            ) : null}
          </div>
        );
      }
    },
    { 
      header: 'Net Settled Subtotal', 
      accessor: (row: PurchaseInvoice) => (
        <div>
          <div className="text-xs font-extrabold text-emerald-800">₹{(row.subtotal ?? 0).toLocaleString()}</div>
          {row.items?.[0]?.settledRate || row.items?.[0]?.rate ? (
            <div className="text-[10px] text-emerald-600 font-semibold">@ ₹{(row.items[0].settledRate || row.items[0].rate).toLocaleString()}/MT</div>
          ) : null}
        </div>
      )
    },
    { 
      header: 'GST Tax', 
      accessor: (row: PurchaseInvoice) => {
        const totalTaxAmt = ((row.cgst || 0) + (row.sgst || 0) + (row.igst || 0)) || (row.items?.reduce((s, i) => s + (i.taxAmount || 0), 0) || 0);
        const taxRate = row.items?.[0]?.taxPercent !== undefined ? row.items[0].taxPercent : (totalTaxAmt > 0 ? 5 : 0);
        return (
          <div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              totalTaxAmt > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {totalTaxAmt > 0 ? `+₹${totalTaxAmt.toLocaleString()}` : '₹0 (0%)'}
            </span>
            {totalTaxAmt > 0 ? (
              <div className="text-[9px] text-indigo-600 font-semibold mt-0.5">GST ({taxRate}%)</div>
            ) : null}
          </div>
        );
      }
    },
    { 
      header: 'Grand Total Pay', 
      accessor: (row: PurchaseInvoice) => (
        <span className="font-extrabold text-xs text-slate-900">₹{(row.grandTotal ?? 0).toLocaleString()}</span>
      )
    },
    { 
      header: 'Payment Status', 
      accessor: (row: PurchaseInvoice) => {
        const isPaid = row.status === 'Paid';
        const isPartial = row.status === 'Partially Paid';
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            isPartial ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            {isPaid ? 'Fully Paid' : isPartial ? 'Partially Paid' : 'Pending Payment'}
          </span>
        );
      }
    }
  ];

  const finalInvoices = useMemo(() => {
    return (db.purchaseInvoices || []).filter(inv => inv.isFinalInvoice === true || inv.invoiceType === 'Final');
  }, [db.purchaseInvoices]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Final Purchase Invoices (Post-QC Settlement)</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              QC Deductions Subtracted
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Final commercial billing created after Quality Control deductions, inwarded GRN weighbridge weights, and vendor payment tracking.</p>
        </div>
        <button
          onClick={() => {
            setSelectedInvoice(null);
            setIsEditMode(false);
            setIsViewMode(false);
            const autoNo = `FIN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
            setInvoiceNo(autoNo);
            setSelectedSource('');
            setPoNo('');
            setQcId('');
            setQcNo('');
            setGrnNo('');
            setFreight(0);
            setOtherCharges(0);
            setDiscount(0);
            setRemarks('');
            setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setItemsList([]);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Make Final Invoice</span>
        </button>
      </div>

      {/* Main Grid: Data Table + Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <DataTable
              columns={columns}
              data={finalInvoices}
              onRowClick={row => setSelectedInvoice(row)}
            />
          </div>
        </div>

        {/* Invoice Inspector Drawer */}
        <div className="space-y-4">
          {selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Final Invoice: {selectedInvoice.invoiceNo}</h3>
                  <p className="text-[10px] text-slate-400">Date: {formatDate(selectedInvoice.invoiceDate)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  selectedInvoice.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  selectedInvoice.status === 'Partially Paid' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {selectedInvoice.status.toUpperCase()}
                </span>
              </div>

              {/* Header Info */}
              <div className="space-y-2 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Supplier / Farmer:</span>
                  <span className="text-slate-800 font-bold">
                    {selectedInvoice.partyType === 'supplier'
                      ? suppliers.find(s => s.id === selectedInvoice.supplierId)?.name
                      : farmers.find(f => f.id === selectedInvoice.supplierId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PO Number:</span>
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
              </div>

              {/* Settlement Price Breakdown Box */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs font-semibold">
                <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Scale size={13} className="text-emerald-700" />
                  <span>QC Settlement & Commercial Price Breakdown</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Original Base Amount:</span>
                  <span className="font-bold text-slate-800">
                    ₹{(selectedInvoice.baseSubtotal !== undefined ? selectedInvoice.baseSubtotal : (selectedInvoice.subtotal + (selectedInvoice.qualityRebateDeduction || 0))).toLocaleString()}
                  </span>
                </div>
                {(selectedInvoice.qualityRebateDeduction || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Less: QC Quality Deduction:</span>
                    <span>-₹{(selectedInvoice.qualityRebateDeduction || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-800 font-extrabold border-t border-emerald-200 pt-1">
                  <span>Net Settled Subtotal:</span>
                  <span>₹{(selectedInvoice.subtotal ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-indigo-700 font-bold text-[11px]">
                  <span>GST Taxes (CGST + SGST):</span>
                  <span>+₹{(((selectedInvoice.cgst || 0) * 2) || (selectedInvoice.igst || 0) || selectedInvoice.items?.reduce((s, i) => s + (i.taxAmount || 0), 0) || 0).toLocaleString()}</span>
                </div>
                {((selectedInvoice.freight || 0) + (selectedInvoice.otherCharges || 0)) > 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Freight & Other Charges:</span>
                    <span>+₹{((selectedInvoice.freight || 0) + (selectedInvoice.otherCharges || 0)).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-emerald-300 pt-1.5 mt-1">
                  <span>Net Grand Total Pay:</span>
                  <span className="text-emerald-700">₹{(selectedInvoice.grandTotal ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Items Table with full price details */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed Items (Price & GST Details)</span>
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className="text-xs border-b border-slate-150 pb-2.5 last:border-0 last:pb-0 space-y-1">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{commodities.find(c => c.id === item.item || c._id === item.item)?.name || item.item}</span>
                        <span className="text-emerald-800 font-extrabold">₹{(item.amount ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                        <div>Base Rate: <b className="text-slate-700">₹{(item.baseRate !== undefined ? item.baseRate : item.rate).toLocaleString()}/MT</b></div>
                        <div>QC Rebate: <b className="text-rose-600">{(item.qualityRebatePerUnit || 0) > 0 ? `-₹${item.qualityRebatePerUnit}/MT` : '₹0'}</b></div>
                        <div>Net Settled Rate: <b className="text-emerald-700">₹{(item.settledRate !== undefined ? item.settledRate : item.rate).toLocaleString()}/MT</b></div>
                        <div>Billed Qty: <b className="text-slate-700">{item.invoiceQty} MT</b></div>
                        <div className="col-span-2 text-indigo-700 font-semibold">
                          GST Tax: <b>{item.taxPercent || 0}% (+₹{(item.taxAmount || 0).toLocaleString()})</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs font-semibold text-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Payment Status</span>
                  <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${
                    selectedInvoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                    selectedInvoice.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedInvoice.status === 'Paid' ? 'Fully Settled' : selectedInvoice.status === 'Partially Paid' ? 'Partially Paid' : 'Pending Payment'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Paid:</span>
                  <span className="text-emerald-700 font-bold">₹{(selectedInvoice.amountPaid ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold border-t border-slate-100 pt-1.5 mt-1.5">
                  <span>Outstanding Balance:</span>
                  <span>₹{(selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment History Log */}
              {selectedInvoice.paymentHistory && selectedInvoice.paymentHistory.length > 0 && (
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Transaction Logs</span>
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {selectedInvoice.status !== 'Paid' && (
                  <button
                    onClick={() => {
                      const remaining = selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : selectedInvoice.grandTotal;
                      setPaymentAmount(remaining);
                      setIsPaymentModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition mb-2"
                  >
                    <Wallet size={14} />
                    <span>Record Vendor Payment</span>
                  </button>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download Final Settlement PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select a Final Purchase Invoice to view settled rates, log vendor payments, or export receipts.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Make Final Purchase Invoice (After QC Deduction)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Select approved Quality Control (QC) or inwarded GRN to automatically calculate net settled price.</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); setIsViewMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Unified Source Reference & Auto Invoice Header */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Select Source Inward / QC Slip *
                    </label>
                    <select
                      value={selectedSource || (qcId ? `qc:${qcId}` : (grnNo ? `grn:${grnNo}` : ''))}
                      onChange={e => handleSourceSelection(e.target.value)}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      disabled={isViewMode}
                    >
                      <option value="">-- Select Completed QC / Inward GRN / Pre-Bill --</option>
                      {availableQCs.length > 0 && (
                        <optgroup label="⭐ Approved QC Inspections (with Quality Rebates)">
                          {availableQCs.map((q: any) => (
                            <option key={`qc-${q._id || q.id}`} value={`qc:${q._id || q.id}`}>
                              QC: {q.qcNumber} — {q.commodityName || 'Cargo'} (Net: ₹{Number(q.finalRate || 0).toLocaleString()}/MT | Rebate: -₹{Number(q.totalRebate || 0).toLocaleString()}/MT)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {availableGRNs.length > 0 && (
                        <optgroup label="📦 Inwarded GRN Slips">
                          {availableGRNs.map((g: any) => (
                            <option key={`grn-${g.id || g.grnNo}`} value={`grn:${g.grnNo}`}>
                              GRN: {g.grnNo} {g.invoiceNo ? `(Inv: ${g.invoiceNo})` : ''} - PO: {g.poNo}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {availablePreliminaryInvoices.length > 0 && (
                        <optgroup label="📄 Preliminary Bills (Pre-QC)">
                          {availablePreliminaryInvoices.map((inv: any) => (
                            <option key={`inv-${inv.id || inv.invoiceNo}`} value={`inv:${inv.invoiceNo}`}>
                              Invoice: {inv.invoiceNo} (PO: {inv.poNumber})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Final Invoice Number
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        value={invoiceNo}
                        onChange={e => setInvoiceNo(e.target.value)}
                        placeholder="Auto Assigned Final Invoice No"
                        required
                        disabled={isViewMode}
                      />
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1.5 rounded-lg font-bold whitespace-nowrap border border-emerald-200">
                        Auto Numbered
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Source Details Strip */}
                {(poNo || grnNo || qcNo) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-400">Linked Records:</span>
                    {poNo && <span className="bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded font-bold">PO: {poNo}</span>}
                    {grnNo && <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-bold">GRN: {grnNo}</span>}
                    {qcNo && <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">QC: {qcNo}</span>}
                  </div>
                )}
              </div>

              {/* QC Deduction Applied Alert */}
              {activeQc && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <div>
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <span>Final Invoice Linked to {activeQc.qcNumber}</span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">QC Approved</span>
                      </div>
                      <p className="text-[10px] text-emerald-700 mt-0.5">
                        Base Rate: <b>₹{Number(activeQc.baseRate || 0).toLocaleString()}</b> &minus; QC Deduction: <b className="text-rose-600">-₹{Number(activeQc.totalRebate || 0).toLocaleString()}/MT</b> = Net Settled Unit Rate: <b className="text-emerald-900 font-extrabold">₹{Number(activeQc.finalRate !== undefined ? activeQc.finalRate : (activeQc.baseRate - (activeQc.totalRebate || 0))).toLocaleString()}/MT</b>
                      </p>
                    </div>
                  </div>
                  <div className="text-right sm:self-auto self-end">
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      Total QC Deduction: -₹{Number(activeQc.totalDeduction || ((activeQc.totalRebate || 0) * (activeQc.quantity || 0))).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight (₹)</label>
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

              {/* Items Table */}
              {itemsList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Settled Quantities & Price Breakdown</span>
                  <div className="space-y-3 font-semibold text-xs text-slate-700">
                    {itemsList.map((item, idx) => {
                      const comm = commodities.find(c => c.id === item.item || c._id === item.item) || commodities[0];
                      const masterGst = comm?.defaultGst !== undefined ? Number(comm.defaultGst) : 5;
                      const hsnCode = comm?.hsn || '100590';
                      const currentTaxPercent = item.taxPercent !== undefined ? item.taxPercent : masterGst;

                      return (
                        <div key={idx} className="bg-white p-3.5 border border-slate-100 rounded-lg space-y-3">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{comm?.name || item.item}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                HSN: {hsnCode}
                              </span>
                            </div>
                            <span className="text-emerald-700">Net Settled Rate: ₹{(item.settledRate !== undefined ? item.settledRate : item.rate || 0).toLocaleString()} / MT</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Original Base Rate (₹)</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50"
                                value={item.baseRate !== undefined ? item.baseRate : (item.rate || '')}
                                onChange={e => handleItemValueChange(idx, 'baseRate', Number(e.target.value))}
                                disabled={isViewMode}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-rose-600 block mb-0.5">QC Rebate Ded. (₹)</label>
                              <input
                                type="number"
                                className="w-full px-2 py-1.5 border border-rose-200 rounded-lg text-xs font-semibold bg-rose-50/50 text-rose-700"
                                value={item.qualityRebatePerUnit || ''}
                                onChange={e => handleItemValueChange(idx, 'qualityRebatePerUnit', Number(e.target.value))}
                                disabled={isViewMode}
                              />
                            </div>
                            <div>
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
                            <div className="text-right">
                              <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Line Total</span>
                              <span className="font-extrabold text-emerald-800 block text-xs">₹{(item.amount ?? 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order total preview */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between items-center text-slate-700 text-[11px]">
                  <span>Original Base Subtotal:</span>
                  <span className="font-bold">₹{baseSubtotal.toLocaleString()}</span>
                </div>
                {totalQualityRebateDeduction > 0 && (
                  <div className="flex justify-between items-center text-rose-600 text-[11px] font-bold">
                    <span>Total QC Deduction:</span>
                    <span>-₹{totalQualityRebateDeduction.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-emerald-800 text-[11px] font-bold border-t border-emerald-100 pt-1">
                  <span>Net Commercial Subtotal:</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-indigo-700 text-[11px] font-bold">
                  <span>GST Taxes (CGST + SGST from Master Hub):</span>
                  <span>+₹{totalTax.toLocaleString()}</span>
                </div>
                {totalCharges > 0 && (
                  <div className="flex justify-between items-center text-slate-500 text-[11px]">
                    <span>Freight & Other Charges:</span>
                    <span>+₹{totalCharges.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-emerald-300 pt-1.5 mt-1 font-extrabold text-sm text-slate-900">
                  <span className="text-emerald-900">Final Settled Payable Total:</span>
                  <span className="text-emerald-700">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setIsEditMode(false); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 transition"
                >
                  Save & Issue Final Invoice
                </button>
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
                <h3 className="text-sm font-semibold text-slate-800">Record Outgoing Vendor Payment</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Issue voucher payment against Final Invoice {selectedInvoice.invoiceNo}.</p>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account *</label>
                  <select
                    value={paymentAccount}
                    onChange={e => setPaymentAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                    required
                  >
                    <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                    <option value="SBI Account">SBI Account</option>
                    <option value="Petty Cash">Petty Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transaction Ref / UTR *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="e.g. UTR-982104"
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
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
