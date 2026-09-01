'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import DataTable from '../../../components/shared/DataTable';
import { Printer, Truck, Plus } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

export default function LogisticsLoadingPage() {
  const { db, refreshDb, showToast } = useErp();
  const [selectedSlip, setSelectedSlip] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [soId, setSoId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [binId, setBinId] = useState('');
  const [packageType, setPackageType] = useState('Burlap Gunny Bags (50 Kg)');
  const [numPackages, setNumPackages] = useState(0);

  const commodities = db.commodities;
  const customers = db.customers;
  const pendingSO = db.salesOrders.filter((s: any) => s.status === 'Approved' || s.status === 'Picking');

  const handleSOChange = (selectedSoId: string) => {
    setSoId(selectedSoId);
    const order = db.salesOrders.find((s: any) => s.id === selectedSoId);
    if (order) {
      const match = db.stockItems.find((stk: any) => stk.commodityId === order.commodityId && stk.quantity >= order.quantity);
      if (match) {
        setBatchNo(match.batchNo);
        setBinId(match.binId);
      } else {
        setBatchNo('');
        setBinId('');
      }
      setNumPackages(order.quantity * 20); // Default estimate for 50kg bags
    } else {
      setBatchNo('');
      setBinId('');
      setNumPackages(0);
    }
  };

  const handleCreateLoadingSlip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!soId || !batchNo || !binId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    erpService.completePickingAndPacking(
      soId,
      batchNo,
      binId,
      packageType,
      Number(numPackages)
    );

    refreshDb();
    setIsCreateOpen(false);
    showToast('Loading Slip & Picking Handover created successfully!', 'success');
  };

  const columns: any[] = [
    { header: 'Packing No', accessor: 'packingNo', sortable: true },
    { header: 'Order Ref', accessor: 'soNo' },
    { 
      header: 'Client', 
      accessor: (row: any) => customers.find(c => c.id === row.customerId)?.name || 'Unknown' 
    },
    { 
      header: 'Product', 
      accessor: (row: any) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown' 
    },
    { header: 'Batch No', accessor: 'batchNo' },
    { header: 'Weight (MT)', accessor: (row: any) => `${row.quantity} MT` },
    { header: 'Bags/Packages', accessor: (row: any) => `${row.numPackages} (${row.packageType.split(' ')[0]})` },
    { header: 'Date', accessor: 'packingDate' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Loading Slips & Picking Handovers</h1>
          <p className="text-xs font-medium text-slate-400">Review packed bags, verify loading orders, and authorize fleet gate clearance.</p>
        </div>
        <button
          onClick={() => {
            setSoId('');
            setBatchNo('');
            setBinId('');
            setNumPackages(0);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Register Loading Slip</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.packingSlips || []}
            columns={columns}
            searchPlaceholder="Search packing/loading number..."
            searchField="packingNo"
            onRowClick={(row) => setSelectedSlip(row)}
            exportFileName="loading_slips_manifest"
          />
        </div>

        {/* Selected Loading Slip details */}
        <div>
          {selectedSlip ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 relative overflow-hidden">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedSlip.packingNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Order Ref: {selectedSlip.soNo}</span>
              </div>

              {/* Specific details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Corporate Client:</span>
                  <span>{customers.find(c => c.id === selectedSlip.customerId)?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Commodity loaded:</span>
                  <span className="font-bold text-slate-800">
                    {commodities.find(c => c.id === selectedSlip.commodityId)?.name || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Total Net Weight:</span>
                  <span>{selectedSlip.quantity} MT</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Packages:</span>
                  <span>{selectedSlip.numPackages} Bags</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Packaging Type:</span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-500">{selectedSlip.packageType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Batch Code:</span>
                  <span className="font-mono text-[10px] text-slate-700">{selectedSlip.batchNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prepared Date:</span>
                  <span>{formatDate(selectedSlip.packingDate)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => alert('Print job sent to gate printer.')}
                  className="flex-1 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Printer size={14} />
                  <span>Print Loading Slip</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Truck size={24} className="text-slate-300" />
              <span>Select a loading slip row to review package counts, batch codes, and print handover sheets.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Register New Loading Slip</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Locate batches, select package counts, and sign off packing orders.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateLoadingSlip} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Sales Order *</label>
                <select
                  value={soId}
                  onChange={e => handleSOChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  required
                >
                  <option value="">Select Pending Order</option>
                  {pendingSO.map((order: any) => (
                    <option key={order.id} value={order.id}>
                      {order.soNo} - {customers.find(c => c.id === order.customerId)?.name} ({order.quantity} MT)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Silo / Bin ID *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-mono text-slate-800 focus:outline-none"
                    value={binId}
                    onChange={e => setBinId(e.target.value)}
                    placeholder="e.g. BIN-PA-S01"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch Code *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-mono text-slate-800 focus:outline-none"
                    value={batchNo}
                    onChange={e => setBatchNo(e.target.value)}
                    placeholder="e.g. BAT-12345"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Packaging Option *</label>
                  <select
                    value={packageType}
                    onChange={e => setPackageType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="Burlap Gunny Bags (50 Kg)">Burlap Gunny Bags (50 Kg)</option>
                    <option value="Jumbo Bags (1 MT)">Jumbo Bags (1 MT)</option>
                    <option value="Bulk Loose Carriage">Bulk Loose Carriage</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Number of Bags *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={numPackages}
                    onChange={e => setNumPackages(Math.max(0, Number(e.target.value)))}
                    required
                  />
                </div>
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
                  Record Loading Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
