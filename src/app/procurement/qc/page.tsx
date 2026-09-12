'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import api from '../../../services/axios';
import { 
  FlaskConical, ClipboardCheck, CheckCircle2, Clock, 
  Search, ShieldAlert, Award, FileSpreadsheet, UserCheck,
  Warehouse, ArrowRight, PackageCheck, Scale, FileText,
  History, Settings, BarChart2, Plus, Trash2, Printer, Eye, FileCheck,
  Edit3, X, Check, AlertTriangle, Download, RefreshCw, Filter, ChevronRight,
  TrendingDown, Info, Calculator, Truck, Calendar, DollarSign, Sparkles
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../../utils/dateUtils';
import IndianDateInput from '../../../components/shared/IndianDateInput';
import DataTable from '../../../components/shared/DataTable';
import { calculateQualityRebateFrontend } from '../../../utils/qcCalculation';
import { QualityControl, QualityRebateRule, QualityParameter, QCTestedParameter } from '../../../types/erp';

export default function QualityControlPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qcList, setQcList] = useState<QualityControl[]>([]);
  const [rebateRules, setRebateRules] = useState<QualityRebateRule[]>([]);
  const [qualityParams, setQualityParams] = useState<QualityParameter[]>([]);

  // Search & Multi-Filters State (Section 18)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [filterCommodity, setFilterCommodity] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRebateType, setFilterRebateType] = useState('');
  const [filterCalcMethod, setFilterCalcMethod] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isApprovedEditModalOpen, setIsApprovedEditModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Selected QC for operations
  const [selectedQC, setSelectedQC] = useState<QualityControl | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [modificationReasonInput, setModificationReasonInput] = useState('');

  // Form State for QC Entry (Section 2)
  const [editingQCId, setEditingQCId] = useState<string | null>(null);
  const [formQcNumber, setFormQcNumber] = useState('');
  const [formPartyType, setFormPartyType] = useState<'supplier' | 'farmer'>('farmer');
  const [formPartyId, setFormPartyId] = useState('');
  const [formCommodityId, setFormCommodityId] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');
  const [formQuantity, setFormQuantity] = useState<number | ''>(100);
  const [formUnit, setFormUnit] = useState('MT');
  const [formBaseRate, setFormBaseRate] = useState<number | ''>(25000);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRefNumber, setFormRefNumber] = useState('');
  const [formPoId, setFormPoId] = useState('');
  const [formGrnId, setFormGrnId] = useState('');
  const [formCalcMethod, setFormCalcMethod] = useState<'Discount' | 'Pro-Rata' | 'Both'>('Pro-Rata');
  const [formRebateType, setFormRebateType] = useState<'Standard Rebate' | 'Single Rebate' | 'Double Rebate' | 'All' | 'All Types'>('Standard Rebate');
  const [formDiscountRate, setFormDiscountRate] = useState<number | ''>(2);
  const [formDiscountType, setFormDiscountType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [formInspector, setFormInspector] = useState('QC Analyst');
  const [formNotes, setFormNotes] = useState('');

  // Tested Parameters in Form
  const [formParameters, setFormParameters] = useState<Array<{
    parameterName: string;
    actualValue: number | '';
    unit: string;
    standardValue: number;
    tolerance: number;
  }>>([]);

  // Live calculation preview in form
  const [calculationResult, setCalculationResult] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch QC records from Backend
      const qcRes = await api.get('/quality-control').catch(() => null);
      if (qcRes?.data?.data) {
        setQcList(qcRes.data.data);
      }

      // Fetch Rebate Rules
      const rulesRes = await api.get('/quality-rebate-rules').catch(() => null);
      if (rulesRes?.data?.data) {
        setRebateRules(rulesRes.data.data);
      }

      // Fetch Quality Parameters
      const paramRes = await api.get('/quality-parameters').catch(() => null);
      if (paramRes?.data?.data) {
        setQualityParams(paramRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load QC data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Re-populate dynamic parameter inputs when Commodity, Date, or Rebate Type changes
  const [activeMasterRuleInfo, setActiveMasterRuleInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!formCommodityId) {
      setFormParameters([]);
      setActiveMasterRuleInfo(null);
      return;
    }

    const txDate = new Date(formDate || new Date());
    const selectedComm = db.commodities.find(c => (c.id || c._id) === formCommodityId);
    const commName = selectedComm ? selectedComm.name.toLowerCase().trim() : '';

    // Find active rules for selected commodity
    const matchingRules = rebateRules.filter(r => {
      const rName = (r.commodityName || '').toLowerCase().trim();
      const matchId = r.commodityId === formCommodityId;
      const matchName = commName && rName === commName;
      if (!matchId && !matchName) return false;
      if (r.status !== 'Active') return false;
      if (r.effectiveFrom && new Date(r.effectiveFrom) > txDate) return false;
      if (r.effectiveTo) {
        const toDate = new Date(r.effectiveTo);
        toDate.setHours(23, 59, 59, 999);
        if (txDate > toDate) return false;
      }
      return true;
    });

    if (matchingRules.length > 0) {
      const primaryRule = matchingRules[0];
      setActiveMasterRuleInfo(`${primaryRule.ruleCode} (${primaryRule.calculationMethod})`);

      if (!editingQCId) {
        // Auto-configure form from Master Hub rule
        if (primaryRule.calculationMethod) {
          setFormCalcMethod(primaryRule.calculationMethod);
        }
        if (primaryRule.rebateType) {
          setFormRebateType(primaryRule.rebateType as any);
        }
        if (primaryRule.calculationMethod === 'Discount' || primaryRule.calculationMethod === 'Both') {
          if (primaryRule.rebateRate !== undefined && primaryRule.rebateRate !== null) {
            setFormDiscountRate(primaryRule.rebateRate);
          }
          if (primaryRule.rebateBasis === 'Flat Rate per MT') {
            setFormDiscountType('FLAT');
          } else {
            setFormDiscountType('PERCENT');
          }
        }
      }

      let rulesToUse = matchingRules;
      if (formRebateType === 'Single Rebate') {
        rulesToUse = matchingRules.slice(0, 1);
      } else if (formRebateType === 'Double Rebate') {
        rulesToUse = matchingRules.slice(0, 2);
      }

      setFormParameters(rulesToUse.map(r => {
        // preserve existing actualValue if already entered
        const existing = formParameters.find(p => p.parameterName.toLowerCase() === r.parameterName.toLowerCase());
        return {
          parameterName: r.parameterName,
          actualValue: existing && existing.actualValue !== '' ? existing.actualValue : r.standardValue,
          unit: r.unit || '%',
          standardValue: r.standardValue,
          tolerance: r.tolerance || 0
        };
      }));
    } else {
      setActiveMasterRuleInfo(null);
      // Fallback to standard parameters
      const defaultParams = [
        { parameterName: 'Moisture', standardValue: 14, tolerance: 1, unit: '%' },
        { parameterName: 'Protein', standardValue: 45, tolerance: 0.5, unit: '%' }
      ];
      let fallback = defaultParams;
      if (formRebateType === 'Single Rebate') fallback = defaultParams.slice(0, 1);
      setFormParameters(fallback.map(p => ({
        parameterName: p.parameterName,
        actualValue: p.standardValue,
        unit: p.unit,
        standardValue: p.standardValue,
        tolerance: p.tolerance
      })));
    }
  }, [formCommodityId, formRebateType, formDate, rebateRules, editingQCId]);

  // Execute live calculation whenever form inputs change
  useEffect(() => {
    if (!formQuantity || !formBaseRate || Number(formQuantity) <= 0 || Number(formBaseRate) < 0) {
      setCalculationResult(null);
      return;
    }

    const selectedComm = db.commodities.find(c => (c.id || c._id) === formCommodityId);

    const calc = calculateQualityRebateFrontend({
      commodityId: formCommodityId,
      commodityName: selectedComm ? selectedComm.name : 'Commodity',
      quantity: Number(formQuantity),
      baseRate: Number(formBaseRate),
      calculationMethod: formCalcMethod,
      rebateType: formRebateType,
      discountRate: Number(formDiscountRate) || 0,
      discountType: formDiscountType,
      qualityParameters: formParameters.map(p => ({
        parameterName: p.parameterName,
        actualValue: Number(p.actualValue) || 0,
        unit: p.unit,
        standardValue: p.standardValue,
        tolerance: p.tolerance
      })),
      applicableRules: rebateRules,
      transactionDate: formDate
    });

    setCalculationResult(calc);
  }, [formQuantity, formBaseRate, formCalcMethod, formRebateType, formDiscountRate, formDiscountType, formParameters, formCommodityId, formDate, rebateRules, db.commodities]);

  // Filter POs and GRNs that already have an active/draft/approved QC record created
  const availablePOs = useMemo(() => {
    const usedPoSet = new Set<string>();

    const addIdentifier = (val?: any) => {
      if (!val) return;
      const s = String(val).trim().toLowerCase();
      if (!s) return;
      usedPoSet.add(s);
      usedPoSet.add(s.replace(/[^a-z0-9]/g, ''));
      // If not a 24-char MongoDB ObjectId, extract sequence numbers (e.g. '00007' and '7')
      if (!/^[0-9a-fA-F]{24}$/.test(s)) {
        const numMatch = s.match(/\d+$/);
        if (numMatch) {
          usedPoSet.add(numMatch[0]);
          usedPoSet.add(String(parseInt(numMatch[0], 10)));
        }
      }
    };

    // From QC List (all except Rejected)
    qcList.forEach(qc => {
      // If currently editing this specific QC, allow its existing PO
      if (editingQCId && (qc._id === editingQCId || qc.id === editingQCId)) {
        return;
      }
      if (qc.status !== 'Rejected') {
        addIdentifier(qc.poId);
        addIdentifier(qc.poNumber);
        addIdentifier(qc.referenceNumber);
      }
    });

    // From ErpContext quality inspections (if any)
    (db.qualityInspections || []).forEach((qi: any) => {
      if (qi.status !== 'Rejected') {
        addIdentifier(qi.poId);
        addIdentifier(qi.poNo);
      }
    });

    // Filter only Approved Purchase Orders (Draft / Pending Approval / Cancelled POs cannot undergo QC)
    const approvedPOs = db.purchaseOrders.filter(p => {
      const st = (p.status || '').toLowerCase().trim();
      return st === 'approved' || st === 'sent' || st === 'partially received' || st === 'received';
    });

    return approvedPOs.filter(p => {
      const idStr = String(p.id || (p as any)._id || '').toLowerCase().trim();
      const poNoStr = String(p.poNo || (p as any).poNumber || '').toLowerCase().trim();
      const cleanId = idStr.replace(/[^a-z0-9]/g, '');
      const cleanPoNo = poNoStr.replace(/[^a-z0-9]/g, '');

      if (idStr && usedPoSet.has(idStr)) return false;
      if (cleanId && usedPoSet.has(cleanId)) return false;
      if (poNoStr && usedPoSet.has(poNoStr)) return false;
      if (cleanPoNo && usedPoSet.has(cleanPoNo)) return false;

      if (!/^[0-9a-fA-F]{24}$/.test(poNoStr)) {
        const poNumMatch = poNoStr.match(/\d+$/);
        if (poNumMatch && (usedPoSet.has(poNumMatch[0]) || usedPoSet.has(String(parseInt(poNumMatch[0], 10))))) {
          return false;
        }
      }
      return true;
    });
  }, [db.purchaseOrders, db.qualityInspections, qcList, editingQCId]);

  const availableGRNs = useMemo(() => {
    const usedGrnIdentifiers = new Set<string>();

    qcList.forEach(qc => {
      if (editingQCId && (qc._id === editingQCId || qc.id === editingQCId)) return;
      if (qc.status !== 'Rejected') {
        if (qc.grnId) usedGrnIdentifiers.add(String(qc.grnId).toLowerCase().trim());
        if ((qc as any).grnNumber) usedGrnIdentifiers.add(String((qc as any).grnNumber).toLowerCase().trim());
        if (qc.referenceNumber) usedGrnIdentifiers.add(String(qc.referenceNumber).toLowerCase().trim());
      }
    });

    return db.grns.filter(g => {
      const idStr = String(g.id || (g as any)._id || '').toLowerCase().trim();
      const grnNoStr = String(g.grnNo || (g as any).grnNumber || '').toLowerCase().trim();

      const isUsed = (idStr && usedGrnIdentifiers.has(idStr)) || (grnNoStr && usedGrnIdentifiers.has(grnNoStr));
      return !isUsed;
    });
  }, [db.grns, qcList, editingQCId]);

  // Auto-fetch details when selecting reference PO or GRN
  const handleSelectReferencePo = (poNo: string) => {
    const po = db.purchaseOrders.find(p => 
      p.poNo === poNo || 
      p.id === poNo || 
      (p as any)._id === poNo || 
      (p as any).poNumber === poNo
    );
    if (!po) return;

    const actualPoNo = po.poNo || (po as any).poNumber || '';
    setFormRefNumber(actualPoNo);
    setFormPoId(po.id || (po as any)._id || '');
    setFormPartyType(po.partyType || 'supplier');
    
    // Resolve partner ID
    let partnerId = '';
    if (po.partyId) {
      partnerId = typeof po.partyId === 'object' ? String((po.partyId as any)?._id || (po.partyId as any)?.id || '') : String(po.partyId);
    } else if ((po as any).supplier) {
      partnerId = typeof (po as any).supplier === 'object' ? String(((po as any).supplier as any)?._id || ((po as any).supplier as any)?.id || '') : String((po as any).supplier);
    }

    if (partnerId) {
      setFormPartyId(partnerId);
    } else {
      const firstPartner = (po.partyType === 'farmer' ? db.farmers[0]?.id : db.suppliers[0]?.id) || '';
      setFormPartyId(firstPartner);
    }

    if (po.items && po.items.length > 0) {
      const item = po.items[0];
      const rawItemVal = typeof item.item === 'object' && item.item !== null ? String((item.item as any)?._id || (item.item as any)?.name || '') : String(item.item || '');
      const rawDesc = String((item as any).description || '');

      const comm = db.commodities.find(c => 
        (c.id && (c.id === rawItemVal || (c as any)._id === rawItemVal)) ||
        c.name?.toLowerCase() === rawItemVal.toLowerCase() || 
        (rawDesc && c.name?.toLowerCase() === rawDesc.toLowerCase())
      );
      if (comm) {
        setFormCommodityId(comm.id || (comm as any)._id || '');
      } else if (db.commodities.length > 0) {
        setFormCommodityId(db.commodities[0].id || (db.commodities[0] as any)._id || '');
      }
      setFormQuantity(item.quantity || 100);
      setFormBaseRate(item.rate || 25000);
      setFormUnit(item.unit || 'MT');
    }
    showToast(`Loaded details from Purchase Order ${actualPoNo}`, 'info');
  };

  const handleSelectReferenceGrn = (grnNo: string) => {
    const grn = db.grns.find(g => g.grnNo === grnNo || g.id === grnNo || (g as any)._id === grnNo || (g as any).grnNumber === grnNo);
    if (!grn) return;
    const actualGrnNo = grn.grnNo || (grn as any).grnNumber || '';
    setFormRefNumber(actualGrnNo);
    setFormGrnId(grn.id || (grn as any)._id || '');
    setFormVehicleNumber(grn.vehicleNo || '');
    setFormPartyType(grn.partyType || 'supplier');
    setFormPartyId(grn.partyId || '');
    if (grn.items && grn.items.length > 0) {
      const item = grn.items[0];
      const comm = db.commodities.find(c => c.name?.toLowerCase() === item.item?.toLowerCase() || c.id === item.item || (c as any)._id === item.item);
      if (comm) {
        setFormCommodityId(comm.id || (comm as any)._id || '');
        setFormBaseRate(comm.purchaseCost || 22000);
      }
      setFormQuantity(item.receivedNow || item.orderedQty || 50);
      setFormUnit(item.unit || 'MT');
    }
    showToast(`Loaded details from GRN ${actualGrnNo}`, 'info');
  };

  // Open Add QC Modal
  const handleOpenCreateModal = () => {
    if (availablePOs.length === 0) {
      showToast('All approved Purchase Orders already have Quality Control inspections completed! Please create a new PO first.', 'info');
    }

    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(qcList.length + 1).padStart(4, '0');
    setEditingQCId(null);
    setFormQcNumber(`QC-${yr}${mo}-${seq}`);
    setFormVehicleNumber('BR-01-GB-4590');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCalcMethod('Pro-Rata');
    setFormRebateType('Standard Rebate');
    setFormDiscountRate(2);
    setFormDiscountType('PERCENT');
    setFormInspector('QC Analyst');
    setFormNotes('');
    setModificationReasonInput('');

    // Pre-populate from first available PO if any
    if (availablePOs.length > 0) {
      const firstPo = availablePOs[0];
      handleSelectReferencePo(firstPo.poNo || (firstPo as any).poNumber || firstPo.id);
    } else {
      setFormRefNumber('');
      setFormPoId('');
      setFormPartyType('supplier');
      setFormPartyId('');
      setFormCommodityId('');
      setFormQuantity(100);
      setFormBaseRate(25000);
    }

    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (qc: QualityControl) => {
    setSelectedQC(qc);
    if (qc.status === 'Approved') {
      // Prompt authorized reason modal first
      setIsApprovedEditModalOpen(true);
      return;
    }
    populateFormForQC(qc);
    setIsFormOpen(true);
  };

  const populateFormForQC = (qc: QualityControl) => {
    setEditingQCId(qc._id || qc.id || null);
    setFormQcNumber(qc.qcNumber);
    setFormPartyType(qc.partyType);
    setFormPartyId(qc.partyId);
    setFormCommodityId(qc.commodityId);
    setFormVehicleNumber(qc.vehicleNumber);
    setFormQuantity(qc.quantity);
    setFormUnit(qc.unit || 'MT');
    setFormBaseRate(qc.baseRate);
    setFormDate(new Date(qc.date).toISOString().split('T')[0]);
    setFormRefNumber(qc.referenceNumber || '');
    setFormPoId(qc.poId || '');
    setFormGrnId(qc.grnId || '');
    setFormCalcMethod(qc.calculationMethod);
    setFormRebateType(qc.rebateType);
    setFormDiscountRate(qc.discountRate || 0);
    setFormDiscountType(qc.discountType || 'PERCENT');
    setFormInspector(qc.inspector || 'QC Analyst');
    setFormNotes(qc.notes || '');

    if (qc.qualityParameters && qc.qualityParameters.length > 0) {
      setFormParameters(qc.qualityParameters.map(p => ({
        parameterName: p.parameterName,
        actualValue: p.actualValue,
        unit: p.unit || '%',
        standardValue: p.standardValue,
        tolerance: p.tolerance || 0
      })));
    }
  };

  const handleProceedApprovedEdit = () => {
    if (!modificationReasonInput || modificationReasonInput.trim().length < 5) {
      showToast('Please provide a valid modification reason (minimum 5 characters)', 'error');
      return;
    }
    setIsApprovedEditModalOpen(false);
    if (selectedQC) {
      populateFormForQC(selectedQC);
      setIsFormOpen(true);
    }
  };

  // Submit Save QC (Create / Update)
  const handleSaveQC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRefNumber && !formPoId) {
      showToast('A linked Purchase Order is mandatory. Please select a Purchase Order to create Quality Inspection.', 'error');
      return;
    }
    if (!formPartyId || !formCommodityId || !formQuantity || Number(formQuantity) <= 0 || !formBaseRate || Number(formBaseRate) < 0) {
      showToast('Please provide valid positive numbers for quantity and rate', 'error');
      return;
    }

    const party = formPartyType === 'farmer' 
      ? db.farmers.find(f => (f.id || f._id) === formPartyId)
      : db.suppliers.find(s => (s.id || s._id) === formPartyId);

    const comm = db.commodities.find(c => (c.id || c._id) === formCommodityId);

    const payload = {
      qcNumber: formQcNumber,
      partyType: formPartyType,
      partyId: formPartyId,
      partyName: party ? party.name : 'Partner',
      commodityId: formCommodityId,
      commodityName: comm ? comm.name : 'Commodity',
      vehicleNumber: formVehicleNumber || 'N/A',
      quantity: Number(formQuantity),
      unit: formUnit,
      baseRate: Number(formBaseRate),
      date: formDate,
      referenceNumber: formRefNumber,
      poId: formPoId || undefined,
      grnId: formGrnId || undefined,
      rebateType: formRebateType,
      calculationMethod: formCalcMethod,
      discountRate: Number(formDiscountRate) || 0,
      discountType: formDiscountType,
      qualityParameters: formParameters.map(p => ({
        parameterName: p.parameterName,
        actualValue: Number(p.actualValue) || 0,
        unit: p.unit,
        standardValue: p.standardValue,
        tolerance: p.tolerance
      })),
      inspector: formInspector,
      notes: formNotes,
      modificationReason: modificationReasonInput || undefined
    };

    try {
      if (editingQCId) {
        const res = await api.put(`/quality-control/${editingQCId}`, payload);
        showToast('Quality Control record updated successfully', 'success');
      } else {
        const res = await api.post('/quality-control', payload);
        showToast(`QC Record ${formQcNumber} created successfully in Draft status`, 'success');
      }
      setIsFormOpen(false);
      setModificationReasonInput('');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error saving QC record', 'error');
    }
  };

  // Submit QC
  const handleSubmitQC = async (qc: QualityControl) => {
    if (!confirm(`Submit QC ${qc.qcNumber} for inspection verification?`)) return;
    try {
      await api.post(`/quality-control/${qc._id || qc.id}/submit`);
      showToast(`QC ${qc.qcNumber} submitted for verification`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to submit QC', 'error');
    }
  };

  // Approve QC
  const handleApproveQC = async (qc: QualityControl) => {
    if (!confirm(`Are you sure you want to Approve QC ${qc.qcNumber}? This will finalize rebate deductions.`)) return;
    try {
      await api.post(`/quality-control/${qc._id || qc.id}/approve`);
      showToast(`QC ${qc.qcNumber} Approved & Finalized!`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to approve QC', 'error');
    }
  };

  // Reject QC
  const handleOpenRejectModal = (qc: QualityControl) => {
    setSelectedQC(qc);
    setRejectionReasonInput('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejectQC = async () => {
    if (!selectedQC) return;
    if (!rejectionReasonInput || rejectionReasonInput.trim().length === 0) {
      showToast('Rejection reason is required', 'error');
      return;
    }
    try {
      await api.post(`/quality-control/${selectedQC._id || selectedQC.id}/reject`, {
        reason: rejectionReasonInput
      });
      showToast(`QC ${selectedQC.qcNumber} has been Rejected`, 'info');
      setIsRejectModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reject QC', 'error');
    }
  };

  // Delete Draft QC
  const handleDeleteQC = async (qc: QualityControl) => {
    if (qc.status === 'Approved') {
      showToast('Approved QC records cannot be deleted', 'error');
      return;
    }
    if (!confirm(`Delete Draft QC ${qc.qcNumber}?`)) return;
    try {
      await api.delete(`/quality-control/${qc._id || qc.id}`);
      showToast(`QC ${qc.qcNumber} deleted`, 'info');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete QC', 'error');
    }
  };

  // View Details
  const handleViewDetails = (qc: QualityControl) => {
    setSelectedQC(qc);
    setIsViewModalOpen(true);
  };

  // Print Dialog
  const handleOpenPrint = (qc: QualityControl) => {
    setSelectedQC(qc);
    setIsPrintModalOpen(true);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  // Download PDF using jsPDF (Section 1)
  const handleDownloadPDF = (qc: QualityControl) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Header Branding
    doc.setFillColor(16, 185, 129); // Emerald header banner
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BRIJRANI AGRO FOODS - QUALITY CONTROL CERTIFICATE', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Trading & Silo Storage ERP | Quality & Rebate Assessment Slip', 14, 20);

    // Document Metadata
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`QC NUMBER: ${qc.qcNumber}`, 14, 34);
    doc.text(`DATE: ${formatDate(qc.date)}`, 140, 34);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Status: ${qc.status}`, 14, 40);
    doc.text(`Party: ${qc.partyName} (${qc.partyType.toUpperCase()})`, 14, 46);
    doc.text(`Commodity: ${qc.commodityName}`, 14, 52);
    doc.text(`Vehicle Number: ${qc.vehicleNumber}`, 14, 58);
    doc.text(`Ref Doc No: ${qc.referenceNumber || 'N/A'}`, 14, 64);

    doc.text(`Inspection Method: ${qc.calculationMethod}`, 140, 40);
    doc.text(`Rebate Type: ${qc.rebateType}`, 140, 46);
    doc.text(`Quantity: ${qc.quantity} ${qc.unit || 'MT'}`, 140, 52);
    doc.text(`Base Purchase Rate: Rs ${qc.baseRate.toLocaleString('en-IN')}/${qc.unit || 'MT'}`, 140, 58);
    doc.text(`Inspector: ${qc.inspector || 'QC Analyst'}`, 140, 64);

    // Table Header
    let yPos = 74;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, yPos, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('Quality Parameter', 16, yPos + 5.5);
    doc.text('Standard', 65, yPos + 5.5);
    doc.text('Actual', 90, yPos + 5.5);
    doc.text('Deviation', 115, yPos + 5.5);
    doc.text('Rebate / Unit', 140, yPos + 5.5);
    doc.text('Total Rebate', 170, yPos + 5.5);

    // Table Rows
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    if (qc.qualityParameters && qc.qualityParameters.length > 0) {
      qc.qualityParameters.forEach((p, idx) => {
        doc.text(p.parameterName, 16, yPos);
        doc.text(`${p.standardValue}${p.unit || '%'}`, 65, yPos);
        doc.text(`${p.actualValue}${p.unit || '%'}`, 90, yPos);
        doc.text(`${p.deviation > 0 ? '+' : ''}${p.deviation.toFixed(2)}${p.unit || '%'}`, 115, yPos);
        doc.text(`Rs ${p.rebatePerUnit.toFixed(2)}`, 140, yPos);
        doc.text(`Rs ${p.rebateTotal.toLocaleString('en-IN')}`, 170, yPos);
        yPos += 7;
      });
    } else {
      doc.text('Global Discount Calculation Applied', 16, yPos);
      doc.text(`Discount: Rs ${qc.totalRebate}/unit`, 140, yPos);
      doc.text(`Rs ${qc.totalDeduction.toLocaleString('en-IN')}`, 170, yPos);
      yPos += 7;
    }

    // Financial Calculation Summary Card
    yPos += 5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, yPos, 182, 40, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('FINANCIAL SETTLEMENT SUMMARY', 18, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Base Rate: Rs ${qc.baseRate.toLocaleString('en-IN')}/${qc.unit || 'MT'}`, 18, yPos + 16);
    doc.text(`Total Rebate Deduction: - Rs ${qc.totalRebate.toLocaleString('en-IN')}/${qc.unit || 'MT'}`, 18, yPos + 23);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`FINAL SETTLED RATE: Rs ${qc.finalRate.toLocaleString('en-IN')}/${qc.unit || 'MT'}`, 18, yPos + 32);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gross Value: Rs ${qc.baseValue.toLocaleString('en-IN')}`, 110, yPos + 16);
    doc.text(`Total Deduction Amount: - Rs ${qc.totalDeduction.toLocaleString('en-IN')}`, 110, yPos + 23);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`FINAL SETTLED VALUE: Rs ${qc.finalValue.toLocaleString('en-IN')}`, 110, yPos + 32);

    // Signatures
    yPos += 55;
    doc.setDrawColor(148, 163, 184);
    doc.line(18, yPos, 65, yPos);
    doc.line(80, yPos, 130, yPos);
    doc.line(145, yPos, 190, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared By (Weighbridge)', 18, yPos + 5);
    doc.text('Tested By (QC Inspector)', 80, yPos + 5);
    doc.text('Authorized Approver (Purchase)', 145, yPos + 5);

    // Audit Footer
    yPos += 15;
    doc.setFontSize(7.5);
    doc.text(`Generated on ${new Date().toLocaleString()} by ${qc.createdBy}. BrijRani Quality Control ERP System v1.2`, 14, 285);

    const cleanFileName = `${(qc.qcNumber || 'QC').replace(/[^a-zA-Z0-9_-]/g, '_')}_Quality_Certificate.pdf`;
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
    showToast(`Downloaded Certificate (${cleanFileName})`, 'success');
  };

  // Filtered QC List
  const filteredQcList = useMemo(() => {
    return qcList.filter(qc => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = qc.qcNumber.toLowerCase().includes(q) ||
          qc.partyName.toLowerCase().includes(q) ||
          qc.commodityName.toLowerCase().includes(q) ||
          qc.vehicleNumber.toLowerCase().includes(q) ||
          (qc.referenceNumber && qc.referenceNumber.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (filterParty && qc.partyId !== filterParty) return false;
      if (filterCommodity && qc.commodityId !== filterCommodity) return false;
      if (filterVehicle && !qc.vehicleNumber.toLowerCase().includes(filterVehicle.toLowerCase())) return false;
      if (filterStatus && qc.status !== filterStatus) return false;
      if (filterRebateType && qc.rebateType !== filterRebateType) return false;
      if (filterCalcMethod && qc.calculationMethod !== filterCalcMethod) return false;
      if (filterStartDate && new Date(qc.date) < new Date(filterStartDate)) return false;
      if (filterEndDate && new Date(qc.date) > new Date(filterEndDate)) return false;
      return true;
    });
  }, [qcList, searchQuery, filterParty, filterCommodity, filterVehicle, filterStatus, filterRebateType, filterCalcMethod, filterStartDate, filterEndDate]);

  // Metric Stats
  const stats = useMemo(() => {
    const total = qcList.length;
    const draft = qcList.filter(q => q.status === 'Draft').length;
    const submitted = qcList.filter(q => q.status === 'Submitted' || q.status === 'Under Review').length;
    const approved = qcList.filter(q => q.status === 'Approved').length;
    const rejected = qcList.filter(q => q.status === 'Rejected').length;
    const totalDeductions = qcList.reduce((acc, q) => acc + (q.totalDeduction || 0), 0);
    return { total, draft, submitted, approved, rejected, totalDeductions };
  }, [qcList]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
              <FlaskConical size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Quality Control & Assessment</h1>
              <p className="text-xs text-slate-500 font-medium">Agricultural commodity quality inspection, rebate calculations & approvals</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/masters?tab=qualityRebateRules')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition"
          >
            <Settings size={14} className="text-slate-500" />
            <span>Rebate Rules Master</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20 transition"
          >
            <Plus size={15} />
            <span>New Quality Inspection</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Inspections</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Logged QC slips</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Draft QCs</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{stats.draft}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Editable slips</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Under Review</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{stats.submitted}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Awaiting manager approval</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{stats.approved}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Finalized & Locked</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-sm">
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Rejected</div>
          <div className="text-2xl font-bold text-red-800 mt-1">{stats.rejected}</div>
          <div className="text-[10px] text-red-600 mt-0.5">Failed specifications</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Rebates</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹{stats.totalDeductions.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Deducted from invoices</div>
        </div>
      </div>

      {/* 3. Search & Multi-Filter Control Bar (Section 18) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search QC No, Partner, Vehicle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Commodity Filter */}
          <div>
            <select
              value={filterCommodity}
              onChange={e => setFilterCommodity(e.target.value)}
              className="w-full py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Commodities</option>
              {db.commodities.map(c => (
                <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Rebate Type */}
          <div>
            <select
              value={filterRebateType}
              onChange={e => setFilterRebateType(e.target.value)}
              className="w-full py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Rebate Types</option>
              <option value="Standard Rebate">Standard Rebate</option>
              <option value="Single Rebate">Single Rebate</option>
              <option value="Double Rebate">Double Rebate</option>
              <option value="All Types">All Types</option>
            </select>
          </div>

          {/* Calculation Method */}
          <div>
            <select
              value={filterCalcMethod}
              onChange={e => setFilterCalcMethod(e.target.value)}
              className="w-full py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Calc Methods</option>
              <option value="Pro-Rata">Pro-Rata</option>
              <option value="Discount">Discount</option>
              <option value="Both">Both (Hybrid)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="w-full py-2 px-2 text-xs border border-slate-200 rounded-lg text-slate-700"
              placeholder="From Date"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="w-full py-2 px-2 text-xs border border-slate-200 rounded-lg text-slate-700"
              placeholder="To Date"
            />
          </div>
        </div>

        {(searchQuery || filterCommodity || filterRebateType || filterCalcMethod || filterStatus || filterStartDate || filterEndDate) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>Filtered results: <strong>{filteredQcList.length}</strong> matching records</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterParty('');
                setFilterCommodity('');
                setFilterVehicle('');
                setFilterStatus('');
                setFilterRebateType('');
                setFilterCalcMethod('');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 4. QC Master List Table (All 13 Required Columns - Section 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-3">QC Number</th>
                <th className="py-3 px-3">Supplier / Farmer</th>
                <th className="py-3 px-3">Commodity</th>
                <th className="py-3 px-3">Vehicle No</th>
                <th className="py-3 px-3 text-right">Quantity</th>
                <th className="py-3 px-3 text-right">Rate</th>
                <th className="py-3 px-3">Rebate Type</th>
                <th className="py-3 px-3">Calc Method</th>
                <th className="py-3 px-3 text-right">Total Rebate</th>
                <th className="py-3 px-3 text-right">Final Rate</th>
                <th className="py-3 px-3 text-right">Final Value</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQcList.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400">
                    <FlaskConical size={32} className="mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="font-semibold">No Quality Control records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;New Quality Inspection&quot; to log your first QC record</p>
                  </td>
                </tr>
              ) : (
                filteredQcList.map(qc => (
                  <tr key={qc._id || qc.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* QC Number */}
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetails(qc)}
                        className="text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        {qc.qcNumber}
                      </button>
                    </td>

                    {/* Supplier / Farmer */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{qc.partyName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">{qc.partyType}</div>
                    </td>

                    {/* Commodity */}
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                      {qc.commodityName}
                    </td>

                    {/* Vehicle Number */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {qc.vehicleNumber || '-'}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {qc.quantity} <span className="text-[10px] font-normal text-slate-400">{qc.unit || 'MT'}</span>
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap text-slate-700">
                      ₹{qc.baseRate.toLocaleString('en-IN')}
                    </td>

                    {/* Rebate Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {qc.rebateType}
                      </span>
                    </td>

                    {/* Calculation Method */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        qc.calculationMethod === 'Pro-Rata' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {qc.calculationMethod}
                      </span>
                    </td>

                    {/* Total Rebate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-red-600">
                      {qc.totalRebate > 0 ? `- ₹${qc.totalRebate.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    {/* Final Rate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-slate-900">
                      ₹{qc.finalRate.toLocaleString('en-IN')}
                    </td>

                    {/* Final Value */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-emerald-700">
                      ₹{qc.finalValue.toLocaleString('en-IN')}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        qc.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                        qc.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                        qc.status === 'Under Review' ? 'bg-indigo-100 text-indigo-800' :
                        qc.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {qc.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {formatDate(qc.date)}
                    </td>

                    {/* Actions Menu (View, Edit, Submit, Approve, Reject, Print, Download) */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* View */}
                        <button
                          onClick={() => handleViewDetails(qc)}
                          className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                          title="View complete QC breakdown"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(qc)}
                          className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                          title={qc.status === 'Approved' ? 'Request authorized edit with reason' : 'Edit QC'}
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* Submit (if Draft) */}
                        {qc.status === 'Draft' && (
                          <button
                            onClick={() => handleSubmitQC(qc)}
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition cursor-pointer"
                            title="Submit for Approval"
                          >
                            <FileCheck size={14} />
                          </button>
                        )}

                        {/* Approve (if Submitted / Draft) */}
                        {qc.status !== 'Approved' && qc.status !== 'Rejected' && (
                          <button
                            onClick={() => handleApproveQC(qc)}
                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Approve QC"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}

                        {/* Create Purchase Invoice (if Approved or Submitted) */}
                        {qc.status !== 'Rejected' && (
                          <button
                            onClick={() => router.push(`/procurement/invoices?qc=${qc._id || qc.id}&action=new`)}
                            className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition cursor-pointer"
                            title="Generate Purchase Invoice according to QC Rebate"
                          >
                            <FileText size={14} />
                          </button>
                        )}

                        {/* Reject */}
                        {qc.status !== 'Rejected' && (
                          <button
                            onClick={() => handleOpenRejectModal(qc)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Reject QC"
                          >
                            <ShieldAlert size={14} />
                          </button>
                        )}

                        {/* Print */}
                        <button
                          onClick={() => handleOpenPrint(qc)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Print QC Voucher"
                        >
                          <Printer size={14} />
                        </button>

                        {/* Download PDF */}
                        <button
                          onClick={() => handleDownloadPDF(qc)}
                          className="p-1 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded transition cursor-pointer"
                          title="Download PDF Certificate"
                        >
                          <Download size={14} />
                        </button>

                        {/* Delete (if Draft) */}
                        {qc.status === 'Draft' && (
                          <button
                            onClick={() => handleDeleteQC(qc)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Delete Draft"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. CREATE / EDIT QC MODAL & DYNAMIC FORM (Section 2 & 25) */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] my-auto flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <FlaskConical size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingQCId ? `Edit Quality Assessment (${formQcNumber})` : 'New Quality Assessment & Rebate Calculation'}
                  </h2>
                  <p className="text-xs text-slate-500">Enter laboratory testing parameters to dynamically compute quality rebates</p>
                </div>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveQC} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Mandatory Purchase Order Link Section */}
              <div className={`p-3.5 rounded-xl border transition ${
                formRefNumber ? 'bg-emerald-50/70 border-emerald-300' : 'bg-amber-50/80 border-amber-300'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <PackageCheck size={18} className={formRefNumber ? 'text-emerald-600' : 'text-amber-600'} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          Select Purchase Order to Inspect <span className="text-red-500">*</span>
                        </span>
                        {formRefNumber && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check size={10} /> Linked: {formRefNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Quality Inspection requires an approved PO (Orders already inspected are automatically excluded)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className={`p-2 border rounded-lg bg-white text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none min-w-[220px] ${
                        formRefNumber ? 'border-emerald-300' : 'border-amber-400 bg-amber-50/30'
                      }`}
                      onChange={(e) => { if (e.target.value) handleSelectReferencePo(e.target.value); }}
                      value={formRefNumber || ""}
                      required
                    >
                      <option value="" disabled>-- Link Purchase Order ({availablePOs.length} Pending QC) --</option>
                      {availablePOs.map(p => (
                        <option key={p.id || (p as any)._id} value={p.poNo || (p as any).poNumber}>
                          {p.poNo || (p as any).poNumber} ({p.partyType || 'supplier'})
                        </option>
                      ))}
                    </select>

                    <select
                      className="p-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-700 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      onChange={(e) => { if (e.target.value) handleSelectReferenceGrn(e.target.value); }}
                      value={formGrnId || ""}
                    >
                      <option value="">-- Optional: Link Inward GRN ({availableGRNs.length}) --</option>
                      {availableGRNs.map(g => (
                        <option key={g.id || (g as any)._id} value={g.grnNo || (g as any).grnNumber}>
                          {g.grnNo || (g as any).grnNumber} ({g.vehicleNo || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {availablePOs.length === 0 && !editingQCId && (
                  <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center gap-2 font-medium">
                    <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                    <span>
                      <strong>No Approved Purchase Orders Available:</strong> Only Purchase Orders in <strong>Approved</strong> status can undergo Quality Control inspection. Please create and approve a Purchase Order in Procurement &gt; Purchase Orders first.
                    </span>
                  </div>
                )}
              </div>

              {/* Basic Details (Section 2) */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Info size={14} className="text-emerald-600" />
                  <span>1. Basic Transaction Details</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">QC Slip Number *</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 bg-slate-50"
                      value={formQcNumber}
                      onChange={e => setFormQcNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      Partner Type * {formRefNumber && <span className="text-[9px] text-emerald-600 font-normal">(From PO)</span>}
                    </label>
                    <select
                      className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-medium ${
                        formRefNumber ? 'bg-slate-50 text-slate-700 cursor-not-allowed' : 'bg-white text-slate-800'
                      }`}
                      value={formPartyType}
                      disabled={!!formRefNumber}
                      onChange={e => {
                        const pt = e.target.value as 'supplier' | 'farmer';
                        setFormPartyType(pt);
                        setFormPartyId(pt === 'farmer' ? db.farmers[0]?.id || '' : db.suppliers[0]?.id || '');
                      }}
                    >
                      <option value="farmer">Farmer</option>
                      <option value="supplier">Supplier / Trader</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      {formPartyType === 'farmer' ? 'Farmer Name *' : 'Supplier Name *'} {formRefNumber && <span className="text-[9px] text-emerald-600 font-normal">(From PO)</span>}
                    </label>
                    <select
                      className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-medium ${
                        formRefNumber ? 'bg-slate-50 text-slate-700 cursor-not-allowed' : 'bg-white text-slate-800'
                      }`}
                      value={formPartyId}
                      disabled={!!formRefNumber}
                      onChange={e => setFormPartyId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Partner --</option>
                      {formPartyType === 'farmer' 
                        ? db.farmers.map(f => <option key={f.id || f._id} value={f.id || f._id}>{f.name} ({f.state || f.address || 'Bihar'})</option>)
                        : db.suppliers.map(s => <option key={s.id || s._id} value={s.id || s._id}>{s.name} ({s.gstin})</option>)
                      }
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      Commodity * {formRefNumber && <span className="text-[9px] text-emerald-600 font-normal">(From PO)</span>}
                    </label>
                    <select
                      className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-medium ${
                        formRefNumber ? 'bg-slate-50 text-slate-700 cursor-not-allowed' : 'bg-white text-slate-800'
                      }`}
                      value={formCommodityId}
                      disabled={!!formRefNumber}
                      onChange={e => setFormCommodityId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Commodity --</option>
                      {db.commodities.map(c => (
                        <option key={c.id || c._id} value={c.id || c._id}>{c.name} ({c.unit || 'MT'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Vehicle Number *</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-800"
                      placeholder="e.g. BR-01-GB-4590"
                      value={formVehicleNumber}
                      onChange={e => setFormVehicleNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Quantity ({formUnit}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                      value={formQuantity}
                      onChange={e => setFormQuantity(e.target.value !== '' ? Number(e.target.value) : '')}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Base Purchase Rate (₹/{formUnit}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                      value={formBaseRate}
                      onChange={e => setFormBaseRate(e.target.value !== '' ? Number(e.target.value) : '')}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Transaction Date *</label>
                    <IndianDateInput
                      value={formDate}
                      onChange={val => setFormDate(val)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Calculation Method & Rebate Type (Section 3, 4, 5) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Calculator size={14} className="text-emerald-600" />
                    <span>2. Calculation Method & Rebate Model</span>
                  </h3>
                  {activeMasterRuleInfo && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <Sparkles size={11} className="text-emerald-600" />
                      <span>Auto-applied from Master Rule: {activeMasterRuleInfo}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Calculation Method</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormCalcMethod('Pro-Rata')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          formCalcMethod === 'Pro-Rata' 
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Pro-Rata
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormCalcMethod('Discount')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          formCalcMethod === 'Discount' 
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Discount
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormCalcMethod('Both')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          formCalcMethod === 'Both' 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Both
                      </button>
                    </div>
                  </div>

                  {formCalcMethod !== 'Discount' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Rebate Type</label>
                      <select
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
                        value={formRebateType}
                        onChange={e => setFormRebateType(e.target.value as any)}
                      >
                        <option value="Standard Rebate">Standard Rebate (1.0x Rate)</option>
                        <option value="Single Rebate">Single Rebate (Primary Parameter)</option>
                        <option value="Double Rebate">Double Rebate (2.0x Penalty Rate)</option>
                        <option value="All Types">All Types (Universal Contract)</option>
                      </select>
                    </div>
                  )}

                  {(formCalcMethod === 'Discount' || formCalcMethod === 'Both') && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Commercial Discount Rate {formCalcMethod === 'Both' && '(Hybrid Layer)'}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formDiscountRate}
                          onChange={e => setFormDiscountRate(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white"
                          placeholder="e.g. 2 for 2%"
                        />
                        <select
                          value={formDiscountType}
                          onChange={e => setFormDiscountType(e.target.value as any)}
                          className="p-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
                        >
                          <option value="PERCENT">% Rate</option>
                          <option value="FLAT">Flat ₹</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {(formCalcMethod === 'Pro-Rata' || formCalcMethod === 'Discount') && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Reference Doc No</label>
                      <input
                        type="text"
                        placeholder="PO / GRN / Inward Slip"
                        value={formRefNumber}
                        onChange={e => setFormRefNumber(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Parameter Evaluation Table (Section 4, 6, 7, 8, 14) */}
              {(formCalcMethod === 'Pro-Rata' || formCalcMethod === 'Both') && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Scale size={14} className="text-emerald-600" />
                      <span>3. Quality Testing Parameters & Deviation Evaluation</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Evaluated against Master rules valid for {formDate}
                    </span>
                  </h3>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                        <tr>
                          <th className="p-2.5">Parameter Name</th>
                          <th className="p-2.5 text-center">Standard Value</th>
                          <th className="p-2.5 text-center">Tolerance</th>
                          <th className="p-2.5 w-32">Actual Value *</th>
                          <th className="p-2.5 text-right">Deviation</th>
                          <th className="p-2.5 text-right">Rebate / Unit</th>
                          <th className="p-2.5 text-right">Total Deduction</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {formParameters.map((p, idx) => {
                          const calcItem = calculationResult?.parameterCalculations?.find(
                            (c: any) => c.parameterName.toLowerCase() === p.parameterName.toLowerCase()
                          );
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-bold text-slate-900">
                                {p.parameterName}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-600">
                                {p.standardValue} {p.unit}
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-400">
                                &plusmn;{p.tolerance} {p.unit}
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-full p-1.5 border border-emerald-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/20"
                                    value={p.actualValue}
                                    onChange={e => {
                                      const val = e.target.value !== '' ? Number(e.target.value) : '';
                                      setFormParameters(prev => prev.map((item, i) => i === idx ? { ...item, actualValue: val } : item));
                                    }}
                                    required
                                  />
                                  <span className="text-[10px] text-slate-400">{p.unit}</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-right font-mono text-xs">
                                {calcItem ? (
                                  <span className={`font-bold ${calcItem.deviation > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {calcItem.deviation > 0 ? `+${calcItem.deviation.toFixed(2)}` : calcItem.deviation.toFixed(2)} {p.unit}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono text-xs">
                                {calcItem ? (
                                  <div>
                                    <div className="font-bold text-red-600">
                                      ₹{calcItem.rebatePerUnit.toFixed(2)}/{formUnit}
                                    </div>
                                    {calcItem.formulaDescription && (
                                      <div className="text-[10px] text-slate-500 font-sans font-medium" title={calcItem.formulaDescription}>
                                        {calcItem.formulaDescription.replace(/.*matches Slab/, 'Slab').replace(/.*in Slab/, 'Slab')}
                                      </div>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-red-600">
                                {calcItem ? `₹${calcItem.rebateTotal.toLocaleString('en-IN')}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Dynamic Live Calculation Summary Card (Section 13, 14) */}
              {calculationResult && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-md space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Calculator size={14} />
                      <span>Dynamic Calculation Summary</span>
                    </div>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                      Method: {calculationResult.calculationBreakdown.method}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">Gross Base Value</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        ₹{calculationResult.baseValue.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-slate-400">{formQuantity} {formUnit} &times; ₹{formBaseRate}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-red-400 uppercase font-medium">
                        {formCalcMethod === 'Discount' ? 'Total Commercial Discount' : formCalcMethod === 'Both' ? 'Total Deductions (QC + Disc)' : 'Total Quality Rebate'}
                      </div>
                      <div className="text-sm font-bold text-red-400 mt-0.5">
                        - ₹{calculationResult.totalRebate.toLocaleString('en-IN')}/{formUnit}
                      </div>
                      <div className="text-[9px] text-red-400/80">Total: - ₹{calculationResult.totalDeduction.toLocaleString('en-IN')}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-emerald-400 uppercase font-medium">Final Settled Rate</div>
                      <div className="text-base font-extrabold text-emerald-400 mt-0.5">
                        ₹{calculationResult.finalRate.toLocaleString('en-IN')}/{formUnit}
                      </div>
                      <div className="text-[9px] text-emerald-400/80">
                        Base ₹{formBaseRate} - {formCalcMethod === 'Discount' ? 'Discount' : 'Deduction'} ₹{calculationResult.totalRebate}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-emerald-300 uppercase font-medium">Final Settled Value</div>
                      <div className="text-base font-extrabold text-emerald-300 mt-0.5">
                        ₹{calculationResult.finalValue.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-emerald-300/80">{formQuantity} {formUnit} &times; ₹{calculationResult.finalRate}</div>
                    </div>
                  </div>

                  {/* Formula Transparency details */}
                  {calculationResult.calculationBreakdown?.details && calculationResult.calculationBreakdown.details.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/80 text-[10px] text-slate-300 space-y-1">
                      <div className="font-bold text-slate-400 uppercase text-[9px]">Transparency Breakdown:</div>
                      {calculationResult.calculationBreakdown.details.map((d: string, i: number) => (
                        <div key={i} className="font-mono text-slate-300 pl-2 border-l border-emerald-500">
                          {d}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inspector & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Inspector / QC Officer</label>
                  <input
                    type="text"
                    value={formInspector}
                    onChange={e => setFormInspector(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">QC Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Optional testing notes..."
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formRefNumber && !formPoId}
                  title={!formRefNumber && !formPoId ? 'Please select a Purchase Order to create Quality Assessment' : ''}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                    (!formRefNumber && !formPoId)
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
                  }`}
                >
                  <Check size={14} />
                  <span>{editingQCId ? 'Update QC Record' : 'Save & Calculate QC'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VIEW QC DETAILS MODAL (Full Transparency & Audit Trail Timeline - Section 14, 17) */}
      {/* ========================================================================= */}
      {isViewModalOpen && selectedQC && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] my-auto flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{selectedQC.qcNumber}</h2>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedQC.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                      selectedQC.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                      selectedQC.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedQC.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Inspection & Settlement Breakdown Certificate</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedQC.status !== 'Rejected' && (
                  <button
                    onClick={() => router.push(`/procurement/invoices?qc=${selectedQC._id || selectedQC.id}&action=new`)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs transition"
                    title="Generate Purchase Invoice from this QC"
                  >
                    <FileText size={13} />
                    <span>Create Invoice</span>
                  </button>
                )}
                <button
                  onClick={() => handleDownloadPDF(selectedQC)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition"
                >
                  <Download size={13} />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleOpenPrint(selectedQC)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Supplier / Farmer</div>
                  <div className="font-bold text-slate-900 mt-1">{selectedQC.partyName}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{selectedQC.partyType}</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Commodity & Quantity</div>
                  <div className="font-bold text-slate-900 mt-1">{selectedQC.commodityName}</div>
                  <div className="text-[10px] text-slate-500 font-bold">{selectedQC.quantity} {selectedQC.unit || 'MT'}</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Vehicle & Date</div>
                  <div className="font-mono font-bold text-slate-900 mt-1">{selectedQC.vehicleNumber}</div>
                  <div className="text-[10px] text-slate-500">{formatDate(selectedQC.date)}</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Rebate Model</div>
                  <div className="font-bold text-purple-700 mt-1">{selectedQC.calculationMethod}</div>
                  <div className="text-[10px] text-slate-500">{selectedQC.rebateType}</div>
                </div>
              </div>

              {/* Parameter Transparency Table (Section 14) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Scale size={14} className="text-emerald-600" />
                  <span>Quality Parameter Deductions</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                      <tr>
                        <th className="p-2.5">Parameter</th>
                        <th className="p-2.5 text-center">Standard</th>
                        <th className="p-2.5 text-center">Actual</th>
                        <th className="p-2.5 text-center">Deviation</th>
                        <th className="p-2.5">Rule Applied / Formula</th>
                        <th className="p-2.5 text-right">Rebate Rate</th>
                        <th className="p-2.5 text-right">Total Rebate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedQC.qualityParameters && selectedQC.qualityParameters.length > 0 ? (
                        selectedQC.qualityParameters.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-slate-900">{p.parameterName}</td>
                            <td className="p-2.5 text-center font-mono text-slate-600">{p.standardValue}{p.unit}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-900">{p.actualValue}{p.unit}</td>
                            <td className="p-2.5 text-center font-mono font-semibold text-slate-700">
                              {p.deviation > 0 ? `+${p.deviation.toFixed(2)}` : p.deviation.toFixed(2)}{p.unit}
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-500 font-mono">
                              {p.formulaDescription || p.rebateBasis}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-red-600">
                              ₹{p.rebatePerUnit.toFixed(2)}/{selectedQC.unit || 'MT'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-red-600">
                              ₹{p.rebateTotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-3 text-slate-500 font-mono">
                            Calculated via Global Discount: {selectedQC.discountRate}% (₹{selectedQC.totalRebate}/{selectedQC.unit || 'MT'})
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Settlement Cards */}
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 rounded-xl shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] text-emerald-200 uppercase font-medium">Base Rate</div>
                  <div className="text-sm font-bold text-white mt-0.5">₹{selectedQC.baseRate.toLocaleString('en-IN')}/{selectedQC.unit || 'MT'}</div>
                  <div className="text-[9px] text-emerald-200/80">Base Value: ₹{selectedQC.baseValue.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div className="text-[10px] text-red-200 uppercase font-medium">Total Rebate</div>
                  <div className="text-sm font-bold text-red-300 mt-0.5">- ₹{selectedQC.totalRebate.toLocaleString('en-IN')}/{selectedQC.unit || 'MT'}</div>
                  <div className="text-[9px] text-red-200/80">Total Deduction: - ₹{selectedQC.totalDeduction.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div className="text-[10px] text-emerald-200 uppercase font-medium">Final Settled Rate</div>
                  <div className="text-lg font-black text-white mt-0.5">₹{selectedQC.finalRate.toLocaleString('en-IN')}/{selectedQC.unit || 'MT'}</div>
                  <div className="text-[9px] text-emerald-100 font-semibold">Net Rate to Vendor</div>
                </div>

                <div>
                  <div className="text-[10px] text-emerald-200 uppercase font-medium">Final Settled Value</div>
                  <div className="text-lg font-black text-emerald-300 mt-0.5">₹{selectedQC.finalValue.toLocaleString('en-IN')}</div>
                  <div className="text-[9px] text-emerald-100 font-semibold">Total Payable Amount</div>
                </div>
              </div>

              {/* Audit Trail Timeline (Section 17) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <History size={14} className="text-slate-500" />
                  <span>Audit Trail & Modification History</span>
                </h4>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  {selectedQC.auditTrail && selectedQC.auditTrail.length > 0 ? (
                    selectedQC.auditTrail.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-emerald-500 pl-3 py-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{log.action}</span>
                            <span className="text-[10px] text-slate-400">&bull; by {log.user}</span>
                            <span className="text-[10px] text-slate-400">&bull; {new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          {log.reason && (
                            <div className="text-slate-600 mt-0.5 italic text-[11px]">
                              &quot;{log.reason}&quot;
                            </div>
                          )}
                          {log.changes && log.changes.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {log.changes.map((c, ci) => (
                                <span key={ci} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600">
                                  {c.field}: {c.oldValue} &rarr; {c.newValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic">No audit history entries recorded.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. APPROVED QC EDITING AUTHORIZATION MODAL (Section 16) */}
      {/* ========================================================================= */}
      {isApprovedEditModalOpen && selectedQC && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-auto p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Modify Approved QC Record</h3>
                <p className="text-xs text-slate-500">Authorized Audit Lock Verification</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Important Compliance Requirement:</p>
              <p>QC <strong>{selectedQC.qcNumber}</strong> has already been approved. To modify final rates or quantities, ERP security policy requires an authorized modification reason which will be permanently recorded in the Audit Trail.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Modification Reason *
              </label>
              <textarea
                rows={3}
                placeholder="State the justification (e.g. Weighbridge recalibration correction, laboratory re-test result)..."
                value={modificationReasonInput}
                onChange={e => setModificationReasonInput(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsApprovedEditModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedApprovedEdit}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm"
              >
                Authorize & Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. REJECT QC MODAL (Section 15, 17) */}
      {/* ========================================================================= */}
      {isRejectModalOpen && selectedQC && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-auto p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Quality Inspection</h3>
                <p className="text-xs text-slate-500">Record formal rejection for {selectedQC.qcNumber}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Reason for Rejection *
              </label>
              <textarea
                rows={3}
                placeholder="State reason for rejecting commodity lot (e.g. Moisture exceeds critical limit of 18%, Severe insect infestation)..."
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectQC}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. PRINTABLE QC VOUCHER MODAL */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedQC && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-auto p-8 space-y-6 animate-scale-up border border-slate-300">
            {/* Action Bar (hidden in print) */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="text-xs font-bold text-slate-500">Print Preview</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerPrint}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 shadow-sm"
                >
                  <Printer size={15} />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-6">
              {/* Slip Header */}
              <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">BRIJRANI AGRO FOODS</h1>
                  <p className="text-xs text-slate-600 font-medium">Grain Trading, Milling & Silo Storage Operations</p>
                  <p className="text-[10px] text-slate-400">Patna Industrial Area, Bihar &bull; GSTIN: 10AAACR0912K1Z8</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-700">QC CERTIFICATE</div>
                  <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">{selectedQC.qcNumber}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Date: {formatDate(selectedQC.date)}</div>
                </div>
              </div>

              {/* Transaction Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-200 p-3 rounded-lg bg-slate-50/50">
                <div>
                  <div className="text-slate-500 text-[10px]">Vendor / Supplier:</div>
                  <div className="font-bold text-slate-900">{selectedQC.partyName} ({selectedQC.partyType})</div>
                  <div className="text-slate-500 text-[10px] mt-1">Vehicle Number:</div>
                  <div className="font-mono font-bold text-slate-800">{selectedQC.vehicleNumber}</div>
                </div>

                <div className="text-right">
                  <div className="text-slate-500 text-[10px]">Commodity & Quantity:</div>
                  <div className="font-bold text-slate-900">{selectedQC.commodityName} &bull; {selectedQC.quantity} {selectedQC.unit || 'MT'}</div>
                  <div className="text-slate-500 text-[10px] mt-1">Calculation Method:</div>
                  <div className="font-bold text-purple-700">{selectedQC.calculationMethod} ({selectedQC.rebateType})</div>
                </div>
              </div>

              {/* Parameters Table */}
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b">
                  <tr>
                    <th className="p-2">Quality Parameter</th>
                    <th className="p-2 text-center">Standard</th>
                    <th className="p-2 text-center">Actual Tested</th>
                    <th className="p-2 text-center">Deviation</th>
                    <th className="p-2 text-right">Rebate / Unit</th>
                    <th className="p-2 text-right">Total Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedQC.qualityParameters && selectedQC.qualityParameters.length > 0 ? (
                    selectedQC.qualityParameters.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold text-slate-900">{p.parameterName}</td>
                        <td className="p-2 text-center font-mono">{p.standardValue}{p.unit}</td>
                        <td className="p-2 text-center font-mono font-bold">{p.actualValue}{p.unit}</td>
                        <td className="p-2 text-center font-mono font-semibold">
                          {p.deviation > 0 ? `+${p.deviation.toFixed(2)}` : p.deviation.toFixed(2)}{p.unit}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-red-600">
                          ₹{p.rebatePerUnit.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-red-600">
                          ₹{p.rebateTotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 font-mono">
                        Discount Rate: {selectedQC.discountRate}% &bull; Deduction: ₹{selectedQC.totalDeduction.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Financial Summary */}
              <div className="border border-slate-800 p-4 rounded-lg bg-slate-50 flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-500 text-[10px]">BASE PURCHASE RATE:</div>
                  <div className="text-sm font-bold text-slate-800">₹{selectedQC.baseRate.toLocaleString('en-IN')}/{selectedQC.unit || 'MT'}</div>
                  <div className="text-[10px] text-slate-400">Gross: ₹{selectedQC.baseValue.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div className="text-slate-500 text-[10px]">TOTAL REBATE DEDUCTED:</div>
                  <div className="text-sm font-bold text-red-600">- ₹{selectedQC.totalRebate.toLocaleString('en-IN')}/{selectedQC.unit || 'MT'}</div>
                  <div className="text-[10px] text-red-600">Deduction: - ₹{selectedQC.totalDeduction.toLocaleString('en-IN')}</div>
                </div>

                <div className="text-right">
                  <div className="text-emerald-800 text-[10px] font-bold">FINAL SETTLED RATE & VALUE:</div>
                  <div className="text-base font-black text-emerald-800">₹{selectedQC.finalRate.toLocaleString('en-IN')}/{selectedQC.unit || 'MT'}</div>
                  <div className="text-xs font-black text-emerald-700">Total: ₹{selectedQC.finalValue.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
                <div className="border-t border-slate-400 pt-1">Weighbridge Operator</div>
                <div className="border-t border-slate-400 pt-1">QC Chemist / Analyst</div>
                <div className="border-t border-slate-400 pt-1">Manager Approval</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
