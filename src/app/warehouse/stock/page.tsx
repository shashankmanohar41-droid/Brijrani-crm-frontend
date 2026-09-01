'use client';

import React, { useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { StockItem } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Layers, AlertTriangle, ArrowUpRight, TrendingUp, DollarSign, X, MapPin, Database } from 'lucide-react';

export default function StockInventoryPage() {
  const { db } = useErp();

  const commodities = db.commodities;
  const warehouses = db.warehouses;
  const bins = db.bins;

  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  // Compile row data with calculations
  const stockRows = useMemo(() => {
    return db.stockItems.map(item => {
      const commodity = commodities.find(c => c.id === item.commodityId);
      const warehouse = warehouses.find(w => w.id === item.warehouseId);
      const bin = bins.find(b => b.id === item.binId);

      const purchaseCost = item.purchaseCost;
      const marketPrice = commodity?.currentMarketPrice || purchaseCost;
      const stockVal = item.quantity * purchaseCost;
      const profit = (marketPrice - purchaseCost) * item.quantity;
      const profitPct = purchaseCost > 0 ? Math.round(((marketPrice - purchaseCost) / purchaseCost) * 100) : 0;

      // Status indicator
      const available = (commodity?.stockQty || 0) - (commodity?.reservedQty || 0);
      let status: 'Low Stock' | 'Reserved' | 'Good' = 'Good';
      if (available <= (commodity?.minStockLevel || 0)) {
        status = 'Low Stock';
      } else if ((commodity?.reservedQty || 0) > 0 && item.commodityId === commodity?.id) {
        status = 'Reserved';
      }

      return {
        id: item.id,
        commodityId: item.commodityId,
        commodityName: commodity?.name || 'Unknown',
        sku: commodity?.sku || '',
        batchNo: item.batchNo,
        warehouseName: warehouse?.name || 'Unknown',
        warehouseId: item.warehouseId,
        binName: bin?.name || item.binId,
        quantity: item.quantity,
        unit: item.unit,
        purchaseCost,
        marketPrice,
        stockVal,
        profit,
        profitPct,
        status
      };
    });
  }, [db, commodities, warehouses, bins]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalVal = stockRows.reduce((sum, r) => sum + r.stockVal, 0);
    const totalProfit = stockRows.reduce((sum, r) => sum + r.profit, 0);
    const lowStockCount = commodities.filter(c => (c.stockQty - c.reservedQty) <= c.minStockLevel).length;
    return {
      totalVal,
      totalProfit,
      lowStockCount
    };
  }, [stockRows, commodities]);

  // Derived stock details
  const targetBin = useMemo(() => {
    if (!selectedStock) return null;
    return bins.find(b => b.name === selectedStock.binName || b.id === selectedStock.binName);
  }, [selectedStock, bins]);

  const targetWarehouse = useMemo(() => {
    if (!selectedStock) return null;
    return warehouses.find(w => w.id === selectedStock.warehouseId);
  }, [selectedStock, warehouses]);

  const targetCommodity = useMemo(() => {
    if (!selectedStock) return null;
    return commodities.find(c => c.id === selectedStock.commodityId);
  }, [selectedStock, commodities]);

  const occupancyPercent = useMemo(() => {
    if (!targetBin) return 50; // default indicator
    return Math.round((targetBin.occupiedMT / targetBin.capacityMT) * 100) || 0;
  }, [targetBin]);

  const grainColorClass = useMemo(() => {
    if (!targetCommodity) return 'bg-primary-500';
    const name = targetCommodity.name.toLowerCase();
    if (name.includes('wheat') || name.includes('grain') || name.includes('barley')) return 'bg-amber-400 border-amber-500';
    if (name.includes('rice') || name.includes('paddy')) return 'bg-slate-200 border-slate-300';
    if (name.includes('maize') || name.includes('corn')) return 'bg-orange-400 border-orange-500';
    if (name.includes('mustard') || name.includes('oilseed')) return 'bg-yellow-600 border-yellow-700';
    return 'bg-primary-500 border-primary-600';
  }, [targetCommodity]);

  const columns = [
    { header: 'Commodity', accessor: 'commodityName' as any, sortable: true },
    { header: 'SKU', accessor: 'sku' as any },
    { 
      header: 'Batch No', 
      accessor: (row: any) => <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-700">{row.batchNo}</span>,
      csvAccessor: 'batchNo' as any
    },
    { header: 'Warehouse', accessor: 'warehouseName' as any },
    { header: 'Qty', accessor: (row: any) => `${row.quantity} ${row.unit}` },
    { header: 'Avg Cost/MT', accessor: (row: any) => `₹${row.purchaseCost.toLocaleString()}` },
    { header: 'Market/MT', accessor: (row: any) => `₹${row.marketPrice.toLocaleString()}` },
    { header: 'Stock Value', accessor: (row: any) => `₹${row.stockVal.toLocaleString()}` },
    { 
      header: 'Profit Arbitrage', 
      accessor: (row: any) => (
        <span className={`font-bold flex items-center gap-0.5 ${row.profit > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
          {row.profit > 0 ? <ArrowUpRight size={12} /> : null}
          ₹{row.profit.toLocaleString()} ({row.profitPct}%)
        </span>
      ),
      csvAccessor: (row: any) => `₹${row.profit} (${row.profitPct}%)`
    },
    { 
      header: 'Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
          row.status === 'Low Stock' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
          row.status === 'Reserved' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          'bg-green-50 text-green-600 border-green-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  // Filters setup
  const whOptions = warehouses.map(w => ({ label: w.name, value: w.id }));
  const cmdOptions = commodities.map(c => ({ label: c.name, value: c.id }));

  const filterConfigs = [
    { name: 'Warehouse', field: 'warehouseId', options: whOptions },
    { name: 'Commodity', field: 'commodityId', options: cmdOptions }
  ];

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
        @keyframes fillHeight {
          from {
            height: 0%;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fill-height {
          animation: fillHeight 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Advanced Stock Management</h1>
        <p className="text-xs font-medium text-slate-400">View real-time batch allocation, purchase costing, and market profit analyses.</p>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inventory Asset Value</span>
            <span className="text-lg font-bold text-slate-800">₹{stats.totalVal.toLocaleString()}</span>
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Potential Profit</span>
            <span className="text-lg font-bold text-emerald-600">₹{stats.totalProfit.toLocaleString()}</span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Commodities</span>
            <span className={`text-lg font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {stats.lowStockCount} items
            </span>
          </div>
          <div className={`p-2 rounded-lg ${stats.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Split layout block */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Table column */}
        <div className={`${selectedStock ? 'xl:col-span-2' : 'xl:col-span-3'} space-y-3 transition-all duration-300`}>
          <DataTable
            data={stockRows}
            columns={columns}
            searchPlaceholder="Search commodity, SKU or batch..."
            searchField="commodityName"
            filters={filterConfigs}
            exportFileName="inventory_stock_valuation"
            pageSize={10}
            onRowClick={(row) => setSelectedStock(row)}
          />
        </div>

        {/* Selected Batch visualizer side panel */}
        {selectedStock && (
          <div className="xl:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-slide-in-right">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Location Tracker</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">{selectedStock.commodityName}</h3>
                <span className="text-[10px] text-slate-400 block font-mono">{selectedStock.sku}</span>
              </div>
              <button
                onClick={() => setSelectedStock(null)}
                className="text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 p-1 transition flex items-center justify-center cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Info details */}
            <div className="space-y-2.5 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Batch Code:</span>
                <span className="font-mono text-slate-800 bg-slate-50 border border-slate-100 px-1 py-0.2 rounded">
                  {selectedStock.batchNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Batch Quantity:</span>
                <span className="text-slate-850 font-bold">{selectedStock.quantity} {selectedStock.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg Cost Price:</span>
                <span className="text-slate-700">₹{selectedStock.purchaseCost.toLocaleString()} / MT</span>
              </div>
            </div>

            {/* Animated Silo Graphic */}
            <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Database size={12} />
                <span>Silo Storage Visualizer</span>
              </span>

              {/* Silo cylinder graphic */}
              <div className="relative w-24 h-40 border-2 border-slate-400 rounded-b-2xl overflow-hidden flex flex-col justify-end shadow-inner bg-slate-200">
                {/* Dome shape at top of outer border */}
                <div className="absolute top-0 left-0 right-0 h-4 bg-slate-300 border-b border-slate-400 rounded-t-full shadow-inner" />

                {/* Animated Liquid/Grain layer */}
                <div
                  className={`w-full ${grainColorClass} border-t-2 animate-fill-height relative flex items-center justify-center`}
                  style={{ height: `${occupancyPercent}%` }}
                >
                  {/* Grain wave sheen effect */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/25 animate-pulse" />

                  {/* Percentage label inside fluid */}
                  {occupancyPercent > 15 && (
                    <span className="text-[10px] font-extrabold text-slate-800 drop-shadow-sm select-none z-10">
                      {occupancyPercent}%
                    </span>
                  )}
                </div>

                {/* Grid markings on cylinder */}
                <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
                  <div className="border-b border-slate-500 w-full" />
                  <div className="border-b border-slate-500 w-full" />
                  <div className="border-b border-slate-500 w-full" />
                  <div className="border-b border-slate-500 w-full" />
                </div>
              </div>

              {/* Bin label details */}
              <div className="text-center space-y-1">
                <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Allocated Silo Bin</span>
                <span className="text-xs font-extrabold text-slate-800 block">{selectedStock.binName}</span>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Bin Capacity Used: {targetBin ? `${targetBin.occupiedMT} / ${targetBin.capacityMT} MT` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Warehouse Map Location details */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <MapPin size={12} className="text-primary-500" />
                <span>Warehouse Location Details</span>
              </span>
              <div className="space-y-1 font-semibold text-slate-600">
                <div>Terminal: <span className="font-bold text-slate-800">{selectedStock.warehouseName}</span></div>
                {targetWarehouse && (
                  <>
                    <div className="text-[10px] text-slate-450 font-medium">Address: {targetWarehouse.location}</div>
                    <div className="text-[10px] text-slate-450 font-medium">
                      Terminal Occupancy: {targetWarehouse.usedCapacityMT} / {targetWarehouse.capacityMT} MT
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
