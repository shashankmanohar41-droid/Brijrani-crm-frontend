'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useErp } from '../../context/ErpContext';
import { erpService } from '../../services/erpService';
import api from '../../services/axios';
import DataTable from '../../components/shared/DataTable';
import { Plus, Database, UserCheck, ShieldAlert, CheckCircle, Trash2, Edit3, Eye, X, Building2, Phone, Mail, MapPin, CreditCard, Landmark, FlaskConical, Settings } from 'lucide-react';

function MastersHubPageContent() {
  const searchParams = useSearchParams();
  const { db, refreshDb, showToast } = useErp();

  const tabQuery = searchParams.get('tab') as 'customers' | 'suppliers' | 'farmers' | 'commodities' | 'qualitySpecs' | 'warehouses' | 'bins' | 'vehicles' | 'drivers';
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'farmers' | 'commodities' | 'qualitySpecs' | 'warehouses' | 'bins' | 'vehicles' | 'drivers'>(tabQuery || 'customers');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Quality Specification States
  const [specsList, setSpecsList] = useState<any[]>([
    { _id: '1', commodityId: db.commodities[0]?.id || 'CMD-001', parameterName: 'Moisture', limitType: '<=', maxLimit: 14, unit: '%', isOptional: false },
    { _id: '2', commodityId: db.commodities[0]?.id || 'CMD-001', parameterName: 'Foreign Material', limitType: '<=', maxLimit: 2, unit: '%', isOptional: false }
  ]);
  const [specCommodityId, setSpecCommodityId] = useState('');
  const [specParamName, setSpecParamName] = useState('');
  const [specLimitType, setSpecLimitType] = useState<'<=' | '>=' | 'Range' | '=' | 'Text'>('<=');
  const [specMinLimit, setSpecMinLimit] = useState<number | ''>('');
  const [specMaxLimit, setSpecMaxLimit] = useState<number | ''>('');
  const [specTextValue, setSpecTextValue] = useState('');
  const [specTolerance, setSpecTolerance] = useState<number | ''>('');
  const [specUnit, setSpecUnit] = useState('%');
  const [specIsOptional, setSpecIsOptional] = useState(false);

  // Sync activeTab state with URL tab changes (essential for redirects like Bins & Racks)
  useEffect(() => {
    if (tabQuery) {
      setActiveTab(tabQuery);
    }
  }, [tabQuery]);

  // Load backend specs on mount
  useEffect(() => {
    api.get('/procurement/quality-inspections/specs')
      .then(res => {
        if (res.data?.data && res.data.data.length > 0) {
          setSpecsList(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specCommodityId || !specParamName || !specUnit) {
      showToast('Please fill all required specification fields', 'error');
      return;
    }
    const newSpec = {
      _id: `SPEC-${Date.now()}`,
      commodityId: specCommodityId,
      parameterName: specParamName,
      limitType: specLimitType,
      minLimit: specMinLimit !== '' ? Number(specMinLimit) : undefined,
      maxLimit: specMaxLimit !== '' ? Number(specMaxLimit) : undefined,
      textValue: specTextValue,
      tolerancePercent: specTolerance !== '' ? Number(specTolerance) : undefined,
      unit: specUnit,
      isOptional: specIsOptional
    };

    try {
      await api.post('/procurement/quality-inspections/specs', newSpec);
    } catch {}

    setSpecsList(prev => [...prev, newSpec]);
    showToast('Quality Specification constraint added successfully', 'success');
    setSpecParamName('');
    setSpecMinLimit('');
    setSpecMaxLimit('');
    setSpecTextValue('');
    setSpecTolerance('');
  };

  const handleDeleteSpec = async (id: string) => {
    if (!confirm('Are you sure you want to remove this specification constraint?')) return;
    try {
      await api.delete(`/procurement/quality-inspections/specs/${id}`);
    } catch {}
    setSpecsList(prev => prev.filter(s => s._id !== id && s.id !== id));
    showToast('Specification constraint removed', 'success');
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
          { key: 'qualitySpecs', label: 'Quality Specs Master' },
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

        {activeTab === 'qualitySpecs' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full animate-fade-in">
            {/* Form Left Column */}
            <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Settings size={18} className="text-emerald-600" />
                <span>Configure Commodity Specifications</span>
              </h3>
              <p className="text-xs text-slate-400">
                Establish laboratory quality parameters, acceptable tolerances, and rejection rules per agricultural commodity.
              </p>

              <form onSubmit={handleSaveSpec} className="space-y-3.5 pt-1">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Select Commodity *</label>
                  <select 
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
                    value={specCommodityId}
                    onChange={(e) => setSpecCommodityId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Commodity --</option>
                    {db.commodities.map(c => (
                      <option key={c.id} value={c.id || c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Parameter Name *</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                    placeholder="e.g. Moisture, Foreign Material, Admixture"
                    value={specParamName}
                    onChange={e => setSpecParamName(e.target.value)}
                    required
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { name: 'Moisture', type: '<=', max: 12.0, unit: '%' },
                      { name: 'Foreign Material', type: '<=', max: 1.5, unit: '%' },
                      { name: 'Broken Grains', type: '<=', max: 3.0, unit: '%' },
                      { name: 'Damaged Grains', type: '<=', max: 2.0, unit: '%' },
                      { name: 'Admixture', type: '<=', max: 1.0, unit: '%' }
                    ].map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSpecParamName(p.name);
                          setSpecLimitType(p.type as any);
                          setSpecMaxLimit(p.max);
                          setSpecMinLimit('');
                          setSpecUnit(p.unit);
                        }}
                        className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-2 py-1 rounded-md border border-slate-200 transition font-medium cursor-pointer"
                      >
                        + {p.name} (&le; {p.max}{p.unit})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Constraint Type *</label>
                    <select 
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                      value={specLimitType}
                      onChange={(e) => setSpecLimitType(e.target.value as any)}
                      required
                    >
                      <option value="<=">&lt;= Max Allowed</option>
                      <option value=">=">&gt;= Min Required</option>
                      <option value="Range">Range Limit</option>
                      <option value="=">Exact Value</option>
                      <option value="Text">Text Check</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Unit *</label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                      placeholder="e.g. %, mm, Grade"
                      value={specUnit}
                      onChange={e => setSpecUnit(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {specLimitType === 'Range' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Min Value *</label>
                      <input 
                        type="number" 
                        step="any"
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                        value={specMinLimit}
                        onChange={e => setSpecMinLimit(e.target.value !== '' ? Number(e.target.value) : '')}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Max Value *</label>
                      <input 
                        type="number" 
                        step="any"
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                        value={specMaxLimit}
                        onChange={e => setSpecMaxLimit(e.target.value !== '' ? Number(e.target.value) : '')}
                        required
                      />
                    </div>
                  </div>
                ) : specLimitType === 'Text' || specLimitType === '=' ? (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Compare Value *</label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                      placeholder="e.g. Bright Yellow, 12"
                      value={specTextValue}
                      onChange={e => setSpecTextValue(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Limit Boundary *</label>
                    <input 
                      type="number" 
                      step="any"
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                      value={specMinLimit || specMaxLimit}
                      onChange={e => {
                        setSpecMinLimit(e.target.value !== '' ? Number(e.target.value) : '');
                        setSpecMaxLimit(e.target.value !== '' ? Number(e.target.value) : '');
                      }}
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" 
                    id="opt-master"
                    checked={specIsOptional}
                    onChange={e => setSpecIsOptional(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="opt-master" className="text-xs text-slate-600 cursor-pointer font-medium">
                    Flag as Optional Parameter (Trigger WARN instead of FAIL rejection)
                  </label>
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md shadow-emerald-600/10 cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Add Specification Constraint</span>
                </button>
              </form>
            </div>

            {/* Specs Master Log Table */}
            <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <FlaskConical size={18} className="text-indigo-600" />
                  <span>Quality Specifications Master Log</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {specsList.length} Active Rules
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                      <th className="py-2.5 px-3">Commodity</th>
                      <th className="py-2.5 px-3">Parameter Name</th>
                      <th className="py-2.5 px-3">Constraint Limit</th>
                      <th className="py-2.5 px-3">Breach Policy</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                          No quality specifications configured yet. Add your first commodity parameter on the left.
                        </td>
                      </tr>
                    ) : (
                      specsList.map(s => {
                        const comm = db.commodities.find(c => c.id === s.commodityId || c._id === s.commodityId);
                        const limitLabel = s.limitType === 'Range' 
                          ? `${s.minLimit} - ${s.maxLimit} ${s.unit}` 
                          : `${s.limitType} ${s.maxLimit !== undefined ? s.maxLimit : s.minLimit !== undefined ? s.minLimit : s.textValue} ${s.unit}`;
                        return (
                          <tr key={s._id || s.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                            <td className="py-3 px-3 font-bold text-slate-800">{comm ? comm.name : 'All / ' + s.commodityId}</td>
                            <td className="py-3 px-3 font-semibold text-slate-700">{s.parameterName}</td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-600">{limitLabel}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                s.isOptional 
                                  ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                  : 'bg-red-50 text-red-600 border-red-200'
                              }`}>
                                {s.isOptional ? 'Warn only' : 'Mandatory (FAIL)'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button 
                                onClick={() => handleDeleteSpec(s._id || s.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Delete constraint"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
