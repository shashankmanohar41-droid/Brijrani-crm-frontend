'use client';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import DataTable from '../../../components/shared/DataTable';
import { Truck, CheckCircle2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LogisticsDispatchPage() {
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();
  const [selectedDC, setSelectedDC] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [soId, setSoId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const commodities = db.commodities;
  const customers = db.customers;

  const packingOrders = db.salesOrders.filter((s: any) => s.status === 'Packing');
  const vehicles = db.vehicles.filter((v: any) => v.status === 'Available');
  const drivers = db.drivers.filter((d: any) => d.status === 'Active');

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!soId || !vehicleId || !driverId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const order = db.salesOrders.find(s => s.id === soId);
    const vehicle = db.vehicles.find(v => v.id === vehicleId);
    const driver = db.drivers.find(d => d.id === driverId);

    if (!order || !vehicle || !driver) return;

    // Dispatch
    erpService.dispatchOrder(
      order.id,
      vehicle.number,
      driver.name,
      deliveryAddress
    );

    // Update vehicle and driver statuses to 'On Route'
    vehicle.status = 'On Route';
    driver.status = 'On Route';
    erpService.vehicles.update(vehicle);
    erpService.drivers.update(driver);

    refreshDb();
    setIsCreateOpen(false);
    showToast(`Delivery Challan generated. Sales Invoice & E-Way Bill generated automatically!`, 'success');
  };

  const columns: any[] = [
    { header: 'Challan Number', accessor: 'dcNo', sortable: true },
    { header: 'Order Ref', accessor: 'soNo' },
    { 
      header: 'Customer', 
      accessor: (row: any) => customers.find(c => c.id === row.customerId)?.name || 'Unknown' 
    },
    { 
      header: 'Commodity', 
      accessor: (row: any) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown' 
    },
    { header: 'Qty (MT)', accessor: 'quantity' },
    { header: 'Vehicle Plate', accessor: 'vehicleNo' },
    { header: 'Driver', accessor: 'driverName' },
    { header: 'Dispatch Date', accessor: 'dispatchDate' },
    { 
      header: 'Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          'bg-blue-50 text-blue-600 border-blue-200 animate-pulse'
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Logistics Dispatches</h1>
          <p className="text-xs font-medium text-slate-400">Track active trucks, verify routes, and record delivery handovers.</p>
        </div>
        <button
          onClick={() => {
            setSoId('');
            setVehicleId('');
            setDriverId('');
            setDeliveryAddress('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Register New Dispatch</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.deliveryChallans}
            columns={columns}
            searchPlaceholder="Search challan number..."
            searchField="dcNo"
            onRowClick={(row) => setSelectedDC(row)}
            exportFileName="logistics_dispatch_manifest"
          />
        </div>

        {/* Selected Dispatch info */}
        <div>
          {selectedDC ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedDC.dcNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Order Ref: {selectedDC.soNo}</span>
              </div>

              {/* Transit manifest details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Truck Assigned:</span>
                  <span>{selectedDC.vehicleNo}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Driver Assigned:</span>
                  <span>{selectedDC.driverName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Net Quantity:</span>
                  <span>{selectedDC.quantity} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Consignee Address:</span>
                  <span className="truncate max-w-[150px]">{selectedDC.deliveryAddress}</span>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                {selectedDC.status === 'Dispatched' ? (
                  <button
                    onClick={() => router.push(`/logistics/pod?dc=${selectedDC.dcNo}`)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition animate-pulse"
                  >
                    <CheckCircle2 size={14} />
                    <span>Upload Proof of Delivery (POD)</span>
                  </button>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[10px] text-slate-400 font-semibold">
                    ✅ Delivery completed. Ledger invoiced.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Truck size={24} className="text-slate-300" />
              <span>Select a dispatch row to review route details and submit Proof of Delivery.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Register New Dispatch (Delivery Challan)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Approve vehicle gate out, assign active driver, and authorize transit.</p>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Packed Order *</label>
                <select
                  value={soId}
                  onChange={e => {
                    setSoId(e.target.value);
                    const order = db.salesOrders.find(s => s.id === e.target.value);
                    if (order) setDeliveryAddress(order.deliveryLocation);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  required
                >
                  <option value="">Select Packed Order</option>
                  {packingOrders.map((order: any) => (
                    <option key={order.id} value={order.id}>
                      {order.soNo} - {customers.find(c => c.id === order.customerId)?.name} ({order.quantity} MT)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Available Vehicle *</label>
                  <select
                    value={vehicleId}
                    onChange={e => setVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.number} - {v.type} ({v.capacityMT} MT Capacity)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Active Driver *</label>
                  <select
                    value={driverId}
                    onChange={e => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Driver</option>
                    {drivers.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.licenseType})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Consignee Address *</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  rows={3}
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Enter full shipping address..."
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
                  Record Transit Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
