'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { SalesOrder } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Package, Plus, ClipboardList, LayoutList, Navigation, CheckCircle } from 'lucide-react';

function PickingPackingPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [isPackOpen, setIsPackOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Packing Form states
  const [batchNo, setBatchNo] = useState('');
  const [binId, setBinId] = useState('');
  const [packageType, setPackageType] = useState('Burlap Gunny Bags (50 Kg)');
  const [numPackages, setNumPackages] = useState(0);

  const pendingSO = db.salesOrders.filter(s => s.status === 'Approved' || s.status === 'Picking');
  const stockItems = db.stockItems;
  const commodities = db.commodities;

  const filteredSO = statusFilter === 'All'
    ? pendingSO
    : pendingSO.filter(s => s.status === statusFilter);

  // Search Param Trigger
  const soQuery = searchParams.get('so');
  useEffect(() => {
    if (soQuery) {
      const order = db.salesOrders.find(s => s.id === soQuery);
      if (order) {
        setSelectedSO(order);
        // Find a suitable stock item matching commodity
        const match = stockItems.find(stk => stk.commodityId === order.commodityId && stk.quantity >= order.quantity)
          || stockItems.find(stk => stk.commodityId === order.commodityId);
        if (match) {
          setBatchNo(match.batchNo);
          setBinId(match.binId);
        }
        setIsPackOpen(true);
      }
    }
  }, [soQuery, db.salesOrders, stockItems]);

  // Auto-calculate package count based on order volume & bag type
  useEffect(() => {
    if (selectedSO) {
      let bagWeightKg = 50;
      if (packageType.includes('100 Kg')) bagWeightKg = 100;
      else if (packageType.includes('50 Kg')) bagWeightKg = 50;
      else if (packageType.includes('Bulk')) bagWeightKg = Math.max(1, (selectedSO.quantity || 1) * 1000);
      
      const calculated = Math.max(1, Math.round(((selectedSO.quantity || 1) * 1000) / bagWeightKg));
      setNumPackages(calculated);
    }
  }, [selectedSO, packageType]);

  const handlePack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSO || !batchNo) {
      showToast('Please select a storage batch', 'error');
      return;
    }

    const match = stockItems.find(stk => stk.batchNo === batchNo);
    const resolvedBin = match?.binId || binId || 'BIN-001';

    erpService.completePickingAndPacking(
      selectedSO.id,
      batchNo,
      resolvedBin,
      packageType,
      Number(numPackages) || 1
    );

    refreshDb();
    setIsPackOpen(false);
    showToast(`Picking and Packing slips completed for ${selectedSO.soNo}. Ready for transit!`, 'success');
    router.push(`/sales/delivery-challans?action=new&so=${selectedSO.id}`);
  };

  const columns: any[] = [
    { header: 'Order Ref', accessor: 'soNo' as keyof SalesOrder, sortable: true },
    { 
      header: 'Commodity', 
      accessor: (row: SalesOrder) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Order Volume', accessor: (row: SalesOrder) => `${row.quantity} MT` },
    { 
      header: 'Warehouse Sourced', 
      accessor: (row: SalesOrder) => db.warehouses.find(w => w.id === row.warehouseId)?.name || 'Unknown'
    },
    { 
      header: 'Status', 
      accessor: (row: SalesOrder) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Picking' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {row.status === 'Picking' ? 'Picking In Progress' : 'Picking Pending'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Picking Slips & Packing Lists</h1>
        <p className="text-xs font-medium text-slate-400">Warehouse execution: Locate product batches on racks, pack bags, and weigh packages.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Approved', 'Picking'].map(status => {
              const count = status === 'All' 
                ? pendingSO.length 
                : pendingSO.filter(s => s.status === status).length;
              const label = status === 'All' ? 'All Pending' : status === 'Approved' ? 'Ready to Pick' : 'Picking Progress';
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
                  {label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          <DataTable
            data={filteredSO}
            columns={columns}
            searchPlaceholder="Search order number..."
            searchField="soNo"
            onRowClick={(row) => {
              setSelectedSO(row);
              const match = stockItems.find(stk => stk.commodityId === row.commodityId && stk.quantity >= row.quantity);
              if (match) {
                setBatchNo(match.batchNo);
                setBinId(match.binId);
              }
            }}
            exportFileName="picking_pending_so"
          />
        </div>

        {/* Selected SO pick checklist */}
        <div>
          {selectedSO ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">Pick List: {selectedSO.soNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Facility: {db.warehouses.find(w => w.id === selectedSO.warehouseId)?.name}
                </span>
              </div>

              {/* Recommended storage bins */}
              <div className="space-y-3 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recommended Storage Bins</span>
                
                {stockItems.filter(stk => stk.commodityId === selectedSO.commodityId && stk.quantity > 0).map(stk => (
                  <div key={stk.id} className="text-xs border-b border-slate-200/50 pb-2 last:border-0 last:pb-0 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-700 block">{db.bins.find(b => b.id === stk.binId)?.name || stk.binId}</span>
                      <span className="font-mono text-[9px] text-slate-400">Batch: {stk.batchNo}</span>
                    </div>
                    <span className="font-bold text-primary-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                      {stk.quantity} MT
                    </span>
                  </div>
                ))}
              </div>

              {/* Picking Action */}
              <button
                onClick={() => setIsPackOpen(true)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
              >
                <Package size={14} />
                <span>Confirm Picking & Packing</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <LayoutList size={24} className="text-slate-300" />
              <span>Select an order row from the table to inspect shelf storage locations and print pick lists.</span>
            </div>
          )}
        </div>
      </div>

      {/* Picking and Packing form overlay */}
      {isPackOpen && selectedSO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Confirm Picking & Packing</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Verify physical stock allocation and packaging bags counts.</p>
              </div>
              <button 
                onClick={() => setIsPackOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePack} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Batch selection */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Batch *</label>
                  <select
                    value={batchNo}
                    onChange={e => {
                      setBatchNo(e.target.value);
                      const match = stockItems.find(stk => stk.batchNo === e.target.value);
                      if (match) setBinId(match.binId);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Batch</option>
                    {stockItems.filter(stk => stk.commodityId === selectedSO.commodityId).map(stk => (
                      <option key={stk.id} value={stk.batchNo}>{stk.batchNo} ({stk.quantity} MT available)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Packaging type */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Package Type *</label>
                    <select
                      value={packageType}
                      onChange={e => setPackageType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    >
                      <option value="Burlap Gunny Bags (50 Kg)">Burlap Gunny Bags (50 Kg)</option>
                      <option value="PP Woven Bags (50 Kg)">PP Woven Bags (50 Kg)</option>
                      <option value="Jute Bags (100 Kg)">Jute Bags (100 Kg)</option>
                      <option value="Bulk Loose Container">Bulk Loose Container</option>
                    </select>
                  </div>

                  {/* Package counts */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Number of Packages *</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      value={numPackages}
                      onChange={e => setNumPackages(Math.max(1, Number(e.target.value)))}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-650 font-medium">
                Confirming picking of <span className="font-bold text-slate-800">{selectedSO.quantity} MT</span> ({numPackages} packages) of commodity for fulfillment.
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPackOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 transition"
                >
                  Approve Pick & Pack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PickingPackingPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading picking console...</div>}>
      <PickingPackingPageContent />
    </React.Suspense>
  );
}
