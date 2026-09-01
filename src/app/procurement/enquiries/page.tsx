'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { PurchaseEnquiry, PurchaseEnquiryItem, Commodity } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import IndianDateInput from '../../../components/shared/IndianDateInput';
import { Plus, ClipboardList, CheckCircle, Clock, Trash2, Calendar, FileText, Send, Check, Edit3, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PurchaseEnquiriesPage() {
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  
  const [selectedEnquiry, setSelectedEnquiry] = useState<PurchaseEnquiry | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Draft' | 'Pending Approval' | 'Approved' | 'RFQ Created' | 'Closed'>('All');

  // Form states for Header
  const [requiredByDate, setRequiredByDate] = useState('');
  const [department, setDepartment] = useState('Production');
  const [requestedBy, setRequestedBy] = useState('Rahul (Production Head)');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [warehouseId, setWarehouseId] = useState('');
  const [purpose, setPurpose] = useState('');

  // Form states for Items
  const [itemsList, setItemsList] = useState<PurchaseEnquiryItem[]>([]);
  const [selectedCommodityId, setSelectedCommodityId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemQty, setItemQty] = useState(0);
  const [itemRate, setItemRate] = useState(0);
  const [itemRequiredDate, setItemRequiredDate] = useState('');
  const [itemRemarks, setItemRemarks] = useState('');

  // Selectors
  const commodities = db.commodities;
  const warehouses = db.warehouses;
  const suppliers = db.suppliers;

  // Selected commodity helper
  const currentCommodity = useMemo(() => {
    return commodities.find(c => c.id === selectedCommodityId);
  }, [selectedCommodityId, commodities]);

  // RFQ Creation state
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  // Add item to draft list
  const handleAddItem = () => {
    if (!selectedCommodityId || itemQty <= 0) {
      showToast('Select a valid commodity and enter quantity', 'error');
      return;
    }
    const commodity = commodities.find(c => c.id === selectedCommodityId);
    if (!commodity) return;

    const newItem: PurchaseEnquiryItem = {
      item: commodity.id,
      sku: commodity.sku,
      description: itemDescription || commodity.name,
      quantity: itemQty,
      unit: commodity.unit,
      estimatedRate: itemRate || commodity.purchaseCost || 0,
      estimatedAmount: itemQty * (itemRate || commodity.purchaseCost || 0),
      requiredDate: itemRequiredDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remarks: itemRemarks
    };

    setItemsList(prev => [...prev, newItem]);
    
    // Clear item inputs
    setSelectedCommodityId('');
    setItemDescription('');
    setItemQty(0);
    setItemRate(0);
    setItemRequiredDate('');
    setItemRemarks('');
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenEdit = () => {
    if (!selectedEnquiry) return;
    setRequiredByDate(selectedEnquiry.requiredByDate);
    setDepartment(selectedEnquiry.department || 'Production');
    setRequestedBy(selectedEnquiry.requestedBy || 'Rahul (Production Head)');
    setPriority(selectedEnquiry.priority || 'Medium');
    setWarehouseId(selectedEnquiry.warehouseId);
    setPurpose(selectedEnquiry.purpose || '');
    setItemsList(selectedEnquiry.items || []);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleOpenView = () => {
    if (!selectedEnquiry) return;
    setRequiredByDate(selectedEnquiry.requiredByDate);
    setDepartment(selectedEnquiry.department || 'Production');
    setRequestedBy(selectedEnquiry.requestedBy || 'Rahul (Production Head)');
    setPriority(selectedEnquiry.priority || 'Medium');
    setWarehouseId(selectedEnquiry.warehouseId);
    setPurpose(selectedEnquiry.purpose || '');
    setItemsList(selectedEnquiry.items || []);
    setIsEditMode(false);
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  const handleDeleteEnquiry = () => {
    if (!selectedEnquiry) return;
    if (!confirm('Are you sure you want to delete this enquiry?')) return;
    erpService.purchaseEnquiries.delete(selectedEnquiry.id);
    refreshDb();
    setSelectedEnquiry(null);
    showToast('Purchase Enquiry deleted successfully', 'success');
  };

  // Submit Enquiry Form
  const handleCreateEnquiry = (status: 'Draft' | 'Pending Approval') => {
    if (itemsList.length === 0) {
      showToast('Please add at least one item to the enquiry', 'error');
      return;
    }
    if (!warehouseId) {
      showToast('Please select a target warehouse', 'error');
      return;
    }

    if (isEditMode && selectedEnquiry) {
      const updatedEnquiry: PurchaseEnquiry = {
        ...selectedEnquiry,
        requiredByDate: requiredByDate || selectedEnquiry.date,
        department,
        requestedBy,
        priority,
        warehouseId,
        purpose,
        status,
        items: itemsList,
        commodityId: itemsList[0]?.item || '',
        quantity: itemsList.reduce((sum, i) => sum + i.quantity, 0),
        expectedPrice: itemsList[0]?.estimatedRate || 0,
        requiredDate: itemsList[0]?.requiredDate || selectedEnquiry.requiredByDate,
        notes: purpose
      };
      erpService.purchaseEnquiries.update(updatedEnquiry);
      refreshDb();
      setIsCreateOpen(false);
      setIsEditMode(false);
      setItemsList([]);
      setPurpose('');
      setRequiredByDate('');
      setSelectedEnquiry(updatedEnquiry);
      showToast(`Purchase Enquiry ${selectedEnquiry.enquiryNo} updated successfully!`, 'success');
      return;
    }

    const enquiryNo = `PE-2026-${String(db.purchaseEnquiries.length + 1).padStart(4, '0')}`;
    const id = `PE-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const firstItem = itemsList[0];
    const totalAmount = itemsList.reduce((sum, i) => sum + i.estimatedAmount, 0);

    const newEnquiry: PurchaseEnquiry = {
      id,
      enquiryNo,
      date,
      requiredByDate: requiredByDate || date,
      department,
      requestedBy,
      priority,
      warehouseId,
      purpose,
      status,
      items: itemsList,
      // Fallbacks
      commodityId: firstItem.item,
      quantity: itemsList.reduce((sum, i) => sum + i.quantity, 0),
      expectedPrice: firstItem.estimatedRate,
      requiredDate: firstItem.requiredDate,
      notes: purpose
    };

    erpService.purchaseEnquiries.create(newEnquiry);
    refreshDb();
    setIsCreateOpen(false);
    setItemsList([]);
    setPurpose('');
    setRequiredByDate('');
    setSelectedEnquiry(newEnquiry);
    showToast(`Purchase Enquiry ${enquiryNo} created as ${status}!`, 'success');
  };

  // Manager Actions
  const handleApprove = () => {
    if (!selectedEnquiry) return;
    const updated = { ...selectedEnquiry, status: 'Approved' as const };
    erpService.purchaseEnquiries.update(updated);
    refreshDb();
    setSelectedEnquiry(updated);
    showToast(`Purchase Enquiry ${selectedEnquiry.enquiryNo} Approved!`, 'success');
  };

  const handleReject = () => {
    if (!selectedEnquiry) return;
    const updated = { ...selectedEnquiry, status: 'Cancelled' as const };
    erpService.purchaseEnquiries.update(updated);
    refreshDb();
    setSelectedEnquiry(updated);
    showToast(`Purchase Enquiry ${selectedEnquiry.enquiryNo} Cancelled/Rejected`, 'error');
  };

  // RFQ Creation workflow
  const handleToggleSupplier = (supId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supId) ? prev.filter(id => id !== supId) : [...prev, supId]
    );
  };

  const handleCreateRFQs = () => {
    if (!selectedEnquiry) return;
    if (selectedSuppliers.length === 0) {
      showToast('Select at least one supplier to send RFQ', 'error');
      return;
    }

    // For each supplier, create a quotation record in 'Sent' state
    selectedSuppliers.forEach(supId => {
      const quotationNo = `PQ/BR/2026-27/${String(db.purchaseQuotations.length + 1).padStart(3, '0')}`;
      const qId = `PQ-${Date.now()}-${Math.random().toString().slice(-4)}`;
      
      const quotationItems = selectedEnquiry.items.map(item => {
        const commodity = db.commodities.find(c => c.id === item.item || c._id === item.item);
        const gstRate = commodity?.defaultGst !== undefined ? commodity.defaultGst : 5;
        return {
          item: item.item,
          sku: item.sku,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.estimatedRate,
          discount: 0,
          taxPercent: gstRate,
          taxAmount: Math.round(item.estimatedAmount * (gstRate / 100)),
          lineTotal: Math.round(item.estimatedAmount * (1 + gstRate / 100)),
          deliveryDate: item.requiredDate
        };
      });

      const totalTax = quotationItems.reduce((sum, i) => sum + i.taxAmount, 0);
      const grandTotal = quotationItems.reduce((sum, i) => sum + i.lineTotal, 0);

      erpService.purchaseQuotations.create({
        id: qId,
        quotationNo,
        enquiryNo: selectedEnquiry.enquiryNo,
        date: new Date().toISOString().split('T')[0],
        partyType: 'supplier',
        partyId: supId,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentTerms: 'Standard Net 30',
        deliveryDays: 5,
        freight: 1500,
        discount: 0,
        tax: totalTax,
        grandTotal: grandTotal + 1500,
        status: 'Sent',
        items: quotationItems,
        // Fallbacks
        commodityId: selectedEnquiry.commodityId,
        quantity: selectedEnquiry.quantity,
        rate: selectedEnquiry.expectedPrice,
        transportCost: 1500,
        loadingCost: 0,
        otherCharges: 0,
        gstPercent: 5,
        total: grandTotal + 1500
      });
    });

    const updated = { ...selectedEnquiry, status: 'RFQ Created' as const };
    erpService.purchaseEnquiries.update(updated);
    refreshDb();
    setSelectedEnquiry(updated);
    setIsRfqModalOpen(false);
    setSelectedSuppliers([]);
    showToast(`Quotation Requests sent to ${selectedSuppliers.length} suppliers!`, 'success');
  };

  // Filters list based on tab
  const filteredEnquiries = useMemo(() => {
    if (activeTab === 'All') return db.purchaseEnquiries;
    return db.purchaseEnquiries.filter(e => e.status === activeTab);
  }, [db.purchaseEnquiries, activeTab]);

  const columns = [
    { header: 'Enquiry No', accessor: 'enquiryNo' as keyof PurchaseEnquiry, sortable: true },
    { header: 'Date', accessor: 'date' as keyof PurchaseEnquiry },
    { header: 'Department', accessor: 'department' as keyof PurchaseEnquiry },
    { header: 'Requested By', accessor: 'requestedBy' as keyof PurchaseEnquiry },
    { 
      header: 'Warehouse', 
      accessor: (row: PurchaseEnquiry) => warehouses.find(w => w.id === row.warehouseId)?.name || 'Unknown'
    },
    { 
      header: 'Priority', 
      accessor: (row: PurchaseEnquiry) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
          row.priority === 'High' ? 'bg-amber-50 text-amber-600 border-amber-200' :
          row.priority === 'Medium' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
          'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {row.priority}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: (row: PurchaseEnquiry) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
          row.status === 'RFQ Created' ? 'bg-sky-50 text-sky-600 border-sky-200' :
          row.status === 'Pending Approval' ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' :
          row.status === 'Closed' ? 'bg-slate-50 text-slate-500 border-slate-250' :
          'bg-indigo-50 text-indigo-600 border-indigo-250'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  if (!['Super Admin', 'Purchase Manager'].includes(currentUserRole)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto mt-20 space-y-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-lg font-bold">✕</div>
        <h2 className="text-sm font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-400 font-semibold leading-normal">Your account role ({currentUserRole}) does not have permission to access the Purchase Enquiries module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Purchase Enquiries</h1>
          <p className="text-xs font-medium text-slate-400">Manage internal material requests, trigger approvals, and dispatch quotation requests to suppliers.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setPurpose('');
            setRequiredByDate('');
            setDepartment('Production');
            setRequestedBy('Rahul (Production Head)');
            setPriority('Medium');
            setWarehouseId('');
            setIsEditMode(false);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Purchase Enquiry</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 rounded-lg gap-1.5">
        {(['All', 'Draft', 'Pending Approval', 'Approved', 'RFQ Created', 'Closed'] as const).map(tab => (
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

      {/* Data Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Enquiries List */}
        <div className="xl:col-span-2">
          <DataTable
            data={filteredEnquiries}
            columns={columns}
            searchPlaceholder="Search enquiry number..."
            searchField="enquiryNo"
            onRowClick={(row) => setSelectedEnquiry(row)}
            exportFileName="purchase_enquiries_list"
          />
        </div>

        {/* Selected Details Drawer */}
        <div>
          {selectedEnquiry ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedEnquiry.enquiryNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Date: {formatDate(selectedEnquiry.date)}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                  selectedEnquiry.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
                  selectedEnquiry.status === 'RFQ Created' ? 'bg-sky-50 text-sky-600 border-sky-200' :
                  selectedEnquiry.status === 'Pending Approval' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  'bg-indigo-50 text-indigo-600 border-indigo-200'
                }`}>
                  {selectedEnquiry.status.toUpperCase()}
                </span>
              </div>

              {/* Sourcing details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-slate-800">{selectedEnquiry.department}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Requested By:</span>
                  <span>{selectedEnquiry.requestedBy}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Required By:</span>
                  <span>{formatDate(selectedEnquiry.requiredByDate)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Location:</span>
                  <span>{warehouses.find(w => w.id === selectedEnquiry.warehouseId)?.name || 'N/A'}</span>
                </div>
                {selectedEnquiry.purpose && (
                  <div className="flex flex-col gap-1 text-[11px] pt-1">
                    <span className="text-slate-400">Purpose / Remarks:</span>
                    <span className="bg-slate-50 p-2 border border-slate-100 rounded text-slate-600 font-medium font-sans block italic">
                      "{selectedEnquiry.purpose}"
                    </span>
                  </div>
                )}
              </div>

              {/* Items Card list */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requested Items</span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {selectedEnquiry.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100/50 pb-2 last:border-0 last:pb-0">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {commodities.find(c => c.id === item.item)?.name || item.description}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Est. Rate: ₹{item.estimatedRate.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-700 block">{item.quantity} {item.unit}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">₹{item.estimatedAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between items-center font-bold text-xs text-slate-800">
                  <span>Estimated Total:</span>
                  <span>₹{selectedEnquiry.items.reduce((sum, i) => sum + i.estimatedAmount, 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={handleOpenView}
                    className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-slate-600/10 cursor-pointer transition"
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={handleDeleteEnquiry}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-750 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
                {(selectedEnquiry.status === 'Draft' || selectedEnquiry.status === 'Pending Approval') && (
                  <button
                    onClick={handleOpenEdit}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition mb-2"
                  >
                    <Edit3 size={14} />
                    <span>Edit Purchase Enquiry</span>
                  </button>
                )}
                {selectedEnquiry.status === 'Pending Approval' && currentUserRole === 'Super Admin' && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleApprove}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition shadow-md shadow-emerald-600/10"
                    >
                      <CheckCircle size={14} />
                      <span>Approve Request</span>
                    </button>
                    <button
                      onClick={handleReject}
                      className="flex-1 py-2 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <span>Reject</span>
                    </button>
                  </div>
                )}

                {selectedEnquiry.status === 'Approved' && (
                  <button
                    onClick={() => {
                      setSelectedSuppliers([]);
                      setIsRfqModalOpen(true);
                    }}
                    className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary-600/10 cursor-pointer transition"
                  >
                    <Send size={14} />
                    <span>Create Quotation Request (RFQ)</span>
                  </button>
                )}

                {selectedEnquiry.status === 'RFQ Created' && (
                  <button
                    onClick={() => router.push(`/procurement/quotations`)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <FileText size={14} className="text-primary-600" />
                    <span>View Supplier Quotations</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <ClipboardList size={24} className="text-slate-300" />
              <span>Select a Purchase Enquiry to view requested items, tracking timeline, and perform sourcing actions.</span>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Purchase Enquiry: ${selectedEnquiry?.enquiryNo}` : isViewMode ? `View Purchase Enquiry: ${selectedEnquiry?.enquiryNo}` : 'Draft New Purchase Enquiry'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify enquiry header details or requested items.' : isViewMode ? 'Detailed view of the purchase enquiry.' : 'Submit item requests for production, packing, or admin warehouse stocks.'}</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); setIsViewMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Header Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Warehouse Location *</label>
                  <select
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                    disabled={isViewMode}
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Required By Date *</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={requiredByDate}
                    onChange={val => setRequiredByDate(val)}
                    required
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Department</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Requested By Employee</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={requestedBy}
                    onChange={e => setRequestedBy(e.target.value)}
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    disabled={isViewMode}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Purpose / Remarks</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  rows={2}
                  placeholder="Reason for purchase enquiry..."
                  disabled={isViewMode}
                />
              </div>

              {/* Add Item Panel */}
              {!isViewMode && (
                <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Add Items to List</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Commodity *</label>
                      <select
                        value={selectedCommodityId}
                        onChange={e => {
                          setSelectedCommodityId(e.target.value);
                          const c = commodities.find(item => item.id === e.target.value);
                          if (c) {
                            setItemRate(c.purchaseCost || 0);
                          }
                        }}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                      >
                        <option value="">Select Commodity</option>
                        {commodities.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Description / Note</label>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                        value={itemDescription}
                        onChange={e => setItemDescription(e.target.value)}
                        placeholder="e.g. OPC 53 Grade"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Quantity *</label>
                      <input
                        type="number"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                        value={itemQty || ''}
                        onChange={e => setItemQty(Number(e.target.value))}
                        placeholder="Quantity"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Estimated Rate (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                        value={itemRate || ''}
                        onChange={e => setItemRate(Number(e.target.value))}
                        placeholder="Estimated Rate"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Required Date</label>
                      <IndianDateInput
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                        value={itemRequiredDate}
                        onChange={val => setItemRequiredDate(val)}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer transition shadow-md shadow-indigo-600/5"
                      >
                        + Add Item
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Items table */}
              {(isViewMode || itemsList.length > 0) && (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mt-4">
                  <table className="w-full border-collapse text-[11px] font-medium text-slate-600">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-extrabold text-[9px] tracking-wider text-left">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2 text-right">Est. Rate</th>
                        <th className="px-3 py-2 text-right">Est. Amount</th>
                        <th className="px-3 py-2">Date Needed</th>
                        {!isViewMode && <th className="px-3 py-2 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {itemsList.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-bold text-slate-800">
                            {commodities.find(c => c.id === item.item)?.name || 'Commodity'}
                            <span className="text-[9px] text-slate-400 block font-normal">{item.description}</span>
                          </td>
                          <td className="px-3 py-2 font-bold">{item.quantity} {item.unit}</td>
                          <td className="px-3 py-2 text-right">₹{item.estimatedRate.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold">₹{item.estimatedAmount.toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-500 font-semibold">{item.requiredDate}</td>
                          {!isViewMode && (
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateEnquiry('Draft')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateEnquiry('Pending Approval')}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-md shadow-primary-600/10 transition"
                    >
                      Submit for Approval
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RFQ Suppliers Modal */}
      {isRfqModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Dispatch RFQs to Suppliers</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Select commercial suppliers to send pricing requests for {selectedEnquiry?.enquiryNo}.</p>
              </div>
              <button onClick={() => setIsRfqModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Select Sourcing Partners</span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {suppliers.map(sup => (
                  <label
                    key={sup.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer text-xs font-semibold transition ${
                      selectedSuppliers.includes(sup.id)
                        ? 'border-primary-500 bg-primary-50/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-slate-800">{sup.name}</span>
                      <span className="text-[9px] text-slate-400 font-semibold">GSTIN: {sup.gstin}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes(sup.id)}
                      onChange={() => handleToggleSupplier(sup.id)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                    />
                  </label>
                ))}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsRfqModalOpen(false)}
                  className="px-4 py-2 border border-slate-250 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRFQs}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Generate Sourcing RFQs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
