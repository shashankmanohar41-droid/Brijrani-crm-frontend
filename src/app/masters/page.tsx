'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useErp } from '../../context/ErpContext';
import { erpService } from '../../services/erpService';
import api from '../../services/axios';
import DataTable from '../../components/shared/DataTable';
import IndianDateInput from '../../components/shared/IndianDateInput';
import { gstService } from '../../services/gstService';
import {
  Plus, Database, UserCheck, ShieldAlert, CheckCircle, Trash2, Edit3, Eye, X,
  Building2, Phone, Mail, MapPin, CreditCard, Landmark, FlaskConical, Settings,
  Copy, Check, AlertCircle, Sparkles, Scale, Layers, Filter, Percent, Calculator,
  ChevronRight, ChevronLeft, Zap, CheckCircle2, Sliders, Info, ShieldCheck, HelpCircle,
  ArrowRight, ArrowLeft, Loader2
} from 'lucide-react';
import { QualityRebateRule, QualityParameter, RebateSlab, CommodityQualityParam } from '../../types/erp';

export interface CommoditySpecState {
  id: string;
  name: string;
  unit: string;
  standardValue: number | '';
  tolerance: number | '';
  minLimit: number | '';
  maxLimit: number | '';
  direction: 'HIGHER_IS_WORSE' | 'LOWER_IS_WORSE';
  hasRebateRule: boolean;
  ruleCode?: string;
  ruleId?: string;
  rebateType: 'Standard Rebate' | 'Single Rebate' | 'Double Rebate' | 'All' | 'All Types';
  calculationMethod: 'Discount' | 'Pro-Rata' | 'Both';
  rebateBasis: 'Per % Deviation' | 'Flat Rate per MT' | 'Percentage of Base Rate' | 'Tiered Slabs';
  rebateRate: number | '';
  slabs: RebateSlab[];
  effectiveFrom?: string;
  effectiveTo?: string;
  status: 'Active' | 'Inactive';
  notes?: string;
}

