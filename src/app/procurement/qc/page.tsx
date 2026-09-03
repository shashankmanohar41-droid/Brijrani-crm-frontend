'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService, getDb, saveDb } from '../../../services/erpService';
import api from '../../../services/axios';
import { 
  FlaskConical, ClipboardCheck, CheckCircle2, Clock, 
  Search, ShieldAlert, Award, FileSpreadsheet, UserCheck,
  Warehouse, ArrowRight, PackageCheck, Scale, FileText,
  History, Settings, BarChart2, Plus, Trash2, Printer, Eye, FileCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../../utils/dateUtils';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

export default function QualityControlPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspections' | 'samples' | 'specs'>('dashboard');
  const [subTab, setSubTab] = useState<'pending' | 'completed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Dashboard indicators
  const [dashboardStats, setDashboardStats] = useState({
    totalInspections: 0,
    passedToday: 0,
    rejectedToday: 0,
    onHold: 0,
    pendingGRNsCount: 0,
    averageQualityScore: 90
  });

  // DB and custom states
  const [specs, setSpecs] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Specs Form States
  const [selectedCommodityId, setSelectedCommodityId] = useState('');
  const [specParamName, setSpecParamName] = useState('');
  const [specLimitType, setSpecLimitType] = useState<'<=' | '>=' | '<' | '>' | '=' | 'Range' | 'Tolerance' | 'Text'>('<=');
  const [specMinLimit, setSpecMinLimit] = useState<number | ''>('');
  const [specMaxLimit, setSpecMaxLimit] = useState<number | ''>('');
  const [specTextValue, setSpecTextValue] = useState('');
  const [specTolerance, setSpecTolerance] = useState<number | ''>('');
  const [specUnit, setSpecUnit] = useState('%');
  const [specIsOptional, setSpecIsOptional] = useState(false);

  // Sample collection form
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [sampleGrn, setSampleGrn] = useState<any>(null);
  const [sampleQty, setSampleQty] = useState(25);
  const [sampleLocation, setSampleLocation] = useState('Truck Center');
  const [sampleCondition, setSampleCondition] = useState('Dry');
  const [sampleRemarks, setSampleRemarks] = useState('');

  // Inspection form
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [inspectGrn, setInspectGrn] = useState<any>(null);
  const [grossWeight, setGrossWeight] = useState(30000);
  const [tareWeight, setTareWeight] = useState(10000);
  const [netWeight, setNetWeight] = useState(20000);
  const [actualParams, setActualParams] = useState<Record<string, string>>({});
  const [overallDecision, setOverallDecision] = useState<'ACCEPT' | 'PARTIAL ACCEPT' | 'REJECT' | 'HOLD'>('ACCEPT');
  const [overallGrade, setOverallGrade] = useState('Grade A');
  const [acceptedQty, setAcceptedQty] = useState(20000);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [holdQty, setHoldQty] = useState(0);
  const [damagedQty, setDamagedQty] = useState(0);
  const [basePrice, setBasePrice] = useState(2500);
  const [priceDeduction, setPriceDeduction] = useState(0);
  const [inspectRemarks, setInspectRemarks] = useState('');
  const [reInspectionOfId, setReInspectionOfId] = useState('');
  const [auditReason, setAuditReason] = useState('');

  // Fetch QC stats and databases
  const loadQcData = async () => {
    try {
      const statsRes = await api.get('/procurement/quality-inspections/dashboard');
      if (statsRes.data?.success) setDashboardStats(statsRes.data.data);

      const specsRes = await api.get('/procurement/quality-inspections/specs');
      if (specsRes.data?.success) setSpecs(specsRes.data.data);

      const samplesRes = await api.get('/procurement/quality-inspections/samples');
      if (samplesRes.data?.success) setSamples(samplesRes.data.data);

      const inspectionsRes = await api.get('/procurement/quality-inspections');
      if (inspectionsRes.data?.success && inspectionsRes.data.data?.length > 0) {
        setInspections(inspectionsRes.data.data);
      } else {
        const localQIs = getDb().qualityInspections || [];
        setInspections(localQIs);
      }
    } catch (err) {
      console.error('Failed to load quality database records:', err);
      const localQIs = getDb().qualityInspections || [];
      setInspections(localQIs);
    }
  };

  useEffect(() => {
    loadQcData();
  }, [activeTab, subTab]);

  // Handle ?po= URL query parameter from PO page
  const poQueryParam = searchParams.get('po');
  useEffect(() => {
    if (poQueryParam) {
      const po = db.purchaseOrders.find(p => p.id === poQueryParam || p.poNo === poQueryParam);
      if (po) {
        const lotWeight = (po.items?.[0]?.quantity || 10) * 1000;
        setInspectGrn({
          id: po.id,
          poId: po.id,
          poNo: po.poNo,
          grnNo: `LOT-${po.poNo}`,
          items: po.items || [],
          grossWeight: lotWeight,
          tareWeight: 0,
          vehicleNo: 'PO-CARGO'
        });
        setGrossWeight(lotWeight);
        setTareWeight(0);
        setNetWeight(lotWeight);
        setOverallDecision('ACCEPT');
        setOverallGrade('Grade A');
        setBasePrice(po.items?.[0]?.rate || 2500);
        setActiveTab('inspections');
        setSubTab('pending');
        setIsInspectionModalOpen(true);
      }
    }
  }, [poQueryParam, db.purchaseOrders]);

  // Sync net weight calculations
  useEffect(() => {
    const net = Math.max(0, grossWeight - tareWeight);
    setNetWeight(net);
    if (overallDecision === 'ACCEPT') {
      setAcceptedQty(net);
      setRejectedQty(0);
      setHoldQty(0);
    }
  }, [grossWeight, tareWeight]);

  useEffect(() => {
    if (overallDecision === 'ACCEPT') {
      setAcceptedQty(netWeight);
      setRejectedQty(0);
      setHoldQty(0);
    } else if (overallDecision === 'REJECT') {
      setAcceptedQty(0);
      setRejectedQty(netWeight);
      setHoldQty(0);
    } else if (overallDecision === 'HOLD') {
      setAcceptedQty(0);
      setRejectedQty(0);
      setHoldQty(netWeight);
    }
  }, [overallDecision, netWeight]);

  // Load audit logs when inspection selected
  const fetchAuditLogs = async (id: string) => {
    try {
      const res = await api.get(`/procurement/quality-inspections/audits/${id}`);
      if (res.data?.success) setAuditLogs(res.data.data);
    } catch (err) {
      console.error('Failed to fetch audits:', err);
    }
  };

  // Live evaluation of parameters against Admin Quality Specifications
  const evaluatedBreaches = useMemo(() => {
    if (!inspectGrn) return [];
    const itemId = inspectGrn.items?.[0]?.item;
    const commoditySpecs = specs.filter(s => String(s.commodityId) === String(itemId));
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
        const val = actualParams[spec.parameterName];
        if (val !== undefined && val !== '') {
          const numVal = Number(val);
          let breached = false;
          if (spec.limitType === '<=' && numVal > (spec.maxLimit ?? 0)) breached = true;
          else if (spec.limitType === '>=' && numVal < (spec.minLimit ?? 0)) breached = true;
          else if (spec.limitType === 'Range' && (numVal < (spec.minLimit ?? 0) || numVal > (spec.maxLimit ?? 0))) breached = true;
          else if (spec.limitType === '=' && spec.textValue && String(val).trim().toLowerCase() !== spec.textValue.trim().toLowerCase()) breached = true;
          else if (spec.limitType === '=' && spec.minLimit !== undefined && numVal !== spec.minLimit) breached = true;

          const limitLabel = spec.limitType === 'Range' 
            ? `${spec.minLimit}-${spec.maxLimit} ${spec.unit}` 
            : `${spec.limitType} ${spec.maxLimit !== undefined ? spec.maxLimit : spec.minLimit !== undefined ? spec.minLimit : spec.textValue} ${spec.unit}`;

          if (breached) {
            breaches.push({
              name: spec.parameterName,
              actualValue: val,
              allowedLimit: limitLabel,
              unit: spec.unit,
              isOptional: spec.isOptional,
              status: spec.isOptional ? 'WARN' : 'FAIL'
            });
          }
        }
      });
    } else {
      // Default fallback checks if no custom specs configured for commodity
      const moisture = actualParams['Moisture'];
      if (moisture !== undefined && moisture !== '') {
        const mNum = Number(moisture);
        if (mNum > 12.5) {
          breaches.push({
            name: 'Moisture',
            actualValue: `${mNum}%`,
            allowedLimit: '<= 12.5%',
            unit: '%',
            isOptional: false,
            status: 'FAIL'
          });
        }
      }
      const foreign = actualParams['Foreign Material'];
      if (foreign !== undefined && foreign !== '') {
        const fNum = Number(foreign);
        if (fNum > 2.0) {
          breaches.push({
            name: 'Foreign Material',
            actualValue: `${fNum}%`,
            allowedLimit: '<= 2.0%',
            unit: '%',
            isOptional: false,
            status: 'FAIL'
          });
        }
      }
    }

    return breaches;
  }, [inspectGrn, specs, actualParams]);

  const hasMandatoryBreach = useMemo(() => {
    return evaluatedBreaches.some(b => !b.isOptional && b.status === 'FAIL');
  }, [evaluatedBreaches]);

  // When mandatory breach occurs, strictly lock decision to REJECT and zero out accepted quantity
  useEffect(() => {
    if (hasMandatoryBreach) {
      if (overallDecision === 'ACCEPT' || overallDecision === 'PARTIAL ACCEPT') {
        setOverallDecision('REJECT');
        setOverallGrade('Rejected');
        setAcceptedQty(0);
        setRejectedQty(netWeight);
        setHoldQty(0);
        showToast('QC Policy Alert: Entered parameter exceeds Admin limit. Order must be Rejected.', 'error');
      }
    }
  }, [hasMandatoryBreach, netWeight]);

  // Specs save
  const handleSaveSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommodityId || !specParamName || !specUnit) {
      showToast('Please fill all required specification fields', 'error');
      return;
    }
    try {
      await api.post('/procurement/quality-inspections/specs', {
        commodityId: selectedCommodityId,
        parameterName: specParamName,
        limitType: specLimitType,
        minLimit: specMinLimit !== '' ? Number(specMinLimit) : undefined,
        maxLimit: specMaxLimit !== '' ? Number(specMaxLimit) : undefined,
        textValue: specTextValue,
        tolerancePercent: specTolerance !== '' ? Number(specTolerance) : undefined,
        unit: specUnit,
        isOptional: specIsOptional
      });
      showToast('Quality Specification constraint added successfully', 'success');
      setSpecParamName('');
      setSpecMinLimit('');
      setSpecMaxLimit('');
      setSpecTextValue('');
      setSpecTolerance('');
      loadQcData();
    } catch (err) {
      showToast('Failed to add Quality constraint specification', 'error');
    }
  };

  const handleDeleteSpec = async (id: string) => {
    try {
      await api.delete(`/procurement/quality-inspections/specs/${id}`);
      showToast('Specification constraint removed', 'success');
      loadQcData();
    } catch (err) {
      showToast('Failed to remove constraint', 'error');
    }
  };

  // Sample submission
  const handleCreateSample = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/procurement/quality-inspections/samples', {
        grnId: sampleGrn._id,
        grnNo: sampleGrn.grnNo,
        vehicleNo: sampleGrn.vehicleNo,
        batchNo: sampleGrn.items[0]?.batchNo || 'Lot',
        commodityId: sampleGrn.items[0]?.item,
        totalQuantity: sampleGrn.items[0]?.receivedNow || 0,
        sampleQuantity: sampleQty,
        sampleLocation,
        sampleCondition,
        remarks: sampleRemarks
      });
      showToast(`Sample drawn successfully for ${sampleGrn.grnNo}`, 'success');
      setIsSampleModalOpen(false);
      loadQcData();
      refreshDb();
    } catch (err) {
      showToast('Failed to log sample collection', 'error');
    }
  };

  // QC inspection submission
  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasMandatoryBreach && (overallDecision === 'ACCEPT' || overallDecision === 'PARTIAL ACCEPT' || acceptedQty > 0)) {
      const breachNames = evaluatedBreaches.filter(b => !b.isOptional).map(b => `${b.name} (${b.actualValue} > ${b.allowedLimit})`).join(', ');
      showToast(`Cannot Accept Order: Quality parameter(s) breach Admin policy: ${breachNames}. Order must be Rejected.`, 'error');
      setOverallDecision('REJECT');
      setAcceptedQty(0);
      setRejectedQty(netWeight);
      return;
    }
    try {
      const itemsPayload = inspectGrn.items.map((it: any) => {
        const itemSpecs = specs.filter(s => String(s.commodityId) === String(it.item));
        const tp = itemSpecs.map(s => ({
          parameterName: s.parameterName,
          allowedLimit: s.limitType === 'Range' ? `${s.minLimit}-${s.maxLimit} ${s.unit}` : `${s.limitType} ${s.maxLimit || s.minLimit || s.textValue} ${s.unit}`,
          actualValue: actualParams[s.parameterName] || '0',
          status: 'PASS'
        }));

        return {
          item: it.item,
          quantity: netWeight,
          grade: overallGrade,
          color: actualParams['Color'] || 'Yellow',
          moisturePercent: Number(actualParams['Moisture'] || 0),
          testedParameters: tp
        };
      });

      const grnIdVal = inspectGrn._id || inspectGrn.id;

      const payload: any = {
        grnId: grnIdVal,
        grnNo: inspectGrn.grnNo,
        decision: overallDecision,
        grade: overallGrade,
        receivedQuantity: netWeight,
        acceptedQuantity: acceptedQty,
        rejectedQuantity: rejectedQty,
        holdQuantity: holdQty,
        damagedQuantity: damagedQty,
        basePrice,
        priceDeduction,
        notes: inspectRemarks,
        items: itemsPayload,
        sampleId: samples.find(s => s.grnNo === inspectGrn.grnNo)?.sampleId
      };

      if (reInspectionOfId) {
        payload.reInspectionOf = reInspectionOfId;
      }
      if (auditReason) {
        payload.auditReason = auditReason;
      }

      // Check if we are updating an existing inspection or submitting a new one
      const existingQi = inspections.find(qi => qi.grnNo === inspectGrn.grnNo);
      if (existingQi && !reInspectionOfId) {
        // Edit mode (Updates)
        await api.patch(`/procurement/quality-inspections/${existingQi._id}`, payload);
        showToast('QC Audit updated successfully and logged in audit trails', 'success');
      } else {
        // New Inspection
        await api.post('/procurement/quality-inspections', payload);
        showToast('QC Audit Certificate completed and stock allocated', 'success');
      }

      // Synchronize local DB state immediately
      const currentDb = getDb();
      if (!currentDb.qualityInspections) currentDb.qualityInspections = [];
      const newQi = {
        id: `QC-${Date.now()}`,
        _id: `QC-${Date.now()}`,
        qcNo: `QC-${inspectGrn.poNo || inspectGrn.grnNo || Date.now()}`,
        poId: inspectGrn.poId || inspectGrn.id,
        poNo: inspectGrn.poNo,
        grnId: inspectGrn.grnId || grnIdVal,
        grnNo: inspectGrn.grnNo || `LOT-${inspectGrn.poNo}`,
        decision: overallDecision,
        status: overallDecision === 'ACCEPT' ? 'Passed' : overallDecision === 'REJECT' ? 'Rejected' : 'Partially Passed',
        qualityStatus: overallDecision === 'ACCEPT' ? 'Passed' : overallDecision === 'REJECT' ? 'Rejected' : 'Partially Passed',
        grade: overallGrade,
        qualityScore: overallDecision === 'ACCEPT' ? 95 : overallDecision === 'REJECT' ? 40 : 75,
        receivedQuantity: netWeight,
        acceptedQuantity: acceptedQty,
        rejectedQuantity: rejectedQty,
        holdQuantity: holdQty,
        damagedQuantity: damagedQty,
        basePrice,
        priceDeduction,
        vehicleNo: inspectGrn.vehicleNo || 'PO-Cargo',
        notes: inspectRemarks,
        items: itemsPayload,
        date: new Date().toISOString()
      };

      const existingIdx = currentDb.qualityInspections.findIndex((q: any) => q.grnNo === inspectGrn.grnNo || (inspectGrn.poNo && q.poNo === inspectGrn.poNo));
      if (existingIdx >= 0) {
        currentDb.qualityInspections[existingIdx] = { ...currentDb.qualityInspections[existingIdx], ...newQi } as any;
      } else {
        currentDb.qualityInspections.push(newQi as any);
      }

      const targetGrn = currentDb.grns.find((g: any) => g.id === grnIdVal || g.grnNo === inspectGrn.grnNo);
      if (targetGrn) {
        targetGrn.qualityStatus = overallDecision === 'ACCEPT' ? 'Passed' : overallDecision === 'REJECT' ? 'Rejected' : overallDecision === 'PARTIAL ACCEPT' ? 'Partially Passed' : 'On Hold';
        targetGrn.status = overallDecision === 'ACCEPT' || overallDecision === 'PARTIAL ACCEPT' ? 'Accepted' : overallDecision === 'REJECT' ? 'Rejected' : 'Pending QC';
      }
      saveDb(currentDb);

      setIsInspectionModalOpen(false);
      setInspectGrn(null);
      setSelectedItem(null);
      loadQcData();
      refreshDb();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to register quality inspection results';
      showToast(msg, 'error');
    }
  };

  const handleOpenView = () => {
    if (!selectedItem) return;
    const originalGrn = db.grns.find(g => g.grnNo === selectedItem.grnNo);
    if (originalGrn) {
      setInspectGrn(originalGrn);
      setOverallDecision(selectedItem.decision);
      setOverallGrade(selectedItem.grade);
      setAcceptedQty(selectedItem.acceptedQuantity);
      setRejectedQty(selectedItem.rejectedQuantity);
      setHoldQty(selectedItem.holdQuantity);
      setBasePrice(selectedItem.basePrice || 2500);
      setPriceDeduction(selectedItem.priceDeduction || 0);
      
      // Load actual parameters
      const params: Record<string, string> = {};
      selectedItem.items.forEach((item: any) => {
        (item.testedParameters || []).forEach((param: any) => {
          params[param.parameterName] = param.actualValue;
        });
      });
      setActualParams(params);
      
      setIsViewMode(true);
      setIsInspectionModalOpen(true);
    } else {
      showToast('Original arrival GRN not found', 'error');
    }
  };

  const handleDeleteQC = () => {
    if (!selectedItem) return;
    if (!confirm('Are you sure you want to delete this QC inspection log?')) return;
    erpService.qualityInspections.delete(selectedItem.id || selectedItem._id);
    refreshDb();
    setSelectedItem(null);
    loadQcData();
    showToast('QC Inspection log deleted successfully', 'success');
  };

  // Generate certificate PDF
  const handlePrintCertificate = (qi: any) => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('BRIJRANI AGRO FOODS LIMITED', 14, 20);
    doc.setFontSize(14);
    doc.text('OFFICIAL QUALITY INSPECTION REPORT', 14, 28);
    
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`QC Certificate No: ${qi.grnNo.replace('GRN', 'QC')}`, 14, 40);
    doc.text(`Date of Inspection: ${formatDate(qi.date || qi.createdAt)}`, 14, 46);
    doc.text(`GRN Number Reference: ${qi.grnNo}`, 14, 52);
    doc.text(`Inspector Signature: ${qi.inspector}`, 14, 58);

    doc.setFont('Helvetica', 'bold');
    doc.text('SUMMARY OF ANALYSIS:', 14, 68);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Overall Grade: ${qi.grade || 'Grade A'}`, 14, 74);
    doc.text(`QC Decision Status: ${qi.decision || 'ACCEPTED'}`, 14, 80);
    doc.text(`Received Quantity: ${qi.receivedQuantity || 0} KG`, 14, 86);
    doc.text(`Accepted Weight: ${qi.acceptedQuantity || 0} KG`, 14, 92);
    doc.text(`Price Deductions: INR ${qi.priceDeduction || 0} per Qtl`, 14, 98);

    doc.setFont('Helvetica', 'bold');
    doc.text('Tested Quality Parameters:', 14, 110);
    doc.line(14, 112, 196, 112);

    let y = 118;
    qi.items.forEach((item: any) => {
      (item.testedParameters || []).forEach((param: any) => {
        doc.setFont('Helvetica', 'normal');
        doc.text(`${param.parameterName}:`, 14, y);
        doc.text(`Allowed Limits: ${param.allowedLimit}`, 70, y);
        doc.text(`Actual Test: ${param.actualValue}`, 130, y);
        doc.setFont('Helvetica', 'bold');
        doc.text(param.status, 180, y);
        y += 8;
      });
    });

    doc.save(`QC_Certificate_${qi.grnNo}.pdf`);
    showToast('Quality Certificate PDF printed successfully', 'success');
  };

  // Helpers
  const getCommodityName = (id: string) => {
    return db.commodities.find(c => c.id === id || c._id === id)?.name || 'Commodity';
  };

  // Pending items for QC (Approved POs awaiting pre-inward inspection + any arrival GRNs)
  const pendingInspections = useMemo(() => {
    // 1. Approved Purchase Orders awaiting QC testing
    const pendingPOs = db.purchaseOrders
      .filter(p => p.status === 'Approved' || p.status === 'Partially Received')
      .filter(p => !inspections.some(qi => qi.poId === p.id || qi.poNo === p.poNo || qi.grnNo === `LOT-${p.poNo}` || qi.grnNo === p.poNo))
      .filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const partyName = p.partyType === 'supplier' 
          ? db.suppliers.find(s => s.id === p.partyId)?.name || ''
          : db.farmers.find(f => f.id === p.partyId)?.name || '';
        return p.poNo.toLowerCase().includes(q) || partyName.toLowerCase().includes(q);
      })
      .map(p => {
        const partyName = p.partyType === 'supplier' 
          ? db.suppliers.find(s => s.id === p.partyId)?.name || 'Supplier'
          : db.farmers.find(f => f.id === p.partyId)?.name || 'Farmer';
        const totalQty = (p.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
        return {
          id: p.id,
          type: 'PO',
          poId: p.id,
          poNo: p.poNo,
          grnNo: `LOT-${p.poNo}`,
          displayTitle: `${p.poNo}`,
          subtitle: `PO Source: ${partyName} | Qty: ${totalQty} MT`,
          partyName,
          commodityName: getCommodityName(p.items?.[0]?.item),
          items: p.items || [],
          totalQty,
          vehicleNo: 'Pre-Inward PO Cargo',
          grossWeight: totalQty * 1000,
          tareWeight: 0,
          basePrice: p.items?.[0]?.rate || 2500
        };
      });

    // 2. Pending arrival GRNs (if any)
    const pendingArrivalGRNs = db.grns
      .filter(g => g.qualityStatus === 'Pending')
      .filter(g => !pendingPOs.some(po => po.poId === g.poId || po.poNo === g.poNo))
      .filter(g => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return g.grnNo.toLowerCase().includes(q) || g.poNo.toLowerCase().includes(q);
      })
      .map(g => ({
        id: g.id,
        type: 'GRN',
        poId: g.poId,
        poNo: g.poNo,
        grnNo: g.grnNo,
        displayTitle: `${g.grnNo}`,
        subtitle: `Gate Entry Ref: ${g.poNo} | Vehicle: ${g.vehicleNo}`,
        partyName: (g as any).supplierName || 'Vendor',
        commodityName: getCommodityName(g.items?.[0]?.item),
        items: g.items || [],
        totalQty: (g.items || []).reduce((s: number, i: any) => s + (i.receivedNow || i.quantity || 0), 0),
        vehicleNo: g.vehicleNo,
        grossWeight: (g as any).grossWeight || 30000,
        tareWeight: (g as any).tareWeight || 10000,
        basePrice: 2500
      }));

    return [...pendingPOs, ...pendingArrivalGRNs];
  }, [db.purchaseOrders, db.grns, db.suppliers, db.farmers, inspections, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="text-emerald-600 animate-pulse" size={24} />
            <span>Advanced QC Laboratory Portal</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain commodity specs, collect lot samples, run parameters validation checklists, and issue official quality release certificates.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <BarChart2 size={14} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('inspections')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'inspections' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ClipboardCheck size={14} /> Inspections Log
          </button>
          <button 
            onClick={() => setActiveTab('samples')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'samples' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <History size={14} /> Samples ({samples.length})
          </button>
          <button 
            onClick={() => router.push('/masters?tab=qualitySpecs')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200"
            title="Configure specifications in Masters Hub"
          >
            <Settings size={14} /> Specs Master ↗
          </button>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audits Executed</span>
                <span className="text-xl font-bold text-slate-700">{dashboardStats.totalInspections}</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Quality Score</span>
                <span className="text-xl font-bold text-slate-700">{dashboardStats.averageQualityScore}%</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejections logged</span>
                <span className="text-xl font-bold text-slate-700">{dashboardStats.rejectedToday}</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Inspections</span>
                <span className="text-xl font-bold text-slate-700">{pendingInspections.length}</span>
              </div>
            </div>
          </div>

          {/* Quick Alert list */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-amber-500" size={18} />
              <span>Critical QC Quality Notifications</span>
            </h3>
            <div className="space-y-2 text-xs">
              {pendingInspections.length > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-medium">
                  ⚠️ Alert: There are {pendingInspections.length} Purchase Orders / arrivals awaiting quality parameter validation & release certification.
                </div>
              ) : (
                <div className="p-3 bg-slate-50 text-slate-500 rounded-lg font-medium">
                  No active quality alerts or pending arrivals. Stock quality parameters are within tolerances.
                </div>
              )}
            </div>
          </div>

          {/* Graphical Charts Section (Rectangles) */}
          {mounted && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quality by Commodity</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Wheat', Score: 92 },
                      { name: 'Paddy', Score: 88 },
                      { name: 'Mustard', Score: 95 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="Score" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quality by Supplier</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Sharma Agro', Score: 94 },
                      { name: 'Verma Traders', Score: 87 },
                      { name: 'Patna Grain', Score: 91 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="Score" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quality Trend (Score vs Rejection Rate %)</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { month: 'Apr', Score: 92, Rejections: 2 },
                      { month: 'May', Score: 89, Rejections: 4 },
                      { month: 'Jun', Score: 94, Rejections: 1 },
                      { month: 'Jul', Score: 91, Rejections: 3 },
                      { month: 'Aug', Score: 93, Rejections: 2 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} />
                      <Line type="monotone" dataKey="Score" stroke="#10B981" strokeWidth={2} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Rejections" stroke="#EF4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Overall QC Decision Distribution</h3>
                <div className="h-60 flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Accepted', value: 75, color: '#10B981' },
                          { name: 'Partial Accept', value: 15, color: '#F59E0B' },
                          { name: 'Rejected', value: 10, color: '#EF4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#10B981" />
                        <Cell fill="#F59E0B" />
                        <Cell fill="#EF4444" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INSPECTIONS TAB */}
      {activeTab === 'inspections' && (
        <div className="grid grid-cols-12 gap-6">
          {/* List panel */}
          <div className="col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setSubTab('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${subTab === 'pending' ? 'bg-pink-50 text-pink-700' : 'text-slate-500'}`}
                >
                  Pending QC / POs ({pendingInspections.length})
                </button>
                <button 
                  onClick={() => setSubTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${subTab === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
                >
                  QC Logs ({inspections.length})
                </button>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search PO / GRN..." 
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {subTab === 'pending' ? (
                pendingInspections.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">No pending Purchase Orders or arrivals awaiting QC.</div>
                ) : (
                  pendingInspections.map((item: any) => (
                    <div 
                      key={item.id || item._id}
                      onClick={() => setSelectedItem(item)}
                      className={`p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${selectedItem?.grnNo === item.grnNo || selectedItem?.poNo === item.poNo ? 'border-pink-500 bg-pink-50/10' : 'border-slate-150 hover:bg-slate-50'}`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span>{item.displayTitle}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 text-pink-700">
                            {item.type === 'PO' ? 'PO Awaiting QC' : 'Gate Receipt'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {item.subtitle} | Comm: <span className="font-semibold text-slate-700">{item.commodityName}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectGrn(item);
                          setGrossWeight(item.grossWeight || 30000);
                          setTareWeight(item.tareWeight || 0);
                          setNetWeight((item.grossWeight || 30000) - (item.tareWeight || 0));
                          setBasePrice(item.basePrice || 2500);
                          setOverallDecision('ACCEPT');
                          setOverallGrade('Grade A');
                          setIsInspectionModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition flex items-center gap-1"
                      >
                        <Scale size={12} />
                        <span>Inspect PO Lot</span>
                      </button>
                    </div>
                  ))
                )
              ) : (
                inspections.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">No QC logs found.</div>
                ) : (
                  inspections.map((qi: any) => (
                    <div 
                      key={qi._id}
                      onClick={() => { setSelectedItem(qi); fetchAuditLogs(qi._id); }}
                      className={`p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${selectedItem?._id === qi._id ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-150 hover:bg-slate-50'}`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-700">{qi.grnNo} - {qi.grade}</div>
                        <div className="text-[10px] text-slate-500">Decision: <span className="font-bold text-emerald-600">{qi.decision}</span> | Accepted: {qi.acceptedQuantity} KG</div>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => handlePrintCertificate(qi)}
                          className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                          title="Print Certificate"
                        >
                          <Printer size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            const originalGrn = db.grns.find(g => g.grnNo === qi.grnNo);
                            if (originalGrn) {
                              setInspectGrn(originalGrn);
                              setReInspectionOfId(qi._id);
                              setOverallDecision(qi.decision);
                              setOverallGrade(qi.grade);
                              setAcceptedQty(qi.acceptedQuantity);
                              setRejectedQty(qi.rejectedQuantity);
                              setHoldQty(qi.holdQuantity);
                              setBasePrice(qi.basePrice || 2500);
                              setPriceDeduction(qi.priceDeduction || 0);
                              setIsInspectionModalOpen(true);
                            } else {
                              showToast('Original arrival GRN not found', 'error');
                            }
                          }}
                          className="px-2 py-0.5 border border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-[9px] rounded font-bold"
                        >
                          Re-Inspect
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          {/* Details & Audit Trail */}
          <div className="col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText size={18} className="text-indigo-600" />
              <span>Inspection Certificate Details</span>
            </h3>

            {selectedItem ? (
              <div className="space-y-4 text-xs">
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenView}
                    className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-slate-600/10 cursor-pointer transition"
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={handleDeleteQC}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Inspection / GRN No</span>
                    <span className="font-bold text-slate-800">{selectedItem.grnNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">QC Status Decision</span>
                    <span className="font-bold text-slate-800">{selectedItem.decision || selectedItem.qualityStatus || 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Vehicle Reference</span>
                    <span className="font-bold text-slate-700">{selectedItem.vehicleNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Final Lot Grade</span>
                    <span className="font-bold text-slate-700">{selectedItem.grade || 'N/A'}</span>
                  </div>
                </div>

                {(selectedItem.decision === 'ACCEPT' || selectedItem.qualityStatus === 'Passed' || selectedItem.decision === 'PARTIAL ACCEPT') && (
                  <button
                    onClick={() => router.push(`/procurement/invoices?action=new&po=${selectedItem.poId || selectedItem.poNo || selectedItem.grnNo?.replace('LOT-', '')}&qc=${selectedItem._id || selectedItem.id || selectedItem.qcNo}`)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Create Purchase Invoice (Step 2 - Next Step)</span>
                  </button>
                )}

                {/* Audit Trail list */}
                {subTab === 'completed' && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <h4 className="font-bold text-slate-700 flex items-center gap-1">
                      <History size={14} className="text-amber-500" />
                      <span>QC Parameter Adjustment Audit Logs</span>
                    </h4>
                    {auditLogs.length === 0 ? (
                      <div className="text-slate-400 py-4 text-center">No adjustments recorded for this certificate.</div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {auditLogs.map((log: any) => (
                          <div key={log._id} className="p-2 bg-slate-50 rounded border border-slate-100 flex justify-between">
                            <div>
                              <div className="font-semibold text-slate-800">{log.parameterName} Adjusted</div>
                              <div className="text-[10px] text-slate-500">Reason: {log.reason}</div>
                            </div>
                            <div className="text-right text-[10px]">
                              <div className="font-semibold text-slate-700">{log.oldValue} ➔ {log.newValue}</div>
                              <div className="text-slate-400">{log.changedBy}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-xs text-slate-400 font-semibold">
                Select an arrival GRN or Quality inspection report to view details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SAMPLES TAB */}
      {activeTab === 'samples' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Trigger Sample Drawing</h3>
            <p className="text-[11px] text-slate-500">Initiate sample collection for incoming lots at weigh-bridge / gate entry.</p>

            <form onSubmit={handleCreateSample} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Select Incoming GRN Arrival *</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  onChange={(e) => {
                    const g = db.grns.find(grn => grn.id === e.target.value || grn._id === e.target.value);
                    setSampleGrn(g);
                  }}
                  required
                >
                  <option value="">-- Choose Arrival --</option>
                  {db.grns.filter(g => g.qualityStatus === 'Pending').map(g => (
                    <option key={g.id} value={g.id}>{g.grnNo} - {g.vehicleNo}</option>
                  ))}
                </select>
              </div>

              {sampleGrn && (
                <div className="space-y-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Lot Net Quantity:</span>
                    <span className="font-bold text-slate-800">{sampleGrn.items[0]?.receivedNow || 0} KG</span>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sample Size drawn (KG) *</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-200 rounded text-xs"
                      value={sampleQty}
                      onChange={e => setSampleQty(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sample Location *</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-slate-200 rounded text-xs"
                      value={sampleLocation}
                      onChange={e => setSampleLocation(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Grain Draw Condition *</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-slate-200 rounded text-xs"
                      value={sampleCondition}
                      onChange={e => setSampleCondition(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Inspector Remarks</label>
                    <textarea 
                      className="w-full p-2 border border-slate-200 rounded text-xs"
                      value={sampleRemarks}
                      onChange={e => setSampleRemarks(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer transition text-xs"
                  >
                    Print Sample Tag & Save
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Sample Drawing Register</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] font-bold">
                    <th className="py-2">Sample ID</th>
                    <th>GRN No</th>
                    <th>Vehicle No</th>
                    <th>Draw Size</th>
                    <th>Draw Location</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">No samples drawn yet.</td>
                    </tr>
                  ) : (
                    samples.map((s: any) => (
                      <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 font-bold text-indigo-600">{s.sampleId}</td>
                        <td className="font-semibold text-slate-700">{s.grnNo}</td>
                        <td>{s.vehicleNo}</td>
                        <td>{s.sampleQuantity} KG</td>
                        <td>{s.sampleLocation}</td>
                        <td>{s.sampleCondition}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* QC INSPECTION MODAL */}
      {isInspectionModalOpen && inspectGrn && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                <FlaskConical className="text-emerald-600" size={18} />
                <span>QC Laboratory Lot Inspection: {inspectGrn.grnNo}</span>
              </h3>
              <button 
                onClick={() => { setIsInspectionModalOpen(false); setInspectGrn(null); }}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitInspection} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Form Body */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs min-h-0">
                {reInspectionOfId && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded font-medium">
                    ⚠️ This inspection is flag-marked as a **Re-Inspection** of the previous QC lot records. History will be fully archived in audit trail logs.
                  </div>
                )}

                {/* Weighment Section */}
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg space-y-3">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1">
                    <Scale size={14} className="text-indigo-600" />
                    <span>Silo Gate Weighment Log</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Gross Weight (KG) *</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border border-slate-200 rounded"
                        value={grossWeight}
                        onChange={e => setGrossWeight(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Tare Weight (KG) *</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border border-slate-200 rounded"
                        value={tareWeight}
                        onChange={e => setTareWeight(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Calculated Net Weight (KG)</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border border-slate-200 bg-slate-100 font-bold"
                        value={netWeight}
                        disabled
                      />
                    </div>
                  </div>
                </div>

                {/* Critical Breach Banner */}
                {hasMandatoryBreach && (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 text-xs space-y-2 shadow-sm animate-pulse">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
                      <ShieldAlert className="text-rose-600 shrink-0" size={20} />
                      <span>🚨 CRITICAL QUALITY VIOLATION - ORDER CANNOT BE ACCEPTED</span>
                    </div>
                    <p className="font-medium text-rose-800 leading-relaxed">
                      One or more tested parameters exceed the maximum limit configured by Admin. Under system quality policy, this order <strong>CANNOT BE ACCEPTED</strong> and has been automatically set to <strong>REJECT</strong>:
                    </p>
                    <div className="bg-white/80 border border-rose-200 rounded-lg p-2.5 space-y-1 font-mono text-[11px]">
                      {evaluatedBreaches.filter(b => !b.isOptional).map((b, idx) => (
                        <div key={idx} className="flex justify-between items-center text-rose-700 font-semibold">
                          <span>❌ {b.name}:</span>
                          <span>Entered: <strong className="text-rose-900 underline">{b.actualValue}</strong> | Admin Limit: <strong>{b.allowedLimit}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parameters Input */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 flex items-center gap-1">
                      <ClipboardCheck size={14} className="text-emerald-600" />
                      <span>Laboratory Quality Parameters</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">Limits enforced by Admin QC Policy</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {specs.filter(s => String(s.commodityId) === String(inspectGrn.items[0]?.item)).map(s => {
                      const breach = evaluatedBreaches.find(b => b.name === s.parameterName);
                      const isBreached = !!breach;
                      const isFail = breach?.status === 'FAIL';
                      const val = actualParams[s.parameterName];
                      const isEntered = val !== undefined && val !== '';

                      return (
                        <div key={s._id} className={`p-2.5 rounded-lg border transition-all ${
                          isFail ? 'bg-rose-50/60 border-rose-300' : isEntered ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase font-bold text-slate-600 block truncate">
                              {s.parameterName}
                            </label>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-semibold">
                              {s.limitType === 'Range' ? `${s.minLimit}-${s.maxLimit} ${s.unit}` : `${s.limitType} ${s.maxLimit || s.minLimit || s.textValue} ${s.unit}`}
                            </span>
                          </div>
                          <div className="relative">
                            <input 
                              type="text" 
                              className={`w-full p-2 border rounded text-xs font-mono font-medium focus:outline-none transition ${
                                isFail 
                                  ? 'border-rose-400 bg-white text-rose-900 focus:ring-2 focus:ring-rose-400' 
                                  : isEntered 
                                    ? 'border-emerald-400 bg-white text-emerald-900 focus:ring-2 focus:ring-emerald-400' 
                                    : 'border-slate-300 bg-white text-slate-800'
                              }`}
                              placeholder={`Actual ${s.parameterName}`}
                              value={actualParams[s.parameterName] || ''}
                              onChange={e => setActualParams({...actualParams, [s.parameterName]: e.target.value})}
                              required
                            />
                          </div>
                          {isEntered && (
                            <div className="mt-1 flex items-center justify-between text-[10px]">
                              {isFail ? (
                                <span className="text-rose-600 font-bold flex items-center gap-1">
                                  ❌ Exceeds Limit (Reject)
                                </span>
                              ) : breach?.status === 'WARN' ? (
                                <span className="text-amber-600 font-bold flex items-center gap-1">
                                  ⚠️ Warning (Tolerated)
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  ✓ Within Admin Limit
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Generic defaults fallback */}
                    {specs.filter(s => String(s.commodityId) === String(inspectGrn.items[0]?.item)).length === 0 && (
                      <>
                        {(() => {
                          const mVal = actualParams['Moisture'];
                          const isMEntered = mVal !== undefined && mVal !== '';
                          const isMFail = isMEntered && Number(mVal) > 12.5;

                          return (
                            <div className={`p-2.5 rounded-lg border transition-all ${isMFail ? 'bg-rose-50/60 border-rose-300' : isMEntered ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] uppercase font-bold text-slate-600 block">Moisture (%)</label>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-semibold">&lt;= 12.5%</span>
                              </div>
                              <input 
                                type="number" 
                                step="any"
                                className={`w-full p-2 border rounded text-xs font-mono font-medium focus:outline-none transition ${isMFail ? 'border-rose-400 bg-white text-rose-900' : isMEntered ? 'border-emerald-400 bg-white text-emerald-900' : 'border-slate-300 bg-white'}`}
                                placeholder="Enter Moisture %"
                                value={actualParams['Moisture'] || ''}
                                onChange={e => setActualParams({...actualParams, 'Moisture': e.target.value})}
                                required
                              />
                              {isMEntered && (
                                <div className="mt-1 text-[10px]">
                                  {isMFail ? (
                                    <span className="text-rose-600 font-bold">❌ Exceeds 12.5% Max Limit</span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">✓ Within Limit</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(() => {
                          const fVal = actualParams['Foreign Material'];
                          const isFEntered = fVal !== undefined && fVal !== '';
                          const isFFail = isFEntered && Number(fVal) > 2.0;

                          return (
                            <div className={`p-2.5 rounded-lg border transition-all ${isFFail ? 'bg-rose-50/60 border-rose-300' : isFEntered ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] uppercase font-bold text-slate-600 block">Foreign Material (%)</label>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-semibold">&lt;= 2.0%</span>
                              </div>
                              <input 
                                type="number" 
                                step="any"
                                className={`w-full p-2 border rounded text-xs font-mono font-medium focus:outline-none transition ${isFFail ? 'border-rose-400 bg-white text-rose-900' : isFEntered ? 'border-emerald-400 bg-white text-emerald-900' : 'border-slate-300 bg-white'}`}
                                placeholder="Enter Foreign Material %"
                                value={actualParams['Foreign Material'] || ''}
                                onChange={e => setActualParams({...actualParams, 'Foreign Material': e.target.value})}
                                required
                              />
                              {isFEntered && (
                                <div className="mt-1 text-[10px]">
                                  {isFFail ? (
                                    <span className="text-rose-600 font-bold">❌ Exceeds 2.0% Max Limit</span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">✓ Within Limit</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {/* Decisions & Splits */}
                <div className={`p-3.5 rounded-lg border space-y-3 transition-all ${
                  hasMandatoryBreach ? 'bg-rose-50/40 border-rose-200' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-700">QC Decision Board</h4>
                    {hasMandatoryBreach && (
                      <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                        ACCEPT Option Disabled (Policy Breach)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">QC Decision *</label>
                      <select 
                        className={`w-full p-2 border rounded text-xs font-bold ${
                          hasMandatoryBreach ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-200'
                        }`}
                        value={overallDecision}
                        onChange={e => setOverallDecision(e.target.value as any)}
                        required
                      >
                        <option value="ACCEPT" disabled={hasMandatoryBreach}>
                          {hasMandatoryBreach ? 'ACCEPT (Blocked - Exceeds Limit)' : 'ACCEPT (All Accepted)'}
                        </option>
                        <option value="PARTIAL ACCEPT" disabled={hasMandatoryBreach}>
                          {hasMandatoryBreach ? 'PARTIAL ACCEPT (Blocked)' : 'PARTIAL ACCEPT (Split)'}
                        </option>
                        <option value="REJECT">REJECT (Return all / Policy Breach)</option>
                        <option value="HOLD">HOLD (Wait Release / Lab Review)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Lot Grading *</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border border-slate-200 rounded"
                        placeholder="e.g. Grade A, Grade B, Rejected"
                        value={overallGrade}
                        onChange={e => setOverallGrade(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {overallDecision === 'PARTIAL ACCEPT' && (
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Accepted (KG)</label>
                        <input 
                          type="number" 
                          className="w-full p-1 border border-slate-200 rounded"
                          value={acceptedQty}
                          onChange={e => setAcceptedQty(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Rejected (KG)</label>
                        <input 
                          type="number" 
                          className="w-full p-1 border border-slate-200 rounded"
                          value={rejectedQty}
                          onChange={e => setRejectedQty(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Hold (KG)</label>
                        <input 
                          type="number" 
                          className="w-full p-1 border border-slate-200 rounded"
                          value={holdQty}
                          onChange={e => setHoldQty(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Damaged (KG)</label>
                        <input 
                          type="number" 
                          className="w-full p-1 border border-slate-200 rounded"
                          value={damagedQty}
                          onChange={e => setDamagedQty(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Adjustments */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Contract Base Price (INR/Qtl) *</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-200 rounded"
                      value={basePrice}
                      onChange={e => setBasePrice(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Quality Price Deduction *</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-200 rounded text-rose-600 font-bold"
                      value={priceDeduction}
                      onChange={e => setPriceDeduction(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Final Cost (INR/Qtl)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-200 bg-slate-100 font-bold text-emerald-600"
                      value={basePrice - priceDeduction}
                      disabled
                    />
                  </div>
                </div>

                {reInspectionOfId && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Re-inspection Reason (Audit Log note) *</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-slate-200 rounded"
                      placeholder="Describe adjustment reason"
                      value={auditReason}
                      onChange={e => setAuditReason(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Lab Inspector Notes</label>
                  <textarea 
                    className="w-full p-2 border border-slate-200 rounded"
                    value={inspectRemarks}
                    onChange={e => setInspectRemarks(e.target.value)}
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
                {isViewMode ? (
                  <button
                    type="button"
                    onClick={() => { setIsInspectionModalOpen(false); setInspectGrn(null); setIsViewMode(false); }}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold cursor-pointer shadow-md"
                  >
                    Close View
                  </button>
                ) : (
                  <>
                    <button 
                      type="button"
                      onClick={() => { setIsInspectionModalOpen(false); setInspectGrn(null); }}
                      className="px-4 py-2 border border-slate-200 rounded text-slate-600 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className={`px-5 py-2 text-white rounded-lg font-bold cursor-pointer transition shadow-md ${
                        overallDecision === 'REJECT'
                          ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                          : overallDecision === 'HOLD'
                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      }`}
                    >
                      {overallDecision === 'REJECT'
                        ? '🚨 Reject Lot (Policy Violation)'
                        : overallDecision === 'HOLD'
                          ? '⏸️ Put Lot On Hold'
                          : '✓ Confirm QC & Accept Lot'}
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
