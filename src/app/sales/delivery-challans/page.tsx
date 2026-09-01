'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { DeliveryChallan } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Truck, Plus, CheckCircle, Navigation, FilePlus } from 'lucide-react';

function DeliveryChallansPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedDC, setSelectedDC] = useState<DeliveryChallan | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [soId, setSoId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const packingOrders = db.salesOrders.filter(s => s.status === 'Packing' || s.status === 'Picking');
  const vehicles = db.vehicles.filter(v => v.status === 'Available');
  const drivers = db.drivers.filter(d => d.status === 'Active');
  const commodities = db.commodities;

  const filteredChallans = statusFilter === 'All'
    ? db.deliveryChallans
    : db.deliveryChallans.filter(d => d.status === statusFilter);

  // Handle URL query parameters
  const soQuery = searchParams.get('so');
  useEffect(() => {
    if (soQuery) {
      setSoId(soQuery);
      const order = db.salesOrders.find(s => s.id === soQuery);
      if (order) {
        setDeliveryAddress(order.deliveryLocation);
        setIsCreateOpen(true);
      }
    }
  }, [soQuery, db.salesOrders]);

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!soId || !vehicleId || !driverId) {
      showToast('Please select an order, vehicle and driver', 'error');
      return;
    }

    const order = db.salesOrders.find(s => s.id === soId);
    const vehicle = db.vehicles.find(v => v.id === vehicleId);
    const driver = db.drivers.find(d => d.id === driverId);

    if (!order || !vehicle || !driver) return;

    erpService.dispatchOrder(
      order.id,
      vehicle.number,
      driver.name,
      deliveryAddress
    );

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Delivery Challan generated successfully. Order is on route!`, 'success');
    router.push('/logistics/dispatch');
  };

  const columns: any[] = [
    { header: 'Challan Number', accessor: 'dcNo' as keyof DeliveryChallan, sortable: true },
    { header: 'Order Ref', accessor: 'soNo' as keyof DeliveryChallan },
    { 
      header: 'Customer', 
      accessor: (row: DeliveryChallan) => db.customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: DeliveryChallan) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Quantity', accessor: (row: DeliveryChallan) => `${row.quantity} MT` },
    { header: 'Vehicle Number', accessor: 'vehicleNo' as keyof DeliveryChallan },
    { 
      header: 'Status', 
      accessor: (row: DeliveryChallan) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Dispatched' ? 'bg-indigo-50 text-indigo-600 border-indigo-250' :
          'bg-amber-50 text-amber-600 border-amber-250'
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Delivery Challans</h1>
          <p className="text-xs font-medium text-slate-400">Generate dispatch challans, assign drivers/vehicles, and print transit passes.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Generate Delivery Challan</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Draft', 'Dispatched'].map(status => {
              const count = status === 'All' 
                ? db.deliveryChallans.length 
                : db.deliveryChallans.filter(d => d.status === status).length;
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
            data={filteredChallans}
            columns={columns}
            searchPlaceholder="Search challan or order..."
            searchField="dcNo"
            onRowClick={(row) => setSelectedDC(row)}
            exportFileName="delivery_challans_log"
          />
        </div>

        {/* Selected DC details */}
        <div>
          {selectedDC ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedDC.dcNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Order No: {selectedDC.soNo}</span>
              </div>

              {/* Transit assets */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-semibold text-slate-650 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-450">Vehicle Plate:</span>
                  <span>{selectedDC.vehicleNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Driver Assigned:</span>
                  <span>{selectedDC.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Volume:</span>
                  <span className="text-primary-600 font-bold">{selectedDC.quantity} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Customer Destination:</span>
                  <span className="truncate max-w-[150px]">{selectedDC.deliveryAddress}</span>
                </div>
              </div>

              {/* Transit status */}
              <div className="pt-2">
                {selectedDC.status === 'Dispatched' ? (
                  <button
                    onClick={() => router.push(`/logistics/pod?dc=${selectedDC.dcNo}`)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition animate-pulse"
                  >
                    <CheckCircle size={14} />
                    <span>Log Proof of Delivery (POD)</span>
                  </button>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[10px] text-slate-400 font-semibold leading-normal">
                    ✅ Delivery completed. Shipment handed over at destination. Invoices cleared.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Truck size={24} className="text-slate-300" />
              <span>Select a Delivery Challan row to view transit vehicle manifests and record delivery signatures.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">New Delivery Challan (Dispatch)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Authorize transit, allocate vehicles, and appoint drivers.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleDispatch} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Packing Order *</label>
                <select
                  value={soId}
                  onChange={e => {
                    setSoId(e.target.value);
                    const order = db.salesOrders.find(s => s.id === e.target.value);
                    if (order) setDeliveryAddress(order.deliveryLocation);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  required
                >
                  <option value="">Select Packing Order</option>
                  {packingOrders.map(order => (
                    <option key={order.id} value={order.id}>{order.soNo} - {db.customers.find(c => c.id === order.customerId)?.name} ({order.quantity} MT)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Vehicle */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Available Vehicle *</label>
                  <select
                    value={vehicleId}
                    onChange={e => setVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.number} - {v.type} ({v.capacityMT} MT Capacity)</option>
                    ))}
                  </select>
                </div>

                {/* Driver */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Active Driver *</label>
                  <select
                    value={driverId}
                    onChange={e => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Driver</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Address Location *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  required
                />
              </div>

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
                  Confirm Gate Out Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function DeliveryChallansPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <DeliveryChallansPageContent />
    </React.Suspense>
  );
}