export const getPresetSlabsForRebate = (rebateType: string, rebateBasis: string = 'Tiered Slabs'): RebateSlab[] => {
  if (rebateBasis === 'Percentage of Base Rate') {
    if (rebateType === 'Double Rebate') {
      return [
        { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Percentage', description: '0-1% Tol -> 0% Cut' },
        { minDeviation: 1.01, maxDeviation: 2, rebateRate: 3.0, rateType: 'Percentage', description: '1-2% Dev -> 2x 3.0% Base Rate' },
        { minDeviation: 2.01, maxDeviation: 4, rebateRate: 6.0, rateType: 'Percentage', description: '2-4% Dev -> 2x 6.0% Base Rate' },
        { minDeviation: 4.01, maxDeviation: 6, rebateRate: 10.0, rateType: 'Percentage', description: '4-6% Dev -> 2x 10.0% Base Rate' }
      ];
    }
    if (rebateType === 'Single Rebate') {
      return [
        { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Percentage', description: '0-1% Tol -> 0% Cut' },
        { minDeviation: 1.01, maxDeviation: 2, rebateRate: 2.0, rateType: 'Percentage', description: '1-2% Dev -> 2.0% Base Rate' },
        { minDeviation: 2.01, maxDeviation: 5, rebateRate: 4.5, rateType: 'Percentage', description: '2-5% Dev -> 4.5% Base Rate' }
      ];
    }
    if (rebateType === 'All' || rebateType === 'All Types') {
      return [
        { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Percentage', description: '0-1% Tol -> 0% Cut' },
        { minDeviation: 1.01, maxDeviation: 2, rebateRate: 1.0, rateType: 'Percentage', description: '1-2% Dev -> 1.0% Base Rate' },
        { minDeviation: 2.01, maxDeviation: 4, rebateRate: 2.5, rateType: 'Percentage', description: '2-4% Dev -> 2.5% Base Rate' },
        { minDeviation: 4.01, maxDeviation: 7, rebateRate: 5.0, rateType: 'Percentage', description: '4-7% Dev -> 5.0% Base Rate' }
      ];
    }
    return [
      { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Percentage', description: '0-1% Tol -> 0% Cut' },
      { minDeviation: 1.01, maxDeviation: 2, rebateRate: 1.5, rateType: 'Percentage', description: '1-2% Dev -> 1.5% of Base Rate' },
      { minDeviation: 2.01, maxDeviation: 4, rebateRate: 3.0, rateType: 'Percentage', description: '2-4% Dev -> 3.0% of Base Rate' }
    ];
  }

  if (rebateBasis === 'Flat Rate per MT') {
    if (rebateType === 'Double Rebate') {
      return [
        { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
        { minDeviation: 1.01, maxDeviation: 2, rebateRate: 400, rateType: 'Fixed Amount', description: '1-2% Dev -> 2x ₹400 Flat/MT' },
        { minDeviation: 2.01, maxDeviation: 4, rebateRate: 800, rateType: 'Fixed Amount', description: '2-4% Dev -> 2x ₹800 Flat/MT' }
      ];
    }
    if (rebateType === 'Single Rebate') {
      return [
        { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
        { minDeviation: 1.01, maxDeviation: 2, rebateRate: 350, rateType: 'Fixed Amount', description: '1-2% Dev -> ₹350 Flat/MT' },
        { minDeviation: 2.01, maxDeviation: 5, rebateRate: 500, rateType: 'Fixed Amount', description: '2-5% Dev -> ₹500 Flat/MT' }
      ];
    }
    if (rebateType === 'All' || rebateType === 'All Types') {
      return [
        { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
        { minDeviation: 1.01, maxDeviation: 2, rebateRate: 250, rateType: 'Fixed Amount', description: '1-2% Dev -> ₹250 Flat/MT' },
        { minDeviation: 2.01, maxDeviation: 4, rebateRate: 450, rateType: 'Fixed Amount', description: '2-4% Dev -> ₹450 Flat/MT' },
        { minDeviation: 4.01, maxDeviation: 7, rebateRate: 700, rateType: 'Fixed Amount', description: '4-7% Dev -> ₹700 Flat/MT' }
      ];
    }
    return [
      { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
      { minDeviation: 1.01, maxDeviation: 2, rebateRate: 250, rateType: 'Fixed Amount', description: '1-2% Dev -> ₹250 Flat/MT' },
      { minDeviation: 2.01, maxDeviation: 4, rebateRate: 500, rateType: 'Fixed Amount', description: '2-4% Dev -> ₹500 Flat/MT' }
    ];
  }

  // Standard or Tiered Slabs / Per % Deviation / Per % Net Deviation
  if (rebateType === 'Double Rebate') {
    return [
      { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Per Unit Deviation', description: '0-1% Tol -> No Rebate' },
      { minDeviation: 1.01, maxDeviation: 2, rebateRate: 400, rateType: 'Per Unit Deviation', description: '1-2% Dev -> 2x Penalty ₹400/MT' },
      { minDeviation: 2.01, maxDeviation: 4, rebateRate: 600, rateType: 'Per Unit Deviation', description: '2-4% Dev -> 2x Penalty ₹600/MT' },
      { minDeviation: 4.01, maxDeviation: 6, rebateRate: 1000, rateType: 'Per Unit Deviation', description: '4-6% Dev -> 2x Penalty ₹1000/MT' }
    ];
  }

  if (rebateType === 'Single Rebate') {
    return [
      { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Per Unit Deviation', description: '0-1% Tol -> No Rebate' },
      { minDeviation: 1.01, maxDeviation: 2, rebateRate: 350, rateType: 'Per Unit Deviation', description: '1-2% Dev -> ₹350/MT' },
      { minDeviation: 2.01, maxDeviation: 5, rebateRate: 500, rateType: 'Per Unit Deviation', description: '2-5% Dev -> ₹500/MT' }
    ];
  }

  if (rebateType === 'All' || rebateType === 'All Types') {
    return [
      { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Per Unit Deviation', description: '0-1% Tol -> No Rebate' },
      { minDeviation: 1.01, maxDeviation: 2, rebateRate: 250, rateType: 'Per Unit Deviation', description: '1-2% Dev -> ₹250/MT' },
      { minDeviation: 2.01, maxDeviation: 4, rebateRate: 450, rateType: 'Per Unit Deviation', description: '2-4% Dev -> ₹450/MT' },
      { minDeviation: 4.01, maxDeviation: 7, rebateRate: 700, rateType: 'Per Unit Deviation', description: '4-7% Dev -> ₹700/MT' }
    ];
  }

  // Standard Rebate
  return [
    { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Per Unit Deviation', description: '0-1% Tol -> No Rebate' },
    { minDeviation: 1.01, maxDeviation: 2, rebateRate: 200, rateType: 'Per Unit Deviation', description: '1-2% Dev -> ₹200/MT' },
    { minDeviation: 2.01, maxDeviation: 4, rebateRate: 300, rateType: 'Per Unit Deviation', description: '2-4% Dev -> ₹300/MT' }
  ];
};

export const getDefaultSpecsForCategory = (cat: 'Grains' | 'Oilseeds' | 'Pulses' | 'Other'): CommoditySpecState[] => {
  if (cat === 'Oilseeds') {
    return [
      {
        id: 'oil-1',
        name: 'Oil Content',
        unit: '%',
        standardValue: 42,
        tolerance: 1,
        minLimit: 36,
        maxLimit: 50,
        direction: 'LOWER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Single Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Tiered Slabs',
        rebateRate: 350,
        slabs: [
          { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
          { minDeviation: 1.01, maxDeviation: 2, rebateRate: 350, rateType: 'Per Unit Deviation', description: '1-2% Dev -> ₹350/MT' },
          { minDeviation: 2.01, maxDeviation: 5, rebateRate: 500, rateType: 'Per Unit Deviation', description: '2-5% Dev -> ₹500/MT' }
        ],
        status: 'Active',
        notes: 'Oilseeds premium/discount benchmark standard'
      },
      {
        id: 'oil-2',
        name: 'Moisture',
        unit: '%',
        standardValue: 8,
        tolerance: 1,
        minLimit: 0,
        maxLimit: 12,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Tiered Slabs',
        rebateRate: 200,
        slabs: [
          { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
          { minDeviation: 1.01, maxDeviation: 3, rebateRate: 250, rateType: 'Per Unit Deviation', description: '1-3% Dev -> ₹250/MT' }
        ],
        status: 'Active'
      },
      {
        id: 'oil-3',
        name: 'FFA (Free Fatty Acids)',
        unit: '%',
        standardValue: 1.5,
        tolerance: 0.5,
        minLimit: 0,
        maxLimit: 3,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Discount',
        rebateBasis: 'Per % Deviation',
        rebateRate: 200,
        slabs: [],
        status: 'Active'
      },
      {
        id: 'oil-4',
        name: 'Sand / Silica',
        unit: '%',
        standardValue: 1.5,
        tolerance: 0.5,
        minLimit: 0,
        maxLimit: 3,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Flat Rate per MT',
        rebateRate: 150,
        slabs: [],
        status: 'Active'
      }
    ];
  } else if (cat === 'Pulses') {
    return [
      {
        id: 'pul-1',
        name: 'Moisture',
        unit: '%',
        standardValue: 12,
        tolerance: 1,
        minLimit: 0,
        maxLimit: 14,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Tiered Slabs',
        rebateRate: 250,
        slabs: [
          { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
          { minDeviation: 1.01, maxDeviation: 3, rebateRate: 250, rateType: 'Per Unit Deviation', description: '1-3% Dev -> ₹250/MT' }
        ],
        status: 'Active'
      },
      {
        id: 'pul-2',
        name: 'Foreign Matter',
        unit: '%',
        standardValue: 1,
        tolerance: 0.5,
        minLimit: 0,
        maxLimit: 2.5,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Per % Deviation',
        rebateRate: 300,
        slabs: [],
        status: 'Active'
      },
      {
        id: 'pul-3',
        name: 'Damaged Grains',
        unit: '%',
        standardValue: 2,
        tolerance: 0.5,
        minLimit: 0,
        maxLimit: 4,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Per % Deviation',
        rebateRate: 350,
        slabs: [],
        status: 'Active'
      },
      {
        id: 'pul-4',
        name: 'Admixture',
        unit: '%',
        standardValue: 2,
        tolerance: 1,
        minLimit: 0,
        maxLimit: 4,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: false,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Per % Deviation',
        rebateRate: 200,
        slabs: [],
        status: 'Active'
      }
    ];
  } else {
    // Grains / Other default
    return [
      {
        id: 'grn-1',
        name: 'Moisture',
        unit: '%',
        standardValue: 14,
        tolerance: 1,
        minLimit: 0,
        maxLimit: 16,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Tiered Slabs',
        rebateRate: 300,
        slabs: [
          { minDeviation: 0, maxDeviation: 1, rebateRate: 0, rateType: 'Fixed Amount', description: '0-1% Tol -> No Rebate' },
          { minDeviation: 1.01, maxDeviation: 2, rebateRate: 200, rateType: 'Per Unit Deviation', description: '1-2% Dev -> ₹200/MT' },
          { minDeviation: 2.01, maxDeviation: 4, rebateRate: 300, rateType: 'Per Unit Deviation', description: '2-4% Dev -> ₹300/MT' }
        ],
        status: 'Active'
      },
      {
        id: 'grn-2',
        name: 'Foreign Matter',
        unit: '%',
        standardValue: 1,
        tolerance: 0.5,
        minLimit: 0,
        maxLimit: 3,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Per % Deviation',
        rebateRate: 250,
        slabs: [],
        status: 'Active'
      },
      {
        id: 'grn-3',
        name: 'Broken Grains',
        unit: '%',
        standardValue: 4,
        tolerance: 1,
        minLimit: 0,
        maxLimit: 8,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Per % Deviation',
        rebateRate: 150,
        slabs: [],
        status: 'Active'
      },
      {
        id: 'grn-4',
        name: 'Damaged Grains',
        unit: '%',
        standardValue: 2,
        tolerance: 0.5,
        minLimit: 0,
        maxLimit: 5,
        direction: 'HIGHER_IS_WORSE',
        hasRebateRule: true,
        rebateType: 'Standard Rebate',
        calculationMethod: 'Pro-Rata',
        rebateBasis: 'Per % Deviation',
        rebateRate: 300,
        slabs: [],
        status: 'Active'
      }
    ];
  }
};

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

  const tabQuery = searchParams.get('tab') as 'customers' | 'suppliers' | 'farmers' | 'commodities' | 'warehouses' | 'bins' | 'vehicles' | 'drivers';
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'farmers' | 'commodities' | 'warehouses' | 'bins' | 'vehicles' | 'drivers'>(tabQuery || 'customers');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Sync activeTab state with URL tab changes
  useEffect(() => {
    if (tabQuery) {
      setActiveTab(tabQuery as any);
    }
  }, [tabQuery]);

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
  const [isGstLoading, setIsGstLoading] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [gstAutoMessage, setGstAutoMessage] = useState<string | null>(null);

  // Automatic GST Lookup & Form Enrichment Handler
  const handleGstLookup = async (inputGstin?: string) => {
    const targetGstin = (inputGstin || gstin || '').trim().toUpperCase();
    if (!targetGstin) {
      showToast('Please enter a 15-character GSTIN number', 'error');
      return;
    }

    if (targetGstin.length !== 15) {
      showToast(`GSTIN must be 15 characters (currently ${targetGstin.length})`, 'error');
      return;
    }

    setIsGstLoading(true);
    setGstAutoMessage(null);
    try {
      const data = await gstService.lookupGstin(targetGstin);

      // Auto-populate form fields cleanly
      if (data.tradeName || data.legalName) {
        setName(data.tradeName || data.legalName);
        setCompanyName(data.companyName || data.tradeName || data.legalName);
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
      } else {
        // If not in database or live registry, clear company name/phone/email so stale entries from previously selected items don't remain
        setName('');
        setCompanyName('');
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
      }

      if (data.pan) {
        setPan(data.pan);
      }
      if (data.state) {
        setState(data.state);
      }

      setGstVerified(true);
      const msg = data.tradeName || data.legalName 
        ? `Autofilled from GSTIN: ${data.tradeName || data.legalName} (${data.state})`
        : `GSTIN Format Valid (State: ${data.state} | PAN: ${data.pan}). Please enter company name or configure a live API key.`;
      setGstAutoMessage(msg);
      showToast(`⚡ ${msg}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch GST details', 'error');
    } finally {
      setIsGstLoading(false);
    }
  };

  // Commodity States
  const [category, setCategory] = useState<'Grains' | 'Oilseeds' | 'Pulses' | 'Other'>('Grains');
  const [unit, setUnit] = useState<'MT' | 'Qtl' | 'Kg'>('MT');
  const [hsn, setHsn] = useState('');
  const [defaultGst, setDefaultGst] = useState(5);
  const [cost, setCost] = useState(0);
  const [market, setMarket] = useState(0);
  const [target, setTarget] = useState(0);
  const [minStock, setMinStock] = useState(20);

  // Commodity Quality Specs & Rebates State
  const [commodityModalTab, setCommodityModalTab] = useState<'basic' | 'quality' | 'rebate'>('basic');
  const [commoditySpecs, setCommoditySpecs] = useState<CommoditySpecState[]>(() => getDefaultSpecsForCategory('Grains'));

  // Commodity Specs helper functions
  const handleApplyCategoryPresets = (cat: 'Grains' | 'Oilseeds' | 'Pulses' | 'Other') => {
    setCategory(cat);
    setCommoditySpecs(getDefaultSpecsForCategory(cat));
    showToast(`Loaded standard quality & rebate presets for ${cat}`, 'info');
  };

  const handleAddCustomSpec = () => {
    const newSpec: CommoditySpecState = {
      id: `spec-custom-${Date.now()}`,
      name: '',
      unit: '%',
      standardValue: 0,
      tolerance: 0,
      minLimit: '',
      maxLimit: '',
      direction: 'HIGHER_IS_WORSE',
      hasRebateRule: true,
      rebateType: 'Standard Rebate',
      calculationMethod: 'Pro-Rata',
      rebateBasis: 'Per % Deviation',
      rebateRate: 200,
      slabs: [],
      status: 'Active'
    };
    setCommoditySpecs(prev => [...prev, newSpec]);
  };

  const handleUpdateSpec = (id: string, field: keyof CommoditySpecState, value: any) => {
    setCommoditySpecs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      
      // If setting calculationMethod to Discount, default rebateRate to 2 if 0/empty
      if (field === 'calculationMethod' && value === 'Discount' && (!s.rebateRate || s.rebateRate === 0)) {
        updated.rebateRate = 2;
      }

      // DYNAMIC SLAB TRANSFORMATION ON REBATE TYPE CHANGE
      if (field === 'rebateType') {
        const newType = value;
        const newSlabs = getPresetSlabsForRebate(newType, s.rebateBasis);
        updated.slabs = newSlabs;
        const firstActive = newSlabs.find(sl => sl.rebateRate > 0);
        if (firstActive) {
          updated.rebateRate = firstActive.rebateRate;
        }
      }

      // DYNAMIC SLAB TRANSFORMATION ON REBATE BASIS CHANGE
      if (field === 'rebateBasis') {
        const newBasis = value;
        const newSlabs = getPresetSlabsForRebate(s.rebateType, newBasis);
        updated.slabs = newSlabs;
        const firstActive = newSlabs.find(sl => sl.rebateRate > 0);
        if (firstActive) {
          updated.rebateRate = firstActive.rebateRate;
        }
      }

      return updated;
    }));
  };

  const handleRemoveSpec = (id: string) => {
    setCommoditySpecs(prev => prev.filter(s => s.id !== id));
  };

  const handleAddSlabToSpec = (specId: string) => {
    setCommoditySpecs(prev => prev.map(s => {
      if (s.id !== specId) return s;
      const currentSlabs = s.slabs || [];
      const lastSlab = currentSlabs[currentSlabs.length - 1];
      const minDev = lastSlab ? Number((lastSlab.maxDeviation + 0.01).toFixed(2)) : 0;
      const maxDev = lastSlab ? Number((lastSlab.maxDeviation + 2).toFixed(2)) : 2;

      let rate = 200;
      let rateType: any = 'Per Unit Deviation';
      let desc = '';

      if (s.rebateBasis === 'Percentage of Base Rate') {
        rate = lastSlab ? Number((lastSlab.rebateRate + 1.5).toFixed(1)) : 1.5;
        rateType = 'Percentage';
        desc = `${minDev}-${maxDev}% Dev -> ${rate}% Base Rate`;
      } else if (s.rebateBasis === 'Flat Rate per MT') {
        rate = lastSlab ? lastSlab.rebateRate + 250 : 250;
        rateType = 'Fixed Amount';
        desc = `${minDev}-${maxDev}% Dev -> ₹${rate} Flat/MT`;
      } else if (s.rebateType === 'Double Rebate') {
        rate = lastSlab ? lastSlab.rebateRate + 200 : 400;
        rateType = 'Per Unit Deviation';
        desc = `${minDev}-${maxDev}% Dev -> 2x Penalty ₹${rate}/MT`;
      } else if (s.rebateType === 'Single Rebate') {
        rate = lastSlab ? lastSlab.rebateRate + 150 : 350;
        rateType = 'Per Unit Deviation';
        desc = `${minDev}-${maxDev}% Dev -> ₹${rate}/MT`;
      } else if (s.rebateType === 'All' || s.rebateType === 'All Types') {
        rate = lastSlab ? lastSlab.rebateRate + 200 : 250;
        rateType = 'Per Unit Deviation';
        desc = `${minDev}-${maxDev}% Dev -> ₹${rate}/MT`;
      } else {
        rate = lastSlab ? lastSlab.rebateRate + 100 : 200;
        rateType = 'Per Unit Deviation';
        desc = `${minDev}-${maxDev}% Dev -> ₹${rate}/MT`;
      }

      const newSlab: RebateSlab = {
        minDeviation: minDev,
        maxDeviation: maxDev,
        rebateRate: rate,
        rateType,
        description: desc
      };
      return { ...s, slabs: [...currentSlabs, newSlab] };
    }));
  };

  const handleUpdateSpecSlab = (specId: string, slabIdx: number, field: keyof RebateSlab, value: any) => {
    setCommoditySpecs(prev => prev.map(s => {
      if (s.id !== specId) return s;
      const updatedSlabs = [...s.slabs];
      updatedSlabs[slabIdx] = { ...updatedSlabs[slabIdx], [field]: value };
      return { ...s, slabs: updatedSlabs };
    }));
  };

  const handleRemoveSpecSlab = (specId: string, slabIdx: number) => {
    setCommoditySpecs(prev => prev.map(s => {
      if (s.id !== specId) return s;
      return { ...s, slabs: s.slabs.filter((_, idx) => idx !== slabIdx) };
    }));
  };

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
    setGstVerified(false);
    setIsGstLoading(false);
    setGstAutoMessage(null);
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
    setCommodityModalTab('basic');
    setCommoditySpecs(getDefaultSpecsForCategory('Grains'));
    setIsAddOpen(true);
  };

  const handleOpenEdit = (tab: typeof activeTab, row: any) => {
    setIsEditMode(true);
    setEditingId(row.id || row._id);

    setName(row.name || row.number || ''); // vehicles use row.number
    setPhone(row.phone || '');
    setEmail(row.email || '');
    setAddress(row.address || row.location || ''); // warehouses use row.location
    setState(row.state || 'Bihar');
    setGstin(row.gstin || '');
    setGstVerified(!!row.gstin);
    setIsGstLoading(false);
    setGstAutoMessage(null);

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

    // If editing commodity, load its existing quality specs
    if (tab === 'commodities') {
      setCommodityModalTab('basic');
      if (Array.isArray(row.qualityParameters) && row.qualityParameters.length > 0) {
        const loadedSpecs: CommoditySpecState[] = row.qualityParameters.map((param: any, idx: number) => ({
          id: `spec-row-${idx}`,
          name: param.name,
          unit: param.unit || '%',
          standardValue: param.standardValue ?? 10,
          tolerance: param.tolerance ?? 1,
          minLimit: param.minLimit ?? '',
          maxLimit: param.maxLimit ?? '',
          direction: param.direction || 'HIGHER_IS_WORSE',
          hasRebateRule: true,
          rebateType: 'Standard Rebate',
          calculationMethod: 'Pro-Rata',
          rebateBasis: 'Per % Deviation',
          rebateRate: 200,
          slabs: [],
          status: 'Active'
        }));
        setCommoditySpecs(loadedSpecs);
      } else {
        setCommoditySpecs(getDefaultSpecsForCategory(row.category || 'Grains'));
      }
    }

    setLocation(row.location || '');
    setCapacity(row.capacityMT || 500);

    setVehicleNo(row.number || '');
    setVehicleType(row.type || 'Tata 1613 Truck');
    setDriverId(row.driverId || '');

    setLicense(row.licenseNumber || '');

    setIsAddOpen(true);
  };

  const handleAddMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateStr = new Date().toISOString().split('T')[0];

    if (activeTab === 'commodities') {
      if (!name) {
        showToast('Please enter commodity name', 'error');
        return;
      }

      const qualityParametersPayload: CommodityQualityParam[] = commoditySpecs
        .filter(s => s.name.trim() !== '')
        .map(s => ({
          name: s.name.trim(),
          unit: s.unit || '%',
          standardValue: Number(s.standardValue || 0),
          tolerance: Number(s.tolerance || 0),
          minLimit: s.minLimit !== '' ? Number(s.minLimit) : undefined,
          maxLimit: s.maxLimit !== '' ? Number(s.maxLimit) : undefined,
          direction: s.direction
        }));

      const qualityRebateRulesPayload = commoditySpecs
        .filter(s => s.name.trim() !== '' && s.hasRebateRule)
        .map(s => ({
          id: s.ruleId,
          _id: s.ruleId,
          ruleCode: s.ruleCode,
          parameterName: s.name.trim(),
          unit: s.unit || '%',
          standardValue: Number(s.standardValue || 0),
          minValue: s.minLimit !== '' ? Number(s.minLimit) : undefined,
          maxValue: s.maxLimit !== '' ? Number(s.maxLimit) : undefined,
          tolerance: Number(s.tolerance || 0),
          rebateType: s.rebateType,
          calculationMethod: s.calculationMethod,
          rebateBasis: s.rebateBasis,
          rebateRate: Number(s.rebateRate || 0),
          slabs: s.slabs || [],
          direction: s.direction,
          effectiveFrom: s.effectiveFrom || dateStr,
          effectiveTo: s.effectiveTo || undefined,
          status: s.status,
          notes: s.notes || `Configured for ${name}`
        }));

      const hsnToUse = hsn.trim() || (category === 'Oilseeds' ? '1207' : category === 'Pulses' ? '0713' : '1001');

      if (isEditMode && editingId) {
        const existing = db.commodities.find(c => c.id === editingId || c._id === editingId);
        if (!existing) return;

        erpService.commodities.update({
          ...existing,
          name, category, unit, hsn: hsnToUse, defaultGst,
          purchaseCost: Number(cost),
          currentMarketPrice: Number(market),
          targetPrice: Number(target),
          minStockLevel: Number(minStock),
          qualityParameters: qualityParametersPayload as any,
          qualitySpecs: qualityParametersPayload as any,
          qualityRebateRules: qualityRebateRulesPayload as any
        });

        // Sync rules with backend quality rebate rules API
        for (const rule of qualityRebateRulesPayload) {
          try {
            const rulePayload = {
              commodityId: editingId,
              commodityName: name,
              ...rule
            };
            if (rule.id) {
              await api.put(`/quality-rebate-rules/${rule.id}`, rulePayload).catch(() => null);
            } else {
              await api.post('/quality-rebate-rules', rulePayload).catch(() => null);
            }
          } catch (err) {
            console.warn('Sync rule error:', err);
          }
        }

        showToast(`Commodity "${name}" updated with ${qualityRebateRulesPayload.length} quality rebate rules`, 'success');
      } else {
        const newId = `CMD-${Date.now()}`;
        const generatedSku = `CMD-${Math.floor(100000 + Math.random() * 900000)}`;

        erpService.commodities.create({
          id: newId,
          name,
          sku: generatedSku,
          category, unit, hsn: hsnToUse, defaultGst,
          purchaseCost: Number(cost),
          currentMarketPrice: Number(market),
          targetPrice: Number(target),
          stockQty: 0, reservedQty: 0,
          minStockLevel: Number(minStock),
          qualityParameters: qualityParametersPayload as any,
          qualitySpecs: qualityParametersPayload as any,
          qualityRebateRules: qualityRebateRulesPayload as any
        });

        // Create rules in backend
        for (const rule of qualityRebateRulesPayload) {
          try {
            await api.post('/quality-rebate-rules', {
              commodityId: newId,
              commodityName: name,
              ...rule
            }).catch(() => null);
          } catch (err) {
            console.warn('Create rule error:', err);
          }
        }

        showToast(`Commodity "${name}" created with ${qualityRebateRulesPayload.length} quality rebate rules`, 'success');
      }

      setIsAddOpen(false);
      refreshDb();
      return;
    }

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
          { key: 'warehouses', label: 'Warehouses' },
          { key: 'vehicles', label: 'Vehicles' },
          { key: 'drivers', label: 'Drivers' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === t.key
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
              {
                header: 'Category',
                accessor: (row: any) => (
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${row.category === 'Oilseeds' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    row.category === 'Pulses' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                    {row.category || 'Grains'}
                  </span>
                )
              },
              { header: 'UOM Unit', accessor: 'unit' },
              { header: 'HSN code', accessor: 'hsn' },
              { header: 'Base GST (%)', accessor: (row: any) => `${row.defaultGst}%` },
              {
                header: 'Quality Specs',
                accessor: (row: any) => {
                  const paramCount = row.qualityParameters?.length || row.qualitySpecs?.length || 0;
                  return (
                    <div className="flex items-center gap-1.5">
                      {paramCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <FlaskConical size={12} className="text-emerald-600" />
                          <span>{paramCount} Parameters</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 bg-slate-100">
                          Standard Default
                        </span>
                      )}
                    </div>
                  );
                }
              },
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
                  <>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${viewingRecord.category === 'Oilseeds' ? 'bg-amber-100 text-amber-800' :
                        viewingRecord.category === 'Pulses' ? 'bg-orange-100 text-orange-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                        {viewingRecord.category}
                      </span>
                    </div>

                    {viewingRecord.unit && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">UOM Unit</p>
                        <p className="text-xs font-bold text-slate-700">{viewingRecord.unit}</p>
                      </div>
                    )}

                    {viewingRecord.defaultGst !== undefined && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GST Tax Rate</p>
                        <p className="text-xs font-bold text-slate-700">{viewingRecord.defaultGst}%</p>
                      </div>
                    )}

                    {/* QUALITY PARAMETERS FOR THIS COMMODITY */}
                    <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <FlaskConical size={16} className="text-emerald-600" />
                          <h4 className="text-xs font-bold text-slate-800">Configured Quality Specifications</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">
                          {(viewingRecord.qualityParameters?.length || viewingRecord.qualitySpecs?.length || 0)} Parameters
                        </span>
                      </div>

                      {Array.isArray(viewingRecord.qualityParameters) && viewingRecord.qualityParameters.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {viewingRecord.qualityParameters.map((p: any, idx: number) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                              <p className="font-bold text-slate-800">{p.name}</p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                Std: {p.standardValue ?? '-'} {p.unit || '%'} | Tol: &plusmn;{p.tolerance ?? 0} {p.unit || '%'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-3 text-slate-400 text-xs">
                          Standard default quality parameters apply. Click &quot;Edit Record&quot; to configure custom parameters.
                        </div>
                      )}
                    </div>
                  </>
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className={`w-full ${activeTab === 'commodities' ? 'max-w-4xl' : 'max-w-xl'} bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-zoom-in my-auto flex flex-col max-h-[90vh]`}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                {activeTab === 'commodities' && (
                  <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                    <FlaskConical size={18} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isEditMode ? 'Edit' : 'Register New'} Master Entry: <span className="capitalize">{activeTab === 'commodities' ? 'Commodity & Quality Specifications' : activeTab}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {activeTab === 'commodities'
                      ? 'Configure commodity properties, laboratory testing standards, and deviation rebate deduction slabs.'
                      : `${isEditMode ? 'Update' : 'Define'} core properties for system operations directories.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Commodity Sub-Tabs Header */}
            {activeTab === 'commodities' && (
              <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 gap-2">
                <button
                  type="button"
                  onClick={() => setCommodityModalTab('basic')}
                  className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${commodityModalTab === 'basic'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Building2 size={13} />
                  <span>1. Basic & Commercial Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommodityModalTab('quality')}
                  className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${commodityModalTab === 'quality'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <FlaskConical size={13} />
                  <span>2. Quality Parameters & Standards</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {commoditySpecs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommodityModalTab('rebate')}
                  className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${commodityModalTab === 'rebate'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Scale size={13} />
                  <span>3. Rebate Rules & Slabs</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold">
                    {commoditySpecs.filter(s => s.hasRebateRule).length}
                  </span>
                </button>
              </div>
            )}

            <form onSubmit={handleAddMaster} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Partner Profiles (Customers, Suppliers, Farmers) fields */}
              {(activeTab === 'customers' || activeTab === 'suppliers' || activeTab === 'farmers') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {activeTab === 'farmers' ? 'Farmer Full Name *' : 'Company Name *'}
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={name}
                        onChange={e => {
                          setName(e.target.value);
                          setCompanyName(e.target.value);
                        }}
                        placeholder={activeTab === 'farmers' ? 'e.g. Ramesh Kumar' : 'e.g. Patanjali Agro Foods Ltd'}
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
                    <div className="space-y-1.5 p-3 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={13} className="text-emerald-600" />
                          <span>GSTIN REGISTRATION NUMBER *</span>
                        </label>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                          <Zap size={11} className="text-emerald-700" />
                          <span>API Auto-Fill Enabled</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            maxLength={15}
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold uppercase transition focus:outline-none ${
                              gstVerified 
                                ? 'border-emerald-500 bg-white text-emerald-900 ring-2 ring-emerald-500/20' 
                                : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                            }`}
                            value={gstin}
                            onChange={e => {
                              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                              setGstin(val);
                              setGstVerified(false);
                              setGstAutoMessage(null);
                              if (val.length === 15) {
                                handleGstLookup(val);
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleGstLookup();
                              }
                            }}
                            placeholder="e.g. 10AAAFS4829K1Z4"
                            required
                          />
                          {gstVerified && (
                            <div className="absolute right-3 top-2.5 flex items-center gap-1 text-emerald-600 text-xs font-bold pointer-events-none">
                              <CheckCircle2 size={15} />
                              <span className="text-[10px]">Verified</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleGstLookup()}
                          disabled={isGstLoading || !gstin || gstin.length < 5}
                          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap ${
                            isGstLoading
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isGstLoading ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-emerald-700" />
                              <span>Fetching...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={14} />
                              <span>Fetch GST Details</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Live Feedback / Auto-Fill Status Banner */}
                      {gstAutoMessage && (
                        <div className="text-[11px] font-semibold text-emerald-800 bg-white/80 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>{gstAutoMessage}</span>
                        </div>
                      )}

                      {/* Quick demo presets */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                        <span className="text-slate-400 font-semibold">Try sample:</span>
                        {[
                          { code: '10AAACA0495L1ZZ', label: 'ARB Bearings' },
                          { code: '10AAACT5131A1ZC', label: 'Titan Company' },
                          { code: '10AAAFS4829K1Z4', label: 'Patanjali' },
                          { code: '10AAACT2727Q1ZG', label: 'Tata Steel' },
                          { code: '10AAACS8931M2Z1', label: 'Shree Ganesh' },
                          { code: '08AABCB2234K1Z2', label: 'Adani Wilmar' }
                        ].map(s => (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => {
                              setGstin(s.code);
                              handleGstLookup(s.code);
                            }}
                            className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 border border-slate-200 text-slate-600 hover:text-emerald-800 font-mono transition cursor-pointer"
                          >
                            {s.code} ({s.label})
                          </button>
                        ))}
                      </div>
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
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">PAN Card Number</label>
                        <input
                          type="text"
                          maxLength={10}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none font-mono uppercase"
                          value={pan}
                          onChange={e => setPan(e.target.value.toUpperCase())}
                          placeholder="e.g. ABCDE1234F"
                        />
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

              {/* COMMODITIES INTEGRATED MULTI-TAB BUILDER */}
              {activeTab === 'commodities' && (
                <>
                  {/* TAB 1: BASIC & COMMERCIAL */}
                  {commodityModalTab === 'basic' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-900">
                            Preset Template: Standard <strong>{category}</strong> Quality Parameters & Rebate Rules are auto-selected.
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(['Grains', 'Oilseeds', 'Pulses'] as const).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleApplyCategoryPresets(c)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${category === c
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                }`}
                            >
                              ⚡ {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Commodity Name *</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="e.g. Mustard Seeds (Sarso), Wheat (Kanak), Yellow Maize..."
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category Group *</label>
                          <select
                            value={category}
                            onChange={e => {
                              const newCat = e.target.value as any;
                              setCategory(newCat);
                              setCommoditySpecs(getDefaultSpecsForCategory(newCat));
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="Grains">Grains (Wheat, Rice, Maize)</option>
                            <option value="Oilseeds">Oilseeds (Mustard, Soyabean)</option>
                            <option value="Pulses">Pulses (Chana, Moong, Urad)</option>
                            <option value="Other">Other Agricultural Produce</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Base UOM Unit</label>
                          <select
                            value={unit}
                            onChange={e => setUnit(e.target.value as any)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="MT">Metric Ton (MT)</option>
                            <option value="Qtl">Quintal (Qtl)</option>
                            <option value="Kg">Kilogram (Kg)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">HSN / SAC Code</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono text-slate-700 focus:border-emerald-500 focus:outline-none"
                            value={hsn}
                            onChange={e => setHsn(e.target.value)}
                            placeholder="e.g. 10019910"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">GST Tax Rate (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={defaultGst}
                            onChange={e => setDefaultGst(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                            placeholder="e.g. 5"
                            required
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between">
                        <div className="text-slate-600">
                          Configure quality standards like <strong>Moisture, Oil Content, Broken Grains, Tolerances</strong> and deduction slabs in the next tabs.
                        </div>
                        <button
                          type="button"
                          onClick={() => setCommodityModalTab('quality')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition"
                        >
                          <span>Quality Standards &rarr;</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: QUALITY PARAMETERS & STANDARDS */}
                  {commodityModalTab === 'quality' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2">
                          <FlaskConical size={16} className="text-emerald-600" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">Quality Specifications & Benchmarks</h4>
                            <p className="text-[10px] text-slate-500">Define acceptable standard values, tolerances, and rejection thresholds.</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddCustomSpec}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Add Parameter</span>
                          </button>
                        </div>
                      </div>

                      {/* Parameters Table */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 tracking-wider">
                              <tr>
                                <th className="p-3">Parameter Name *</th>
                                <th className="p-3 w-16 text-center">Unit</th>
                                <th className="p-3 w-24 text-center">Standard</th>
                                <th className="p-3 w-24 text-center">Tolerance (&plusmn;)</th>
                                <th className="p-3 w-28 text-center">Allowable Limits</th>
                                <th className="p-3 w-36">Direction</th>
                                <th className="p-3 w-12 text-center">Remove</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {commoditySpecs.map(spec => (
                                <tr key={spec.id} className="hover:bg-slate-50/50">
                                  <td className="p-2.5">
                                    <input
                                      type="text"
                                      list={`params-list-${spec.id}`}
                                      value={spec.name}
                                      onChange={e => handleUpdateSpec(spec.id, 'name', e.target.value)}
                                      placeholder="e.g. Moisture, Oil Content"
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                                      required
                                    />
                                    <datalist id={`params-list-${spec.id}`}>
                                      <option value="Moisture" />
                                      <option value="Oil Content" />
                                      <option value="Protein" />
                                      <option value="Foreign Matter" />
                                      <option value="Broken Grains" />
                                      <option value="Damaged Grains" />
                                      <option value="FFA (Free Fatty Acids)" />
                                      <option value="Sand / Silica" />
                                      <option value="Admixture" />
                                      <option value="Fungus / Aflatoxin" />
                                    </datalist>
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <input
                                      type="text"
                                      value={spec.unit}
                                      onChange={e => handleUpdateSpec(spec.id, 'unit', e.target.value)}
                                      className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-center font-mono text-xs focus:outline-none"
                                      placeholder="%"
                                    />
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={spec.standardValue}
                                      onChange={e => handleUpdateSpec(spec.id, 'standardValue', e.target.value !== '' ? Number(e.target.value) : '')}
                                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                                      placeholder="14"
                                      required
                                    />
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={spec.tolerance}
                                      onChange={e => handleUpdateSpec(spec.id, 'tolerance', e.target.value !== '' ? Number(e.target.value) : '')}
                                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center font-mono text-xs focus:outline-none"
                                      placeholder="1"
                                    />
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={spec.minLimit}
                                        onChange={e => handleUpdateSpec(spec.id, 'minLimit', e.target.value !== '' ? Number(e.target.value) : '')}
                                        className="w-12 px-1 py-1.5 border border-slate-200 rounded text-center text-[11px] font-mono"
                                        placeholder="Min"
                                        title="Minimum acceptable before rejection"
                                      />
                                      <span className="text-slate-400">-</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={spec.maxLimit}
                                        onChange={e => handleUpdateSpec(spec.id, 'maxLimit', e.target.value !== '' ? Number(e.target.value) : '')}
                                        className="w-12 px-1 py-1.5 border border-slate-200 rounded text-center text-[11px] font-mono"
                                        placeholder="Max"
                                        title="Maximum acceptable before rejection"
                                      />
                                    </div>
                                  </td>

                                  <td className="p-2.5">
                                    <select
                                      value={spec.direction}
                                      onChange={e => handleUpdateSpec(spec.id, 'direction', e.target.value as any)}
                                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 bg-white focus:outline-none"
                                    >
                                      <option value="HIGHER_IS_WORSE">&uarr; Higher is Worse (Moisture, FM)</option>
                                      <option value="LOWER_IS_WORSE">&darr; Lower is Worse (Oil, Protein)</option>
                                    </select>
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSpec(spec.id)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                      title="Remove parameter"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => setCommodityModalTab('basic')}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          &larr; Back to Basic Info
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommodityModalTab('rebate')}
                          className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition"
                        >
                          <span>Rebate Deduction Slabs &rarr;</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: REBATE RULES & DEDUCTION SLABS */}
                  {commodityModalTab === 'rebate' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scale size={16} className="text-purple-700" />
                          <div>
                            <h4 className="text-xs font-bold text-purple-950">Deviation Rebate & Deduction Formulas</h4>
                            <p className="text-[10px] text-purple-700">Configure how price deductions are applied when lab test results deviate from standard benchmarks.</p>
                          </div>
                        </div>
                      </div>

                      {/* Rule cards for each parameter */}
                      <div className="space-y-4">
                        {commoditySpecs.map(spec => (
                          <div key={spec.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={spec.hasRebateRule}
                                    onChange={e => handleUpdateSpec(spec.id, 'hasRebateRule', e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-900 text-xs">
                                    Enable Rebate Rule for: <span className="text-emerald-700">{spec.name || 'Untitled Parameter'}</span>
                                  </span>
                                </label>
                                <span className="text-[10px] font-mono text-slate-400">
                                  (Std: {spec.standardValue} {spec.unit} &plusmn;{spec.tolerance})
                                </span>
                              </div>

                              {spec.hasRebateRule && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Status:</span>
                                  <select
                                    value={spec.status}
                                    onChange={e => handleUpdateSpec(spec.id, 'status', e.target.value as any)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700"
                                  >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {spec.hasRebateRule ? (
                              <div className="space-y-3 pt-1">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {/* Calculation Method Pill Buttons */}
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Calculation Method *</label>
                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateSpec(spec.id, 'calculationMethod', 'Pro-Rata')}
                                        className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition cursor-pointer text-center ${spec.calculationMethod === 'Pro-Rata'
                                          ? 'bg-purple-600 text-white shadow-xs'
                                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                          }`}
                                      >
                                        Pro-Rata
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateSpec(spec.id, 'calculationMethod', 'Discount');
                                          if (!spec.rebateRate || spec.rebateRate === 0) {
                                            handleUpdateSpec(spec.id, 'rebateRate', 2);
                                          }
                                        }}
                                        className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition cursor-pointer text-center ${spec.calculationMethod === 'Discount'
                                          ? 'bg-amber-600 text-white shadow-xs'
                                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                          }`}
                                      >
                                        Discount
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateSpec(spec.id, 'calculationMethod', 'Both')}
                                        className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition cursor-pointer text-center ${spec.calculationMethod === 'Both'
                                          ? 'bg-indigo-600 text-white shadow-xs'
                                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                          }`}
                                      >
                                        Both
                                      </button>
                                    </div>
                                  </div>

                                  {spec.calculationMethod !== 'Discount' ? (
                                    <>
                                      <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Rebate Type</label>
                                        <select
                                          value={spec.rebateType}
                                          onChange={e => handleUpdateSpec(spec.id, 'rebateType', e.target.value as any)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold focus:outline-none"
                                        >
                                          <option value="Standard Rebate">Standard Rebate (Multi-parameter)</option>
                                          <option value="Single Rebate">Single Rebate (Dedicated Spec)</option>
                                          <option value="Double Rebate">Double Rebate (Additive 2x)</option>
                                          <option value="All">All Types</option>
                                        </select>
                                      </div>

                                      <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Rebate Basis</label>
                                        <select
                                          value={spec.rebateBasis}
                                          onChange={e => handleUpdateSpec(spec.id, 'rebateBasis', e.target.value as any)}
                                          className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold focus:outline-none"
                                        >
                                          <option value="Tiered Slabs">Tiered Slabs (Per % Range)</option>
                                          <option value="Per % Deviation">Per % Deviation (Linear Rate)</option>
                                          <option value="Flat Rate per MT">Flat Rate per MT</option>
                                          <option value="Percentage of Base Rate">Percentage of Base Rate</option>
                                        </select>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="sm:col-span-2 flex items-center p-2 bg-amber-50/60 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 font-medium">
                                      <span>Direct commercial price cut mode: Quality deviations reduce PO base rate by a specified percentage or fixed flat discount.</span>
                                    </div>
                                  )}
                                </div>

                                {/* DISCOUNT CONFIGURATION PANEL (When Discount or Both is selected) */}
                                {(spec.calculationMethod === 'Discount' || spec.calculationMethod === 'Both') && (
                                  <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-yellow-50/90 p-3.5 rounded-xl border border-amber-200 space-y-2.5 animate-fade-in">
                                    <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                                      <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                                        <Percent size={14} className="text-amber-700" />
                                        <span>Commercial Discount Rate Configuration</span>
                                      </div>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                        {spec.calculationMethod === 'Discount' ? 'Direct Price Cut Mode' : 'Hybrid Discount Layer'}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                      <div>
                                        <label className="text-[10px] font-bold uppercase text-amber-950 block mb-1">
                                          Discount Value (% of Base Rate)
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <div className="relative flex-1">
                                            <input
                                              type="number"
                                              step="0.1"
                                              value={spec.rebateRate}
                                              onChange={e => handleUpdateSpec(spec.id, 'rebateRate', e.target.value !== '' ? Number(e.target.value) : '')}
                                              className="w-full p-2 pr-8 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                              placeholder="e.g. 2"
                                            />
                                            <span className="absolute right-2.5 top-2 text-xs font-bold text-amber-700">
                                              %
                                            </span>
                                          </div>

                                          {/* Preset chips */}
                                          <div className="flex items-center gap-1">
                                            {[1, 2, 3, 5].map(preset => (
                                              <button
                                                key={preset}
                                                type="button"
                                                onClick={() => handleUpdateSpec(spec.id, 'rebateRate', preset)}
                                                className={`px-2 py-1 text-[10px] font-bold rounded border transition cursor-pointer ${Number(spec.rebateRate) === preset
                                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                                  : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                                                  }`}
                                              >
                                                {preset}%
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-[11px] text-amber-900 bg-white/95 p-2.5 rounded-lg border border-amber-200 shadow-xs">
                                        <span className="font-bold block text-amber-950 mb-0.5">Live Calculation Impact:</span>
                                        <span>
                                          Deducts <strong>{Number(spec.rebateRate) || 0}%</strong> directly from agreed PO base rate (e.g. On ₹25,000/MT base &rarr; <strong>-₹{((25000 * (Number(spec.rebateRate) || 0)) / 100).toFixed(0)}/MT</strong> cut &rarr; Net <strong>₹{(25000 * (1 - (Number(spec.rebateRate) || 0) / 100)).toFixed(0)}/MT</strong>).
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* PRO-RATA / LINEAR RATE BUILDER (When not Tiered Slabs and not Discount-only) */}
                                {spec.calculationMethod !== 'Discount' && spec.rebateBasis !== 'Tiered Slabs' && (
                                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                                        Deduction Rate ({spec.rebateBasis === 'Percentage of Base Rate' ? '%' : '₹/MT'})
                                      </label>
                                      <input
                                        type="number"
                                        value={spec.rebateRate}
                                        onChange={e => handleUpdateSpec(spec.id, 'rebateRate', e.target.value !== '' ? Number(e.target.value) : '')}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-800 focus:outline-none"
                                        placeholder="e.g. 250"
                                      />
                                    </div>
                                    <div className="flex items-center text-xs text-slate-500 pt-3">
                                      <span>Applied proportionally for every unit deviation beyond tolerance limit.</span>
                                    </div>
                                  </div>
                                )}

                                {/* TIERED SLABS BUILDER (When Pro-Rata or Both and Tiered Slabs) */}
                                {spec.calculationMethod !== 'Discount' && spec.rebateBasis === 'Tiered Slabs' && (
                                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                        Deviation Rebate Tiered Slabs
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleAddSlabToSpec(spec.id)}
                                        className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                                      >
                                        <Plus size={12} /> Add Tier Slab
                                      </button>
                                    </div>

                                    <div className="space-y-1.5">
                                      {spec.slabs.map((slab, slabIdx) => (
                                        <div key={slabIdx} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400">From</span>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={slab.minDeviation}
                                              onChange={e => handleUpdateSpecSlab(spec.id, slabIdx, 'minDeviation', Number(e.target.value))}
                                              className="w-14 p-1 border border-slate-200 rounded text-center font-mono font-bold"
                                            />
                                            <span className="text-[10px] text-slate-400">% to</span>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={slab.maxDeviation}
                                              onChange={e => handleUpdateSpecSlab(spec.id, slabIdx, 'maxDeviation', Number(e.target.value))}
                                              className="w-14 p-1 border border-slate-200 rounded text-center font-mono font-bold"
                                            />
                                            <span className="text-[10px] text-slate-400">%</span>
                                          </div>

                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400">
                                              {spec.rebateBasis === 'Percentage of Base Rate' ? 'Rate: ' : 'Rate: ₹'}
                                            </span>
                                            <input
                                              type="number"
                                              step={spec.rebateBasis === 'Percentage of Base Rate' ? '0.1' : '1'}
                                              value={slab.rebateRate}
                                              onChange={e => handleUpdateSpecSlab(spec.id, slabIdx, 'rebateRate', Number(e.target.value))}
                                              className="w-16 p-1 border border-slate-200 rounded text-center font-mono font-bold text-emerald-700"
                                            />
                                            <span className="text-[10px] text-slate-400">
                                              {spec.rebateBasis === 'Percentage of Base Rate' ? '% of Base' : spec.rebateBasis === 'Flat Rate per MT' ? 'Flat/MT' : '/MT'}
                                            </span>
                                          </div>

                                          <div className="flex-1 min-w-[120px]">
                                            <input
                                              type="text"
                                              value={slab.description || ''}
                                              onChange={e => handleUpdateSpecSlab(spec.id, slabIdx, 'description', e.target.value)}
                                              placeholder="Description (optional)"
                                              className="w-full p-1 border border-slate-200 rounded text-[11px] text-slate-600"
                                            />
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSpecSlab(spec.id, slabIdx)}
                                            className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                            title="Delete slab"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic py-1">
                                Rebate deduction policy is disabled for {spec.name}. Check the box above to configure price deductions for this parameter.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => setCommodityModalTab('quality')}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          &larr; Back to Quality Standards
                        </button>
                        <div className="text-xs text-slate-500 font-semibold">
                          Ready to register {name || 'commodity'} with {commoditySpecs.filter(s => s.hasRebateRule).length} active rebate rules.
                        </div>
                      </div>
                    </div>
                  )}
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
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{isEditMode ? 'Save Changes & Sync Rules' : 'Register Commodity & Rules'}</span>
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
