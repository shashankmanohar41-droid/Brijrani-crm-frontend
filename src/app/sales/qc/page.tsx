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
  TrendingDown, Info, Calculator, Truck, Calendar, DollarSign, Sparkles, Building2, Handshake
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../../utils/dateUtils';
import IndianDateInput from '../../../components/shared/IndianDateInput';
import DataTable from '../../../components/shared/DataTable';
import { calculateQualityRebateFrontend } from '../../../utils/qcCalculation';
import { QualityControl, QualityRebateRule, QualityParameter, QCTestedParameter, SalesOrder, SalesInvoice } from '../../../types/erp';

function SalesQcPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qcList, setQcList] = useState<any[]>([]);
  const [rebateRules, setRebateRules] = useState<QualityRebateRule[]>([]);
  const [qualityParams, setQualityParams] = useState<QualityParameter[]>([]);

  // Search & Multi-Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Selected QC for operations
  const [selectedQC, setSelectedQC] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Form State for Sales QC Entry (Mirrors Procurement QC)
  const [editingQCId, setEditingQCId] = useState<string | null>(null);
  const [formQcNumber, setFormQcNumber] = useState('');
  const [formPartyType, setFormPartyType] = useState<'Customer / Buyer'>('Customer / Buyer');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCommodityId, setFormCommodityId] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');
  const [formQuantity, setFormQuantity] = useState<number | ''>(100);
  const [formUnit, setFormUnit] = useState('MT');
  const [formBaseRate, setFormBaseRate] = useState<number | ''>(1000);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRefNumber, setFormRefNumber] = useState('');
  const [formSoId, setFormSoId] = useState('');
  const [formSoNo, setFormSoNo] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formInvoiceNo, setFormInvoiceNo] = useState('');
  const [formOrderType, setFormOrderType] = useState<'GT' | 'WH'>('WH');
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
  const [activeMasterRuleInfo, setActiveMasterRuleInfo] = useState<string | null>(null);

  const customers = db.customers || [];
  const commodities = db.commodities || [];
  const salesOrders = db.salesOrders || [];
  const salesInvoices = db.salesInvoices || [];

  // Handle URL query parameters for conversions
  const soQueryParam = searchParams.get('so');
  const invoiceQueryParam = searchParams.get('invoice');
  const actionQueryParam = searchParams.get('action');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Rules & Parameters
      const [rulesRes, paramRes] = await Promise.all([
        api.get('/quality-rebate-rules').catch(() => ({ data: { data: [] } })),
        api.get('/quality-parameters').catch(() => ({ data: { data: [] } }))
      ]);
      setRebateRules(rulesRes.data?.data || []);
      setQualityParams(paramRes.data?.data || []);

      // Load initial Sales QC records
      loadLocalQc();
    } catch (e) {
      console.error('Failed to load rules and params:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLocalQc = () => {
    const existingList = (db as any).salesQcList || [
      {
        id: 'SQC-2026-0001',
        qcNumber: 'SQC-202609-0001',
        date: new Date().toISOString().split('T')[0],
        customerId: customers[0]?.id || 'CUST-001',
        customerName: customers[0]?.name || 'Patanjali Agro Foods Ltd',
        partyName: customers[0]?.name || 'Patanjali Agro Foods Ltd',
        partyType: 'Customer / Buyer',
        commodityId: commodities[0]?.id || 'CMD-001',
        commodityName: commodities[0]?.name || 'MAIZE (YELLOW)',
        soId: salesOrders[0]?.id || 'SO-001',
        soNumber: salesOrders[0]?.soNo || 'SO/BR/2026-27/001',
        soNo: salesOrders[0]?.soNo || 'SO/BR/2026-27/001',
        referenceNumber: salesOrders[0]?.soNo || 'SO/BR/2026-27/001',
        invoiceNo: salesInvoices[0]?.invoiceNo || 'INV/BR/2026-27/001',
        invoiceId: salesInvoices[0]?.id || 'INV-001',
        orderType: 'WH',
        quantity: 100,
        unit: 'MT',
        vehicleNumber: 'BR-01-GB-4590',
        baseRate: 26500,
        calculationMethod: 'Pro-Rata',
        rebateType: 'Standard Rebate',
        totalRebate: 150,
        finalRate: 26350,
        totalDeduction: 15000,
        baseValue: 2650000,
        finalValue: 2635000,
        status: 'Approved',
        inspector: 'Dr. S. K. Verma (Senior QC Analyst)',
        qualityParameters: [
          { parameterName: 'Moisture', standardValue: 14.0, tolerance: 1.0, actualValue: 15.8, deviation: 1.8, rebatePerUnit: 100, rebateTotal: 10000, formulaDescription: 'Deviation (1.80%) beyond tolerance (1.0%): Net Dev (0.80%) × ₹125 = ₹100/MT' },
          { parameterName: 'Protein', standardValue: 45.0, tolerance: 0.5, actualValue: 45.0, deviation: 0.0, rebatePerUnit: 0, rebateTotal: 0, formulaDescription: 'Actual (45%) meets standard (45%) -> No rebate' },
          { parameterName: 'Foreign Matter', standardValue: 1.0, tolerance: 0.2, actualValue: 1.3, deviation: 0.3, rebatePerUnit: 50, rebateTotal: 5000, formulaDescription: 'Deviation (0.30%) beyond tolerance (0.2%): Net Dev (0.10%) × ₹500 = ₹50/MT' }
        ],
        notes: 'Quality passed laboratory outward standards. Authorized for gate outward dispatch.'
      }
    ];
    setQcList(existingList);
  };

  // Populate dynamic parameter inputs when Commodity, Date, or Rebate Type changes
  useEffect(() => {
    if (!formCommodityId) {
      setFormParameters([]);
      setActiveMasterRuleInfo(null);
      return;
    }

    const txDate = new Date(formDate || new Date());
    const selectedComm = commodities.find(c => (c.id || (c as any)._id) === formCommodityId);
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
      // Standard Quality Testing Parameters (Moisture, Protein, Foreign Matter, Broken, Admixture)
      const defaultParams = [
        { parameterName: 'Moisture', standardValue: 14, tolerance: 1, unit: '%' },
        { parameterName: 'Protein', standardValue: 45, tolerance: 0.5, unit: '%' },
        { parameterName: 'Foreign Matter', standardValue: 1.0, tolerance: 0.2, unit: '%' },
        { parameterName: 'Broken Grains', standardValue: 2.0, tolerance: 0.5, unit: '%' }
      ];
      let fallback = defaultParams;
      if (formRebateType === 'Single Rebate') fallback = defaultParams.slice(0, 1);
      else if (formRebateType === 'Double Rebate') fallback = defaultParams.slice(0, 2);

      setFormParameters(fallback.map(p => {
        const existing = formParameters.find(x => x.parameterName.toLowerCase() === p.parameterName.toLowerCase());
        return {
          parameterName: p.parameterName,
          actualValue: existing && existing.actualValue !== '' ? existing.actualValue : p.standardValue,
          unit: p.unit,
          standardValue: p.standardValue,
          tolerance: p.tolerance
        };
      }));
    }
  }, [formCommodityId, formRebateType, formDate, rebateRules, editingQCId]);

  // Execute live calculation whenever form inputs change
  useEffect(() => {
    if (!formQuantity || !formBaseRate || Number(formQuantity) <= 0 || Number(formBaseRate) < 0) {
      setCalculationResult(null);
      return;
    }

    const selectedComm = commodities.find(c => (c.id || (c as any)._id) === formCommodityId);

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
  }, [formQuantity, formBaseRate, formCalcMethod, formRebateType, formDiscountRate, formDiscountType, formParameters, formCommodityId, formDate, rebateRules, commodities]);

  // Available Sales Orders for linking (exclude SOs that already have completed QC)
  const availableSOs = useMemo(() => {
    return salesOrders.filter(so => {
      if (so.status === 'Cancelled') return false;

      // Allow linked SO if editing the current QC
      if (editingQCId) {
        const currentQc = (qcList || []).find((q: any) => (q._id || q.id) === editingQCId);
        if (currentQc && (currentQc.soId === so.id || currentQc.soNumber === so.soNo || currentQc.soNo === so.soNo)) {
          return true;
        }
      }

      // Exclude SOs that already have a non-rejected Sales QC
      const alreadyHasQC = (qcList || []).some((q: any) => 
        (q.soId === so.id || q.soNumber === so.soNo || q.soNo === so.soNo) && q.status !== 'Rejected'
      );
      return !alreadyHasQC;
    });
  }, [salesOrders, qcList, editingQCId]);

  // Available Sales Invoices for linking
  const availableInvoices = useMemo(() => {
    return (salesInvoices || []).filter(inv => {
      if ((inv as any).status === 'Cancelled') return false;

      // If a SO is already selected in the form, ONLY show invoices belonging to that SO
      if (formSoId || formSoNo || formRefNumber) {
        const matchesSo = 
          (formSoId && (inv.soId === formSoId || (inv as any).soNo === formSoId)) ||
          (formSoNo && (inv.soNo === formSoNo || inv.soId === formSoNo)) ||
          (formRefNumber && (inv.soNo === formRefNumber || inv.soId === formRefNumber));
        if (!matchesSo) return false;
      }

      if (editingQCId) {
        const currentQc = (qcList || []).find((q: any) => (q._id || q.id) === editingQCId);
        if (currentQc && (currentQc.invoiceNumber === inv.invoiceNo || currentQc.invoiceId === inv.id || currentQc.soNo === inv.soNo)) {
          return true;
        }
      }

      const alreadyHasQC = (qcList || []).some((q: any) => 
        q.status !== 'Rejected' && (
          (inv.soNo && (q.soNumber === inv.soNo || q.soNo === inv.soNo || q.soId === inv.soNo)) ||
          (q.invoiceNumber && (q.invoiceNumber === inv.invoiceNo || q.invoiceId === inv.id))
        )
      );
      if (alreadyHasQC) return false;

      // If no SO selected yet, ensure invoice belongs to an available (non-QC'd) SO
      if (!formSoId && !formSoNo && !formRefNumber && (inv.soNo || inv.soId)) {
        const soExists = availableSOs.some(s => s.soNo === inv.soNo || s.id === inv.soId);
        if (!soExists) return false;
      }

      return true;
    });
  }, [salesInvoices, qcList, editingQCId, formSoId, formSoNo, formRefNumber, availableSOs]);

  // Handle SO Selection
  const handleSelectReferenceSo = (soNumberOrId: string) => {
    const so = salesOrders.find(s => s.id === soNumberOrId || s.soNo === soNumberOrId);
    if (!so) return;

    setFormSoId(so.id);
    setFormSoNo(so.soNo);
    setFormRefNumber(so.soNo);
    setFormCustomerId(so.customerId);
    setFormCommodityId(so.commodityId);
    setFormQuantity(so.quantity);
    setFormBaseRate(so.rate);
    setFormOrderType(so.orderType || 'WH');

    // Auto find linked invoice if available
    const inv = salesInvoices.find(i => i.soId === so.id || i.soNo === so.soNo);
    if (inv) {
      setFormInvoiceId(inv.id);
      setFormInvoiceNo(inv.invoiceNo);
    }
  };

  // Handle Invoice Selection
  const handleSelectReferenceInvoice = (invNumberOrId: string) => {
    const inv = salesInvoices.find(i => i.id === invNumberOrId || i.invoiceNo === invNumberOrId);
    if (!inv) return;

    setFormInvoiceId(inv.id);
    setFormInvoiceNo(inv.invoiceNo);
    if (inv.soNo) {
      handleSelectReferenceSo(inv.soNo);
    } else {
      setFormCustomerId(inv.customerId);
      if (inv.items && inv.items.length > 0) {
        setFormCommodityId(inv.items[0].commodityId);
        setFormQuantity(inv.items[0].quantity);
        setFormBaseRate(inv.items[0].rate);
      }
      setFormRefNumber(inv.invoiceNo);
    }
  };

  useEffect(() => {
    if (soQueryParam) {
      handleSelectReferenceSo(soQueryParam);
      setIsFormOpen(true);
    } else if (invoiceQueryParam) {
      handleSelectReferenceInvoice(invoiceQueryParam);
      setIsFormOpen(true);
    } else if (actionQueryParam === 'new') {
      setIsFormOpen(true);
    }
  }, [soQueryParam, invoiceQueryParam, actionQueryParam, salesOrders, salesInvoices]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingQCId(null);
    const slipNumber = `SQC-${new Date().toISOString().slice(0,7).replace('-','')}-${String(qcList.length + 1).padStart(4, '0')}`;
    setFormQcNumber(slipNumber);
    setFormCustomerId(customers[0]?.id || '');
    setFormCommodityId(commodities[0]?.id || '');
    setFormVehicleNumber('BR-01-GB-4590');
    setFormQuantity(100);
    setFormBaseRate(1000);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormRefNumber('');
    setFormSoId('');
    setFormSoNo('');
    setFormInvoiceId('');
    setFormInvoiceNo('');
    setFormCalcMethod('Pro-Rata');
    setFormRebateType('Standard Rebate');
    setFormInspector('QC Analyst');
    setFormNotes('');
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (qc: any) => {
    setEditingQCId(qc.id || qc._id);
    setFormQcNumber(qc.qcNumber);
    setFormCustomerId(qc.customerId || '');
    setFormCommodityId(qc.commodityId || '');
    setFormVehicleNumber(qc.vehicleNumber || '');
    setFormQuantity(qc.quantity || 100);
    setFormBaseRate(qc.baseRate || 1000);
    setFormDate(qc.date || new Date().toISOString().split('T')[0]);
    setFormRefNumber(qc.referenceNumber || qc.soNumber || '');
    setFormSoId(qc.soId || '');
    setFormSoNo(qc.soNumber || '');
    setFormInvoiceId(qc.invoiceId || '');
    setFormInvoiceNo(qc.invoiceNo || '');
    setFormCalcMethod(qc.calculationMethod || 'Pro-Rata');
    setFormRebateType(qc.rebateType || 'Standard Rebate');
    setFormInspector(qc.inspector || 'QC Analyst');
    setFormNotes(qc.notes || '');

    if (qc.qualityParameters && qc.qualityParameters.length > 0) {
      setFormParameters(qc.qualityParameters.map((p: any) => ({
        parameterName: p.parameterName,
        actualValue: p.actualValue,
        unit: p.unit || '%',
        standardValue: p.standardValue,
        tolerance: p.tolerance || 0
      })));
    }
    setIsFormOpen(true);
  };

  // Save / Submit QC Entry
  const handleSaveQC = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCustomerId || !formCommodityId || !formQuantity || !formBaseRate) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const cust = customers.find(c => c.id === formCustomerId);
    const comm = commodities.find(c => c.id === formCommodityId);

    const testedParams: QCTestedParameter[] = formParameters.map(p => {
      const calcItem = calculationResult?.parameterCalculations?.find(
        (c: any) => c.parameterName.toLowerCase() === p.parameterName.toLowerCase()
      );
      const isLowerWorse = p.parameterName?.toLowerCase().includes('protein') || p.parameterName?.toLowerCase().includes('oil');
      const fallbackDev = isLowerWorse 
        ? ((Number(p.standardValue) || 0) - (Number(p.actualValue) || 0))
        : ((Number(p.actualValue) || 0) - (Number(p.standardValue) || 0));
      const dev = calcItem ? calcItem.deviation : fallbackDev;

      return {
        parameterName: p.parameterName,
        actualValue: Number(p.actualValue) || 0,
        unit: p.unit,
        standardValue: p.standardValue,
        tolerance: p.tolerance,
        deviation: dev,
        rebateBasis: calcItem?.rebateBasis || 'Per % Deviation',
        rebateRate: calcItem ? calcItem.rebateRate || 0 : 0,
        rebatePerUnit: calcItem ? calcItem.rebatePerUnit : 0,
        rebateTotal: calcItem ? calcItem.rebateTotal : 0,
        formulaDescription: calcItem ? calcItem.formulaDescription : '',
        status: calcItem?.status || (dev > p.tolerance ? 'WARN' : 'PASS')
      };
    });

    const totalDeduction = calculationResult ? calculationResult.totalDeduction : 0;
    const totalRebate = calculationResult ? calculationResult.totalRebate : 0;
    const baseValue = calculationResult ? calculationResult.baseValue : Number(formQuantity) * Number(formBaseRate);
    const finalRate = calculationResult ? calculationResult.finalRate : Number(formBaseRate);
    const finalValue = calculationResult ? calculationResult.finalValue : baseValue;

    const newRecord = {
      id: editingQCId || `SQC-${Date.now()}`,
      qcNumber: formQcNumber || `SQC-${Date.now()}`,
      date: formDate,
      customerId: formCustomerId,
      customerName: cust?.name || 'Customer / Buyer',
      partyName: cust?.name || 'Customer / Buyer',
      partyType: 'Customer / Buyer',
      commodityId: formCommodityId,
      commodityName: comm?.name || 'Commodity',
      soId: formSoId,
      soNumber: formSoNo,
      soNo: formSoNo,
      referenceNumber: formRefNumber || formSoNo,
      invoiceId: formInvoiceId,
      invoiceNo: formInvoiceNo,
      orderType: formOrderType,
      vehicleNumber: formVehicleNumber,
      quantity: Number(formQuantity),
      unit: formUnit,
      baseRate: Number(formBaseRate),
      calculationMethod: formCalcMethod,
      rebateType: formRebateType,
      discountRate: Number(formDiscountRate) || 0,
      discountType: formDiscountType,
      totalRebate,
      totalDeduction,
      baseValue,
      finalRate,
      finalValue,
      status: 'Approved',
      inspector: formInspector,
      notes: formNotes,
      qualityParameters: testedParams,
      calculationBreakdown: calculationResult?.calculationBreakdown
    };

    let updatedList: any[];
    if (editingQCId) {
      updatedList = qcList.map(item => (item.id === editingQCId || item._id === editingQCId) ? newRecord : item);
      showToast(`Sales QC ${newRecord.qcNumber} updated successfully!`, 'success');
    } else {
      updatedList = [newRecord, ...qcList];
      showToast(`Sales QC ${newRecord.qcNumber} recorded and calculated successfully!`, 'success');
    }

    setQcList(updatedList);
    (db as any).salesQcList = updatedList;
    refreshDb();
    setIsFormOpen(false);
    setSelectedQC(newRecord);
  };

  // Status Action Handlers
  const handleApproveQC = (qc: any) => {
    const updated = qcList.map(item => (item.id === qc.id || item._id === qc._id) ? { ...item, status: 'Approved' } : item);
    setQcList(updated);
    (db as any).salesQcList = updated;
    refreshDb();
    showToast(`Sales QC ${qc.qcNumber} approved! Ready for Gate Outward.`, 'success');
  };

  const handleOpenRejectModal = (qc: any) => {
    setSelectedQC(qc);
    setRejectionReasonInput('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedQC) return;
    const updated = qcList.map(item => (item.id === selectedQC.id || item._id === selectedQC._id) ? { ...item, status: 'Rejected', rejectionReason: rejectionReasonInput } : item);
    setQcList(updated);
    (db as any).salesQcList = updated;
    refreshDb();
    setIsRejectModalOpen(false);
    showToast(`Sales QC ${selectedQC.qcNumber} marked as Rejected.`, 'info');
  };

  const handleDeleteQC = (qc: any) => {
    if (confirm(`Are you sure you want to delete QC ${qc.qcNumber}?`)) {
      const updated = qcList.filter(item => (item.id !== qc.id && item._id !== qc.id));
      setQcList(updated);
      (db as any).salesQcList = updated;
      refreshDb();
      showToast(`Sales QC record ${qc.qcNumber} deleted.`, 'info');
      if (selectedQC?.id === qc.id) setSelectedQC(null);
    }
  };

  const handleViewDetails = (qc: any) => {
    setSelectedQC(qc);
    setIsViewModalOpen(true);
  };

  // PDF Export
  const handleDownloadPDF = (qc: any) => {
    const doc = new jsPDF();

    // Header & Company Branding
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008 | GSTIN: 10AAACB1234F1Z5", 14, 25);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(13, 148, 136); // Teal
    doc.text("OUTWARD LABORATORY QUALITY AUDIT & REBATE CERTIFICATE", 14, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`QC Certificate No:   ${qc.qcNumber}`, 14, 46);
    doc.text(`Inspection Date:    ${formatDate(qc.date)}`, 14, 52);
    doc.text(`Customer / Buyer:   ${qc.customerName || qc.partyName}`, 14, 58);
    doc.text(`Sales Order (SO):   ${qc.soNumber || qc.referenceNumber || 'Direct'}`, 14, 64);
    doc.text(`Commercial Invoice: ${qc.invoiceNo || 'Pending'}`, 14, 70);

    doc.text(`Commodity:          ${qc.commodityName}`, 115, 46);
    doc.text(`Vehicle Number:     ${qc.vehicleNumber || 'N/A'}`, 115, 52);
    doc.text(`Fulfillment Mode:   ${qc.orderType === 'GT' ? 'GT - General Trade' : 'WH - Warehouse'}`, 115, 58);
    doc.text(`Dispatched Volume:  ${qc.quantity} ${qc.unit || 'MT'}`, 115, 64);
    doc.text(`Audit Status:       ${(qc.status || 'APPROVED').toUpperCase()}`, 115, 70);

    // Table Header
    const tableTop = 82;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, tableTop, 182, 8, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("QUALITY PARAMETER", 16, tableTop + 5.5);
    doc.text("STANDARD", 75, tableTop + 5.5);
    doc.text("TESTED VALUE", 105, tableTop + 5.5);
    doc.text("DEVIATION", 140, tableTop + 5.5);
    doc.text("REBATE DEDUCTION", 165, tableTop + 5.5);

    let curY = tableTop + 14;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);

    (qc.qualityParameters || []).forEach((p: any) => {
      doc.setTextColor(30, 41, 59);
      doc.text(p.parameterName, 16, curY);
      doc.text(`${p.standardValue} ${p.unit || '%'} (±${p.tolerance || 0}%)`, 75, curY);
      doc.text(`${p.actualValue} ${p.unit || '%'}`, 105, curY);
      
      const isLowerWorse = p.parameterName?.toLowerCase().includes('protein') || p.parameterName?.toLowerCase().includes('oil');
      const fallbackDev = isLowerWorse 
        ? ((Number(p.standardValue) || 0) - (Number(p.actualValue) || 0))
        : ((Number(p.actualValue) || 0) - (Number(p.standardValue) || 0));
      const dev = typeof p.deviation === 'number' ? p.deviation : fallbackDev;
      doc.setTextColor(dev > (p.tolerance || 0) ? 225 : 13, dev > (p.tolerance || 0) ? 29 : 148, dev > (p.tolerance || 0) ? 72 : 136);
      doc.text(dev > 0 ? `+${dev.toFixed(2)} ${p.unit || '%'}` : `${dev.toFixed(2)} ${p.unit || '%'}`, 140, curY);

      doc.setTextColor(p.rebateTotal > 0 ? 225 : 71, p.rebateTotal > 0 ? 29 : 85, p.rebateTotal > 0 ? 72 : 105);
      doc.text(p.rebateTotal > 0 ? `- ₹${p.rebateTotal.toLocaleString('en-IN')}` : '₹0', 165, curY);

      curY += 7;
    });

    // Valuation Summary Box
    curY += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, curY, 182, 38, 2, 2, 'F');
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("COMMERCIAL SETTLEMENT SUMMARY", 18, curY + 7);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Base Agreed Rate:      Rs. ${(qc.baseRate || 0).toLocaleString('en-IN')} / ${qc.unit || 'MT'}`, 18, curY + 15);
    doc.text(`Gross Base Value:      Rs. ${(qc.baseValue || 0).toLocaleString('en-IN')}`, 18, curY + 22);

    doc.setTextColor(225, 29, 72);
    doc.text(`Total Quality Rebate:  - Rs. ${(qc.totalDeduction || 0).toLocaleString('en-IN')}`, 115, curY + 15);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(13, 148, 136);
    doc.text(`Net Settled Rate:      Rs. ${(qc.finalRate || qc.baseRate || 0).toLocaleString('en-IN')} / ${qc.unit || 'MT'}`, 115, curY + 22);
    doc.text(`Net Outward Value:     Rs. ${(qc.finalValue || qc.baseValue || 0).toLocaleString('en-IN')}`, 115, curY + 29);

    // Signatures
    curY += 52;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Inspector: ${qc.inspector || 'QC Analyst'}`, 18, curY);
    doc.text("Authorized Laboratory Chemist", 18, curY + 5);

    doc.text("Brijrani Agro Foods Ltd", 145, curY);
    doc.text("Authorized Signature & Quality Stamp", 145, curY + 5);

    doc.save(`Sales_QC_${qc.qcNumber}.pdf`);
  };

  // Filtered List
  const filteredQcList = useMemo(() => {
    return qcList.filter(qc => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchQc = (qc.qcNumber || '').toLowerCase().includes(q);
        const matchParty = (qc.customerName || qc.partyName || '').toLowerCase().includes(q);
        const matchVeh = (qc.vehicleNumber || '').toLowerCase().includes(q);
        const matchRef = (qc.referenceNumber || qc.soNumber || qc.invoiceNo || '').toLowerCase().includes(q);
        if (!matchQc && !matchParty && !matchVeh && !matchRef) return false;
      }
      if (filterCustomer && qc.customerId !== filterCustomer) return false;
      if (filterCommodity && qc.commodityId !== filterCommodity) return false;
      if (filterRebateType && qc.rebateType !== filterRebateType) return false;
      if (filterCalcMethod && qc.calculationMethod !== filterCalcMethod) return false;
      if (filterStatus && filterStatus !== 'All' && qc.status !== filterStatus) return false;
      if (filterStartDate && new Date(qc.date) < new Date(filterStartDate)) return false;
      if (filterEndDate && new Date(qc.date) > new Date(filterEndDate)) return false;
      return true;
    });
  }, [qcList, searchQuery, filterCustomer, filterCommodity, filterRebateType, filterCalcMethod, filterStatus, filterStartDate, filterEndDate]);

  // Metric Stats
  const stats = useMemo(() => {
    const total = qcList.length;
    const approved = qcList.filter(q => q.status === 'Approved').length;
    const underReview = qcList.filter(q => q.status === 'Under Review' || q.status === 'Submitted' || q.status === 'Draft').length;
    const rejected = qcList.filter(q => q.status === 'Rejected').length;
    const totalDeductions = qcList.reduce((sum, q) => sum + (q.totalDeduction || 0), 0);
    return { total, approved, underReview, rejected, totalDeductions };
  }, [qcList]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <FlaskConical className="text-emerald-600" size={24} />
            <span>Sales Quality Control (Outward QC)</span>
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Test physical grain specifications, compute dynamic quality rebates, and authorize gate outward delivery challans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-white"
            title="Refresh QC Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-emerald-600/10 transition"
          >
            <Plus size={14} />
            <span>New Quality Inspection</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Audited</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Dispatched lots</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Under Review</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{stats.underReview}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Awaiting manager signoff</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{stats.approved}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Ready for GRN Outward</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Rejected</div>
          <div className="text-2xl font-bold text-red-800 mt-1">{stats.rejected}</div>
          <div className="text-[10px] text-red-600 mt-0.5">Failed specifications</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Rebates</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹{stats.totalDeductions.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Quality deductions applied</div>
        </div>
      </div>

      {/* 3. Search & Multi-Filter Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="lg:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search QC No, Buyer, Vehicle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <select
              value={filterCommodity}
              onChange={e => setFilterCommodity(e.target.value)}
              className="w-full py-2 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Commodities</option>
              {commodities.map(c => (
                <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.name}</option>
              ))}
            </select>
          </div>

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

          <div>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="w-full py-2 px-2 text-xs border border-slate-200 rounded-lg text-slate-700"
              placeholder="From Date"
            />
          </div>

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
                setFilterCustomer('');
                setFilterCommodity('');
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

      {/* 4. Sales QC Master List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-3">QC Number</th>
                <th className="py-3 px-3">Customer / Buyer</th>
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
                  <td colSpan={14} className="py-10 text-center text-slate-400">
                    <FlaskConical size={32} className="mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="font-semibold">No Sales Quality Control records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;New Quality Inspection&quot; to audit an outward shipment</p>
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

                    {/* Customer */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{qc.customerName || qc.partyName}</span>
                        {qc.orderType && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            qc.orderType === 'GT' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {qc.orderType}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{qc.soNumber || qc.referenceNumber || 'Direct'}</div>
                    </td>

                    {/* Commodity */}
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                      {qc.commodityName}
                    </td>

                    {/* Vehicle */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {qc.vehicleNumber || '-'}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {qc.quantity} <span className="text-[10px] font-normal text-slate-400">{qc.unit || 'MT'}</span>
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap text-slate-700 font-medium">
                      ₹{(qc.baseRate || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Rebate Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {qc.rebateType || 'Standard'}
                      </span>
                    </td>

                    {/* Calculation Method */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        qc.calculationMethod === 'Pro-Rata' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {qc.calculationMethod || 'Pro-Rata'}
                      </span>
                    </td>

                    {/* Total Rebate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-red-600">
                      {qc.totalDeduction > 0 ? `- ₹${qc.totalDeduction.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    {/* Final Rate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-slate-900">
                      ₹{(qc.finalRate || qc.baseRate || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Final Value */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-emerald-700">
                      ₹{(qc.finalValue || qc.baseValue || 0).toLocaleString('en-IN')}
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
                        {qc.status || 'Approved'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {formatDate(qc.date)}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 px-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewDetails(qc)}
                          className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(qc)}
                          className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                          title="Edit QC"
                        >
                          <Edit3 size={14} />
                        </button>

                        {qc.status !== 'Approved' && qc.status !== 'Rejected' && (
                          <button
                            onClick={() => handleApproveQC(qc)}
                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Approve QC"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}

                        {/* Link to GRN Outward (Delivery Challan) */}
                        {qc.status !== 'Rejected' && (
                          <button
                            onClick={() => router.push(`/sales/delivery-challans?action=new&so=${qc.soNumber || qc.referenceNumber}&invoice=${qc.invoiceId}&qc=${qc.qcNumber}`)}
                            className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition cursor-pointer"
                            title="Proceed to Gate Outward (GRN Outward)"
                          >
                            <Truck size={14} />
                          </button>
                        )}

                        {qc.status !== 'Rejected' && (
                          <button
                            onClick={() => handleOpenRejectModal(qc)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Reject QC"
                          >
                            <ShieldAlert size={14} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDownloadPDF(qc)}
                          className="p-1 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded transition cursor-pointer"
                          title="Download PDF Certificate"
                        >
                          <Download size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteQC(qc)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
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
      {/* 5. CREATE / EDIT QC MODAL & DYNAMIC FORM (EXACT MATCH TO SCREENSHOT)       */}
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
              {/* Sales Order & Sales Invoice Link Banner */}
              <div className={`p-3.5 rounded-xl border transition ${
                formRefNumber ? 'bg-emerald-50/70 border-emerald-300' : 'bg-amber-50/80 border-amber-300'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <PackageCheck size={18} className={formRefNumber ? 'text-emerald-600' : 'text-amber-600'} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          Link Sales Order (SO) &amp; Sales Invoice (SI) <span className="text-red-500">*</span>
                        </span>
                        {formRefNumber && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check size={10} /> Linked SO: {formRefNumber}
                          </span>
                        )}
                        {formInvoiceNo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            <Check size={10} /> Linked SI: {formInvoiceNo}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Quality Inspection verifies outward goods against Sales Order and registered Sales Invoice
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className={`p-2 border rounded-lg bg-white text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none min-w-[220px] ${
                        formRefNumber ? 'border-emerald-300' : 'border-amber-400 bg-amber-50/30'
                      }`}
                      onChange={(e) => { if (e.target.value) handleSelectReferenceSo(e.target.value); }}
                      value={formSoNo || formRefNumber || ""}
                    >
                      <option value="">-- Link Sales Order ({availableSOs.length}) --</option>
                      {availableSOs.map(s => (
                        <option key={s.id} value={s.soNo}>
                          {s.soNo} ({customers.find(c => c.id === s.customerId)?.name || 'Buyer'} - {s.orderType || 'WH'})
                        </option>
                      ))}
                    </select>

                    <select
                      className="p-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-700 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none min-w-[200px]"
                      onChange={(e) => { if (e.target.value) handleSelectReferenceInvoice(e.target.value); }}
                      value={formInvoiceNo || ""}
                    >
                      <option value="">-- Link Sales Invoice ({availableInvoices.length}) --</option>
                      {availableInvoices.map(inv => (
                        <option key={inv.id} value={inv.invoiceNo}>
                          {inv.invoiceNo} {inv.soNo ? `(SO: ${inv.soNo})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 1. BASIC TRANSACTION DETAILS (Exact Match to Screenshot 1) */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Info size={14} className="text-emerald-600" />
                  <span>1. BASIC TRANSACTION DETAILS</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">QC SLIP NUMBER *</label>
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
                      PARTNER TYPE * {formRefNumber && <span className="text-[9px] text-emerald-600 font-normal">(FROM SO)</span>}
                    </label>
                    <select
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-700"
                      value={formPartyType}
                      disabled
                    >
                      <option value="Customer / Buyer">Customer / Buyer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      CUSTOMER NAME * {formRefNumber && <span className="text-[9px] text-emerald-600 font-normal">(FROM SO)</span>}
                    </label>
                    <select
                      className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-medium ${
                        formRefNumber ? 'bg-slate-50 text-slate-700' : 'bg-white text-slate-800'
                      }`}
                      value={formCustomerId}
                      onChange={e => setFormCustomerId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.gstin || c.address || 'Buyer'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      COMMODITY * {formRefNumber && <span className="text-[9px] text-emerald-600 font-normal">(FROM SO)</span>}
                    </label>
                    <select
                      className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-medium ${
                        formRefNumber ? 'bg-slate-50 text-slate-700' : 'bg-white text-slate-800'
                      }`}
                      value={formCommodityId}
                      onChange={e => setFormCommodityId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Commodity --</option>
                      {commodities.map(c => (
                        <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                          {c.name} ({c.unit || 'MT'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">VEHICLE NUMBER *</label>
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
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">QUANTITY ({formUnit}) *</label>
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
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">BASE PURCHASE RATE (₹/{formUnit}) *</label>
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
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">TRANSACTION DATE *</label>
                    <IndianDateInput
                      value={formDate}
                      onChange={val => setFormDate(val)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 2. CALCULATION METHOD & REBATE MODEL (Exact Match to Screenshot 1) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Calculator size={14} className="text-emerald-600" />
                    <span>2. CALCULATION METHOD &amp; REBATE MODEL</span>
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
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">CALCULATION METHOD</label>
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
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">REBATE TYPE</label>
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

                  {(formCalcMethod === 'Pro-Rata' || formCalcMethod === 'Discount') && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">REFERENCE DOC NO</label>
                      <input
                        type="text"
                        placeholder="SO / SI / Challan Slip"
                        value={formRefNumber}
                        onChange={e => setFormRefNumber(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                      />
                    </div>
                  )}

                  {(formCalcMethod === 'Discount' || formCalcMethod === 'Both') && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        COMMERCIAL DISCOUNT RATE
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
                </div>
              </div>

              {/* 3. QUALITY TESTING PARAMETERS & DEVIATION EVALUATION (Exact Match to Screenshot 1 & 2) */}
              {(formCalcMethod === 'Pro-Rata' || formCalcMethod === 'Both') && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Scale size={14} className="text-emerald-600" />
                      <span>3. QUALITY TESTING PARAMETERS &amp; DEVIATION EVALUATION</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">
                      EVALUATED AGAINST MASTER RULES VALID FOR {formDate}
                    </span>
                  </h3>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                        <tr>
                          <th className="p-2.5">PARAMETER NAME</th>
                          <th className="p-2.5 text-center">STANDARD VALUE</th>
                          <th className="p-2.5 text-center">TOLERANCE</th>
                          <th className="p-2.5 w-32">ACTUAL VALUE *</th>
                          <th className="p-2.5 text-right">DEVIATION</th>
                          <th className="p-2.5 text-right">REBATE / UNIT</th>
                          <th className="p-2.5 text-right">TOTAL DEDUCTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {formParameters.map((p, idx) => {
                          const calcItem = calculationResult?.parameterCalculations?.find(
                            (c: any) => c.parameterName.toLowerCase() === p.parameterName.toLowerCase()
                          );
                          const isLowerWorse = p.parameterName?.toLowerCase().includes('protein') || p.parameterName?.toLowerCase().includes('oil');
                          const fallbackDev = isLowerWorse 
                            ? ((Number(p.standardValue) || 0) - (Number(p.actualValue) || 0))
                            : ((Number(p.actualValue) || 0) - (Number(p.standardValue) || 0));
                          const deviationVal = calcItem ? calcItem.deviation : fallbackDev;
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
                                <span className={`font-bold ${deviationVal > p.tolerance ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {deviationVal > 0 ? `+${deviationVal.toFixed(2)}` : deviationVal.toFixed(2)} {p.unit}
                                </span>
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
                                ) : (
                                  <span className="text-slate-400">₹0.00/{formUnit}</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-red-600">
                                {calcItem ? (calcItem.rebateTotal > 0 ? `₹${calcItem.rebateTotal.toLocaleString('en-IN')}` : '₹0') : '₹0'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. DYNAMIC CALCULATION SUMMARY (Exact Match to Screenshot 2) */}
              {calculationResult && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-md space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Calculator size={14} />
                      <span>DYNAMIC CALCULATION SUMMARY</span>
                    </div>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                      Method: {calculationResult.calculationBreakdown?.method || formCalcMethod}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">GROSS BASE VALUE</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        ₹{calculationResult.baseValue.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-slate-400">{formQuantity} {formUnit} &times; ₹{formBaseRate}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-red-400 uppercase font-medium">
                        {formCalcMethod === 'Discount' ? 'TOTAL COMMERCIAL DISCOUNT' : formCalcMethod === 'Both' ? 'TOTAL DEDUCTIONS (QC + DISC)' : 'TOTAL QUALITY REBATE'}
                      </div>
                      <div className="text-sm font-bold text-red-400 mt-0.5">
                        - ₹{calculationResult.totalRebate.toLocaleString('en-IN')}/{formUnit}
                      </div>
                      <div className="text-[9px] text-red-400/80">Total: - ₹{calculationResult.totalDeduction.toLocaleString('en-IN')}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-emerald-400 uppercase font-medium">FINAL SETTLED RATE</div>
                      <div className="text-base font-extrabold text-emerald-400 mt-0.5">
                        ₹{calculationResult.finalRate.toLocaleString('en-IN')}/{formUnit}
                      </div>
                      <div className="text-[9px] text-emerald-400/80">
                        Base ₹{formBaseRate} - {formCalcMethod === 'Discount' ? 'Discount' : 'Deduction'} ₹{calculationResult.totalRebate}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-emerald-300 uppercase font-medium">FINAL SETTLED VALUE</div>
                      <div className="text-base font-extrabold text-emerald-300 mt-0.5">
                        ₹{calculationResult.finalValue.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-emerald-300/80">{formQuantity} {formUnit} &times; ₹{calculationResult.finalRate}</div>
                    </div>
                  </div>

                  {/* Transparency Breakdown details */}
                  {calculationResult.calculationBreakdown?.details && calculationResult.calculationBreakdown.details.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/80 text-[10px] text-slate-300 space-y-1">
                      <div className="font-bold text-slate-400 uppercase text-[9px]">TRANSPARENCY BREAKDOWN:</div>
                      {calculationResult.calculationBreakdown.details.map((d: string, i: number) => (
                        <div key={i} className="font-mono text-slate-300 pl-2 border-l border-emerald-500">
                          {d}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Inspector, Remarks & Bottom Action Buttons (Exact Match to Screenshot 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">INSPECTOR / QC OFFICER</label>
                  <input
                    type="text"
                    value={formInspector}
                    onChange={e => setFormInspector(e.target.value)}
                    placeholder="QC Analyst"
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">QC REMARKS / NOTES</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Optional testing notes..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer"
                >
                  <Check size={15} />
                  <span>Save &amp; Calculate QC</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal Drawer */}
      {isViewModalOpen && selectedQC && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <FlaskConical size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedQC.qcNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {selectedQC.status?.toUpperCase() || 'APPROVED'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Inspection Date: {formatDate(selectedQC.date)}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Summary details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Customer / Buyer</div>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedQC.customerName || selectedQC.partyName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Commodity</div>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedQC.commodityName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Vehicle Number</div>
                  <div className="font-mono font-bold text-slate-800 mt-0.5">{selectedQC.vehicleNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Dispatched Qty</div>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedQC.quantity} {selectedQC.unit || 'MT'}</div>
                </div>
              </div>

              {/* Parameter Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                    <tr>
                      <th className="p-2.5">Parameter</th>
                      <th className="p-2.5 text-center">Standard</th>
                      <th className="p-2.5 text-center">Tested</th>
                      <th className="p-2.5 text-right">Deviation</th>
                      <th className="p-2.5 text-right">Deduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(selectedQC.qualityParameters || []).map((p: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-slate-900">{p.parameterName}</td>
                        <td className="p-2.5 text-center text-slate-600 font-mono">{p.standardValue} {p.unit || '%'}</td>
                        <td className="p-2.5 text-center font-bold font-mono text-slate-800">{p.actualValue} {p.unit || '%'}</td>
                        <td className="p-2.5 text-right font-mono">
                          <span className={p.deviation > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {p.deviation > 0 ? `+${p.deviation}` : (p.deviation || 0)} {p.unit || '%'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-red-600">
                          {p.rebateTotal > 0 ? `- ₹${p.rebateTotal.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Valuation breakdown */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Gross Base Value</div>
                  <div className="text-base font-bold text-white">₹{(selectedQC.baseValue || 0).toLocaleString('en-IN')}</div>
                  {selectedQC.totalDeduction > 0 && (
                    <div className="text-[10px] text-red-400 font-bold mt-0.5">Total Rebate: - ₹{selectedQC.totalDeduction.toLocaleString('en-IN')}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-400 uppercase font-medium">Final Settled Value</div>
                  <div className="text-xl font-extrabold text-emerald-400">₹{(selectedQC.finalValue || selectedQC.baseValue || 0).toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-emerald-300">Rate: ₹{(selectedQC.finalRate || selectedQC.baseRate || 0).toLocaleString('en-IN')} / {selectedQC.unit || 'MT'}</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <button
                onClick={() => handleDownloadPDF(selectedQC)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download size={14} className="text-red-500" />
                <span>Download Laboratory PDF</span>
              </button>

              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  router.push(`/sales/delivery-challans?action=new&so=${selectedQC.soNumber || selectedQC.referenceNumber}&invoice=${selectedQC.invoiceId}&qc=${selectedQC.qcNumber}`);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Truck size={14} />
                <span>Proceed to Gate Outward (GRN Outward)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedQC && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold text-base">
              <ShieldAlert size={20} />
              <span>Reject Sales Outward QC Audit</span>
            </div>
            <p className="text-xs text-slate-500">
              Provide justification for failing laboratory specifications for QC <strong>{selectedQC.qcNumber}</strong>:
            </p>
            <textarea
              value={rejectionReasonInput}
              onChange={e => setRejectionReasonInput(e.target.value)}
              placeholder="e.g. Moisture exceeded maximum permissible limit (>16%), high infestation..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 h-24 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesQcPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading Sales QC Module...</div>}>
      <SalesQcPageContent />
    </React.Suspense>
  );
}
