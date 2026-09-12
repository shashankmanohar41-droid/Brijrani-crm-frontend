'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { saveDb } from '../../../services/erpService';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { 
  ClipboardCheck, Plus, Scale, AlertTriangle, CheckCircle2, 
  TrendingDown, TrendingUp, Download, Eye, FileText, X, ShieldAlert 
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface StockAdjustmentRecord {
  id: string;
  adjustmentNo: string;
  date: string;
  commodityId: string;
  commodityName: string;
  batchNo: string;
  warehouseId: string;
  warehouseName: string;
  binId: string;
  binName: string;
  bookQty: number;
  physicalQty: number;
  varianceQty: number;
  variancePercent: number;
  reason: 'Moisture Shrinkage' | 'Handling Spillage' | 'Cycle Count Variance' | 'Pest Spoilage' | 'Extra Stock Found' | 'Other';
  unit: string;
  auditorName: string;
  approvedBy: string;
  status: 'Approved' | 'Pending Review';
  notes?: string;
}

export default function WarehouseAdjustmentsPage() {
  const { db, refreshDb, currentUser, showToast } = useErp();

  const [adjustments, setAdjustments] = useState<StockAdjustmentRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('brijrani_stock_adjustments');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustmentRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [reasonFilter, setReasonFilter] = useState<string>('All');

  // Form states
  const [selectedStockId, setSelectedStockId] = useState('');
  const [physicalCount, setPhysicalCount] = useState<number | ''>('');
  const [reason, setReason] = useState<StockAdjustmentRecord['reason']>('Moisture Shrinkage');
  const [notes, setNotes] = useState('');
  const [auditorName, setAuditorName] = useState(currentUser?.name || 'Warehouse Auditor');

  const commodities = db.commodities;
  const warehouses = db.warehouses;
  const bins = db.bins;
  const stockItems = db.stockItems;

  // Selected stock item details for adjustment
  const activeStock = useMemo(() => {
    return stockItems.find(s => s.id === selectedStockId);
  }, [selectedStockId, stockItems]);

  const activeCommodity = useMemo(() => {
    if (!activeStock) return null;
    return commodities.find(c => c.id === activeStock.commodityId);
  }, [activeStock, commodities]);

  const activeWarehouse = useMemo(() => {
    if (!activeStock) return null;
    return warehouses.find(w => w.id === activeStock.warehouseId);
  }, [activeStock, warehouses]);

  const activeBin = useMemo(() => {
    if (!activeStock) return null;
    return bins.find(b => b.id === activeStock.binId);
  }, [activeStock, bins]);

  // Live variance calculations
  const varianceQty = useMemo(() => {
    if (!activeStock || physicalCount === '') return 0;
    return Number((Number(physicalCount) - activeStock.quantity).toFixed(2));
  }, [activeStock, physicalCount]);

  const variancePercent = useMemo(() => {
    if (!activeStock || physicalCount === '' || activeStock.quantity === 0) return 0;
    return Number(((varianceQty / activeStock.quantity) * 100).toFixed(2));
  }, [activeStock, physicalCount, varianceQty]);

  // Handle Adjustment submission
  const handleCreateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStock || !activeCommodity || physicalCount === '') {
      showToast('Please select a stock batch and enter physical count quantity', 'error');
      return;
    }

    const pQty = Number(physicalCount);
    if (pQty < 0) {
      showToast('Physical count quantity cannot be negative', 'error');
      return;
    }

    const adjNo = `ADJ-2026-${String(adjustments.length + 1).padStart(5, '0')}`;
    const diff = Number((pQty - activeStock.quantity).toFixed(2));

    const newRecord: StockAdjustmentRecord = {
      id: `ADJ-${Date.now()}`,
      adjustmentNo: adjNo,
      date: new Date().toISOString().split('T')[0],
      commodityId: activeCommodity.id,
      commodityName: activeCommodity.name,
      batchNo: activeStock.batchNo,
      warehouseId: activeWarehouse?.id || activeStock.warehouseId,
      warehouseName: activeWarehouse?.name || 'Main Warehouse',
      binId: activeBin?.id || activeStock.binId,
      binName: activeBin?.name || 'Bin',
      bookQty: activeStock.quantity,
      physicalQty: pQty,
      varianceQty: diff,
      variancePercent: activeStock.quantity > 0 ? Number(((diff / activeStock.quantity) * 100).toFixed(2)) : 0,
      reason,
      unit: activeStock.unit || 'MT',
      auditorName,
      approvedBy: currentUser?.name || 'Admin',
      status: 'Approved',
      notes
    };

    // Update physical inventory in DB
    const dbStore = db;
    const targetStock = dbStore.stockItems.find(s => s.id === activeStock.id);
    if (targetStock) {
      targetStock.quantity = pQty;
      if (pQty === 0) {
        dbStore.stockItems = dbStore.stockItems.filter(s => s.id !== activeStock.id);
      }
    }

    // Update Bin occupancy
    if (activeBin) {
      const targetBin = dbStore.bins.find(b => b.id === activeBin.id);
      if (targetBin) {
        targetBin.occupiedMT = Math.max(0, Number((targetBin.occupiedMT + diff).toFixed(2)));
      }
    }

    // Update Warehouse occupancy
    if (activeWarehouse) {
      const targetWH = dbStore.warehouses.find(w => w.id === activeWarehouse.id);
      if (targetWH) {
        targetWH.usedCapacityMT = Math.max(0, Number((targetWH.usedCapacityMT + diff).toFixed(2)));
      }
    }

    saveDb(dbStore);

    // Save adjustment record
    const updatedAdj = [newRecord, ...adjustments];
    setAdjustments(updatedAdj);
    localStorage.setItem('brijrani_stock_adjustments', JSON.stringify(updatedAdj));

    refreshDb();
    setIsCreateOpen(false);
    setSelectedStockId('');
    setPhysicalCount('');
    setNotes('');
    showToast(`Physical Stock Adjustment ${adjNo} recorded and reconciled!`, 'success');
  };

  // Generate official PDF audit certificate
  const handlePrintAuditCertificate = (adj: StockAdjustmentRecord) => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('BRIJRANI AGRO FOODS LIMITED', 14, 20);
    doc.setFontSize(12);
    doc.text('OFFICIAL PHYSICAL STOCK AUDIT & RECONCILIATION CERTIFICATE', 14, 28);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Adjustment Reference: ${adj.adjustmentNo}`, 14, 40);
    doc.text(`Audit Date: ${formatDate(adj.date)}`, 14, 46);
    doc.text(`Audited By: ${adj.auditorName}`, 14, 52);
    doc.text(`Approved By: ${adj.approvedBy}`, 14, 58);

    doc.text(`Warehouse Terminal: ${adj.warehouseName}`, 120, 40);
    doc.text(`Silo/Bin Location: ${adj.binName}`, 120, 46);
    doc.text(`Adjustment Reason: ${adj.reason}`, 120, 52);
    doc.text(`Status: ${adj.status}`, 120, 58);

    doc.setFillColor(245, 247, 250);
    doc.rect(14, 65, 182, 35, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.text('STOCK VARIANCE AUDIT LOG', 18, 72);

    doc.setFont('Helvetica', 'normal');
    doc.text(`Commodity: ${adj.commodityName}`, 18, 80);
    doc.text(`Batch Code: ${adj.batchNo}`, 18, 86);
    doc.text(`Book System Stock: ${adj.bookQty} ${adj.unit}`, 18, 92);

    doc.text(`Physical Counted Stock: ${adj.physicalQty} ${adj.unit}`, 110, 80);
    doc.text(`Net Variance: ${adj.varianceQty > 0 ? '+' : ''}${adj.varianceQty} ${adj.unit} (${adj.variancePercent}%)`, 110, 86);
    doc.text(`Reconciliation Impact: ${adj.varianceQty >= 0 ? 'Stock Gain' : 'Inventory Write-Off / Shrinkage'}`, 110, 92);

    if (adj.notes) {
      doc.text(`Auditor Justification: "${adj.notes}"`, 14, 110);
    }

    doc.line(14, 140, 196, 140);
    doc.text('Authorized Signatory: _________________________', 14, 150);
    doc.text('Warehouse Head Seal: _________________________', 120, 150);

    doc.save(`Stock_Adjustment_${adj.adjustmentNo}.pdf`);
    showToast('Audit Certificate PDF downloaded', 'success');
  };

  // KPIs
  const stats = useMemo(() => {
    const totalAdjustments = adjustments.length;
    const totalNetVariance = adjustments.reduce((sum, a) => sum + a.varianceQty, 0);
    const shrinkageLoss = adjustments.filter(a => a.varianceQty < 0).reduce((sum, a) => sum + Math.abs(a.varianceQty), 0);
    const gains = adjustments.filter(a => a.varianceQty > 0).reduce((sum, a) => sum + a.varianceQty, 0);
    return {
      totalAdjustments,
      totalNetVariance: Number(totalNetVariance.toFixed(2)),
      shrinkageLoss: Number(shrinkageLoss.toFixed(2)),
      gains: Number(gains.toFixed(2))
    };
  }, [adjustments]);

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter(a => {
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (reasonFilter !== 'All' && a.reason !== reasonFilter) return false;
      return true;
    });
  }, [adjustments, statusFilter, reasonFilter]);

  const columns = [
    { header: 'Adjustment No', accessor: 'adjustmentNo' as keyof StockAdjustmentRecord, sortable: true },
    { header: 'Date', accessor: (row: StockAdjustmentRecord) => formatDate(row.date) },
    { header: 'Commodity', accessor: 'commodityName' as keyof StockAdjustmentRecord },
    { header: 'Batch Code', accessor: 'batchNo' as keyof StockAdjustmentRecord },
    { header: 'Warehouse / Bin', accessor: (row: StockAdjustmentRecord) => `${row.warehouseName} (${row.binName})` },
    { header: 'Book (MT)', accessor: (row: StockAdjustmentRecord) => `${row.bookQty} MT` },
    { header: 'Physical (MT)', accessor: (row: StockAdjustmentRecord) => `${row.physicalQty} MT` },
    { 
      header: 'Variance', 
      accessor: (row: StockAdjustmentRecord) => (
        <span className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
          row.varianceQty < 0 
            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
            : row.varianceQty > 0 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'text-slate-600 bg-slate-100'
        }`}>
          {row.varianceQty > 0 ? '+' : ''}{row.varianceQty} MT ({row.variancePercent}%)
        </span>
      )
    },
    { header: 'Reason', accessor: 'reason' as keyof StockAdjustmentRecord },
    { 
      header: 'Status', 
      accessor: (row: StockAdjustmentRecord) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Physical Stock Audits & Adjustments</h1>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
              Cycle Count & Shrinkage Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile physical silo bin inventory against system book balances with shrinkage and spillage audit logs.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-md shadow-indigo-600/10 cursor-pointer transition shrink-0"
        >
          <Plus size={15} />
          <span>New Stock Adjustment</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audited Adjustments</span>
            <span className="text-lg font-bold text-slate-800">{stats.totalAdjustments} records</span>
          </div>
          <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600">
            <ClipboardCheck size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Volume Variance</span>
            <span className={`text-lg font-bold ${stats.totalNetVariance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {stats.totalNetVariance > 0 ? '+' : ''}{stats.totalNetVariance} MT
            </span>
          </div>
          <div className={`p-2.5 rounded-lg ${stats.totalNetVariance < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <Scale size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shrinkage / Spoilage Loss</span>
            <span className="text-lg font-bold text-rose-600">-{stats.shrinkageLoss} MT</span>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-lg text-rose-600">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock Found / Gains</span>
            <span className="text-lg font-bold text-emerald-600">+{stats.gains} MT</span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Main Table & Side Panel Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className={`${selectedAdjustment ? 'xl:col-span-2' : 'xl:col-span-3'} space-y-3 transition-all duration-300`}>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Physical Stock Reconciliation Logs</h3>
              <div className="flex items-center gap-2">
                <select
                  value={reasonFilter}
                  onChange={e => setReasonFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium text-slate-700 focus:outline-none"
                >
                  <option value="All">All Reasons</option>
                  <option value="Moisture Shrinkage">Moisture Shrinkage</option>
                  <option value="Handling Spillage">Handling Spillage</option>
                  <option value="Cycle Count Variance">Cycle Count Variance</option>
                  <option value="Pest Spoilage">Pest Spoilage</option>
                  <option value="Extra Stock Found">Extra Stock Found</option>
                </select>
              </div>
            </div>

            <DataTable
              data={filteredAdjustments}
              columns={columns}
              searchPlaceholder="Search adjustment ID, batch, commodity..."
              searchField="commodityName"
              pageSize={10}
              onRowClick={(row) => setSelectedAdjustment(row)}
            />
          </div>
        </div>

        {/* Selected Adjustment Details Panel */}
        {selectedAdjustment && (
          <div className="xl:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-slide-in-right">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Adjustment Details</span>
                <h3 className="text-sm font-bold text-slate-800">{selectedAdjustment.adjustmentNo}</h3>
                <span className="text-[10px] text-slate-400 block font-medium">Date: {formatDate(selectedAdjustment.date)}</span>
              </div>
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 p-1 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2.5 text-xs font-semibold text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Commodity:</span>
                <span className="text-slate-800 font-bold">{selectedAdjustment.commodityName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Batch Code:</span>
                <span className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {selectedAdjustment.batchNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Warehouse:</span>
                <span>{selectedAdjustment.warehouseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Silo / Bin:</span>
                <span>{selectedAdjustment.binName}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Book Stock:</span>
                <span className="font-bold">{selectedAdjustment.bookQty} MT</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Physical Count:</span>
                <span className="font-bold text-slate-800">{selectedAdjustment.physicalQty} MT</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <span>Variance:</span>
                <span className={selectedAdjustment.varianceQty < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {selectedAdjustment.varianceQty > 0 ? '+' : ''}{selectedAdjustment.varianceQty} MT ({selectedAdjustment.variancePercent}%)
                </span>
              </div>
            </div>

            {selectedAdjustment.notes && (
              <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 italic border border-slate-100">
                "{selectedAdjustment.notes}"
              </div>
            )}

            <button
              onClick={() => handlePrintAuditCertificate(selectedAdjustment)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition"
            >
              <Download size={14} />
              <span>Download Audit Certificate</span>
            </button>
          </div>
        )}
      </div>

      {/* New Adjustment Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center z-[9999] p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Scale className="text-indigo-600" size={18} />
                <h3 className="font-bold text-slate-800 text-sm">Record Physical Stock Adjustment</h3>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Select Batch to Reconcile *</label>
                <select
                  value={selectedStockId}
                  onChange={e => {
                    setSelectedStockId(e.target.value);
                    const match = stockItems.find(s => s.id === e.target.value);
                    if (match) setPhysicalCount(match.quantity);
                  }}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  required
                >
                  <option value="">-- Choose Stock Item Batch --</option>
                  {stockItems.map(s => {
                    const c = commodities.find(comm => comm.id === s.commodityId);
                    const w = warehouses.find(wh => wh.id === s.warehouseId);
                    return (
                      <option key={s.id} value={s.id}>
                        {c?.name || 'Item'} - Batch: {s.batchNo} ({s.quantity} MT in {w?.name || 'WH'})
                      </option>
                    );
                  })}
                </select>
              </div>

              {activeStock && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current System Book Stock:</span>
                    <span className="font-bold text-slate-800">{activeStock.quantity} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Warehouse Location:</span>
                    <span className="text-slate-700">{activeWarehouse?.name} ({activeBin?.name || 'Bin'})</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Physical Counted Stock (MT) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter physical MT"
                    value={physicalCount}
                    onChange={e => setPhysicalCount(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Calculated Variance</label>
                  <input
                    type="text"
                    disabled
                    value={physicalCount !== '' ? `${varianceQty > 0 ? '+' : ''}${varianceQty} MT (${variancePercent}%)` : '0.00 MT'}
                    className={`w-full p-2 border rounded-lg text-xs font-bold font-mono ${
                      varianceQty < 0 
                        ? 'border-rose-300 bg-rose-50 text-rose-700' 
                        : varianceQty > 0 
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Adjustment Reason *</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  required
                >
                  <option value="Moisture Shrinkage">Moisture Loss / Aeration Shrinkage</option>
                  <option value="Handling Spillage">Handling & Spillage Loss</option>
                  <option value="Cycle Count Variance">Physical Audit Variance (Cycle Count)</option>
                  <option value="Pest Spoilage">Pest Damage / Quality Spoilage</option>
                  <option value="Extra Stock Found">Extra Stock Found / Gain</option>
                  <option value="Other">Other Operational Adjustment</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Auditor Justification Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Provide reason and audit verification details..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md cursor-pointer"
                >
                  Post Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
