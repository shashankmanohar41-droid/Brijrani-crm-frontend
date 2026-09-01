'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { FileText, Calendar, TrendingUp, TrendingDown, ArrowUpRight, Percent, Award, Printer, Download, DollarSign, Wallet, Warehouse, Building, Tractor } from 'lucide-react';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function ProfitLossPage() {
  const { db } = useErp();

  // Date range state
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-08-31');

  // Quick select filters
  const handleQuickSelect = (range: 'current-month' | 'last-30' | 'last-quarter') => {
    const today = new Date();
    if (range === 'current-month') {
      setFromDate('2026-08-01');
      setToDate('2026-08-31');
    } else if (range === 'last-30') {
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFromDate(past30.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    } else if (range === 'last-quarter') {
      setFromDate('2026-06-01');
      setToDate('2026-08-31');
    }
  };

  const commodities = db.commodities;
  const customers = db.customers;

  // 1. Calculate P&L aggregates
  const plData = useMemo(() => {
    // A. Revenue (Sales Invoices within period)
    const filteredInvoices = db.salesInvoices.filter(inv => {
      return inv.invoiceDate >= fromDate && inv.invoiceDate <= toDate;
    });

    let grossSales = 0;
    let totalCogs = 0;
    
    // Track commodity wise sales for granular analysis
    const commoditySales: Record<string, { qty: number; revenue: number; cogs: number }> = {};
    commodities.forEach(c => {
      commoditySales[c.id] = { qty: 0, revenue: 0, cogs: 0 };
    });

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const itemVal = item.taxableAmount;
        grossSales += itemVal;

        // Calculate COGS using the average cost of that commodity
        const commodity = commodities.find(c => c.id === item.commodityId);
        const avgCost = commodity?.purchaseCost || 0;
        const itemCogs = item.quantity * avgCost;
        totalCogs += itemCogs;

        if (commoditySales[item.commodityId]) {
          commoditySales[item.commodityId].qty += item.quantity;
          commoditySales[item.commodityId].revenue += itemVal;
          commoditySales[item.commodityId].cogs += itemCogs;
        }
      });
    });

    // B. Operating Expenses within period
    const filteredExpenses = db.expenses.filter(exp => {
      return exp.date >= fromDate && exp.date <= toDate;
    });

    let totalExpenses = 0;
    const expenseCategories: Record<string, number> = {
      Wages: 0,
      Rent: 0,
      Fuel: 0,
      Office: 0,
      Other: 0
    };

    filteredExpenses.forEach(exp => {
      const amt = exp.amount; // Base amount without GST for operating cost
      totalExpenses += amt;
      const cat = exp.category || 'Other';
      if (expenseCategories[cat] !== undefined) {
        expenseCategories[cat] += amt;
      } else {
        expenseCategories.Other += amt;
      }
    });

    // C. Profit metrics
    const grossProfit = grossSales - totalCogs;
    const netProfit = grossProfit - totalExpenses;
    
    const grossMarginPercent = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;
    const netMarginPercent = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

    return {
      grossSales,
      totalCogs,
      grossProfit,
      totalExpenses,
      netProfit,
      grossMarginPercent,
      netMarginPercent,
      expenseCategories,
      commoditySales
    };
  }, [db.salesInvoices, db.expenses, fromDate, toDate, commodities]);

  // Export CSV function
  const handleExportCSV = () => {
    const rows = [
      ['BrijRani Agro Foods - Profit & Loss Statement'],
      [`Period: ${fromDate} to ${toDate}`],
      [],
      ['Particulars', 'Amount (INR)'],
      ['OPERATING REVENUE'],
      ['  Gross Revenue (Sales Invoices)', plData.grossSales],
      ['  TOTAL REVENUE', plData.grossSales],
      [],
      ['COST OF GOODS SOLD (COGS)'],
      ['  Direct Material Sourcing Cost', plData.totalCogs],
      ['  TOTAL DIRECT COST', plData.totalCogs],
      [],
      ['GROSS PROFIT', plData.grossProfit],
      [`Gross Margin (%)`, `${plData.grossMarginPercent.toFixed(2)}%`],
      [],
      ['OPERATING EXPENSES'],
      ['  Labor & Wages / Surcharges', plData.expenseCategories.Wages],
      ['  Warehouse Silo Rent', plData.expenseCategories.Rent],
      ['  Logistics & Fuel Transportation', plData.expenseCategories.Fuel],
      ['  Office Administration', plData.expenseCategories.Office],
      ['  Other Overheads', plData.expenseCategories.Other],
      ['  TOTAL OPERATING EXPENSES', plData.totalExpenses],
      [],
      ['NET OPERATING PROFIT', plData.netProfit],
      [`Net Profit Margin (%)`, `${plData.netMarginPercent.toFixed(2)}%`]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + rows.map(e => e.map(val => typeof val === 'string' ? `"${val}"` : val).join(',')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `profit_loss_statement_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate SVG bar heights (max height is 120px)
  const chartHeight = 120;
  const values = [plData.grossSales, plData.totalCogs, plData.totalExpenses, Math.max(0, plData.netProfit)];
  const maxVal = Math.max(...values, 10000);
  const getBarHeight = (val: number) => {
    return Math.round((val / maxVal) * chartHeight);
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Header (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Financial Profit & Loss Statement</h1>
          <p className="text-xs font-medium text-slate-400">Track operating margins, sourcing direct costs, and overhead expenditures.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-xs cursor-pointer transition shadow-sm"
          >
            <Printer size={13} className="text-slate-500" />
            <span>Print PDF Statement</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-md shadow-primary-600/10"
          >
            <Download size={13} />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* Print-only corporate header */}
      <div className="hidden print:flex justify-between items-start border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-850">BRIJRANI AGRO FOODS</h1>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">Silos Complex, Patna, Bihar, IN</span>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Profit & Loss Statement</h2>
          <span className="text-xs text-slate-500 block mt-1 font-mono">Period: {fromDate} to {toDate}</span>
        </div>
      </div>

      {/* Control panel / date selectors (Hidden in Print) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              Statement Period
            </span>
            <div className="flex items-center gap-1.5">
              <IndianDateInput
                value={fromDate}
                onChange={val => setFromDate(val)}
                className="px-3 py-1.5 border border-slate-250 rounded-lg text-xs bg-white font-mono text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400 text-xs font-semibold">to</span>
              <IndianDateInput
                value={toDate}
                onChange={val => setToDate(val)}
                className="px-3 py-1.5 border border-slate-250 rounded-lg text-xs bg-white font-mono text-slate-700 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="flex gap-1.5">
            <button
              onClick={() => handleQuickSelect('current-month')}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Current Month
            </button>
            <button
              onClick={() => handleQuickSelect('last-30')}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleQuickSelect('last-quarter')}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Last Quarter
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Gross Sales Revenue</span>
            <span className="p-1 rounded bg-indigo-50 text-indigo-600"><DollarSign size={13} /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-lg font-bold text-slate-800 block">₹{plData.grossSales.toLocaleString()}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">Gross sales invoice values</span>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
            <span className="p-1 rounded bg-amber-50 text-amber-600"><Warehouse size={13} /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-lg font-bold text-slate-800 block">₹{plData.totalCogs.toLocaleString()}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">Material purchase weight costs</span>
          </div>
        </div>

        {/* Gross Margin */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Trading Gross Margin</span>
            <span className="p-1 rounded bg-teal-50 text-teal-600"><Percent size={13} /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-lg font-bold text-slate-800 block flex items-center gap-1">
              {plData.grossMarginPercent.toFixed(1)}%
              {plData.grossMarginPercent >= 10 ? (
                <TrendingUp size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <TrendingDown size={14} className="text-rose-500 shrink-0" />
              )}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">Markup margin after COGS deduction</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Operating Expenses</span>
            <span className="p-1 rounded bg-rose-50 text-rose-600"><Wallet size={13} /></span>
          </div>
          <div className="mt-3.5">
            <span className="text-lg font-bold text-slate-800 block">₹{plData.totalExpenses.toLocaleString()}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">Logistics, labor, rent and office costs</span>
          </div>
        </div>

        {/* Net Operating Profit */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between ring-2 ring-emerald-500/10">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Net Operating Profit</span>
            <span className={`p-1 rounded ${plData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <Award size={13} />
            </span>
          </div>
          <div className="mt-3.5">
            <span className={`text-lg font-bold block ${plData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{plData.netProfit.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">Net margin: {plData.netMarginPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Structured Ledger (Left) & SVG Trend Chart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Structured Bookkeeping Ledger Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-100 pb-3 print:border-slate-800 print:border-b">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Accounting Breakdown</h3>
            <span className="text-[10px] text-slate-400 block mt-0.5 print:hidden">Audit breakdown of revenues, sourcing charges, and overhead ledger lines.</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {/* 1. Operating Revenue */}
            <div className="pb-3.5">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-2">1. Operating Revenue</span>
              <div className="flex justify-between py-1 text-slate-655">
                <span>Gross Commodity Sales (Sales Invoices)</span>
                <span>₹{plData.grossSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-655">
                <span>Other Operating Receipts</span>
                <span>₹0</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-150 pt-2 mt-1">
                <span>Total Revenue (A)</span>
                <span>₹{plData.grossSales.toLocaleString()}</span>
              </div>
            </div>

            {/* 2. Direct Costs (COGS) */}
            <div className="py-3.5">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-2">2. Cost of Goods Sold (COGS)</span>
              <div className="flex justify-between py-1 text-slate-655">
                <span>Grain Sourcing Purchase Price (Average cost)</span>
                <span>₹{plData.totalCogs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-655">
                <span>Direct Inbound Freight (Logistics loading charges)</span>
                <span>₹0</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-150 pt-2 mt-1">
                <span>Total Direct Costs (B)</span>
                <span>₹{plData.totalCogs.toLocaleString()}</span>
              </div>
            </div>

            {/* 3. Gross Margin */}
            <div className="py-3.5 bg-slate-50/40 px-3 rounded-lg border border-slate-100 flex justify-between items-center text-slate-800 font-bold">
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Gross Margin Profit (A - B)</span>
                <span className="text-xs text-indigo-600 block mt-1">Trading Margin: {plData.grossMarginPercent.toFixed(2)}%</span>
              </div>
              <span className="text-sm font-bold">₹{plData.grossProfit.toLocaleString()}</span>
            </div>

            {/* 4. Operating Expenses */}
            <div className="py-3.5">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-2">3. Operating Overhead Expenses</span>
              <div className="flex justify-between py-1 text-slate-655">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Wages & Silo Operations Labor
                </span>
                <span>₹{plData.expenseCategories.Wages.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-655">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Warehouse Silo Facility Rent
                </span>
                <span>₹{plData.expenseCategories.Rent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-655">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Logistics Dispatch & Fuel Charges
                </span>
                <span>₹{plData.expenseCategories.Fuel.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-655">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  Office Operations & Admin
                </span>
                <span>₹{plData.expenseCategories.Office.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-655">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Other Overhead Expenditures
                </span>
                <span>₹{plData.expenseCategories.Other.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-150 pt-2 mt-1">
                <span>Total Operating Overheads (C)</span>
                <span>₹{plData.totalExpenses.toLocaleString()}</span>
              </div>
            </div>

            {/* 5. Net Profit */}
            <div className="pt-3.5 bg-emerald-50/20 px-3 rounded-lg border border-emerald-100 flex justify-between items-center text-slate-850 font-bold">
              <div>
                <span className="block text-[10px] text-emerald-700 font-bold uppercase tracking-wider leading-none">Net Profit / Loss (Gross Profit - C)</span>
                <span className="text-xs text-emerald-600 block mt-1">Net Sourcing Return: {plData.netMarginPercent.toFixed(2)}%</span>
              </div>
              <span className="text-sm font-bold text-emerald-600">₹{plData.netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Visual Trend Chart panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6 print:hidden">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Visual Trend</h3>
            <span className="text-[10px] text-slate-400 block mt-0.5">Ratio chart comparison of inflows, purchases, and net yields.</span>
          </div>

          {/* SVG Custom Rendered Bar Chart */}
          <div className="flex justify-center items-center py-4">
            <svg width="220" height="180" viewBox="0 0 220 180" className="font-sans">
              {/* Grid lines */}
              <line x1="30" y1="20" x2="200" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="60" x2="200" y2="60" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="100" x2="200" y2="100" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="30" y1="140" x2="200" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Bar 1: Gross Sales */}
              <rect 
                x="45" 
                y={140 - getBarHeight(plData.grossSales)} 
                width="24" 
                height={getBarHeight(plData.grossSales)} 
                fill="#4f46e5" 
                rx="4" 
              />
              {/* Bar 2: COGS */}
              <rect 
                x="85" 
                y={140 - getBarHeight(plData.totalCogs)} 
                width="24" 
                height={getBarHeight(plData.totalCogs)} 
                fill="#f59e0b" 
                rx="4" 
              />
              {/* Bar 3: Expenses */}
              <rect 
                x="125" 
                y={140 - getBarHeight(plData.totalExpenses)} 
                width="24" 
                height={getBarHeight(plData.totalExpenses)} 
                fill="#f43f5e" 
                rx="4" 
              />
              {/* Bar 4: Net Profit */}
              <rect 
                x="165" 
                y={140 - getBarHeight(Math.max(0, plData.netProfit))} 
                width="24" 
                height={getBarHeight(Math.max(0, plData.netProfit))} 
                fill="#10b981" 
                rx="4" 
              />

              {/* X Axis Labels */}
              <text x="57" y="156" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">REV</text>
              <text x="97" y="156" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">COGS</text>
              <text x="137" y="156" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">EXP</text>
              <text x="177" y="156" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">NET</text>

              {/* Y Axis Max Value Indicator */}
              <text x="26" y="23" fill="#cbd5e1" fontSize="7" fontWeight="bold" textAnchor="end">₹{(maxVal / 1000).toFixed(0)}K</text>
              <text x="26" y="142" fill="#cbd5e1" fontSize="7" fontWeight="bold" textAnchor="end">₹0</text>
            </svg>
          </div>

          {/* Chart Legend */}
          <div className="space-y-2 text-[10px] font-bold text-slate-500 pl-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-indigo-600 block shrink-0" />
              <span>Revenue: ₹{plData.grossSales.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 block shrink-0" />
              <span>COGS Cost: ₹{plData.totalCogs.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 block shrink-0" />
              <span>Overheads: ₹{plData.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 pt-2 mt-1 text-slate-800">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 block shrink-0" />
              <span>Net Profit: ₹{plData.netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sourcing Commodity Profitability breakdown card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 print:mt-6 print:border-none print:shadow-none print:p-0">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Commodity Profitability Breakdown</h3>
          <span className="text-[10px] text-slate-400 block mt-0.5 print:hidden">Commodity trading performance matching direct volume and margins.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-semibold text-slate-655">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[9px] print:bg-transparent print:border-slate-800">
                <th className="py-2.5 px-3">Commodity Name</th>
                <th className="py-2.5 px-3 text-right">Volume Sold (MT)</th>
                <th className="py-2.5 px-3 text-right">Avg Purchase Cost/MT</th>
                <th className="py-2.5 px-3 text-right">COGS Sourcing (₹)</th>
                <th className="py-2.5 px-3 text-right">Sales Revenue (₹)</th>
                <th className="py-2.5 px-3 text-right">Trading Profit (₹)</th>
                <th className="py-2.5 px-3 text-right">Trading Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commodities.map(c => {
                const stat = plData.commoditySales[c.id] || { qty: 0, revenue: 0, cogs: 0 };
                const profit = stat.revenue - stat.cogs;
                const margin = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition print:hover:bg-transparent">
                    <td className="py-3 px-3 font-bold text-slate-800">{c.name}</td>
                    <td className="py-3 px-3 text-right font-mono">{stat.qty} MT</td>
                    <td className="py-3 px-3 text-right font-mono">₹{c.purchaseCost.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono">₹{stat.cogs.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono">₹{stat.revenue.toLocaleString()}</td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ₹{profit.toLocaleString()}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              
              {/* Total Row */}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800 text-[11px] print:bg-transparent print:border-slate-800">
                <td className="py-3 px-3 uppercase tracking-wider">Total commodities</td>
                <td className="py-3 px-3 text-right font-mono">
                  {Object.values(plData.commoditySales).reduce((sum, s) => sum + s.qty, 0)} MT
                </td>
                <td className="py-3 px-3 text-right font-mono">-</td>
                <td className="py-3 px-3 text-right font-mono">₹{plData.totalCogs.toLocaleString()}</td>
                <td className="py-3 px-3 text-right font-mono">₹{plData.grossSales.toLocaleString()}</td>
                <td className={`py-3 px-3 text-right font-mono font-bold ${plData.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹{plData.grossProfit.toLocaleString()}
                </td>
                <td className={`py-3 px-3 text-right font-mono font-bold ${plData.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {plData.grossMarginPercent.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
