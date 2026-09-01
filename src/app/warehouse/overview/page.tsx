'use client';

import React, { useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import StatCard from '../../../components/shared/StatCard';
import { Warehouse, Layers, ArrowDownLeft, ArrowUpRight, ShieldCheck, X, Package, PieChart, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WarehouseOverviewPage() {
  const { db } = useErp();
  const router = useRouter();

  const warehouses = db.warehouses;
  const bins = db.bins;
  const stockItems = db.stockItems;

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacityMT, 0);
    const usedCapacity = warehouses.reduce((sum, w) => sum + w.usedCapacityMT, 0);
    const availableCapacity = totalCapacity - usedCapacity;
    const stockVal = stockItems.reduce((sum, item) => sum + (item.quantity * item.purchaseCost), 0);
    return {
      totalCapacity,
      usedCapacity,
      availableCapacity,
      stockVal
    };
  }, [warehouses, stockItems]);

  const selectedWarehouse = useMemo(() => {
    if (!selectedWarehouseId) return null;
    return warehouses.find(w => w.id === selectedWarehouseId) || null;
  }, [selectedWarehouseId, warehouses]);

  const warehouseBins = useMemo(() => {
    if (!selectedWarehouseId) return [];
    const cleanWhId = selectedWarehouseId.replace('WH-', 'WH0');
    return bins.filter(b => b.warehouseId === selectedWarehouseId || b.id.startsWith(cleanWhId));
  }, [selectedWarehouseId, bins]);

  const commodityQuantities = useMemo(() => {
    if (!selectedWarehouseId) return [];
    const whStockItems = stockItems.filter(item => item.warehouseId === selectedWarehouseId);
    const grouped: Record<string, number> = {};
    whStockItems.forEach(item => {
      grouped[item.commodityId] = (grouped[item.commodityId] || 0) + item.quantity;
    });
    return Object.entries(grouped).map(([commId, qty]) => {
      const commodity = db.commodities.find(c => c.id === commId);
      return {
        id: commId,
        name: commodity?.name || commId,
        sku: commodity?.sku || '',
        quantity: qty,
        unit: commodity?.unit || 'MT',
        value: qty * (commodity?.purchaseCost || 0)
      };
    });
  }, [selectedWarehouseId, stockItems, db.commodities]);

  const totalAssetsInSelected = useMemo(() => {
    return commodityQuantities.reduce((sum, c) => sum + c.value, 0);
  }, [commodityQuantities]);

  return (
    <div className="space-y-6">
      {/* Inject custom styling and keyframe animations */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fillWidth {
          from {
            width: 0%;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fill-width {
          animation: fillWidth 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Warehouse Overview</h1>
          <p className="text-xs font-medium text-slate-400">Monitor storage terminal capacities, active silo bins, and asset valuation.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/warehouse/inward')}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-xs cursor-pointer transition"
          >
            <ArrowDownLeft size={14} />
            <span>Goods Inward</span>
          </button>
          <button
            onClick={() => router.push('/warehouse/transfers')}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
          >
            <ArrowUpRight size={14} />
            <span>Bin Transfers</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Storage Units" value={warehouses.length} icon={Warehouse} color="primary" />
        <StatCard title="Total Silo Capacity" value={`${summary.totalCapacity} MT`} icon={Layers} color="info" />
        <StatCard title="Storage Space Used" value={`${summary.usedCapacity} MT (${Math.round((summary.usedCapacity / summary.totalCapacity) * 100)}%)`} icon={Layers} color="warning" />
        <StatCard title="Warehouse Assets Sourced" value={`₹${summary.stockVal.toLocaleString()}`} icon={ShieldCheck} color="success" />
      </div>

      {/* Split Layout Container */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Side: Warehouses List */}
        <div className={`${selectedWarehouseId ? 'xl:col-span-1' : 'xl:col-span-3'} grid grid-cols-1 md:grid-cols-2 ${selectedWarehouseId ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>
          {warehouses.map(wh => {
            const percent = Math.round((wh.usedCapacityMT / wh.capacityMT) * 100);
            const isSelected = selectedWarehouseId === wh.id;

            return (
              <div
                key={wh.id}
                onClick={() => setSelectedWarehouseId(wh.id)}
                className={`bg-white border rounded-xl p-5 shadow-sm space-y-4 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md active:scale-[0.995] ${
                  isSelected ? 'border-primary-500 ring-2 ring-primary-500/10 bg-primary-50/5' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{wh.name}</h3>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{wh.location}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                    wh.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {wh.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Occupancy: {wh.usedCapacityMT} / {wh.capacityMT} MT</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full animate-fill-width transition-all ${
                        percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-primary-600'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Selected Warehouse Details Panel */}
        {selectedWarehouse && (
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 animate-slide-in-right">
            {/* Details Panel Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Terminal Breakdown</span>
                <h2 className="text-base font-bold text-slate-800 mt-0.5">{selectedWarehouse.name}</h2>
                <span className="text-[10px] text-slate-400 block mt-0.5">{selectedWarehouse.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  selectedWarehouse.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {selectedWarehouse.status}
                </span>
                <button
                  onClick={() => setSelectedWarehouseId(null)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded p-1 transition flex items-center justify-center cursor-pointer"
                  title="Close details"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Warehouse capacity details */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Silo Bins</span>
                <span className="text-sm font-extrabold text-slate-800 block mt-1">{warehouseBins.length} Active</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Available Space</span>
                <span className="text-sm font-extrabold text-slate-800 block mt-1">
                  {(selectedWarehouse.capacityMT - selectedWarehouse.usedCapacityMT).toFixed(1)} MT
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Stock Valuation</span>
                <span className="text-sm font-extrabold text-emerald-600 block mt-1">
                  ₹{totalAssetsInSelected.toLocaleString()}
                </span>
              </div>
            </div>

            {/* General progress bar with animation */}
            <div className="space-y-1.5 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Occupancy Progress</span>
              <div className="flex justify-between text-[11px] font-bold text-slate-700">
                <span>{selectedWarehouse.usedCapacityMT} / {selectedWarehouse.capacityMT} MT</span>
                <span>{Math.round((selectedWarehouse.usedCapacityMT / selectedWarehouse.capacityMT) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full animate-fill-width ${
                    (selectedWarehouse.usedCapacityMT / selectedWarehouse.capacityMT) >= 0.9
                      ? 'bg-red-500'
                      : (selectedWarehouse.usedCapacityMT / selectedWarehouse.capacityMT) >= 0.7
                      ? 'bg-amber-500'
                      : 'bg-primary-600'
                  }`}
                  style={{ width: `${Math.round((selectedWarehouse.usedCapacityMT / selectedWarehouse.capacityMT) * 100)}%` }}
                />
              </div>
            </div>


            {/* Commodity details breakdown */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Package size={13} />
                <span>Grain Inventory Assets</span>
              </span>

              {commodityQuantities.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-3">Commodity</th>
                        <th className="p-3 text-right">Quantity</th>
                        <th className="p-3 text-right">Asset Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {commodityQuantities.map(comm => (
                        <tr key={comm.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{comm.name}</span>
                            <span className="text-[9px] text-slate-400">{comm.sku}</span>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {comm.quantity.toLocaleString()} {comm.unit}
                          </td>
                          <td className="p-3 text-right text-emerald-600 font-mono">
                            ₹{comm.value.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400 font-medium">
                  🌾 No commodity stocks currently recorded inside this terminal.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
