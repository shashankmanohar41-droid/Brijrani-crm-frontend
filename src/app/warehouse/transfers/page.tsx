'use client';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { StockTransfer } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { RefreshCw, Plus, ArrowRightLeft } from 'lucide-react';

export default function StockTransfersPage() {
  const { db, refreshDb, showToast } = useErp();

  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [commodityId, setCommodityId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [fromBinId, setFromBinId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toBinId, setToBinId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('Routine Stock Balancing');

  const commodities = db.commodities;
  const warehouses = db.warehouses;
  const bins = db.bins;
  const stockItems = db.stockItems;

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commodityId || !batchNo || !fromWarehouseId || !toWarehouseId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    // Verify stock availability
    const stock = stockItems.find(s => s.warehouseId === fromWarehouseId && s.batchNo === batchNo);
    if (!stock || stock.quantity < quantity) {
      showToast(`Warning: Insufficient stock in source bin. Available: ${stock?.quantity || 0} MT`, 'error');
      return;
    }

    const destBin = toBinId || bins.find(b => b.warehouseId === toWarehouseId)?.id || 'BIN-001';
    const srcBin = fromBinId || stock.binId || 'BIN-001';

    erpService.createStockTransfer({
      commodityId,
      batchNo,
      fromWarehouseId,
      fromBinId: srcBin,
      toWarehouseId,
      toBinId: destBin,
      quantity,
      transferDate: new Date().toISOString().split('T')[0],
      reason
    });

    refreshDb();
    setIsCreateOpen(false);
    showToast('Stock transfer posted successfully', 'success');
  };

  const columns = [
    { header: 'Transfer Ref', accessor: 'transferNo' as keyof StockTransfer, sortable: true },
    { header: 'Date', accessor: 'transferDate' as keyof StockTransfer },
    { 
      header: 'Commodity', 
      accessor: (row: StockTransfer) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Batch Code', accessor: 'batchNo' as keyof StockTransfer },
    { header: 'Qty', accessor: (row: StockTransfer) => `${row.quantity} MT` },
    { 
      header: 'From Warehouse', 
      accessor: (row: StockTransfer) => warehouses.find(w => w.id === row.fromWarehouseId)?.name || row.fromWarehouseId 
    },
    { 
      header: 'To Warehouse', 
      accessor: (row: StockTransfer) => warehouses.find(w => w.id === row.toWarehouseId)?.name || row.toWarehouseId 
    },
    { 
      header: 'Status', 
      accessor: (row: StockTransfer) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Stock Transfers</h1>
          <p className="text-xs font-medium text-slate-400">Record stock transfers between physical bin locations or operating facilities.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.stockTransfers}
            columns={columns}
            searchPlaceholder="Search transfer ref..."
            searchField="transferNo"
            onRowClick={(row) => setSelectedTransfer(row)}
            exportFileName="stock_transfers_log"
          />
        </div>

        {/* Selected Details panel */}
        <div>
          {selectedTransfer ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedTransfer.transferNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">Transfer Date: {formatDate(selectedTransfer.transferDate)}</span>
              </div>

              {/* Transit Map */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-semibold text-slate-655 space-y-3.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Movement Logs</span>
                
                <div className="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-lg">
                  <div className="text-center flex-1">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Source</span>
                    <span className="font-bold text-slate-800 block text-[10px]">
                      {warehouses.find(w => w.id === selectedTransfer.fromWarehouseId)?.name}
                    </span>
                  </div>
                  <ArrowRightLeft size={16} className="text-slate-400 mx-2" />
                  <div className="text-center flex-1">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Destination</span>
                    <span className="font-bold text-slate-800 block text-[10px]">
                      {warehouses.find(w => w.id === selectedTransfer.toWarehouseId)?.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Commodity:</span>
                  <span>{commodities.find(c => c.id === selectedTransfer.commodityId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Batch Code:</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-700">{selectedTransfer.batchNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quantity Transferred:</span>
                  <span className="text-primary-600 font-bold">{selectedTransfer.quantity} MT</span>
                </div>
              </div>

              {selectedTransfer.reason && (
                <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 italic border border-slate-100">
                  Reason: "{selectedTransfer.reason}"
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="text-slate-300" />
              <span>Select a Transfer row to verify stock route manifests and audit logs.</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Drawer */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">New Stock Transfer Voucher</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Move inventory batches across silo bins.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-655 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Commodity selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => {
                      setCommodityId(e.target.value);
                      setBatchNo('');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Batch selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Sourced Batch *</label>
                  <select
                    value={batchNo}
                    onChange={e => {
                      setBatchNo(e.target.value);
                      const match = stockItems.find(stk => stk.batchNo === e.target.value);
                      if (match) {
                        setFromWarehouseId(match.warehouseId);
                        setFromBinId(match.binId);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Sourced Batch</option>
                    {stockItems.filter(s => s.commodityId === commodityId).map(stk => (
                      <option key={stk.id} value={stk.batchNo}>{stk.batchNo} ({stk.quantity} MT in {warehouses.find(w => w.id === stk.warehouseId)?.name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Source details */}
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-xs">
                  <span className="text-[9px] text-slate-400 uppercase block font-bold mb-1">Source Details</span>
                  <p className="font-bold text-slate-700 leading-normal">
                    {warehouses.find(w => w.id === fromWarehouseId)?.name || 'Select Batch First'}
                  </p>
                </div>

                {/* Destination Details */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destination Warehouse *</label>
                    <select
                      value={toWarehouseId}
                      onChange={e => {
                        setToWarehouseId(e.target.value);
                        const firstBin = bins.find(b => b.warehouseId === e.target.value);
                        if (firstBin) setToBinId(firstBin.id);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                      required
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.filter(w => w.id !== fromWarehouseId).map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  {toWarehouseId && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destination Silo/Bin</label>
                      <select
                        value={toBinId}
                        onChange={e => setToBinId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                      >
                        <option value="">Select Destination Bin (Auto-allocated if blank)</option>
                        {bins.filter(b => b.warehouseId === toWarehouseId).map(b => (
                          <option key={b.id} value={b.id}>{b.name} (Cap: {b.capacityMT} MT | Free: {b.capacityMT - b.occupiedMT} MT)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity to Transfer (MT) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
                {/* Reason */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason for Transfer</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
