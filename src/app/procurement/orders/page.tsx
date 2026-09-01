'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { PurchaseOrder, PurchaseOrderItem } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import DocumentTimeline from '../../../components/shared/DocumentTimeline';
import ApprovalPanel from '../../../components/shared/ApprovalPanel';
import { ShoppingCart, Plus, Calendar, Landmark, Info, FilePlus, Truck, FileCheck, Edit3, Download, Eye, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';

export default function PurchaseOrdersPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const router = useRouter();

  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Form states for Header
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [partyId, setPartyId] = useState('');
  const [referenceQuotation, setReferenceQuotation] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [deliveryTerms, setDeliveryTerms] = useState('Door Delivery');
  const [freight, setFreight] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [buyer, setBuyer] = useState('Purchasing Agent');
  const [department, setDepartment] = useState('Purchase');

  // Form states for items
  const [itemsList, setItemsList] = useState<PurchaseOrderItem[]>([]);
  const [selectedCommodityId, setSelectedCommodityId] = useState('');
  const [itemQty, setItemQty] = useState(0);
  const [itemRate, setItemRate] = useState(0);
  const [itemDescription, setItemDescription] = useState('');

  // Sourcing entities
  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const commodities = db.commodities;
  const warehouses = db.warehouses;

  const activeParties = partyType === 'supplier' ? suppliers : farmers;

  // Add item helper
  const handleAddItem = () => {
    if (!selectedCommodityId || itemQty <= 0 || itemRate <= 0) {
      showToast('Select a valid commodity and enter rate & quantity', 'error');
      return;
    }
    const commodity = commodities.find(c => c.id === selectedCommodityId);
    if (!commodity) return;

    const gstRate = commodity.defaultGst !== undefined ? commodity.defaultGst : 5;
    const amt = itemQty * itemRate;
    const taxAmt = Math.round(amt * (gstRate / 100));

    const newItem: PurchaseOrderItem = {
      item: commodity.id,
      description: itemDescription || commodity.name,
      quantity: itemQty,
      unit: commodity.unit,
      rate: itemRate,
      discount: 0,
      taxPercent: gstRate,
      taxAmount: taxAmt,
      amount: amt + taxAmt,
      expectedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    setItemsList(prev => [...prev, newItem]);
    
    // Clear inputs
    setSelectedCommodityId('');
    setItemQty(0);
    setItemRate(0);
    setItemDescription('');
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenEdit = () => {
    if (!selectedPO) return;
    setPartyType(selectedPO.partyType);
    setPartyId(selectedPO.partyId);
    setReferenceQuotation(selectedPO.quotationNo || '');
    setPaymentTerms(selectedPO.paymentTerms || '30 Days');
    setDeliveryTerms(selectedPO.deliveryTerms || 'Door Delivery');
    setFreight(selectedPO.freight || 0);
    setDiscount(selectedPO.discount || 0);
    setWarehouseId(selectedPO.warehouseId || '');
    setNotes(selectedPO.notes || '');
    setBuyer(selectedPO.buyer || 'Purchasing Agent');
    setDepartment(selectedPO.department || 'Purchase');
    setItemsList(selectedPO.items || []);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsCreateOpen(true);
  };

  const handleOpenView = () => {
    if (!selectedPO) return;
    setPartyType(selectedPO.partyType);
    setPartyId(selectedPO.partyId);
    setReferenceQuotation(selectedPO.quotationNo || '');
    setPaymentTerms(selectedPO.paymentTerms || '30 Days');
    setDeliveryTerms(selectedPO.deliveryTerms || 'Door Delivery');
    setFreight(selectedPO.freight || 0);
    setDiscount(selectedPO.discount || 0);
    setWarehouseId(selectedPO.warehouseId || '');
    setNotes(selectedPO.notes || '');
    setBuyer(selectedPO.buyer || 'Purchasing Agent');
    setDepartment(selectedPO.department || 'Purchase');
    setItemsList(selectedPO.items || []);
    setIsEditMode(false);
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  const handleDeletePO = () => {
    if (!selectedPO) return;
    if (!confirm('Are you sure you want to delete this Purchase Order?')) return;
    erpService.purchaseOrders.delete(selectedPO.id);
    refreshDb();
    setSelectedPO(null);
    showToast('Purchase Order deleted successfully', 'success');
  };

  // Calculate totals
  const subtotal = itemsList.reduce((sum, i) => sum + (i.quantity * i.rate), 0);
  const totalTax = itemsList.reduce((sum, i) => sum + i.taxAmount, 0);
  const totalCharges = Number(freight);
  const grandTotal = subtotal + totalTax + totalCharges - Number(discount);

  // Submit PO
  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsList.length === 0) {
      showToast('Please add at least one item to the PO', 'error');
      return;
    }
    if (!partyId || !warehouseId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    if (isEditMode && selectedPO) {
      const updatedPO: PurchaseOrder = {
        ...selectedPO,
        quotationNo: referenceQuotation || undefined,
        referenceQuotation: referenceQuotation || undefined,
        partyType,
        partyId,
        paymentTerms,
        buyer,
        department,
        deliveryTerms,
        freight: Number(freight),
        discount: Number(discount),
        tax: totalTax,
        total: grandTotal,
        notes,
        items: itemsList,
        commodityId: itemsList[0]?.item || '',
        quantity: itemsList.reduce((sum, i) => sum + i.quantity, 0),
        rate: itemsList[0]?.rate || 0,
        transportCost: Number(freight),
        warehouseId
      };
      
      const needsApproval = grandTotal > 10000;
      if (selectedPO.status === 'Draft' || selectedPO.status === 'Pending Approval') {
        updatedPO.status = needsApproval ? 'Pending Approval' : 'Approved';
      }
      
      erpService.purchaseOrders.update(updatedPO);
      refreshDb();
      setIsCreateOpen(false);
      setIsEditMode(false);
      setItemsList([]);
      setNotes('');
      setSelectedPO(updatedPO);
      showToast(`Purchase Order ${selectedPO.poNo} updated successfully!`, 'success');
      return;
    }

    const poNo = `PO/BR/2026-27/${String(db.purchaseOrders.length + 1).padStart(3, '0')}`;
    const id = `PO-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    // Determine approval limit based on PO grand total amount
    // ₹0–₹10,000: Purchase Manager | ₹10,001–₹1,00,000: Department Head | > ₹1,00,000: Finance/Director
    const needsApproval = grandTotal > 10000;
    const status = needsApproval ? 'Pending Approval' : 'Approved';

    const firstItem = itemsList[0];

    const newPO: PurchaseOrder = {
      id,
      poNo,
      quotationNo: referenceQuotation || undefined,
      referenceQuotation: referenceQuotation || undefined,
      date,
      partyType,
      partyId,
      expectedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms,
      currency: 'INR',
      buyer,
      department,
      deliveryTerms,
      freight: Number(freight),
      otherCharges: 0,
      discount: Number(discount),
      tax: totalTax,
      total: grandTotal,
      notes,
      status,
      items: itemsList,
      approvalHistory: [
        { step: 'Creation', user: currentUserRole, action: 'Created', date }
      ],
      // Fallbacks
      commodityId: firstItem.item,
      quantity: itemsList.reduce((sum, i) => sum + i.quantity, 0),
      rate: firstItem.rate,
      transportCost: Number(freight),
      gstPercent: 5,
      warehouseId
    };

    erpService.purchaseOrders.create(newPO);
    refreshDb();
    setIsCreateOpen(false);
    setItemsList([]);
    setNotes('');
    setSelectedPO(newPO);
    showToast(`Purchase Order ${poNo} created successfully! Status: ${status}`, 'success');
  };

  const handleApprove = (comment?: string) => {
    if (!selectedPO) return;
    erpService.approvePurchaseOrder(selectedPO.id, currentUserRole, comment);
    refreshDb();
    const updated = erpService.purchaseOrders.getById(selectedPO.id);
    if (updated) setSelectedPO(updated);
    showToast(`Purchase Order Approved!`, 'success');
  };

  const handleReject = (comment?: string) => {
    if (!selectedPO) return;
    erpService.rejectPurchaseOrder(selectedPO.id, currentUserRole, comment);
    refreshDb();
    const updated = erpService.purchaseOrders.getById(selectedPO.id);
    if (updated) setSelectedPO(updated);
    showToast("Purchase Order Rejected", 'error');
  };

  const handleDownloadPDF = (order: PurchaseOrder) => {
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
    doc.text("Email: procurement@brijranierp.com | Phone: +91 9988776655", 14, 29);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("OFFICIAL PURCHASE ORDER (PO)", 14, 42);

    // Metadata
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`PO Number:      ${order.poNo}`, 14, 50);
    doc.text(`PO Date:        ${formatDate(order.date)}`, 14, 56);
    doc.text(`Expected Deliv: ${formatDate(order.expectedDelivery)}`, 14, 62);
    doc.text(`Ref Quotation:  ${order.quotationNo || 'N/A'}`, 14, 68);
    doc.text(`PO Status:      ${order.status}`, 14, 74);

    const vendorName = order.partyType === 'supplier'
      ? suppliers.find(s => s.id === order.partyId)?.name
      : farmers.find(f => f.id === order.partyId)?.name;
    const vendorGSTIN = order.partyType === 'supplier'
      ? suppliers.find(s => s.id === order.partyId)?.gstin
      : 'Farmer (URP)';

    // Vendor Block
    doc.setFont("Helvetica", "bold");
    doc.text("VENDOR DETAILS:", 14, 86);
    doc.setFont("Helvetica", "normal");
    doc.text(vendorName || 'Unknown Vendor', 14, 92);
    doc.text(`GSTIN: ${vendorGSTIN || 'N/A'}`, 14, 98);

    const warehouseName = warehouses.find(w => w.id === order.warehouseId)?.name || 'N/A';
    doc.setFont("Helvetica", "bold");
    doc.text("DELIVER TO WAREHOUSE:", 110, 86);
    doc.setFont("Helvetica", "normal");
    doc.text(warehouseName, 110, 92);
    doc.text(`Buyer: ${order.buyer} (${order.department})`, 110, 98);

    // Items table header
    const tableTop = 108;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Ordered Item & Description", 16, tableTop + 5.5);
    doc.text("Quantity", 90, tableTop + 5.5, { align: "right" });
    doc.text("Unit Rate", 125, tableTop + 5.5, { align: "right" });
    doc.text("Discount", 150, tableTop + 5.5, { align: "right" });
    doc.text("Line Total", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Item rows
    let itemY = tableTop + 14;
    (order.items || []).forEach(item => {
      const commName = commodities.find(c => c.id === item.item)?.name || item.description;
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${item.quantity} ${item.unit}`, 90, itemY, { align: "right" });
      doc.text(`₹${(item.rate ?? 0).toLocaleString()} / ${item.unit}`, 125, itemY, { align: "right" });
      doc.text(`₹${(item.discount ?? 0).toLocaleString()}`, 150, itemY, { align: "right" });
      doc.text(`₹${(item.amount ?? 0).toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    // Summary block
    doc.line(14, itemY - 3, 196, itemY - 3);

    const summaryX = 135;
    const baseValue = (order.items || []).reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    doc.text("Base Value:", summaryX, itemY + 2);
    doc.text(`₹${baseValue.toLocaleString()}`, 194, itemY + 2, { align: "right" });

    doc.text("Freight charges:", summaryX, itemY + 8);
    doc.text(`₹${(order.freight ?? 0).toLocaleString()}`, 194, itemY + 8, { align: "right" });

    if (order.otherCharges > 0) {
      doc.text("Other charges:", summaryX, itemY + 14);
      doc.text(`₹${(order.otherCharges ?? 0).toLocaleString()}`, 194, itemY + 14, { align: "right" });
    }

    if (order.discount > 0) {
      doc.text("Discount:", summaryX, itemY + 20);
      doc.text(`-₹${(order.discount ?? 0).toLocaleString()}`, 194, itemY + 20, { align: "right" });
    }

    doc.text("GST Taxes:", summaryX, itemY + 26);
    doc.text(`₹${(order.tax ?? 0).toLocaleString()}`, 194, itemY + 26, { align: "right" });

    // Grand total
    doc.line(120, itemY + 30, 196, itemY + 30);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Grand Total:", summaryX, itemY + 35);
    doc.text(`₹${(order.total ?? 0).toLocaleString()}`, 194, itemY + 35, { align: "right" });

    // Terms
    let termsY = itemY + 50;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TERMS AND CONDITIONS:", 14, termsY);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment Terms: ${order.paymentTerms || 'Standard Terms'}`, 14, termsY + 6);
    doc.text(`Delivery Terms: ${order.deliveryTerms || 'Door Delivery'}`, 14, termsY + 12);
    if (order.notes) {
      doc.text(`Notes: ${order.notes}`, 14, termsY + 18);
    }

    // Signatures
    let sigY = termsY + 35;
    doc.setFont("Helvetica", "bold");
    doc.text("Prepared By", 14, sigY);
    doc.text("Authorized Signatory", 140, sigY);
    doc.line(14, sigY + 10, 50, sigY + 10);
    doc.line(140, sigY + 10, 185, sigY + 10);

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an official commercial purchase order of BrijRani Agro Foods Ltd.", 14, 280);

    doc.save(`purchase_order_${order.poNo.replace(/\//g, '_')}.pdf`);
    showToast(`Purchase Order PDF downloaded successfully!`, 'success');
  };

  const filterTabs = [
    { label: 'All', value: 'All' },
    { label: 'Pending Approval', value: 'Pending Approval' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Partially Received', value: 'Partially Received' },
    { label: 'Received', value: 'Received' },
    { label: 'Cancelled', value: 'Cancelled' },
  ];

  const filteredPOs = useMemo(() => {
    if (statusFilter === 'All') return db.purchaseOrders;
    return db.purchaseOrders.filter(po => po.status === statusFilter);
  }, [db.purchaseOrders, statusFilter]);

  const columns = [
    { header: 'PO Number', accessor: 'poNo' as keyof PurchaseOrder, sortable: true },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: PurchaseOrder) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { 
      header: 'Warehouse Location', 
      accessor: (row: PurchaseOrder) => warehouses.find(w => w.id === row.warehouseId)?.name || 'Unknown'
    },
    { header: 'Value', accessor: (row: PurchaseOrder) => `₹${(row.total ?? 0).toLocaleString()}` },
    { header: 'Expected Delivery', accessor: 'expectedDelivery' as keyof PurchaseOrder },
    { 
      header: 'Status', 
      accessor: (row: PurchaseOrder) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Received' || row.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
          row.status === 'Partially Received' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          row.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
          row.status === 'Pending Approval' ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' :
          'bg-slate-50 text-slate-500 border-slate-200'
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
        <p className="text-xs text-slate-400 font-semibold leading-normal">Your account role ({currentUserRole}) does not have permission to access the Purchase Orders module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Purchase Orders (PO)</h1>
          <p className="text-xs font-medium text-slate-400">Log commercial purchase orders, manage authorization limits, and record incoming cargo slips.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setNotes('');
            setPartyId('');
            setReferenceQuotation('');
            setPaymentTerms('30 Days');
            setDeliveryTerms('Door Delivery');
            setFreight(0);
            setDiscount(0);
            setWarehouseId('');
            setIsEditMode(false);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          {/* Status Filter Tabs */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1 flex-wrap">
            {filterTabs.map(tab => {
              const count = tab.value === 'All'
                ? db.purchaseOrders.length
                : db.purchaseOrders.filter(po => po.status === tab.value).length;
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
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
            data={filteredPOs}
            columns={columns}
            searchPlaceholder="Search PO number..."
            searchField="poNo"
            onRowClick={(row) => setSelectedPO(row)}
            exportFileName="purchase_orders_list"
          />
        </div>

        {/* Selected PO Details */}
        <div>
          {selectedPO ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedPO.poNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Date Created: {formatDate(selectedPO.date)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{(selectedPO.total ?? 0).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block font-semibold">Taxes: ₹{(selectedPO.tax ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Header Info */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Supplier:</span>
                  <span className="text-slate-800">
                    {selectedPO.partyType === 'supplier'
                      ? suppliers.find(s => s.id === selectedPO.partyId)?.name
                      : farmers.find(f => f.id === selectedPO.partyId)?.name}
                  </span>
                </div>
                {selectedPO.quotationNo && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Ref Quotation:</span>
                    <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">{selectedPO.quotationNo}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Warehouse:</span>
                  <span>{warehouses.find(w => w.id === selectedPO.warehouseId)?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Payment Terms:</span>
                  <span>{selectedPO.paymentTerms}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Delivery terms:</span>
                  <span>{selectedPO.deliveryTerms || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Expected Delivery:</span>
                  <span>{selectedPO.expectedDelivery}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Buyer/Agent:</span>
                  <span>{selectedPO.buyer} ({selectedPO.department})</span>
                </div>
              </div>

              {/* Items Card list */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ordered Items</span>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                  {selectedPO.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100/50 pb-2 last:border-0 last:pb-0">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {commodities.find(c => c.id === item.item)?.name || item.description}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Rate: ₹{(item.rate ?? 0).toLocaleString()} / {item.unit}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-700 block">{item.quantity} {item.unit}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">₹{(item.amount ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between items-center font-bold text-xs text-slate-800">
                  <span>Grand Total (incl Freight):</span>
                  <span>₹{(selectedPO.total ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Approval History Timeline */}
              {selectedPO.approvalHistory && selectedPO.approvalHistory.length > 0 && (
                <div className="border border-slate-150 rounded-xl p-4 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audit Log History</span>
                  <div className="space-y-2 text-[11px] font-semibold text-slate-600 leading-tight">
                    {selectedPO.approvalHistory.map((hist, idx) => (
                      <div key={idx} className="flex items-start gap-2 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                        <div className="bg-slate-100 text-slate-500 rounded p-1 text-[9px] font-mono mt-0.5">{hist.action}</div>
                        <div>
                          <div className="text-slate-800 font-bold">{hist.step}</div>
                          <div className="text-[10px] text-slate-400">by {hist.user} on {formatDate(hist.date)}</div>
                          {hist.comment && <div className="text-[10px] text-indigo-500 italic mt-0.5">"{hist.comment}"</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
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
                    onClick={handleDeletePO}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-750 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
                {(selectedPO.status === 'Draft' || selectedPO.status === 'Pending Approval') && (
                  <button
                    onClick={handleOpenEdit}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition mb-2"
                  >
                    <Edit3 size={14} />
                    <span>Edit Purchase Order</span>
                  </button>
                )}
                {selectedPO.status === 'Pending Approval' && (
                  <ApprovalPanel
                    documentId={selectedPO.id}
                    documentNo={selectedPO.poNo}
                    documentTotal={selectedPO.total}
                    approvalHistory={selectedPO.approvalHistory || []}
                    status={selectedPO.status}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                )}

                {(selectedPO.status === 'Approved' || selectedPO.status === 'Partially Received') && (
                  <button
                    onClick={() => router.push(`/procurement/grn?action=new&po=${selectedPO.id}`)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
                  >
                    <Truck size={14} />
                    <span>Record Gate Receipt (GRN)</span>
                  </button>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedPO)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download Purchase Order PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <ShoppingCart size={24} className="text-slate-300" />
              <span>Select a Purchase Order row to examine pricing structures, authorization flow, and dispatch records.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Purchase Order: ${selectedPO?.poNo}` : isViewMode ? `View Purchase Order: ${selectedPO?.poNo}` : 'Draft Ad-hoc Purchase Order (PO)'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify direct commercial purchase orders containing customized item configurations.' : isViewMode ? 'Detailed view of the purchase order.' : 'Generate direct commercial purchase orders containing customized item configurations.'}</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); setIsViewMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreatePO} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Facility Warehouse *</label>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Link Quotation Ref (Optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={referenceQuotation}
                    onChange={e => setReferenceQuotation(e.target.value)}
                    placeholder="e.g. PQ/BR/2026-27/001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supplier / Sourcing Partner *</label>
                  <select
                    value={partyId}
                    onChange={e => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Partner</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Supplier)</option>
                    ))}
                    {farmers.map(f => (
                      <option key={f.id} value={f.id}>{f.name} (Farmer)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment terms</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight Transport cost (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={freight || ''}
                    onChange={e => setFreight(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Header Discount (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={discount || ''}
                    onChange={e => setDiscount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={deliveryTerms}
                    onChange={e => setDeliveryTerms(e.target.value)}
                  />
                </div>
              </div>

              {/* Add item panel */}
              <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Configure Purchase Items</span>
                
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
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                    >
                      <option value="">Select Commodity</option>
                      {commodities.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Description</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                      value={itemDescription}
                      onChange={e => setItemDescription(e.target.value)}
                      placeholder="Special specs..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Quantity *</label>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                      value={itemQty || ''}
                      onChange={e => setItemQty(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">PO Unit rate (₹) *</label>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                      value={itemRate || ''}
                      onChange={e => setItemRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer transition shadow-md"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Items draft table */}
                {itemsList.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mt-4">
                    <table className="w-full border-collapse text-[11px] font-medium text-slate-600">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-extrabold text-[9px] tracking-wider text-left">
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Quantity</th>
                          <th className="px-3 py-2 text-right">PO Rate</th>
                          <th className="px-3 py-2 text-right">Line Total</th>
                          <th className="px-3 py-2 text-center">Action</th>
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
                            <td className="px-3 py-2 text-right">₹{item.rate.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-semibold">₹{item.amount.toLocaleString()}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Order total preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Estimated Grand Total</span>
                  <span className="text-sm font-bold text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base Items: ₹{subtotal.toLocaleString()}</span> <br />
                  <span>Freight Transport: ₹{totalCharges.toLocaleString()}</span> <br />
                  <span>GST Taxes ({itemsList.length > 0 ? Array.from(new Set(itemsList.map(i => i.taxPercent))).map(t => `${t}%`).join(', ') : '5%'}): ₹{totalTax.toLocaleString()}</span>
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
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 cursor-pointer transition"
                    >
                      Save Purchase Order
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
