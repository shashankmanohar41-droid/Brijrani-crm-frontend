'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { GRN, Bin } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Warehouse, Plus, Server, LayoutGrid, CheckCircle } from 'lucide-react';

function InwardBinningPageContent() {
  const searchParams = useSearchParams();
  const { db, refreshDb, showToast } = useErp();

  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [selectedBinId, setSelectedBinId] = useState('');

  // Handle URL query parameters for inwarding conversion
  const grnQueryParam = searchParams.get('grn');
  useEffect(() => {
    if (grnQueryParam) {
      const grn = db.grns.find(g => g.id === grnQueryParam);
      if (grn) setSelectedGRN(grn);
    }
  }, [grnQueryParam, db.grns]);

  const qcPassedGRNs = db.grns.filter(g => (g.qualityStatus === 'Passed' || g.qualityStatus === 'Partially Passed') && g.inwardStatus === 'Pending');
  const warehouses = db.warehouses;
  const commodities = db.commodities;

  // Filter bins by the selected GRN's warehouse destination and commodity type compatibility
  const availableBins = selectedGRN 
    ? db.bins.filter(b => b.warehouseId === selectedGRN.warehouseId && b.allowedCommodityId === selectedGRN.commodityId) 
    : [];

  const handleInwardStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGRN) return;
    if (!selectedBinId) {
      showToast('Please select a target bin', 'error');
      return;
    }

    const bin = db.bins.find(b => b.id === selectedBinId);
    if (bin) {
      const availableCapacity = bin.capacityMT - bin.occupiedMT;
      if (selectedGRN.acceptedQty > availableCapacity) {
        showToast(`Warning: Selected Bin has only ${availableCapacity} MT space. Cannot store ${selectedGRN.acceptedQty} MT!`, 'error');
        return;
      }
    }

    erpService.inwardStock(selectedGRN.id, selectedBinId);
    refreshDb();
    setSelectedGRN(null);
    setSelectedBinId('');
    showToast('Inventory inwarded successfully. Purchase Invoice and Ledger entries updated.', 'success');
  };

  const columns = [
    { header: 'GRN Number', accessor: 'grnNo' as keyof GRN, sortable: true },
    { 
      header: 'Commodity', 
      accessor: (row: GRN) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Inward Weight', accessor: (row: GRN) => `${row.acceptedQty} MT` },
    { 
      header: 'Warehouse', 
      accessor: (row: GRN) => warehouses.find(w => w.id === row.warehouseId)?.name || 'Unknown'
    },
    { header: 'Batch Number', accessor: 'batchNo' as keyof GRN },
    { 
      header: 'QC Result', 
      accessor: (row: GRN) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
          Passed (Score: {db.qualityInspections.find(q => q.grnId === row.id)?.qualityScore || 90})
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Inward Binning & Storage</h1>
        <p className="text-xs font-medium text-slate-400">Allocate QC-cleared bulk commodities into physical bins and update current stock levels.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">QC-Cleared Shipments Awaiting Binning</span>
          <DataTable
            data={qcPassedGRNs}
            columns={columns}
            searchPlaceholder="Search pending GRN..."
            searchField="grnNo"
            onRowClick={(row) => setSelectedGRN(row)}
            exportFileName="pending_binning_grn"
          />
        </div>

        {/* Inwarding Form panel */}
        <div>
          {selectedGRN ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">Bin Allocation: {selectedGRN.grnNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Target Facility: {warehouses.find(w => w.id === selectedGRN.warehouseId)?.name}
                </span>
              </div>

              {/* GRN details */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-semibold text-slate-600 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Commodity:</span>
                  <span>{commodities.find(c => c.id === selectedGRN.commodityId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Net Quantity:</span>
                  <span className="text-primary-600 font-bold">{selectedGRN.acceptedQty} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Batch Code:</span>
                  <span className="font-mono text-[10px]">{selectedGRN.batchNo}</span>
                </div>
              </div>

              {/* Visual Bin selector */}
              <form onSubmit={handleInwardStock} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Target Rack Bin *</label>
                  <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                    {availableBins.map(bin => {
                      const avail = bin.capacityMT - bin.occupiedMT;
                      const percent = Math.min(100, Math.round((bin.occupiedMT / bin.capacityMT) * 100));
                      const isFull = avail < selectedGRN.acceptedQty;

                      return (
                        <label
                          key={bin.id}
                          className={`block p-3 rounded-lg border text-xs cursor-pointer select-none transition ${
                            selectedBinId === bin.id
                              ? 'border-primary-600 bg-primary-50/20'
                              : isFull
                              ? 'border-slate-100 bg-slate-50/50 cursor-not-allowed opacity-50'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-center font-bold mb-1">
                            <span className="flex items-center gap-1.5 text-slate-800">
                              <LayoutGrid size={13} className="text-slate-400" />
                              {bin.name}
                            </span>
                            <input
                              type="radio"
                              name="bin"
                              value={bin.id}
                              checked={selectedBinId === bin.id}
                              onChange={() => setSelectedBinId(bin.id)}
                              disabled={isFull}
                              className="accent-primary-600"
                              required
                            />
                          </div>
                          
                          {/* Capacity Meter */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-slate-400 font-semibold leading-none">
                              <span>Occupied: {bin.occupiedMT} / {bin.capacityMT} MT ({percent}%)</span>
                              <span className={isFull ? 'text-red-500 font-bold' : 'text-slate-500 font-semibold'}>
                                Space: {avail} MT
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-primary-600'
                                }`} 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedBinId}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                >
                  <CheckCircle size={14} />
                  <span>Allocate Storage & Complete Inward</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Warehouse size={24} className="text-slate-300" />
              <span>Select a pending QC GRN from the table to allocate a storage bin in the warehouse.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InwardBinningPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading binning console...</div>}>
      <InwardBinningPageContent />
    </React.Suspense>
  );
}
