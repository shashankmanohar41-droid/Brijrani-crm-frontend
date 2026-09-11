'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useErp } from '../../context/ErpContext';
import { erpService } from '../../services/erpService';
import api from '../../services/axios';
import DataTable from '../../components/shared/DataTable';
import IndianDateInput from '../../components/shared/IndianDateInput';
import { 
  Plus, Database, UserCheck, ShieldAlert, CheckCircle, Trash2, Edit3, Eye, X, 
  Building2, Phone, Mail, MapPin, CreditCard, Landmark, FlaskConical, Settings, 
  Copy, Check, AlertCircle, Sparkles, Scale, Layers, Filter, Percent, Calculator
} from 'lucide-react';
import { QualityRebateRule, QualityParameter, RebateSlab } from '../../types/erp';

const formatDateStr = (d?: string | Date) => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
};

function MastersHubPageContent() {
  const searchParams = useSearchParams();
  const { db, refreshDb, showToast } = useErp();

  const tabQuery = searchParams.get('tab') as 'customers' | 'suppliers' | 'farmers' | 'commodities' | 'qualityRebateRules' | 'qualitySpecs' | 'warehouses' | 'bins' | 'vehicles' | 'drivers';
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'farmers' | 'commodities' | 'qualityRebateRules' | 'qualitySpecs' | 'warehouses' | 'bins' | 'vehicles' | 'drivers'>(tabQuery || 'customers');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Quality/Rebate Master Sub-tab ('rules' | 'parameters')
  const [qcMasterSubTab, setQcMasterSubTab] = useState<'rules' | 'parameters'>('rules');
  const [rebateRulesList, setRebateRulesList] = useState<QualityRebateRule[]>([]);
  const [qualityParamsList, setQualityParamsList] = useState<QualityParameter[]>([]);
  
  // Modals for Quality Masters
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [editingParamId, setEditingParamId] = useState<string | null>(null);

  // Rule Form State (Section 9, 10, 19, 20)
  const [ruleFormCode, setRuleFormCode] = useState('');
  const [ruleFormCommodityId, setRuleFormCommodityId] = useState('');
  const [ruleFormParamName, setRuleFormParamName] = useState('Moisture');
  const [ruleFormUnit, setRuleFormUnit] = useState('%');
  const [ruleFormStandardValue, setRuleFormStandardValue] = useState<number | ''>(14);
  const [ruleFormMinValue, setRuleFormMinValue] = useState<number | ''>('');
  const [ruleFormMaxValue, setRuleFormMaxValue] = useState<number | ''>('');
  const [ruleFormTolerance, setRuleFormTolerance] = useState<number | ''>(1);
  const [ruleFormRebateType, setRuleFormRebateType] = useState<'Standard Rebate' | 'Single Rebate' | 'Double Rebate' | 'All' | 'All Types'>('Standard Rebate');
  const [ruleFormCalcMethod, setRuleFormCalcMethod] = useState<'Discount' | 'Pro-Rata' | 'Both'>('Pro-Rata');
  const [ruleFormRebateBasis, setRuleFormRebateBasis] = useState<'Per % Deviation' | 'Flat Rate per MT' | 'Percentage of Base Rate' | 'Tiered Slabs'>('Tiered Slabs');
  const [ruleFormRebateRate, setRuleFormRebateRate] = useState<number | ''>(300);
  const [ruleFormDirection, setRuleFormDirection] = useState<'HIGHER_IS_WORSE' | 'LOWER_IS_WORSE'>('HIGHER_IS_WORSE');
  const [ruleFormEffectiveFrom, setRuleFormEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [ruleFormEffectiveTo, setRuleFormEffectiveTo] = useState('');
  const [ruleFormStatus, setRuleFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [ruleFormNotes, setRuleFormNotes] = useState('');
  const [ruleFormSlabs, setRuleFormSlabs] = useState<RebateSlab[]>([
    { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
    { minDeviation: 1.01, maxDeviation: 2, rebateRate: 200, rateType: 'Per Unit Deviation', description: '1-2% Dev -> ₹200/MT' },
    { minDeviation: 2.01, maxDeviation: 4, rebateRate: 300, rateType: 'Per Unit Deviation', description: '2-4% Dev -> ₹300/MT' }
  ]);

  // Parameter Form State (Section 12)
  const [paramFormName, setParamFormName] = useState('');
  const [paramFormCode, setParamFormCode] = useState('');
  const [paramFormUnit, setParamFormUnit] = useState('%');
  const [paramFormStandard, setParamFormStandard] = useState<number | ''>('');
  const [paramFormMin, setParamFormMin] = useState<number | ''>('');
  const [paramFormMax, setParamFormMax] = useState<number | ''>('');
  const [paramFormDesc, setParamFormDesc] = useState('');
  const [paramFormStatus, setParamFormStatus] = useState<'Active' | 'Inactive'>('Active');

  // Filter states for Rules
  const [ruleFilterCommodity, setRuleFilterCommodity] = useState('');
  const [ruleFilterParam, setRuleFilterParam] = useState('');
  const [ruleFilterStatus, setRuleFilterStatus] = useState('');

  // Sync activeTab state with URL tab changes
  useEffect(() => {
    if (tabQuery) {
      setActiveTab(tabQuery as any);
    }
  }, [tabQuery]);

  // Load Quality Master data on mount
  const loadQualityMasterData = async () => {
    try {
      const [rulesRes, paramsRes] = await Promise.all([
        api.get('/quality-rebate-rules').catch(() => null),
        api.get('/quality-parameters').catch(() => null)
      ]);
      if (rulesRes?.data?.data) setRebateRulesList(rulesRes.data.data);
      if (paramsRes?.data?.data) setQualityParamsList(paramsRes.data.data);
    } catch (e) {
      console.error('Error loading quality masters:', e);
    }
  };

  useEffect(() => {
    loadQualityMasterData();
  }, []);
  // Quality Rebate Rule Handlers
  const handleOpenAddRule = () => {
    setEditingRuleId(null);
    setRuleFormCode('');
    setRuleFormCommodityId(db.commodities[0]?.id || db.commodities[0]?._id || '');
    setRuleFormParamName('Moisture');
    setRuleFormUnit('%');
    setRuleFormStandardValue(14);
    setRuleFormMinValue('');
    setRuleFormMaxValue('');
    setRuleFormTolerance(1);
    setRuleFormRebateType('Standard Rebate');
    setRuleFormCalcMethod('Pro-Rata');
    setRuleFormRebateBasis('Tiered Slabs');
    setRuleFormRebateRate(300);
    setRuleFormDirection('HIGHER_IS_WORSE');
    setRuleFormEffectiveFrom(new Date().toISOString().split('T')[0]);
    setRuleFormEffectiveTo('');
    setRuleFormStatus('Active');
    setRuleFormNotes('');
    setRuleFormSlabs([
      { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0–1% Tol -> No Rebate' },
      { minDeviation: 1.01, maxDeviation: 2, rebateRate: 200, rateType: 'Per Unit Deviation', description: '1–2% Dev -> ₹200/MT' },
      { minDeviation: 2.01, maxDeviation: 4, rebateRate: 300, rateType: 'Per Unit Deviation', description: '2–4% Dev -> ₹300/MT' }
    ]);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: QualityRebateRule) => {
    setEditingRuleId(rule._id || rule.id || null);
    setRuleFormCode(rule.ruleCode);
    setRuleFormCommodityId(rule.commodityId);
    setRuleFormParamName(rule.parameterName);
    setRuleFormUnit(rule.unit || '%');
    setRuleFormStandardValue(rule.standardValue);
    setRuleFormMinValue(rule.minValue ?? '');
    setRuleFormMaxValue(rule.maxValue ?? '');
    setRuleFormTolerance(rule.tolerance);
    setRuleFormRebateType(rule.rebateType);
    setRuleFormCalcMethod(rule.calculationMethod);
    setRuleFormRebateBasis(rule.rebateBasis);
    setRuleFormRebateRate(rule.rebateRate);
    setRuleFormDirection(rule.direction || 'HIGHER_IS_WORSE');
    setRuleFormEffectiveFrom(rule.effectiveFrom ? new Date(rule.effectiveFrom).toISOString().split('T')[0] : '');
    setRuleFormEffectiveTo(rule.effectiveTo ? new Date(rule.effectiveTo).toISOString().split('T')[0] : '');
    setRuleFormStatus(rule.status);
    setRuleFormNotes(rule.notes || '');
    setRuleFormSlabs(rule.slabs || []);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleFormCommodityId || !ruleFormParamName || ruleFormStandardValue === '') {
      showToast('Please fill all mandatory rule fields', 'error');
      return;
    }

    const comm = db.commodities.find(c => (c.id || c._id) === ruleFormCommodityId);

    const payload = {
      ruleCode: ruleFormCode || undefined,
      commodityId: ruleFormCommodityId,
      commodityName: comm ? comm.name : 'Commodity',
      parameterName: ruleFormParamName,
      unit: ruleFormUnit,
      standardValue: Number(ruleFormStandardValue),
      minValue: ruleFormMinValue !== '' ? Number(ruleFormMinValue) : undefined,
      maxValue: ruleFormMaxValue !== '' ? Number(ruleFormMaxValue) : undefined,
      tolerance: Number(ruleFormTolerance || 0),
      rebateType: ruleFormRebateType,
      calculationMethod: ruleFormCalcMethod,
      rebateBasis: ruleFormRebateBasis,
      rebateRate: Number(ruleFormRebateRate || 0),
      slabs: ruleFormSlabs,
      direction: ruleFormDirection,
      effectiveFrom: ruleFormEffectiveFrom,
      effectiveTo: ruleFormEffectiveTo || undefined,
      status: ruleFormStatus,
      notes: ruleFormNotes
    };

    try {
      if (editingRuleId) {
        await api.put(`/quality-rebate-rules/${editingRuleId}`, payload);
        showToast('Quality Rebate rule updated successfully', 'success');
      } else {
        await api.post('/quality-rebate-rules', payload);
        showToast('Quality Rebate rule created successfully', 'success');
      }
      setIsRuleModalOpen(false);
      loadQualityMasterData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error saving rebate rule', 'error');
    }
  };

  const handleDuplicateRule = async (rule: QualityRebateRule) => {
    try {
      await api.post(`/quality-rebate-rules/${rule._id || rule.id}/duplicate`);
      showToast(`Rule duplicated successfully`, 'success');
      loadQualityMasterData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate rule', 'error');
    }
  };

  const handleToggleRuleStatus = async (rule: QualityRebateRule) => {
    try {
      await api.patch(`/quality-rebate-rules/${rule._id || rule.id}/toggle-status`);
      showToast(`Rule status updated`, 'info');
      loadQualityMasterData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to toggle status', 'error');
    }
  };

  const handleDeleteRule = async (rule: QualityRebateRule) => {
    if (!confirm(`Delete Rebate Rule '${rule.ruleCode}'?`)) return;
    try {
      await api.delete(`/quality-rebate-rules/${rule._id || rule.id}`);
      showToast('Rebate rule deleted', 'info');
      loadQualityMasterData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete rule', 'error');
    }
  };

  // Quality Parameter Handlers
  const handleOpenAddParam = () => {
    setEditingParamId(null);
    setParamFormName('');
    setParamFormCode('');
    setParamFormUnit('%');
    setParamFormStandard('');
    setParamFormMin('');
    setParamFormMax('');
    setParamFormDesc('');
    setParamFormStatus('Active');
    setIsParamModalOpen(true);
  };

  const handleOpenEditParam = (param: QualityParameter) => {
    setEditingParamId(param._id || param.id || null);
    setParamFormName(param.name);
    setParamFormCode(param.code);
    setParamFormUnit(param.unit || '%');
    setParamFormStandard(param.standardValue ?? '');
    setParamFormMin(param.minLimit ?? '');
    setParamFormMax(param.maxLimit ?? '');
    setParamFormDesc(param.description || '');
    setParamFormStatus(param.status);
    setIsParamModalOpen(true);
  };

  const handleSaveParam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramFormName || !paramFormCode) {
      showToast('Parameter name and code are required', 'error');
      return;
    }

    const payload = {
      name: paramFormName,
      code: paramFormCode,
      unit: paramFormUnit,
      standardValue: paramFormStandard !== '' ? Number(paramFormStandard) : undefined,
      minLimit: paramFormMin !== '' ? Number(paramFormMin) : undefined,
      maxLimit: paramFormMax !== '' ? Number(paramFormMax) : undefined,
      description: paramFormDesc,
      status: paramFormStatus
    };

    try {
      if (editingParamId) {
        await api.put(`/quality-parameters/${editingParamId}`, payload);
        showToast(`Parameter '${paramFormName}' updated successfully`, 'success');
      } else {
        await api.post('/quality-parameters', payload);
        showToast(`Parameter '${paramFormName}' created successfully`, 'success');
      }
      setIsParamModalOpen(false);
      loadQualityMasterData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error saving parameter', 'error');
    }
  };

  const handleDeleteParam = async (param: QualityParameter) => {
    if (!confirm(`Delete Quality Parameter '${param.name}'?`)) return;
    try {
      await api.delete(`/quality-parameters/${param._id || param.id}`);
      showToast(`Parameter '${param.name}' deleted`, 'info');
      loadQualityMasterData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete parameter', 'error');
    }
  };

  // Bin States
  const [binCode, setBinCode] = useState('');
  const [binWarehouseId, setBinWarehouseId] = useState('');
  const [binAllowedCommodityId, setBinAllowedCommodityId] = useState('');

  const handleDelete = (tab: typeof activeTab, id: string, displayName: string) => {
    if (confirm(`Are you sure you want to delete "${displayName}"?`)) {
      (erpService as any)[tab]?.delete(id);
      showToast(`Entry "${displayName}" deleted`, 'success');
      refreshDb();
    }
  };

  const handleView = (row: any) => {
    setViewingRecord(row);
  };

  // New Entity Form States
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [pan, setPan] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Bihar');
  const [gstin, setGstin] = useState('');

  // Commodity States
  const [category, setCategory] = useState<'Grains' | 'Oilseeds' | 'Pulses' | 'Other'>('Grains');
  const [unit, setUnit] = useState<'MT' | 'Qtl' | 'Kg'>('MT');
  const [hsn, setHsn] = useState('');
  const [defaultGst, setDefaultGst] = useState(5);
  const [cost, setCost] = useState(0);
  const [market, setMarket] = useState(0);
  const [target, setTarget] = useState(0);
  const [minStock, setMinStock] = useState(20);

  // Warehouse States
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(500);

  // Vehicle States
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('Tata 1613 Truck');
  const [driverId, setDriverId] = useState('');

  // Driver States
  const [license, setLicense] = useState('');

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingId(null);
    setName('');
    setCompanyName('');
    setPan('');
    setAadhar('');
    setBankName('');
    setAccountNumber('');
    setIfscCode('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setVehicleNo('');
    setLicense('');
    setState('Bihar');
    setCategory('Grains');
    setUnit('MT');
    setHsn('');
    setDefaultGst(5);
    setCost(0);
    setMarket(0);
    setTarget(0);
    setMinStock(20);
    setLocation('');
    setCapacity(500);
    setVehicleType('Tata 1613 Truck');
    setDriverId('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (tab: typeof activeTab, row: any) => {
    setIsEditMode(true);
    setEditingId(row.id);
    
    setName(row.name || row.number || ''); // vehicles use row.number
    setPhone(row.phone || '');
    setEmail(row.email || '');
    setAddress(row.address || row.location || ''); // warehouses use row.location
    setState(row.state || 'Bihar');
    setGstin(row.gstin || '');
    
    setCompanyName(row.companyName || '');
    setPan(row.pan || '');
    setAadhar(row.aadhar || '');
    setBankName(row.bankName || '');
    setAccountNumber(row.accountNumber || row.bankAccountNo || '');
    setIfscCode(row.ifscCode || row.bankIfsc || '');

    setCategory(row.category || 'Grains');
    setUnit(row.unit || 'MT');
    setHsn(row.hsn || '');
    setDefaultGst(row.defaultGst || 5);
    setCost(row.purchaseCost || 0);
    setMarket(row.currentMarketPrice || 0);
    setTarget(row.targetPrice || 0);
    setMinStock(row.minStockLevel || 20);

    setLocation(row.location || '');
    setCapacity(row.capacityMT || 500);

    setVehicleNo(row.number || '');
    setVehicleType(row.type || 'Tata 1613 Truck');
    setDriverId(row.driverId || '');

    setLicense(row.licenseNumber || '');

    setIsAddOpen(true);
  };

  const handleAddMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const dateStr = new Date().toISOString().split('T')[0];

    if (isEditMode && editingId) {
      if (activeTab === 'customers') {
        const existing = db.customers.find(c => c.id === editingId);
        if (!existing) return;
        if (!name || !gstin) return;
        erpService.customers.update({
          ...existing,
          name, phone, email, address, state, gstin,
          companyName, pan, bankName, accountNumber, ifscCode
        });
        showToast(`Customer ${name} updated`, 'success');
      }
      else if (activeTab === 'suppliers') {
        const existing = db.suppliers.find(s => s.id === editingId);
        if (!existing) return;
        if (!name || !gstin) return;
        erpService.suppliers.update({
          ...existing,
          name, phone, email, address, state, gstin,
          companyName, pan, bankName, accountNumber, ifscCode
        });
        showToast(`Supplier ${name} updated`, 'success');
      }
      else if (activeTab === 'farmers') {
        const existing = db.farmers.find(f => f.id === editingId);
        if (!existing) return;
        if (!name) return;
        erpService.farmers.update({
          ...existing,
          name, phone, email, address, state, gstin: gstin || undefined,
          pan, aadhar, bankName, bankAccountNo: accountNumber, bankIfsc: ifscCode
        });
        showToast(`Farmer ${name} updated`, 'success');
      }
      else if (activeTab === 'commodities') {
        const existing = db.commodities.find(c => c.id === editingId);
        if (!existing) return;
        if (!name) return;
        erpService.commodities.update({
          ...existing,
          name, category, unit, hsn, defaultGst,
          purchaseCost: Number(cost),
          currentMarketPrice: Number(market),
          targetPrice: Number(target),
          minStockLevel: Number(minStock)
        });
        showToast(`Commodity ${name} updated`, 'success');
      }
      else if (activeTab === 'warehouses') {
        const existing = db.warehouses.find(w => w.id === editingId);
        if (!existing) return;
        if (!name || !location) return;
        erpService.warehouses.update({
          ...existing,
          name, location, capacityMT: Number(capacity)
        });
        showToast(`Warehouse facility ${name} updated`, 'success');
      }
      else if (activeTab === 'vehicles') {
        const existing = db.vehicles.find(v => v.id === editingId);
        if (!existing) return;
        if (!vehicleNo) return;
        erpService.vehicles.update({
          ...existing,
          number: vehicleNo, type: vehicleType, capacityMT: Number(capacity),
          driverId: driverId || undefined
        });
        showToast(`Vehicle ${vehicleNo} updated`, 'success');
      }
      else if (activeTab === 'drivers') {
        const existing = db.drivers.find(d => d.id === editingId);
        if (!existing) return;
        if (!name || !license) return;
        erpService.drivers.update({
          ...existing,
          name, phone, licenseNumber: license
        });
        showToast(`Driver ${name} updated`, 'success');
      }
    } else {
      if (activeTab === 'customers') {
      if (!name || !gstin) return;
      erpService.customers.create({
        id: `CUS-${Date.now()}`,
        name, phone, email, address, state, gstin,
        companyName, pan, bankName, accountNumber, ifscCode,
        balance: 0, status: 'Active'
      });
      showToast(`Customer ${name} registered`, 'success');
    } 
    else if (activeTab === 'suppliers') {
      if (!name || !gstin) return;
      erpService.suppliers.create({
        id: `SUP-${Date.now()}`,
        name, phone, email, address, state, gstin,
        companyName, pan, bankName, accountNumber, ifscCode,
        balance: 0, status: 'Active'
      });
      showToast(`Supplier ${name} registered`, 'success');
    } 
    else if (activeTab === 'farmers') {
      if (!name) return;
      erpService.farmers.create({
        id: `FRM-${Date.now()}`,
        name, phone, email, address, state, gstin: gstin || undefined,
        pan, aadhar, bankName, bankAccountNo: accountNumber, bankIfsc: ifscCode,
        balance: 0, status: 'Active'
      });
      showToast(`Farmer ${name} registered`, 'success');
    }
    else if (activeTab === 'commodities') {
      if (!name) return;
      const generatedSku = `CMD-${Math.floor(100000 + Math.random() * 900000)}`;
      erpService.commodities.create({
        id: `CMD-${Date.now()}`,
        name,
        sku: generatedSku,
        category, unit, hsn, defaultGst,
        purchaseCost: Number(cost),
        currentMarketPrice: Number(market),
        targetPrice: Number(target),
        stockQty: 0, reservedQty: 0,
        minStockLevel: Number(minStock)
      });
      showToast(`Commodity ${name} added`, 'success');
    }
    else if (activeTab === 'warehouses') {
      if (!name || !location) return;
      erpService.warehouses.create({
        id: `WH-${Date.now()}`,
        name, location, capacityMT: Number(capacity),
        usedCapacityMT: 0, status: 'Active'
      });
      showToast(`Warehouse facility ${name} added`, 'success');
    }
    else if (activeTab === 'bins') {
      if (!name || !binCode || !binWarehouseId || !binAllowedCommodityId) {
        showToast('Please fill all mandatory fields', 'error');
        return;
      }
      erpService.bins.create({
        id: `BIN-${Date.now()}`,
        name,
        binCode,
        warehouseId: binWarehouseId,
        allowedCommodityId: binAllowedCommodityId,
        capacityMT: Number(capacity),
        occupiedMT: 0,
        rackId: 'RACK-001'
      });
      showToast(`Silo Bin ${name} added`, 'success');
      // Reset Bin Form
      setBinCode('');
      setBinWarehouseId('');
      setBinAllowedCommodityId('');
    }
    else if (activeTab === 'vehicles') {
      if (!vehicleNo) return;
      erpService.vehicles.create({
        id: `VEH-${Date.now()}`,
        number: vehicleNo,
        type: vehicleType,
        capacityMT: Number(capacity),
        driverId: driverId || undefined,
        status: 'Available'
      });
      showToast(`Vehicle ${vehicleNo} registered`, 'success');
    }
    else if (activeTab === 'drivers') {
      if (!name || !license) return;
      erpService.drivers.create({
        id: `DRV-${Date.now()}`,
        name, phone, licenseNumber: license,
        status: 'Active'
      });
      showToast(`Driver ${name} registered`, 'success');
    }

    }

    refreshDb();
    setIsAddOpen(false);
    // Reset Form
    setName('');
    setCompanyName('');
    setPan('');
    setAadhar('');
    setBankName('');
    setAccountNumber('');
    setIfscCode('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setVehicleNo('');
    setLicense('');
    setState('Bihar');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Master Registries</h1>
          <p className="text-xs font-medium text-slate-400">Configure base directories for partners, commodities, fleet logistics, and warehouses.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Register New Entry</span>
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1">
        {[
          { key: 'customers', label: 'Customers' },
          { key: 'suppliers', label: 'Suppliers' },
          { key: 'farmers', label: 'Farmers' },
          { key: 'commodities', label: 'Commodities' },
          { key: 'qualityRebateRules', label: 'Quality / Rebate Master' },
          { key: 'warehouses', label: 'Warehouses' },
          { key: 'vehicles', label: 'Vehicles' },
          { key: 'drivers', label: 'Drivers' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === t.key 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-slate-400 hover:text-slate-655'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table registers */}
      <div className="space-y-4">
        {activeTab === 'customers' && (
          <DataTable
            data={db.customers}
            columns={[
              { header: 'Customer Name', accessor: 'name', sortable: true },
              { header: 'Company Name', accessor: (row: any) => row.companyName || '-' },
              { header: 'GSTIN ID', accessor: 'gstin' },
              { header: 'PAN Card', accessor: (row: any) => row.pan || '-' },
              { header: 'Phone', accessor: 'phone' },
              { 
                header: 'Bank Details', 
                accessor: (row: any) => row.bankName ? `${row.bankName} (${row.accountNumber || ''})` : '-' 
              },
              { header: 'State Location', accessor: 'state' },
              { header: 'Receivables due', accessor: (row: any) => `₹${row.balance.toLocaleString()}` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('customers', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit customer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('customers', row.id, row.name);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete customer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search customer name..."
            searchField="name"
            exportFileName="customers_master"
          />
        )}

        {activeTab === 'suppliers' && (
          <DataTable
            data={db.suppliers}
            columns={[
              { header: 'Supplier Name', accessor: 'name', sortable: true },
              { header: 'Company Name', accessor: (row: any) => row.companyName || '-' },
              { header: 'GSTIN ID', accessor: 'gstin' },
              { header: 'PAN Card', accessor: (row: any) => row.pan || '-' },
              { header: 'Phone', accessor: 'phone' },
              { 
                header: 'Bank Details', 
                accessor: (row: any) => row.bankName ? `${row.bankName} (${row.accountNumber || ''})` : '-' 
              },
              { header: 'Payables due', accessor: (row: any) => `₹${row.balance.toLocaleString()}` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('suppliers', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit supplier"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('suppliers', row.id, row.name);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete supplier"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search supplier name..."
            searchField="name"
            exportFileName="suppliers_master"
          />
        )}

        {activeTab === 'farmers' && (
          <DataTable
            data={db.farmers}
            columns={[
              { header: 'Farmer Name', accessor: 'name', sortable: true },
              { header: 'Contact Phone', accessor: 'phone' },
              { header: 'PAN Card', accessor: (row: any) => row.pan || '-' },
              { header: 'Aadhar Card', accessor: (row: any) => row.aadhar || '-' },
              { 
                header: 'Bank Details', 
                accessor: (row: any) => row.bankName ? `${row.bankName} (${row.bankAccountNo || ''})` : '-' 
              },
              { header: 'Address Details', accessor: 'address' },
              { header: 'State Location', accessor: 'state' },
              { header: 'Advances / Payables due', accessor: (row: any) => `₹${row.balance.toLocaleString()}` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('farmers', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit farmer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('farmers', row.id, row.name);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete farmer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search farmer name..."
            searchField="name"
            exportFileName="farmers_master"
          />
        )}

        {activeTab === 'commodities' && (
          <DataTable
            data={db.commodities}
            columns={[
              { header: 'Commodity', accessor: 'name', sortable: true },
              { header: 'SKU', accessor: 'sku' },
              { header: 'Category', accessor: 'category' },
              { header: 'UOM Unit', accessor: 'unit' },
              { header: 'HSN code', accessor: 'hsn' },
              { header: 'Base GST (%)', accessor: (row: any) => `${row.defaultGst}%` },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('commodities', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit commodity"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('commodities', row.id, row.name);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete commodity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search commodity..."
            searchField="name"
            exportFileName="commodities_master"
          />
        )}

        {(activeTab === 'qualityRebateRules' || (activeTab as string) === 'qualitySpecs') && (
          <div className="space-y-4 animate-fade-in">
            {/* Sub-tabs Header & Actions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQcMasterSubTab('rules')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    qcMasterSubTab === 'rules'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Scale size={14} />
                  <span>Rebate Rules Configuration</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${qcMasterSubTab === 'rules' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {rebateRulesList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQcMasterSubTab('parameters')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    qcMasterSubTab === 'parameters'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FlaskConical size={14} />
                  <span>Quality Parameters Master</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${qcMasterSubTab === 'parameters' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {qualityParamsList.length}
                  </span>
                </button>
              </div>

              <div>
                {qcMasterSubTab === 'rules' ? (
                  <button
                    onClick={handleOpenAddRule}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <Plus size={14} />
                    <span>Create Rebate Rule</span>
                  </button>
                ) : (
                  <button
                    onClick={handleOpenAddParam}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <Plus size={14} />
                    <span>New Parameter</span>
                  </button>
                )}
              </div>
            </div>

            {/* 1. REBATE RULES SUB-TAB */}
            {qcMasterSubTab === 'rules' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                    <Filter size={14} />
                    <span>Filter Rules:</span>
                  </div>

                  <select
                    value={ruleFilterCommodity}
                    onChange={e => setRuleFilterCommodity(e.target.value)}
                    className="p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  >
                    <option value="">All Commodities</option>
                    {db.commodities.map(c => (
                      <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={ruleFilterStatus}
                    onChange={e => setRuleFilterStatus(e.target.value)}
                    className="p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  >
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>

                  {(ruleFilterCommodity || ruleFilterStatus) && (
                    <button
                      onClick={() => { setRuleFilterCommodity(''); setRuleFilterStatus(''); }}
                      className="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Rules Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <tr>
                          <th className="p-3">Rule Code</th>
                          <th className="p-3">Commodity</th>
                          <th className="p-3">Parameter</th>
                          <th className="p-3 text-center">Standard</th>
                          <th className="p-3 text-center">Tolerance</th>
                          <th className="p-3">Rebate Type</th>
                          <th className="p-3">Method</th>
                          <th className="p-3">Rebate Basis / Slabs</th>
                          <th className="p-3">Effective Validity</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rebateRulesList
                          .filter(r => {
                            if (ruleFilterCommodity && r.commodityId !== ruleFilterCommodity) return false;
                            if (ruleFilterStatus && r.status !== ruleFilterStatus) return false;
                            return true;
                          })
                          .map(rule => (
                            <tr key={rule._id || rule.id} className="hover:bg-slate-50/70 transition">
                              <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {rule.ruleCode}
                              </td>
                              <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                                {rule.commodityName}
                              </td>
                              <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                                {rule.parameterName}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                                {rule.standardValue} {rule.unit || '%'}
                              </td>
                              <td className="p-3 text-center font-mono text-slate-500 whitespace-nowrap">
                                &plusmn;{rule.tolerance} {rule.unit || '%'}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {rule.rebateType}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  rule.calculationMethod === 'Pro-Rata' 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {rule.calculationMethod}
                                </span>
                              </td>
                              <td className="p-3 text-xs font-mono text-slate-700 max-w-xs truncate">
                                {rule.slabs && rule.slabs.length > 0 ? (
                                  <span className="text-emerald-700 font-semibold font-sans">
                                    {rule.slabs.length} Tiered Slabs ({rule.rebateBasis})
                                  </span>
                                ) : (
                                  <span>₹{rule.rebateRate} ({rule.rebateBasis})</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap text-slate-500 text-[11px]">
                                {rule.effectiveFrom ? formatDateStr(rule.effectiveFrom) : 'Any'} &rarr; {rule.effectiveTo ? formatDateStr(rule.effectiveTo) : 'Ongoing'}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleRuleStatus(rule)}
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                                    rule.status === 'Active' 
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                  title="Click to toggle status"
                                >
                                  {rule.status}
                                </button>
                              </td>
                              <td className="p-3 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditRule(rule)}
                                    className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                                    title="Edit rule"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateRule(rule)}
                                    className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                                    title="Duplicate rule"
                                  >
                                    <Copy size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                    title="Delete rule"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. QUALITY PARAMETERS SUB-TAB */}
            {qcMasterSubTab === 'parameters' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      <tr>
                        <th className="p-3">Parameter Name</th>
                        <th className="p-3">Code</th>
                        <th className="p-3">Unit</th>
                        <th className="p-3 text-center">Standard Benchmark</th>
                        <th className="p-3 text-center">Allowable Limits</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {qualityParamsList.map(param => (
                        <tr key={param._id || param.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                            {param.name}
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                            {param.code}
                          </td>
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                            {param.unit || '%'}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                            {param.standardValue !== undefined ? `${param.standardValue} ${param.unit}` : '-'}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-500 whitespace-nowrap">
                            {param.minLimit !== undefined || param.maxLimit !== undefined 
                              ? `${param.minLimit ?? 0} - ${param.maxLimit ?? 100} ${param.unit}` 
                              : '-'}
                          </td>
                          <td className="p-3 text-slate-500 max-w-sm truncate">
                            {param.description || '-'}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              param.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {param.status}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditParam(param)}
                                className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                                title="Edit parameter"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteParam(param)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                title="Delete parameter"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADD/EDIT REBATE RULE MODAL (Section 10, 19, 20) */}
        {isRuleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg">
                    <Scale size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingRuleId ? `Edit Rebate Rule (${ruleFormCode})` : 'Create Commodity Rebate Rule'}
                    </h2>
                    <p className="text-xs text-slate-500">Define standards, tolerance thresholds, and deviation rebate slabs</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRuleModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveRule} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Commodity *</label>
                    <select
                      value={ruleFormCommodityId}
                      onChange={e => setRuleFormCommodityId(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-bold"
                      required
                    >
                      <option value="">-- Choose Commodity --</option>
                      {db.commodities.map(c => (
                        <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Quality Parameter *</label>
                    <select
                      value={ruleFormParamName}
                      onChange={e => {
                        const pName = e.target.value;
                        setRuleFormParamName(pName);
                        const found = qualityParamsList.find(p => p.name === pName);
                        if (found) {
                          if (found.unit) setRuleFormUnit(found.unit);
                          if (found.standardValue !== undefined && found.standardValue !== null) {
                            setRuleFormStandardValue(found.standardValue);
                          }
                        }
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold"
                      required
                    >
                      {qualityParamsList.length === 0 ? (
                        <>
                          <option value="Moisture">Moisture (%)</option>
                          <option value="Protein">Protein (%)</option>
                          <option value="Oil Content">Oil Content (%)</option>
                          <option value="Foreign Matter">Foreign Matter (%)</option>
                          <option value="Broken Grain">Broken Grain (%)</option>
                          <option value="Damaged Grain">Damaged Grain (%)</option>
                          <option value="Admixture">Admixture (%)</option>
                          <option value="Fungus/Aflatoxin">Fungus/Aflatoxin (ppb)</option>
                        </>
                      ) : (
                        qualityParamsList.map(p => (
                          <option key={p.name || (p as any)._id} value={p.name}>{p.name} ({p.unit || '%'})</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Unit *</label>
                    <input
                      type="text"
                      value={ruleFormUnit}
                      onChange={e => setRuleFormUnit(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-800 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Standard Value *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ruleFormStandardValue}
                      onChange={e => setRuleFormStandardValue(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-800 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Calculation Method</label>
                    <select
                      value={ruleFormCalcMethod}
                      onChange={e => {
                        const newMethod = e.target.value as any;
                        setRuleFormCalcMethod(newMethod);
                        if (newMethod === 'Discount') {
                          setRuleFormRebateRate(2);
                        }
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold"
                    >
                      <option value="Pro-Rata">Pro-Rata (Parameter-by-Parameter Slabs)</option>
                      <option value="Discount">Discount (Global Commercial Price Cut)</option>
                      <option value="Both">Both (Pro-Rata Slabs + Commercial Discount)</option>
                    </select>
                  </div>

                  {ruleFormCalcMethod !== 'Discount' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tolerance Buffer (&plusmn;)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ruleFormTolerance}
                          onChange={e => setRuleFormTolerance(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-full p-2 border border-slate-200 rounded-lg text-slate-800"
                          placeholder="e.g. 1% grace buffer"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Deviation Direction</label>
                        <select
                          value={ruleFormDirection}
                          onChange={e => setRuleFormDirection(e.target.value as any)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                        >
                          <option value="HIGHER_IS_WORSE">Higher is Worse (Moisture, Impurities)</option>
                          <option value="LOWER_IS_WORSE">Lower is Worse (Protein, Oil)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Rebate Type</label>
                        <select
                          value={ruleFormRebateType}
                          onChange={e => {
                            const newType = e.target.value as any;
                            setRuleFormRebateType(newType);
                            if (newType === 'Double Rebate') {
                              showToast('Double Rebate selected: 2.0x penalty multiplier applied to parameter deviations', 'info');
                            }
                          }}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold"
                        >
                          <option value="Standard Rebate">Standard Rebate</option>
                          <option value="Single Rebate">Single Rebate</option>
                          <option value="Double Rebate">Double Rebate</option>
                          <option value="All Types">All Types</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Rebate Basis</label>
                        <select
                          value={ruleFormRebateBasis}
                          onChange={e => {
                            const newBasis = e.target.value as any;
                            setRuleFormRebateBasis(newBasis);
                            if (newBasis === 'Percentage of Base Rate') {
                              setRuleFormSlabs(prev => prev.map(s => ({
                                ...s,
                                rateType: 'Percentage',
                                rebateRate: s.rebateRate > 50 ? 2 : (s.rebateRate || 2)
                              })));
                            } else if (newBasis === 'Flat Rate per MT') {
                              setRuleFormSlabs(prev => prev.map(s => ({
                                ...s,
                                rateType: 'Fixed Amount'
                              })));
                            } else if (newBasis === 'Per % Deviation') {
                              setRuleFormSlabs(prev => prev.map(s => ({
                                ...s,
                                rateType: 'Per Unit Deviation'
                              })));
                            }
                          }}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold"
                        >
                          <option value="Tiered Slabs">Tiered Deviation Slabs</option>
                          <option value="Per % Deviation">Per % Net Deviation</option>
                          <option value="Percentage of Base Rate">% of Base Purchase Rate</option>
                          <option value="Flat Rate per MT">Flat Amount per Unit</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* 1. DISCOUNT CALCULATION METHOD ADAPTATION (When Discount or Both is selected) */}
                {(ruleFormCalcMethod === 'Discount' || ruleFormCalcMethod === 'Both') && (
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200 space-y-3 animate-fade-in shadow-xs">
                    <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                      <span className="font-bold text-indigo-900 uppercase text-[11px] flex items-center gap-1.5">
                        <Percent size={15} className="text-indigo-600" />
                        <span>Global Commercial Discount Configuration</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                        {ruleFormCalcMethod === 'Discount' ? 'Direct Discount Mode' : 'Hybrid Discount Layer'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          Global Commercial Discount Rate
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={ruleFormRebateRate}
                            onChange={e => setRuleFormRebateRate(Number(e.target.value))}
                            placeholder="e.g. 2 for 2%"
                            className="w-full p-2 pr-8 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 bg-white"
                          />
                          <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">
                            % / ₹
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-indigo-100 font-medium">
                        <span className="font-bold text-slate-800 block">Calculation Effect:</span>
                        Applies a flat commercial reduction on the agreed PO base rate (e.g. ₹2,500/MT &minus; {ruleFormRebateRate || 0}% = ₹{((2500 * (1 - (ruleFormRebateRate || 0)/100))).toFixed(2)}/MT).
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PRO-RATA PARAMETER DEVIATION SLABS BUILDER (When Pro-Rata or Both is selected) */}
                {ruleFormCalcMethod !== 'Discount' && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
                            <Layers size={15} className="text-emerald-600" />
                            <span>
                              {ruleFormRebateBasis === 'Tiered Slabs' && 'Tiered Deviation Slabs (Stepped Progressive Tiers)'}
                              {ruleFormRebateBasis === 'Per % Deviation' && 'Per % Net Deviation Slabs (Rate × Net Dev)'}
                              {ruleFormRebateBasis === 'Percentage of Base Rate' && 'Base Purchase Rate % Discount Slabs (% of PO Price)'}
                              {ruleFormRebateBasis === 'Flat Rate per MT' && 'Flat Rupee Deduction Slabs (Fixed Rupee Cut)'}
                            </span>
                          </span>

                          {/* Rebate Type Multiplier Badge */}
                          {ruleFormRebateType === 'Double Rebate' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              2.0x Double Penalty Multiplier
                            </span>
                          ) : ruleFormRebateType === 'Single Rebate' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              1.0x Primary Parameter
                            </span>
                          ) : (ruleFormRebateType === 'All Types' || (ruleFormRebateType as any) === 'All') ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                              Universal Multi-Parameter (1:1)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Standard 1:1 Rate
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          {ruleFormRebateType === 'Double Rebate' 
                            ? 'Double Rebate active: 2.0x penalty multiplier applies across all evaluated parameter deviations.'
                            : (ruleFormRebateType === 'All Types' || (ruleFormRebateType as any) === 'All')
                              ? 'All Types active: Universal contract rule evaluated across all tested quality parameters.'
                              : ruleFormRebateType === 'Single Rebate'
                                ? 'Single Rebate active: Evaluates primary parameter deviation at standard 1:1 rate.'
                                : ruleFormRebateBasis === 'Tiered Slabs' 
                                  ? 'Progressive slabs: higher deviations match distinct penalty rate brackets.'
                                  : ruleFormRebateBasis === 'Per % Deviation' 
                                    ? 'Multiplies exact net deviation % by the rupee rate.'
                                    : ruleFormRebateBasis === 'Percentage of Base Rate' 
                                      ? 'Deducts percentage of agreed purchase price.'
                                      : 'Applies a fixed rupee deduction across the lot.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRuleFormSlabs(prev => [
                          ...prev, 
                          { 
                            minDeviation: prev.length > 0 ? (Number(prev[prev.length - 1].maxDeviation) + 0.01) : 0, 
                            maxDeviation: prev.length > 0 ? (Number(prev[prev.length - 1].maxDeviation) + 2) : 1, 
                            rebateRate: ruleFormRebateBasis === 'Percentage of Base Rate' ? 2 : (ruleFormRebateType === 'Double Rebate' ? 200 : 100), 
                            rateType: ruleFormRebateBasis === 'Percentage of Base Rate' ? 'Percentage' : (ruleFormRebateBasis === 'Flat Rate per MT' ? 'Fixed Amount' : 'Per Unit Deviation'), 
                            description: '' 
                          }
                        ])}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer transition shadow-xs flex items-center gap-1"
                      >
                        <Plus size={12} />
                        <span>Add Slab</span>
                      </button>
                    </div>

                    {/* Slabs Column Headers */}
                    <div className="grid grid-cols-12 gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">
                      <div className="col-span-3">Min Dev ({ruleFormUnit || '%'})</div>
                      <div className="col-span-3">Max Dev ({ruleFormUnit || '%'})</div>
                      <div className="col-span-3">
                        {ruleFormRebateBasis === 'Percentage of Base Rate' ? 'Price Cut (%)' : (ruleFormRebateType === 'Double Rebate' ? '2x Rebate Rate (₹)' : 'Deduction (₹)')}
                      </div>
                      <div className="col-span-2">Rate Basis</div>
                      <div className="col-span-1 text-center">Action</div>
                    </div>

                    {/* Slabs List */}
                    <div className="space-y-2">
                      {ruleFormSlabs.map((slab, sIdx) => (
                        <div key={sIdx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Min Dev"
                              value={slab.minDeviation}
                              onChange={e => setRuleFormSlabs(prev => prev.map((s, i) => i === sIdx ? { ...s, minDeviation: Number(e.target.value) } : s))}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Max Dev"
                              value={slab.maxDeviation}
                              onChange={e => setRuleFormSlabs(prev => prev.map((s, i) => i === sIdx ? { ...s, maxDeviation: Number(e.target.value) } : s))}
                              className="w-full p-1.5 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                            />
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                placeholder={ruleFormRebateBasis === 'Percentage of Base Rate' ? 'e.g. 2.0' : 'e.g. 200'}
                                value={slab.rebateRate}
                                onChange={e => setRuleFormSlabs(prev => prev.map((s, i) => i === sIdx ? { ...s, rebateRate: Number(e.target.value) } : s))}
                                className={`w-full p-1.5 pr-6 border border-slate-200 rounded text-xs font-bold ${
                                  ruleFormRebateBasis === 'Percentage of Base Rate' ? 'text-indigo-600 bg-indigo-50/20' : 'text-red-600 bg-red-50/20'
                                }`}
                              />
                              <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">
                                {ruleFormRebateBasis === 'Percentage of Base Rate' ? '%' : '₹'}
                              </span>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <select
                              value={slab.rateType || (ruleFormRebateBasis === 'Percentage of Base Rate' ? 'Percentage' : (ruleFormRebateBasis === 'Flat Rate per MT' ? 'Fixed Amount' : 'Per Unit Deviation'))}
                              onChange={e => setRuleFormSlabs(prev => prev.map((s, i) => i === sIdx ? { ...s, rateType: e.target.value as any } : s))}
                              className="w-full p-1.5 border border-slate-200 rounded text-[10px] bg-slate-50 font-medium text-slate-700"
                            >
                              {ruleFormRebateBasis === 'Percentage of Base Rate' ? (
                                <option value="Percentage">% of Base Price</option>
                              ) : ruleFormRebateBasis === 'Flat Rate per MT' ? (
                                <option value="Fixed Amount">Fixed Flat (₹)</option>
                              ) : (
                                <>
                                  <option value="Per Unit Deviation">Per Dev Unit (₹)</option>
                                  <option value="Fixed Amount">Fixed Flat (₹)</option>
                                  <option value="Percentage">% of Base Price</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => setRuleFormSlabs(prev => prev.filter((_, i) => i !== sIdx))}
                              className="p-1 text-red-400 hover:text-red-600 cursor-pointer transition"
                              title="Remove Slab"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Dynamic Formula & Calculation Preview Callout */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Formula Rule:</span>
                        <span className="font-mono text-slate-600">
                          {ruleFormRebateType === 'Double Rebate' 
                            ? 'Double Penalty Multiplier (2.0x) applies to matched deviation slabs'
                            : ruleFormRebateBasis === 'Tiered Slabs' 
                              ? 'Matches Slab [Min - Max] -> Applies slab rate (₹ or % per unit dev)'
                              : ruleFormRebateBasis === 'Per % Deviation' 
                                ? 'Total Rebate = (Actual % - Tolerance %) × Slab ₹ Rate'
                                : ruleFormRebateBasis === 'Percentage of Base Rate' 
                                  ? 'Total Rebate = Base Rate (₹) × (Slab Rate % / 100)'
                                  : 'Total Rebate = Flat ₹ Rate (Fixed across entire MT lot)'}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {ruleFormRebateType} &bull; {ruleFormRebateBasis}
                      </span>
                    </div>
                  </div>
                )}

                {/* Effective Dates & Status (Section 11) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Effective From *</label>
                    <input
                      type="date"
                      value={ruleFormEffectiveFrom}
                      onChange={e => setRuleFormEffectiveFrom(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-800"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Effective To (Optional)</label>
                    <input
                      type="date"
                      value={ruleFormEffectiveTo}
                      onChange={e => setRuleFormEffectiveTo(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Status</label>
                    <select
                      value={ruleFormStatus}
                      onChange={e => setRuleFormStatus(e.target.value as any)}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-bold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Notes / Description</label>
                  <input
                    type="text"
                    value={ruleFormNotes}
                    onChange={e => setRuleFormNotes(e.target.value)}
                    placeholder="e.g. Standard Kharif season quality rebate rule..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer transition shadow-sm"
                  >
                    {editingRuleId ? 'Update Rule' : 'Save Rebate Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD/EDIT QUALITY PARAMETER MODAL (Section 12) */}
        {isParamModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {editingParamId ? 'Edit Quality Parameter' : 'New Quality Parameter'}
                </h3>
                <button onClick={() => setIsParamModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveParam} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Parameter Name *</label>
                  <input
                    type="text"
                    value={paramFormName}
                    onChange={e => setParamFormName(e.target.value)}
                    placeholder="e.g. Moisture, Protein, Foreign Matter"
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-800 font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Code *</label>
                    <input
                      type="text"
                      value={paramFormCode}
                      onChange={e => setParamFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. MOIST"
                      className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Unit *</label>
                    <input
                      type="text"
                      value={paramFormUnit}
                      onChange={e => setParamFormUnit(e.target.value)}
                      placeholder="e.g. %, ppm"
                      className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Standard</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paramFormStandard}
                      onChange={e => setParamFormStandard(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Min Limit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paramFormMin}
                      onChange={e => setParamFormMin(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Max Limit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paramFormMax}
                      onChange={e => setParamFormMax(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Description</label>
                  <input
                    type="text"
                    value={paramFormDesc}
                    onChange={e => setParamFormDesc(e.target.value)}
                    placeholder="Testing parameter details..."
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Status</label>
                  <select
                    value={paramFormStatus}
                    onChange={e => setParamFormStatus(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsParamModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer transition shadow-sm"
                  >
                    {editingParamId ? 'Update Parameter' : 'Save Parameter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'warehouses' && (
          <DataTable
            data={db.warehouses}
            columns={[
              { header: 'Warehouse Facility', accessor: 'name', sortable: true },
              { header: 'Physical Address', accessor: 'location' },
              { header: 'Total Capacity', accessor: (row: any) => `${row.capacityMT} MT` },
              { header: 'Used Capacity', accessor: (row: any) => `${row.usedCapacityMT} MT` },
              { header: 'Occupancy Used', accessor: (row: any) => `${Math.round((row.usedCapacityMT / row.capacityMT) * 100)}%` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('warehouses', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit warehouse"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('warehouses', row.id, row.name);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete warehouse"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search warehouse..."
            searchField="name"
            exportFileName="warehouses_master"
          />
        )}

        {activeTab === 'vehicles' && (
          <DataTable
            data={db.vehicles}
            columns={[
              { header: 'Vehicle Plate No', accessor: 'number', sortable: true },
              { header: 'Vehicle Chassis Type', accessor: 'type' },
              { header: 'Capacity Tonnage', accessor: (row: any) => `${row.capacityMT} MT` },
              { 
                header: 'Driver Assigned', 
                accessor: (row: any) => db.drivers.find(d => d.id === row.driverId)?.name || 'Unassigned' 
              },
              { header: 'Logistics Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('vehicles', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit vehicle"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('vehicles', row.id, row.number);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete vehicle"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search vehicle plates..."
            searchField="number"
            exportFileName="fleet_vehicles_master"
          />
        )}

        {activeTab === 'drivers' && (
          <DataTable
            data={db.drivers}
            columns={[
              { header: 'Driver Name', accessor: 'name', sortable: true },
              { header: 'Contact Phone', accessor: 'phone' },
              { header: 'License Number', accessor: 'licenseNumber' },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleView(row); }}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="View details"
                    ><Eye size={14} /></button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit('drivers', row);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Edit driver"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('drivers', row.id, row.name);
                      }}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                      title="Delete driver"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
                className: 'w-32 text-center'
              }
            ]}
            searchPlaceholder="Search driver name..."
            searchField="name"
            exportFileName="fleet_drivers_master"
          />
        )}
      </div>

      {/* View Detail Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setViewingRecord(null)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700">
              <div>
                <h3 className="text-sm font-bold text-white">{viewingRecord.name || viewingRecord.number || 'Record Details'}</h3>
                <p className="text-[10px] text-primary-200 mt-0.5 capitalize">{activeTab} · Full Record View</p>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-white/70 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* Fields Grid */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* Name / identifier */}
                {viewingRecord.name && (
                  <div className="col-span-2 bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Building2 size={10} /> Name</p>
                    <p className="text-sm font-semibold text-slate-800">{viewingRecord.name}</p>
                  </div>
                )}
                {viewingRecord.number && (
                  <div className="col-span-2 bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registration No</p>
                    <p className="text-sm font-semibold text-slate-800">{viewingRecord.number}</p>
                  </div>
                )}
                {/* Company Name */}
                {viewingRecord.companyName && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.companyName}</p>
                  </div>
                )}
                {/* Phone */}
                {viewingRecord.phone && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Phone size={10} /> Phone</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.phone}</p>
                  </div>
                )}
                {/* Email */}
                {viewingRecord.email && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Mail size={10} /> Email</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.email}</p>
                  </div>
                )}
                {/* GSTIN */}
                {viewingRecord.gstin && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GSTIN</p>
                    <p className="text-xs font-mono font-medium text-slate-700">{viewingRecord.gstin}</p>
                  </div>
                )}
                {/* PAN */}
                {(viewingRecord.pan) && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CreditCard size={10} /> PAN Card</p>
                    <p className="text-xs font-mono font-medium text-slate-700">{viewingRecord.pan}</p>
                  </div>
                )}
                {/* Aadhar */}
                {viewingRecord.aadhar && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aadhar Card</p>
                    <p className="text-xs font-mono font-medium text-slate-700">{viewingRecord.aadhar}</p>
                  </div>
                )}
                {/* Bank Details */}
                {(viewingRecord.bankName || viewingRecord.accountNumber || viewingRecord.bankAccountNo) && (
                  <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Landmark size={10} /> Bank Details</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(viewingRecord.bankName) && (
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Bank</p>
                          <p className="text-xs font-semibold text-slate-700">{viewingRecord.bankName}</p>
                        </div>
                      )}
                      {(viewingRecord.accountNumber || viewingRecord.bankAccountNo) && (
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Account No</p>
                          <p className="text-xs font-semibold text-slate-700 font-mono">{viewingRecord.accountNumber || viewingRecord.bankAccountNo}</p>
                        </div>
                      )}
                      {(viewingRecord.ifscCode || viewingRecord.bankIfsc) && (
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">IFSC Code</p>
                          <p className="text-xs font-semibold text-slate-700 font-mono">{viewingRecord.ifscCode || viewingRecord.bankIfsc}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Address */}
                {(viewingRecord.address || viewingRecord.location) && (
                  <div className="col-span-2 bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={10} /> Address</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.address || viewingRecord.location}{viewingRecord.state ? `, ${viewingRecord.state}` : ''}</p>
                  </div>
                )}
                {/* Status / Balance */}
                {viewingRecord.status && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">{viewingRecord.status}</span>
                  </div>
                )}
                {viewingRecord.balance !== undefined && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Balance Due</p>
                    <p className="text-sm font-bold text-slate-800">₹{Number(viewingRecord.balance).toLocaleString()}</p>
                  </div>
                )}
                {/* Commodity specific */}
                {viewingRecord.category && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.category}</p>
                  </div>
                )}
                {viewingRecord.hsn && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">HSN Code</p>
                    <p className="text-xs font-mono font-medium text-slate-700">{viewingRecord.hsn}</p>
                  </div>
                )}
                {viewingRecord.capacityMT !== undefined && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Capacity</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.capacityMT} MT</p>
                  </div>
                )}
                {viewingRecord.type && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type</p>
                    <p className="text-xs font-medium text-slate-700">{viewingRecord.type}</p>
                  </div>
                )}
                {viewingRecord.licenseNumber && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">License No</p>
                    <p className="text-xs font-mono font-medium text-slate-700">{viewingRecord.licenseNumber}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <button
                onClick={() => { setViewingRecord(null); handleOpenEdit(activeTab, viewingRecord); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <Edit3 size={12} /> Edit Record
              </button>
              <button
                onClick={() => setViewingRecord(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal form drawer */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? 'Edit' : 'Register New'} Master Entry: <span className="capitalize">{activeTab}</span></h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Update' : 'Define'} core properties for system operations directories.</p>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddMaster} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Partner Profiles (Customers, Suppliers, Farmers) fields */}
              {(activeTab === 'customers' || activeTab === 'suppliers' || activeTab === 'farmers') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company / Contact Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar Grain Farms"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. +91 99887 76655"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                      <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="e.g. contact@farm.com"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">State Location</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={state}
                        onChange={e => setState(e.target.value)}
                        placeholder="e.g. Bihar"
                        required
                      />
                    </div>
                  </div>

                  {activeTab !== 'farmers' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GSTIN Registration Number *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                        value={gstin}
                        onChange={e => setGstin(e.target.value)}
                        placeholder="e.g. 10AAAFS4829K1Z4"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Billing Address Location</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none min-h-[50px]"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Street, City, Pin details..."
                    />
                  </div>

                  {(activeTab === 'suppliers' || activeTab === 'customers') && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company Name</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="e.g. BrijRani Agro Foods Private Ltd"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">PAN Card Number</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                            value={pan}
                            onChange={e => setPan(e.target.value)}
                            placeholder="e.g. ABCDE1234F"
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 mt-3 space-y-3">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Bank Details</span>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank Name</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                              value={bankName}
                              onChange={e => setBankName(e.target.value)}
                              placeholder="e.g. SBI, HDFC"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Number</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                              value={accountNumber}
                              onChange={e => setAccountNumber(e.target.value)}
                              placeholder="e.g. 5010029381029"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">IFSC Code</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                              value={ifscCode}
                              onChange={e => setIfscCode(e.target.value)}
                              placeholder="e.g. SBIN0000102"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'farmers' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">PAN Card Number</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                            value={pan}
                            onChange={e => setPan(e.target.value)}
                            placeholder="e.g. ABCDE1234F"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Aadhar Card Number</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                            value={aadhar}
                            onChange={e => setAadhar(e.target.value)}
                            placeholder="e.g. 1234 5678 9012"
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 mt-3 space-y-3">
                        <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Bank Details</span>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank Name</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                              value={bankName}
                              onChange={e => setBankName(e.target.value)}
                              placeholder="e.g. SBI, HDFC"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Number</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                              value={accountNumber}
                              onChange={e => setAccountNumber(e.target.value)}
                              placeholder="e.g. 5010029381029"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">IFSC Code</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono"
                              value={ifscCode}
                              onChange={e => setIfscCode(e.target.value)}
                              placeholder="e.g. SBIN0000102"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Commodities fields */}
              {activeTab === 'commodities' && (
                <>
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Commodity Name *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Mustard Seeds (Sarso)"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      >
                        <option value="Grains">Grains</option>
                        <option value="Oilseeds">Oilseeds</option>
                        <option value="Pulses">Pulses</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">UOM Unit</label>
                      <select
                        value={unit}
                        onChange={e => setUnit(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      >
                        <option value="MT">Metric Ton (MT)</option>
                        <option value="Qtl">Quintal (Qtl)</option>
                        <option value="Kg">Kilogram (Kg)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST Tax Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultGst}
                        onChange={e => setDefaultGst(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        placeholder="e.g. 5, 11, 12"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">HSN Code</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={hsn}
                        onChange={e => setHsn(e.target.value)}
                        placeholder="e.g. 10019910"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Minimum Safety Stock Level</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={minStock}
                        onChange={e => setMinStock(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Warehouses fields */}
              {activeTab === 'warehouses' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Warehouse Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Bihta Warehouse Complex"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Capacity (MT)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={capacity}
                        onChange={e => setCapacity(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Physical Address Location *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Street, City details..."
                      required
                    />
                  </div>
                </>
              )}


              {/* Vehicles fields */}
              {activeTab === 'vehicles' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vehicle License Plate No *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={vehicleNo}
                        onChange={e => setVehicleNo(e.target.value)}
                        placeholder="e.g. BR-01-GB-1234"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vehicle Truck Chassis Type</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={vehicleType}
                        onChange={e => setVehicleType(e.target.value)}
                        placeholder="e.g. Tata 1613 Truck"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payload Weight Capacity (MT)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={capacity}
                        onChange={e => setCapacity(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assign Active Driver</label>
                      <select
                        value={driverId}
                        onChange={e => setDriverId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {db.drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Drivers fields */}
              {activeTab === 'drivers' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Full Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Suresh Singh"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Phone Number</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. +91 88776 65544"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver HGV License Number *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono"
                      value={license}
                      onChange={e => setLicense(e.target.value)}
                      placeholder="e.g. DL-10201500789"
                      required
                    />
                  </div>
                </>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  {isEditMode ? 'Save Changes' : 'Register Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function MastersHubPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <MastersHubPageContent />
    </React.Suspense>
  );
}
