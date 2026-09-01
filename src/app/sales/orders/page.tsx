'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { SalesOrder } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { FileCheck, Plus, Layers, PackagePlus, Truck, ShieldAlert } from 'lucide-react';

function SalesOrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [freightCost, setFreightCost] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Handle URL query parameters for conversions
  const poQuery = searchParams.get('po');
  useEffect(() => {
    if (poQuery) {
      const order = db.salesOrders.find(s => s.id === poQuery);
      if (order) setSelectedSO(order);
    }
  }, [poQuery, db.salesOrders]);

  const customers = db.customers;
  const commodities = db.commodities;
  const warehouses = db.warehouses;

  const filteredOrders = statusFilter === 'All'
    ? db.salesOrders
    : db.salesOrders.filter(o => o.status === statusFilter);

  // Selected order details calculations
  const selectedCommodity = selectedSO ? commodities.find(c => c.id === selectedSO.commodityId) : null;
  const availableToSell = selectedCommodity 
    ? selectedCommodity.stockQty - selectedCommodity.reservedQty 
    : 0;

  const handleCreateSO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId || !warehouseId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    // Double check stock availability before booking
    const cmd = commodities.find(c => c.id === commodityId);
    if (cmd && (cmd.stockQty - cmd.reservedQty) < quantity) {
      showToast(`Warning: Insufficient stock available. Sourced: ${cmd.stockQty} MT | Reserved: ${cmd.reservedQty} MT | Available: ${cmd.stockQty - cmd.reservedQty} MT`, 'error');
      return;
    }

    const subtotal = quantity * rate;
    const grandTotal = Math.round((subtotal + Number(freightCost)) * 1.05);

    const so = erpService.createSalesOrder({
      date: new Date().toISOString().split('T')[0],
      customerId,
      commodityId,
      quantity,
      rate,
      gstPercent: 5,
      freightCost: Number(freightCost),
      total: grandTotal,
      warehouseId,
      deliveryLocation,
      expectedDispatch: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 15 Days',
      notes
    });

    refreshDb();
    setIsCreateOpen(false);
    setSelectedSO(so);
    showToast(`Sales Order ${so.soNo} approved. Stock reservation locked!`, 'success');
  };

  const columns: any[] = [
    { header: 'SO Number', accessor: 'soNo' as keyof SalesOrder, sortable: true },
    { 
      header: 'Customer Name', 
      accessor: (row: SalesOrder) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: SalesOrder) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Volume (MT)', accessor: 'quantity' as keyof SalesOrder },
    { header: 'Dispatch Date', accessor: 'expectedDispatch' as keyof SalesOrder },
    { 
      header: 'Total Value', 
      accessor: (row: SalesOrder) => `₹${row.total.toLocaleString()}`
    },
    { 
      header: 'Status', 
      accessor: (row: SalesOrder) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Shipped' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          row.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
          row.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Orders</h1>
          <p className="text-xs font-medium text-slate-400">Manage buyer agreements, monitor warehouse stock reserves, and authorize dispatches.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record New Sales Order</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Draft', 'Pending Approval', 'Approved', 'Shipped', 'Completed', 'Cancelled'].map(status => {
              const count = status === 'All' 
                ? db.salesOrders.length 
                : db.salesOrders.filter(o => o.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === status 
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40 font-extrabold' 
                      : 'hover:text-slate-700'
                  }`}
                >
                  {status} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          <DataTable
            data={filteredOrders}
            columns={columns}
            searchPlaceholder="Search SO number..."
            searchField="soNo"
            onRowClick={(row) => setSelectedSO(row)}
            exportFileName="sales_orders_register"
          />
        </div>

        {/* Details card */}
        <div>
          {selectedSO ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedSO.soNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Order Date: {formatDate(selectedSO.date)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{selectedSO.total.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block font-semibold">Includes 5% GST</span>
                </div>
              </div>

              {/* Physical Inventory status */}
              {selectedCommodity && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Warehouse Inventory Check</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-650">
                    <span>Sourced: {selectedCommodity.stockQty} MT</span>
                    <span>Reserved: {selectedCommodity.reservedQty} MT</span>
                    <span className="col-span-2 border-t border-slate-200/60 pt-1.5 flex justify-between font-bold text-slate-800">
                      <span>Available to Sell:</span>
                      <span className={availableToSell >= selectedSO.quantity ? 'text-emerald-600' : 'text-red-600'}>
                        {availableToSell} MT
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* General details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Customer Name:</span>
                  <span>{customers.find(c => c.id === selectedSO.customerId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Warehouse Source:</span>
                  <span>{warehouses.find(w => w.id === selectedSO.warehouseId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Delivery Address:</span>
                  <span className="truncate max-w-[150px]">{selectedSO.deliveryLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Exp Dispatch:</span>
                  <span>{selectedSO.expectedDispatch}</span>
                </div>
              </div>

              {/* Workflow transitions */}
              <div className="pt-2">
                {selectedSO.status === 'Approved' ? (
                  <button
                    onClick={() => router.push(`/sales/picking?so=${selectedSO.id}`)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
                  >
                    <PackagePlus size={14} />
                    <span>Issue Picking & Packing Slip</span>
                  </button>
                ) : selectedSO.status === 'Packing' || selectedSO.status === 'Picking' ? (
                  <button
                    onClick={() => router.push(`/sales/delivery-challans?action=new&so=${selectedSO.id}`)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <Truck size={14} />
                    <span>Issue Delivery Challan</span>
                  </button>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[10px] text-slate-400 font-semibold">
                    Order processed. Invoicing and E-way bill generation completed.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Layers size={24} className="text-slate-300" />
              <span>Select a Sales Order row to view details, verify bin availabilities, and issue picking slips.</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Record Sales Order Bookings</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Approve direct customer orders and lock stock balances.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSO} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer Name *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Product Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Stock: {c.stockQty} MT)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selling Rate per MT (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={rate}
                    onChange={e => setRate(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sourcing Warehouse *</label>
                  <select
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Freight Cost (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={freightCost}
                    onChange={e => setFreightCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Address *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  value={deliveryLocation}
                  onChange={e => setDeliveryLocation(e.target.value)}
                  placeholder="e.g. Fatuha Factory Gate 1, Patna"
                  required
                />
              </div>

              {/* Sourcing capacity warning */}
              {commodityId && (
                <div className="bg-slate-50 border border-slate-250 rounded-lg p-3 text-xs flex justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-450 uppercase block font-bold">Stock Capacity</span>
                    <span>Sourced: {commodities.find(c => c.id === commodityId)?.stockQty} MT</span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-[9px] text-slate-450 uppercase block font-bold">Unreserved Space</span>
                    <span className="font-bold text-slate-700">
                      {(commodities.find(c => c.id === commodityId)?.stockQty || 0) - (commodities.find(c => c.id === commodityId)?.reservedQty || 0)} MT
                    </span>
                  </div>
                </div>
              )}

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Confirm Order Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function SalesOrdersPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <SalesOrdersPageContent />
    </React.Suspense>
  );
}
