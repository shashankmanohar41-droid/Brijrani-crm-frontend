'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService, getDb } from '../../../services/erpService';
import api from '../../../services/axios';
import { GRN, GRNItem, PurchaseOrder, QualityInspection } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Plus, Truck, FileCheck, ShieldAlert, Award, Compass, Scale, ClipboardCheck, Edit3, Download, Eye, Trash2, Wallet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function GRNPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isQcOpen, setIsQcOpen] = useState(false);
  const [qcFilter, setQcFilter] = useState<string>('All');

  // Form states for Header
  const [poId, setPoId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [challanDate, setChallanDate] = useState('');
  const [transporter, setTransporter] = useState('');
  const [remarks, setRemarks] = useState('');

  // Form states for Items list
  const [itemsList, setItemsList] = useState<GRNItem[]>([]);

  // Quality Inspection Form states
  const [moisturePercent, setMoisturePercent] = useState(11.5);
  const [grade, setGrade] = useState<'A' | 'B' | 'C' | 'Rejected'>('A');
  const [damagePercent, setDamagePercent] = useState(1);
  const [foreignMaterialPercent, setForeignMaterialPercent] = useState(0.5);
  const [color, setColor] = useState('Bright Golden');
  const [purityPercent, setPurityPercent] = useState(99.5);
  const [qualityScore, setQualityScore] = useState(92);
  const [qcNotes, setQcNotes] = useState('');
  const [qcItemsRates, setQcItemsRates] = useState<Record<string, { rejected: number; damaged: number }>>({});
  const [specs, setSpecs] = useState<any[]>([]);

  // Fetch quality specifications from Admin master
  useEffect(() => {
    api.get('/procurement/quality-inspections/specs')
      .then(res => setSpecs(res.data?.data || []))
      .catch(err => console.error('Failed to load quality specs in GRN', err));
  }, []);

  // Live evaluation of parameters against Admin policy limits
  const evaluatedBreaches = useMemo(() => {
    if (!selectedGRN) return [];
    const itemId = selectedGRN.items?.[0]?.item;
    const commoditySpecs = specs.filter(s => String(s.commodityId) === String(itemId) || String(s.commodityId) === String(selectedGRN.commodityId));
    const breaches: Array<{
      name: string;
      actualValue: any;
      allowedLimit: string;
      unit?: string;
      isOptional: boolean;
      status: 'PASS' | 'FAIL' | 'WARN';
    }> = [];

    if (commoditySpecs.length > 0) {
      commoditySpecs.forEach(spec => {
        let val: any = undefined;
        const pName = spec.parameterName.toLowerCase();
        if (pName.includes('moisture')) val = moisturePercent;
        else if (pName.includes('foreign')) val = foreignMaterialPercent;
        else if (pName.includes('damage')) val = damagePercent;
        else if (pName.includes('purity') && !pName.includes('score')) val = purityPercent;

        if (val !== undefined && val !== '' && !isNaN(Number(val))) {
          const numVal = Number(val);
          let breached = false;
          if (spec.limitType === '<=' && numVal > (spec.maxLimit ?? 0)) breached = true;
          else if (spec.limitType === '>=' && numVal < (spec.minLimit ?? 0)) breached = true;
          else if (spec.limitType === 'Range' && (numVal < (spec.minLimit ?? 0) || numVal > (spec.maxLimit ?? 0))) breached = true;
          else if (spec.limitType === '=' && spec.minLimit !== undefined && numVal !== spec.minLimit) breached = true;

          const limitLabel = spec.limitType === 'Range' 
            ? `${spec.minLimit}-${spec.maxLimit} ${spec.unit}` 
            : `${spec.limitType} ${spec.maxLimit !== undefined ? spec.maxLimit : spec.minLimit !== undefined ? spec.minLimit : spec.textValue} ${spec.unit}`;

          if (breached) {
            breaches.push({
              name: spec.parameterName,
              actualValue: `${val}${spec.unit ? ' ' + spec.unit : '%'}`,
              allowedLimit: limitLabel,
              unit: spec.unit,
              isOptional: spec.isOptional,
              status: spec.isOptional ? 'WARN' : 'FAIL'
            });
          }
        }
      });
    } else {
      // Default baseline Admin limits
      if (moisturePercent > 12.0) {
        breaches.push({
          name: 'Moisture',
          actualValue: `${moisturePercent}%`,
          allowedLimit: '<= 12.0%',
          unit: '%',
          isOptional: false,
          status: 'FAIL'
        });
      }
      if (foreignMaterialPercent > 2.0) {
        breaches.push({
          name: 'Foreign Material',
          actualValue: `${foreignMaterialPercent}%`,
          allowedLimit: '<= 2.0%',
          unit: '%',
          isOptional: false,
          status: 'FAIL'
        });
      }
      if (damagePercent > 3.0) {
        breaches.push({
          name: 'Damage',
          actualValue: `${damagePercent}%`,
          allowedLimit: '<= 3.0%',
          unit: '%',
          isOptional: false,
          status: 'FAIL'
        });
      }
    }

    return breaches;
  }, [selectedGRN, specs, moisturePercent, foreignMaterialPercent, damagePercent, purityPercent]);

  const hasMandatoryBreach = useMemo(() => {
    return evaluatedBreaches.some(b => !b.isOptional && b.status === 'FAIL');
  }, [evaluatedBreaches]);

  // Lock grade to Rejected when policy breach occurs, or Grade A when passing
  useEffect(() => {
    if (hasMandatoryBreach) {
      setGrade('Rejected');
    }
  }, [hasMandatoryBreach]);

  const approvedPOs = db.purchaseOrders.filter(p => p.status === 'Approved' || p.status === 'Partially Received');
  const warehouses = db.warehouses;
  const commodities = db.commodities;
  const suppliers = db.suppliers;
  const farmers = db.farmers;

  // Find linked purchase invoices for selected PO
  const availableInvoices = useMemo(() => {
    if (!poId) return [];
    const po = db.purchaseOrders.find(p => p.id === poId || p.poNo === poId);
    if (!po) return [];
    return db.purchaseInvoices.filter(i => i.poNumber === po.poNo || i.poNumber === po.id);
  }, [poId, db.purchaseOrders, db.purchaseInvoices]);

  useEffect(() => {
    if (availableInvoices.length > 0) {
      setInvoiceId(availableInvoices[0].id);
      setInvoiceNo(availableInvoices[0].invoiceNo);
    } else {
      setInvoiceId('');
      setInvoiceNo('');
    }
  }, [availableInvoices]);

  // Handle URL query parameters for PO/Invoice-to-GRN conversion
  const poQueryParam = searchParams.get('po');
  const invoiceQueryParam = searchParams.get('invoice');
  useEffect(() => {
    if (poQueryParam) {
      const po = db.purchaseOrders.find(p => p.id === poQueryParam || p.poNo === poQueryParam);
      if (po) {
        // If GRN already exists for this PO, do NOT reopen create dialog; select the existing GRN
        const existingGrn = db.grns.find(g => g.poId === po.id || g.poNo === po.poNo);
        if (existingGrn) {
          setSelectedGRN(existingGrn);
          setIsCreateOpen(false);
        } else {
          setPoId(po.id);
          loadPoItems(po);
          if (invoiceQueryParam) {
            const inv = db.purchaseInvoices.find(i => i.id === invoiceQueryParam || i.invoiceNo === invoiceQueryParam);
            if (inv) {
              setInvoiceId(inv.id);
              setInvoiceNo(inv.invoiceNo);
            }
          }
          setIsCreateOpen(true);
        }
      }
    }
  }, [poQueryParam, invoiceQueryParam, db.purchaseOrders, db.grns, db.purchaseInvoices]);

  // Load items from PO into GRN creation form
  const loadPoItems = (po: PurchaseOrder) => {
    const mappedItems: GRNItem[] = po.items.map(poItem => {
      // Find previously received quantity from existing Completion/Inwarded GRNs
      const previouslyReceived = db.grns
        .filter(g => g.poId === po.id && g.inwardStatus === 'Completed')
        .reduce((sum, g) => {
          const git = g.items?.find(gi => gi.item === poItem.item);
          return sum + (git ? git.acceptedQuantity : 0);
        }, 0);

      const pending = Math.max(0, poItem.quantity - previouslyReceived);

      return {
        item: poItem.item,
        orderedQty: poItem.quantity,
        previouslyReceived,
        receivedNow: pending,
        totalReceived: previouslyReceived + pending,
        pendingQuantity: 0,
        acceptedQuantity: pending,
        rejectedQuantity: 0,
        damagedQuantity: 0,
        unit: poItem.unit,
        batchNo: `BAT-${po.poNo.slice(-4)}-${Date.now().toString().slice(-3)}`
      };
    });
    setItemsList(mappedItems);
  };

  // Handle changing received quantity in creation form
  const handleReceivedQtyChange = (index: number, val: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = updated[index];
      const maxAllowed = item.orderedQty - item.previouslyReceived;
      const actualVal = Math.max(0, Math.min(maxAllowed + 10, val)); // Allow small buffer
      item.receivedNow = actualVal;
      item.acceptedQuantity = actualVal;
      item.totalReceived = item.previouslyReceived + actualVal;
      item.pendingQuantity = Math.max(0, item.orderedQty - item.totalReceived);
      return updated;
    });
  };

  const handleOpenEdit = () => {
    if (!selectedGRN) return;
    setPoId(selectedGRN.poId);
    setVehicleNo(selectedGRN.vehicleNo);
    setDriverName(selectedGRN.driverName || '');
    setChallanNo(selectedGRN.challanNo || '');
    setChallanDate(selectedGRN.challanDate || '');
    setTransporter(selectedGRN.transporter || '');
    setRemarks(selectedGRN.remarks || '');
    setItemsList(selectedGRN.items || []);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleOpenView = () => {
    if (!selectedGRN) return;
    setPoId(selectedGRN.poId);
    setVehicleNo(selectedGRN.vehicleNo);
    setDriverName(selectedGRN.driverName || '');
    setChallanNo(selectedGRN.challanNo || '');
    setChallanDate(selectedGRN.challanDate || '');
    setTransporter(selectedGRN.transporter || '');
    setRemarks(selectedGRN.remarks || '');
    setItemsList(selectedGRN.items || []);
    setIsEditMode(false);
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  const handleDeleteGRN = () => {
    if (!selectedGRN) return;
    if (!confirm('Are you sure you want to delete this GRN?')) return;
    erpService.grns.delete(selectedGRN.id);
    refreshDb();
    setSelectedGRN(null);
    showToast('GRN deleted successfully', 'success');
  };

  // Create GRN
  const handleCreateGRN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || itemsList.length === 0) {
      showToast('Please select a valid PO and configure items', 'error');
      return;
    }

    if (isEditMode && selectedGRN) {
      const updatedGRN: GRN = {
        ...selectedGRN,
        poId,
        poNo: db.purchaseOrders.find(p => p.id === poId)?.poNo || selectedGRN.poNo,
        vehicleNo: vehicleNo.toUpperCase(),
        driverName,
        challanNo,
        challanDate: challanDate || new Date().toISOString().split('T')[0],
        transporter,
        remarks,
        items: itemsList,
        receivedQty: itemsList.reduce((sum, i) => sum + i.receivedNow, 0)
      };
      
      erpService.grns.update(updatedGRN);
      refreshDb();
      setIsCreateOpen(false);
      setIsEditMode(false);
      setVehicleNo('');
      setDriverName('');
      setChallanNo('');
      setTransporter('');
      setRemarks('');
      setSelectedGRN(updatedGRN);
      showToast(`GRN ${selectedGRN.grnNo} updated successfully!`, 'success');
      return;
    }

    const po = db.purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    // Check if GRN already exists for this PO
    const grnExists = db.grns.some(g => g.poId === po.id || g.poNo === po.poNo);
    if (grnExists) {
      showToast(`A GRN has already been created for Purchase Order ${po.poNo}`, 'error');
      return;
    }

    const grn = erpService.createGRNFromPO({
      poId: po.id,
      poNo: po.poNo,
      invoiceId: invoiceId || undefined,
      invoiceNo: invoiceNo || undefined,
      date: new Date().toISOString().split('T')[0],
      partyType: po.partyType,
      partyId: po.partyId,
      vehicleNo: vehicleNo.toUpperCase(),
      driverName,
      arrivalDate: new Date().toISOString().split('T')[0],
      warehouseId: po.warehouseId,
      challanNo,
      challanDate: challanDate || new Date().toISOString().split('T')[0],
      transporter,
      remarks,
      items: itemsList
    });

    refreshDb();
    setIsCreateOpen(false);
    setIsEditMode(false);
    setIsViewMode(false);
    setVehicleNo('');
    setDriverName('');
    setChallanNo('');
    setTransporter('');
    setRemarks('');
    setSelectedGRN(grn);
    router.replace('/procurement/grn');
    showToast(`GRN ${grn.grnNo} recorded. Status: Pending Quality Inspection`, 'success');
  };

  const handleCloseCreateModal = () => {
    setIsCreateOpen(false);
    setIsEditMode(false);
    setIsViewMode(false);
    router.replace('/procurement/grn');
  };

  // Start Quality Inspection Modal
  const handleOpenQc = () => {
    if (!selectedGRN) return;
    
    // Initialize QC item parameters record
    const qcInit: Record<string, { rejected: number; damaged: number }> = {};
    selectedGRN.items.forEach(item => {
      qcInit[item.item] = { rejected: 0, damaged: 0 };
    });
    setQcItemsRates(qcInit);
    setIsQcOpen(true);
  };

  const handleQcItemChange = (itemCode: string, field: 'rejected' | 'damaged', val: number) => {
    setQcItemsRates(prev => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        [field]: Math.max(0, val)
      }
    }));
  };

  // Submit Quality Inspection
  const handleSubmitQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGRN) return;

    const isRejected = hasMandatoryBreach || grade === 'Rejected';
    const overallStatus = isRejected ? 'Rejected' as const : 'Passed' as const;

    const qcItems = selectedGRN.items.map(item => {
      const qcParams = qcItemsRates[item.item] || { rejected: 0, damaged: 0 };
      const rejectedQuantity = isRejected ? item.receivedNow : qcParams.rejected;
      const acceptedQuantity = isRejected ? 0 : Math.max(0, item.receivedNow - qcParams.rejected - qcParams.damaged);
      
      return {
        item: item.item,
        quantity: item.receivedNow,
        moisturePercent,
        grade: isRejected ? 'Rejected' : (grade || 'Grade A'),
        color,
        foreignMaterialPercent,
        damagePercent,
        purityPercent,
        qualityScore: isRejected ? Math.min(qualityScore, 40) : qualityScore,
        status: overallStatus,
        rejectedQuantity,
        damagedQuantity: isRejected ? 0 : qcParams.damaged,
        acceptedQuantity,
        remarks: isRejected 
          ? (evaluatedBreaches.length > 0 
              ? `Rejected by Admin QC Policy: ${evaluatedBreaches.map(b => `${b.name} (${b.actualValue}) > ${b.allowedLimit}`).join('; ')}`
              : qcNotes)
          : (qcNotes || 'Passed Laboratory Inspection')
      };
    });

    try {
      await api.post('/procurement/quality-inspections', {
        grnId: selectedGRN.id || (selectedGRN as any)._id,
        grnNo: selectedGRN.grnNo,
        decision: isRejected ? 'REJECT' : 'ACCEPT',
        grade: isRejected ? 'Rejected' : (grade || 'Grade A'),
        receivedQuantity: selectedGRN.receivedQty || selectedGRN.items.reduce((s, i) => s + i.receivedNow, 0),
        acceptedQuantity: isRejected ? 0 : selectedGRN.items.reduce((s, i) => s + i.receivedNow, 0),
        rejectedQuantity: isRejected ? (selectedGRN.receivedQty || selectedGRN.items.reduce((s, i) => s + i.receivedNow, 0)) : 0,
        notes: isRejected ? `Rejected due to policy limit breach: ${evaluatedBreaches.map(b => `${b.name}`).join(', ')}` : qcNotes,
        items: qcItems
      });
    } catch (err) {
      console.warn('Backend QC submission fallback:', err);
    }

    erpService.submitQualityInspection({
      grnId: selectedGRN.id,
      grnNo: selectedGRN.grnNo,
      inspector: currentUserRole || 'Quality Auditor',
      status: overallStatus,
      notes: isRejected ? `Rejected due to policy limit breach` : qcNotes,
      items: qcItems,
      // Fallbacks
      commodityId: selectedGRN.commodityId,
      batchNo: selectedGRN.batchNo,
      quantity: selectedGRN.receivedQty,
      moisturePercent,
      grade: isRejected ? 'Rejected' : grade,
      weight: selectedGRN.weight,
      color,
      foreignMaterialPercent,
      damagePercent,
      qualityScore: isRejected ? Math.min(qualityScore, 40) : qualityScore
    });

    refreshDb();
    setIsQcOpen(false);
    const updated = getDb().grns.find(g => g.id === selectedGRN.id || g.grnNo === selectedGRN.grnNo);
    if (updated) setSelectedGRN(updated);

    if (isRejected) {
      showToast(`QC Policy Violation: GRN ${selectedGRN.grnNo} rejected due to parameter limit breach.`, 'error');
    } else {
      showToast(`Quality inspection certificate approved. GRN status updated to Passed.`, 'success');
    }
  };

  const handleDownloadPDF = (grn: GRN) => {
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
    doc.text("Email: logistics@brijranierp.com | Phone: +91 9988776655", 14, 29);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("GOODS RECEIPT NOTE (GATE ENTRY SLIP)", 14, 42);

    // Metadata
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`GRN Number:     ${grn.grnNo}`, 14, 50);
    doc.text(`Entry Date:     ${grn.date}`, 14, 56);
    doc.text(`Arrival Date:   ${grn.arrivalDate}`, 14, 62);
    doc.text(`PO Reference:   ${grn.poNo}`, 14, 68);
    doc.text(`Quality Status: ${grn.qualityStatus}`, 14, 74);
    doc.text(`Inward Status: ${grn.inwardStatus}`, 14, 80);

    const vendorName = grn.partyType === 'supplier'
      ? suppliers.find(s => s.id === grn.partyId)?.name
      : farmers.find(f => f.id === grn.partyId)?.name;
    const vendorGSTIN = grn.partyType === 'supplier'
      ? suppliers.find(s => s.id === grn.partyId)?.gstin
      : 'Farmer (URP)';

    // Vendor Block
    doc.setFont("Helvetica", "bold");
    doc.text("VENDOR DETAILS:", 14, 92);
    doc.setFont("Helvetica", "normal");
    doc.text(vendorName || 'Unknown Vendor', 14, 98);
    doc.text(`GSTIN: ${vendorGSTIN || 'N/A'}`, 14, 104);

    const warehouseName = warehouses.find(w => w.id === grn.warehouseId)?.name || 'N/A';
    doc.setFont("Helvetica", "bold");
    doc.text("RECEIVING WAREHOUSE:", 110, 92);
    doc.setFont("Helvetica", "normal");
    doc.text(warehouseName, 110, 98);
    doc.text(`Vehicle No: ${grn.vehicleNo.toUpperCase()}`, 110, 104);

    // Transport details
    doc.setFont("Helvetica", "bold");
    doc.text("TRANSPORTATION & CHALLAN DETAILS:", 14, 116);
    doc.setFont("Helvetica", "normal");
    doc.text(`Driver Name: ${grn.driverName || 'N/A'}`, 14, 122);
    doc.text(`Transporter: ${grn.transporter || 'Self/Direct'}`, 14, 128);
    doc.text(`Challan No:  ${grn.challanNo || 'N/A'}`, 110, 122);
    doc.text(`Challan Date: ${grn.challanDate || 'N/A'}`, 110, 128);

    // Items table header
    const tableTop = 138;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Received Commodity Item", 16, tableTop + 5.5);
    doc.text("PO Qty", 70, tableTop + 5.5, { align: "right" });
    doc.text("Recv Now", 95, tableTop + 5.5, { align: "right" });
    doc.text("Accepted", 120, tableTop + 5.5, { align: "right" });
    doc.text("Rejected", 145, tableTop + 5.5, { align: "right" });
    doc.text("Batch Number", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Item rows
    let itemY = tableTop + 14;
    (grn.items || []).forEach(item => {
      const commName = commodities.find(c => c.id === item.item)?.name || 'Commodity';
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${item.orderedQty} ${item.unit}`, 70, itemY, { align: "right" });
      doc.text(`${item.receivedNow} ${item.unit}`, 95, itemY, { align: "right" });
      doc.text(`${item.acceptedQuantity} ${item.unit}`, 120, itemY, { align: "right" });
      doc.text(`${item.rejectedQuantity} ${item.unit}`, 145, itemY, { align: "right" });
      doc.text(`${item.batchNo || 'N/A'}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    doc.line(14, itemY - 3, 196, itemY - 3);

    // Weight and remarks
    let remarksY = itemY + 8;
    if (grn.weight) {
      doc.setFont("Helvetica", "bold");
      doc.text(`Weighbridge Gross Weight: ${grn.weight} MT`, 14, remarksY);
      remarksY += 6;
    }
    if (grn.remarks) {
      doc.setFont("Helvetica", "normal");
      doc.text(`Remarks: ${grn.remarks}`, 14, remarksY);
      remarksY += 6;
    }

    // Signatures
    let sigY = remarksY + 30;
    if (sigY > 260) {
      doc.addPage();
      sigY = 40;
    }
    doc.setFont("Helvetica", "bold");
    doc.text("Security Officer / Gate Entry Keeper", 14, sigY);
    doc.text("Receiving Officer (Warehouse)", 125, sigY);
    doc.line(14, sigY + 10, 70, sigY + 10);
    doc.line(125, sigY + 10, 185, sigY + 10);

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an official gate receipt slip generated by BrijRani Agro Foods Ltd. logistics system.", 14, 280);

    doc.save(`gate_receipt_grn_${grn.grnNo.replace(/\//g, '_')}.pdf`);
    showToast(`GRN gate entry slip PDF downloaded successfully!`, 'success');
  };

  const columns = [
    { header: 'GRN Number', accessor: 'grnNo' as keyof GRN, sortable: true },
    { header: 'PO Reference', accessor: 'poNo' as keyof GRN },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: GRN) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { header: 'Gate Date', accessor: 'date' as keyof GRN },
    { header: 'Vehicle No', accessor: 'vehicleNo' as keyof GRN },
    { 
      header: 'Linked Invoice', 
      accessor: (row: GRN) => {
        const inv = (row.invoiceId || row.invoiceNo)
          ? db.purchaseInvoices.find(i => i.id === row.invoiceId || i.invoiceNo === row.invoiceNo)
          : db.purchaseInvoices.find(i => i.poNumber === row.poNo || i.grnNumber === row.grnNo);
        return inv ? (
          <span className="font-bold text-xs text-primary-600">
            {inv.invoiceNo}
          </span>
        ) : (
          <span className="text-slate-400 text-[11px] font-semibold">Pending</span>
        );
      }
    },
    { 
      header: 'Inward Status', 
      accessor: (row: GRN) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.inwardStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
        }`}>
          {row.inwardStatus === 'Completed' ? 'Inward Done' : 'Pending Inward'}
        </span>
      )
    },
    { 
      header: 'Payment Status', 
      accessor: (row: GRN) => {
        const inv = (row.invoiceId || row.invoiceNo)
          ? db.purchaseInvoices.find(i => i.id === row.invoiceId || i.invoiceNo === row.invoiceNo)
          : db.purchaseInvoices.find(i => i.poNumber === row.poNo || i.grnNumber === row.grnNo);
        if (!inv) return <span className="text-slate-400 text-[10px]">Awaiting Invoice</span>;
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
            inv.status === 'Partially Paid' ? 'bg-blue-50 text-blue-600 border-blue-200' :
            'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {inv.status === 'Paid' ? 'Paid' : inv.status === 'Partially Paid' ? 'Partially Paid' : 'Payment Due'}
          </span>
        );
      }
    }
  ];

  const grnFilterTabs = [
    { label: 'All', value: 'All' },
    { label: 'Pending Inward', value: 'Pending Inward' },
    { label: 'Inward Done', value: 'Completed' },
    { label: 'Payment Done', value: 'Paid' },
  ];

  const filteredGRNs = useMemo(() => {
    if (qcFilter === 'All') return db.grns;
    if (qcFilter === 'Pending Inward') return db.grns.filter(g => g.inwardStatus === 'Pending');
    if (qcFilter === 'Completed') return db.grns.filter(g => g.inwardStatus === 'Completed');
    if (qcFilter === 'Paid') {
      return db.grns.filter(g => {
        const inv = db.purchaseInvoices.find(i => i.id === g.invoiceId || i.invoiceNo === g.invoiceNo || i.grnNumber === g.grnNo || i.poNumber === g.poNo);
        return inv?.status === 'Paid';
      });
    }
    return db.grns;
  }, [db.grns, db.purchaseInvoices, qcFilter]);

  if (!['Super Admin', 'Purchase Manager', 'Warehouse Staff'].includes(currentUserRole)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto mt-20 space-y-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-lg font-bold">✕</div>
        <h2 className="text-sm font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-400 font-semibold leading-normal">Your account role ({currentUserRole}) does not have permission to access the Goods Receipt module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Goods Receipt Slips (GRN)</h1>
          <p className="text-xs font-medium text-slate-400">Record gate arrivals, inward materials into warehouse storage, and track supplier payables.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setVehicleNo('');
            setDriverName('');
            setChallanNo('');
            setTransporter('');
            setRemarks('');
            setPoId('');
            setIsEditMode(false);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record Cargo Entry (GRN)</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          {/* Status Filter Tabs */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1 flex-wrap">
            {grnFilterTabs.map(tab => {
              const count = tab.value === 'All'
                ? db.grns.length
                : tab.value === 'Pending Inward'
                ? db.grns.filter(g => g.inwardStatus === 'Pending').length
                : tab.value === 'Completed'
                ? db.grns.filter(g => g.inwardStatus === 'Completed').length
                : tab.value === 'Paid'
                ? db.grns.filter(g => {
                    const inv = db.purchaseInvoices.find(i => i.id === g.invoiceId || i.invoiceNo === g.invoiceNo || i.grnNumber === g.grnNo || i.poNumber === g.poNo);
                    return inv?.status === 'Paid';
                  }).length
                : 0;
              const isActive = qcFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setQcFilter(tab.value)}
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
            data={filteredGRNs}
            columns={columns}
            searchPlaceholder="Search GRN or PO..."
            searchField="grnNo"
            onRowClick={(row) => setSelectedGRN(row)}
            exportFileName="goods_receipt_notes_list"
          />
        </div>

        {/* Selected GRN Details */}
        <div>
          {selectedGRN ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedGRN.grnNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">PO Ref: {selectedGRN.poNo}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                  selectedGRN.inwardStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
                }`}>
                  {selectedGRN.inwardStatus === 'Completed' ? 'INWARD COMPLETED' : 'PENDING INWARD'}
                </span>
              </div>

              {/* Gate Entry details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold flex items-center gap-1"><Truck size={12} /> Vehicle Number:</span>
                  <span className="text-slate-800">{selectedGRN.vehicleNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Driver Name:</span>
                  <span>{selectedGRN.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transporter:</span>
                  <span>{selectedGRN.transporter || 'Self Delivery'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Challan Reference:</span>
                  <span>{selectedGRN.challanNo} ({formatDate(selectedGRN.challanDate)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold flex items-center gap-1"><Scale size={12} /> Target Warehouse:</span>
                  <span className="text-primary-600 font-bold">{warehouses.find(w => w.id === selectedGRN.warehouseId)?.name || 'N/A'}</span>
                </div>
              </div>

              {/* Item Details Grid */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivered Quantities</span>
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {selectedGRN.items?.map((item, idx) => {
                    return (
                      <div key={idx} className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0 space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span>{commodities.find(c => c.id === item.item)?.name || item.item}</span>
                          <span>Ordered: {item.orderedQty} {item.unit}</span>
                        </div>
                        <div className="grid grid-cols-2 text-[10px] text-slate-500 font-medium leading-tight">
                          <span>Gate Received: <span className="font-bold text-slate-700">{item.receivedNow} {item.unit}</span></span>
                          <span>Inwarded: <span className="font-bold text-emerald-600">{item.acceptedQuantity} {item.unit}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Linked Commercial Invoice & Payment Settlement details */}
              {(() => {
                const inv = (selectedGRN.invoiceId || selectedGRN.invoiceNo)
                  ? db.purchaseInvoices.find(i => i.id === selectedGRN.invoiceId || i.invoiceNo === selectedGRN.invoiceNo)
                  : db.purchaseInvoices.find(i => i.poNumber === selectedGRN.poNo || i.grnNumber === selectedGRN.grnNo);

                return (
                  <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-2.5 text-xs">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><FileCheck size={13} /> Linked Invoice & Payment</span>
                      {inv && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          inv.status === 'Partially Paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {inv.status}
                        </span>
                      )}
                    </span>

                    {inv ? (
                      <div className="space-y-1.5 text-slate-700 pt-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-400">Invoice Ref:</span>
                          <button className="text-primary-600 font-bold cursor-pointer hover:underline text-xs" onClick={() => router.push('/procurement/invoices')}>
                            {inv.invoiceNo}
                          </button>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Billed Total:</span>
                          <span className="font-bold text-slate-800">₹{inv.grandTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Amount Paid:</span>
                          <span className="font-bold text-emerald-600">₹{(inv.amountPaid || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-indigo-100/60 pt-1.5">
                          <span className="text-slate-500 font-bold">Outstanding Due:</span>
                          <span className="font-extrabold text-rose-600">
                            ₹{(inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.grandTotal - (inv.amountPaid || 0))).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-[11px] py-1">
                        Commercial invoice not yet attached for this PO cargo.
                      </div>
                    )}
                  </div>
                );
              })()}

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
                    onClick={handleDeleteGRN}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-755 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>

                {selectedGRN.inwardStatus === 'Pending' && (
                  <button
                    onClick={handleOpenEdit}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition mb-2"
                  >
                    <Edit3 size={14} />
                    <span>Edit Gate Receipt (GRN)</span>
                  </button>
                )}

                {selectedGRN.inwardStatus === 'Pending' && (
                  <button
                    onClick={() => {
                      erpService.inwardStock(selectedGRN.id, 'N/A');
                      refreshDb();
                      const updated = getDb().grns.find((g: GRN) => g.id === selectedGRN.id);
                      if (updated) setSelectedGRN(updated);
                      showToast('Cargo Inward slip marked as complete and stock added to warehouse bins!', 'success');
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition mb-2"
                  >
                    <FileCheck size={14} />
                    <span>Complete Inward Slip & Add Stock</span>
                  </button>
                )}

                {selectedGRN.inwardStatus === 'Completed' && (
                  <div className="space-y-2 mb-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center text-[10px] text-emerald-800 font-semibold leading-normal">
                      ✅ Material Inwarded & Stock Updated in Warehouse.
                    </div>
                    <button
                      onClick={() => router.push('/procurement/invoices')}
                      className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary-600/10 cursor-pointer transition"
                    >
                      <Wallet size={14} />
                      <span>Proceed to Invoice Payment (Step 5)</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedGRN)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download GRN Slip PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select an Inward Slip row to verify scale weight bridge measurements, inspect parameters, and inward stock.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Gate Receipt (GRN): ${selectedGRN?.grnNo}` : isViewMode ? `View Gate Receipt (GRN): ${selectedGRN?.grnNo}` : 'Record Gate Entry slip (GRN)'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify incoming cargo gate measurements or challan numbers.' : isViewMode ? 'Detailed view of the gate entry receipt.' : 'Capture incoming scale measurements and supplier delivery challans at the warehouse gate.'}</p>
              </div>
              <button onClick={handleCloseCreateModal} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateGRN} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Approved Purchase Order Reference *</label>
                  <select
                    value={poId}
                    onChange={e => {
                      setPoId(e.target.value);
                      const po = db.purchaseOrders.find(p => p.id === e.target.value);
                      if (po) {
                        loadPoItems(po);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                    disabled={isViewMode}
                  >
                    <option value="">Select Purchase Order</option>
                    {approvedPOs.map(po => {
                      const partyName = po.partyType === 'supplier'
                        ? suppliers.find(s => s.id === po.partyId)?.name
                        : farmers.find(f => f.id === po.partyId)?.name;
                      return (
                        <option key={po.id} value={po.id}>{po.poNo} - {partyName} (Value: ₹{(po.total ?? 0).toLocaleString()})</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Linked Purchase Invoice <span className="text-[9px] text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <select
                    value={invoiceId}
                    onChange={e => {
                      setInvoiceId(e.target.value);
                      const inv = db.purchaseInvoices.find(i => i.id === e.target.value);
                      setInvoiceNo(inv ? inv.invoiceNo : '');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    disabled={isViewMode}
                  >
                    <option value="">{availableInvoices.length === 0 ? 'No Invoice logged yet' : 'Select Linked Invoice (Optional)'}</option>
                    {availableInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.invoiceNo} (₹{inv.grandTotal.toLocaleString()} - {inv.status})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gate Truck Plate Number *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    placeholder="e.g. BR-01-AB-1234"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Name *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="e.g. Satish Yadav"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supplier Challan No *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={challanNo}
                    onChange={e => setChallanNo(e.target.value)}
                    placeholder="Challan reference..."
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Challan Date</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={challanDate}
                    onChange={val => setChallanDate(val)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transporter Agency</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={transporter}
                    onChange={e => setTransporter(e.target.value)}
                    placeholder="Mithila Logistics..."
                  />
                </div>
              </div>

              {/* Items logging */}
              {itemsList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Quantities Arrived at Weight bridge</span>
                  <div className="space-y-3">
                    {itemsList.map((item, idx) => {
                      const comm = commodities.find(c => c.id === item.item);
                      const pending = item.orderedQty - item.previouslyReceived;
                      return (
                        <div key={idx} className="flex gap-4 items-center bg-white p-3 border border-slate-100 rounded-lg text-xs">
                          <div className="flex-1">
                            <span className="font-bold text-slate-800 block">{comm?.name || 'Commodity'}</span>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              PO Ordered: {item.orderedQty} {item.unit} | Pending: {pending} {item.unit}
                            </span>
                          </div>
                          <div className="w-32">
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Arrived Quantity *</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold"
                              value={item.receivedNow || ''}
                              onChange={e => handleReceivedQtyChange(idx, Number(e.target.value))}
                              required
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                {isViewMode ? (
                  <button
                    type="button"
                    onClick={handleCloseCreateModal}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-md"
                  >
                    Close View
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseCreateModal}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                    >
                      Record Gate Entry
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Laboratory Quality Inspection Modal Form */}
      {isQcOpen && selectedGRN && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span>🔬</span> Laboratory Quality Audit Certificate: <span className="font-mono text-primary-600">{selectedGRN.grnNo}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Test physical moisture, foreign material percentage, and enforce Admin Quality Policies.</p>
              </div>
              <button onClick={() => setIsQcOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmitQc} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Critical Policy Violation Alert */}
              {hasMandatoryBreach && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-shake">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                    <span>🚨 CRITICAL QUALITY VIOLATION - ORDER CANNOT BE ACCEPTED</span>
                  </div>
                  <p className="text-[11px] text-rose-600 leading-relaxed font-medium">
                    One or more tested parameters exceed the maximum limit configured by Admin. Under system quality policy, this order <strong>CANNOT BE ACCEPTED</strong> and has been automatically set to <strong>REJECT</strong>:
                  </p>
                  <div className="space-y-1.5">
                    {evaluatedBreaches.filter(b => b.status === 'FAIL').map((b, i) => (
                      <div key={i} className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-mono shadow-sm">
                        <span className="text-rose-700 font-bold flex items-center gap-1.5">
                          <span>❌</span> <span>{b.name}:</span>
                        </span>
                        <span className="text-slate-600">
                          Entered: <strong className="text-rose-600 underline font-bold">{b.actualValue}</strong> | Admin Limit: <strong className="text-slate-800">{b.allowedLimit}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {/* Moisture */}
                {(() => {
                  const isMoistureBreached = evaluatedBreaches.some(b => b.name.toLowerCase().includes('moisture') && b.status === 'FAIL');
                  const moistureSpec = specs.find(s => (String(s.commodityId) === String(selectedGRN.items?.[0]?.item) || String(s.commodityId) === String(selectedGRN.commodityId)) && s.parameterName.toLowerCase().includes('moisture'));
                  const limitLabel = moistureSpec ? (moistureSpec.limitType === 'Range' ? `${moistureSpec.minLimit}-${moistureSpec.maxLimit} ${moistureSpec.unit}` : `${moistureSpec.limitType} ${moistureSpec.maxLimit ?? moistureSpec.minLimit} ${moistureSpec.unit}`) : '<= 12 %';
                  
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Moisture (%)</label>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{limitLabel}</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        className={`w-full px-3 py-2 border rounded-lg text-xs font-mono transition ${
                          isMoistureBreached 
                            ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-400 font-bold' 
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                        value={moisturePercent}
                        onChange={e => setMoisturePercent(Number(e.target.value))}
                      />
                      <div className="mt-1 text-[10px]">
                        {isMoistureBreached ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">❌ Exceeds Limit (Reject)</span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Within Admin Limit</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Purity */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Purity (%)</label>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">&gt;= 95 %</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-mono"
                    value={purityPercent}
                    onChange={e => setPurityPercent(Number(e.target.value))}
                  />
                  <div className="mt-1 text-[10px]">
                    <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Within Admin Limit</span>
                  </div>
                </div>

                {/* Assigned Grade */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Overall Grade</label>
                    {hasMandatoryBreach && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">Locked</span>
                    )}
                  </div>
                  <select
                    value={hasMandatoryBreach ? 'Rejected' : grade}
                    onChange={e => setGrade(e.target.value as any)}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-bold transition ${
                      hasMandatoryBreach ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-700'
                    }`}
                    disabled={hasMandatoryBreach}
                  >
                    {hasMandatoryBreach ? (
                      <option value="Rejected">Rejected (Policy Breach)</option>
                    ) : (
                      <>
                        <option value="A">Grade A (Premium)</option>
                        <option value="B">Grade B (Standard)</option>
                        <option value="C">Grade C (Below Avg)</option>
                        <option value="Rejected">Rejected</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Damage */}
                {(() => {
                  const isDamageBreached = evaluatedBreaches.some(b => b.name.toLowerCase().includes('damage') && b.status === 'FAIL');
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Damage (%)</label>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">&lt;= 3 %</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        className={`w-full px-3 py-2 border rounded-lg text-xs font-mono transition ${
                          isDamageBreached 
                            ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-400 font-bold' 
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                        value={damagePercent}
                        onChange={e => setDamagePercent(Number(e.target.value))}
                      />
                      <div className="mt-1 text-[10px]">
                        {isDamageBreached ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">❌ Exceeds Limit</span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Within Limit</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Foreign Material */}
                {(() => {
                  const isForeignBreached = evaluatedBreaches.some(b => b.name.toLowerCase().includes('foreign') && b.status === 'FAIL');
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Foreign Material (%)</label>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">&lt;= 2 %</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        className={`w-full px-3 py-2 border rounded-lg text-xs font-mono transition ${
                          isForeignBreached 
                            ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-400 font-bold' 
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                        value={foreignMaterialPercent}
                        onChange={e => setForeignMaterialPercent(Number(e.target.value))}
                      />
                      <div className="mt-1 text-[10px]">
                        {isForeignBreached ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">❌ Exceeds Limit</span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Within Limit</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Purity Score */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Quality Score (0-100)</label>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">&gt;= 70</span>
                  </div>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white text-slate-700"
                    value={hasMandatoryBreach ? Math.min(qualityScore, 35) : qualityScore}
                    onChange={e => setQualityScore(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Color / Texture Description</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    placeholder="e.g. Golden Amber, Slightly Humid..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Inspector Sign</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold"
                    value="Laboratory Quality Control Dept."
                    disabled
                  />
                </div>
              </div>

              {/* Inward Discrepancy parameters */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Item Discrepancy Auditing</span>
                
                <div className="space-y-3">
                  {selectedGRN.items.map((item, idx) => {
                    const params = qcItemsRates[item.item] || { rejected: 0, damaged: 0 };
                    const comm = commodities.find(c => c.id === item.item);
                    const acceptedAmt = hasMandatoryBreach ? 0 : Math.max(0, item.receivedNow - params.rejected - params.damaged);

                    return (
                      <div key={idx} className="bg-white p-3 border border-slate-100 rounded-lg text-xs space-y-2">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span>{comm?.name || item.item}</span>
                          <span>Arrived: {item.receivedNow} {item.unit}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 block mb-0.5">Rejected Qty ({item.unit})</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                              value={hasMandatoryBreach ? item.receivedNow : (params.rejected || '')}
                              onChange={e => handleQcItemChange(item.item, 'rejected', Number(e.target.value))}
                              disabled={hasMandatoryBreach}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 block mb-0.5">Damaged Qty ({item.unit})</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                              value={params.damaged || ''}
                              onChange={e => handleQcItemChange(item.item, 'damaged', Number(e.target.value))}
                              disabled={hasMandatoryBreach}
                            />
                          </div>
                          <div className="flex flex-col justify-end text-right">
                            <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Final Accepted</span>
                            <span className={`font-extrabold ${hasMandatoryBreach ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {acceptedAmt} {item.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">QC Remarks / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  value={qcNotes}
                  onChange={e => setQcNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional inspection results..."
                />
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQcOpen(false)}
                  className="px-4 py-2 border border-slate-250 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                {hasMandatoryBreach ? (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center gap-2 cursor-pointer animate-pulse"
                  >
                    <span>🚨 Reject Lot (Policy Violation)</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>✓ Approve QC Inspection</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
