'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { 
  FileText, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Percent, Award, Printer, Download, DollarSign, Wallet, Warehouse, Building, 
  Tractor, FlaskConical, ShoppingCart, ShoppingBag, ShieldCheck, Scale
} from 'lucide-react';
import IndianDateInput from '../../../components/shared/IndianDateInput';
import { formatDate } from '../../../utils/dateUtils';

export default function ProfitLossPage() {
  const { db } = useErp();

  // Date range state - Default from start of fiscal year 2026-04-01 to end of current year 2026-12-31 to capture all transactions
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState('2026-12-31');
  const [activeViewTab, setActiveViewTab] = useState<'statement' | 'commodities' | 'transactions'>('statement');
  const [commodityFilter, setCommodityFilter] = useState('All');

  // Quick select filters
  const handleQuickSelect = (range: 'all' | 'fy' | 'current-month' | 'last-30' | 'last-quarter') => {
    const today = new Date();
    if (range === 'all') {
      setFromDate('2026-01-01');
      setToDate('2026-12-31');
    } else if (range === 'fy') {
      setFromDate('2026-04-01');
      setToDate('2027-03-31');
    } else if (range === 'current-month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      setFromDate(`${year}-${month}-01`);
      setToDate(today.toISOString().split('T')[0]);
    } else if (range === 'last-30') {
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFromDate(past30.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    } else if (range === 'last-quarter') {
      setFromDate('2026-07-01');
      setToDate('2026-09-30');
    }
  };

  const commodities = db.commodities || [];
  const customers = db.customers || [];
  const suppliers = db.suppliers || [];
  const farmers = db.farmers || [];

  // 1. Calculate Comprehensive P&L Aggregates
  const plData = useMemo(() => {
    // ==========================================
    // A. SALES & REVENUE (Sales Invoices & Orders)
    // ==========================================
    const filteredSalesInvoices = (db.salesInvoices || []).filter(inv => {
      const d = inv.invoiceDate || '';
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    let grossSalesRevenue = 0;
    let totalSalesQty = 0;
    let salesFreightIncome = 0;
    let salesTaxCollected = 0;

    // Track commodity-wise sales metrics
    const commodityStats: Record<string, {
      name: string;
      salesQty: number;
      salesRevenue: number;
      purchaseQty: number;
      grossPurchaseCost: number;
      qcRebateSavings: number;
      netPurchaseCost: number;
      cogsCost: number;
    }> = {};

    commodities.forEach(c => {
      commodityStats[c.id] = {
        name: c.name,
        salesQty: 0,
        salesRevenue: 0,
        purchaseQty: 0,
        grossPurchaseCost: 0,
        qcRebateSavings: 0,
        netPurchaseCost: 0,
        cogsCost: 0
      };
    });

    filteredSalesInvoices.forEach(inv => {
      salesFreightIncome += Number(inv.freight || 0);
      salesTaxCollected += Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0));

      if (inv.items && inv.items.length > 0) {
        inv.items.forEach(item => {
          const cId = String(item.commodityId || '');
          const qty = Number(item.quantity || 0);
          const taxable = Number(item.taxableAmount !== undefined ? item.taxableAmount : (qty * Number(item.rate || item.settledRate || 0)));
          
          grossSalesRevenue += taxable;
          totalSalesQty += qty;

          if (commodityStats[cId]) {
            commodityStats[cId].salesQty += qty;
            commodityStats[cId].salesRevenue += taxable;
          }
        });
      } else {
        const taxable = Number(inv.taxableAmount || inv.grandTotal || 0);
        grossSalesRevenue += taxable;
      }
    });

    // ==========================================
    // B. PURCHASES & PROCUREMENT COSTS (Purchase Invoices & POs)
    // ==========================================
    const filteredPurchaseInvoices = (db.purchaseInvoices || []).filter(inv => {
      const d = inv.invoiceDate || '';
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    let grossPurchaseCost = 0;
    let totalQcRebateSavings = 0;
    let netPurchaseCost = 0;
    let purchaseFreightExpense = 0;
    let totalPurchaseQty = 0;

    filteredPurchaseInvoices.forEach(inv => {
      const grossBase = Number(inv.baseSubtotal || inv.subtotal || 0);
      const qcRebate = Number(inv.qualityRebateDeduction || 0);
      const frt = Number(inv.freight || 0);

      grossPurchaseCost += grossBase;
      totalQcRebateSavings += qcRebate;
      purchaseFreightExpense += frt;
      netPurchaseCost += (grossBase - qcRebate + frt);

      if (inv.items && inv.items.length > 0) {
        inv.items.forEach(item => {
          const cId = String(item.item || '');
          const qty = Number(item.invoiceQty || item.receivedQty || item.poQty || 0);
          const baseRate = Number(item.baseRate !== undefined ? item.baseRate : item.rate || 0);
          const lineGross = qty * baseRate;
          const lineRebate = Number(item.qualityRebateTotal || (Number(item.qualityRebatePerUnit || 0) * qty));
          const lineNet = lineGross - lineRebate;

          totalPurchaseQty += qty;

          if (commodityStats[cId]) {
            commodityStats[cId].purchaseQty += qty;
            commodityStats[cId].grossPurchaseCost += lineGross;
            commodityStats[cId].qcRebateSavings += lineRebate;
            commodityStats[cId].netPurchaseCost += lineNet;
          }
        });
      }
    });

    // Compute COGS (Cost of Goods Sold for Volume Sold)
    let totalCogs = 0;
    commodities.forEach(c => {
      const stat = commodityStats[c.id];
      if (stat) {
        // Average purchase unit cost (fallback to master purchaseCost if no invoices in period)
        const avgUnitCost = stat.purchaseQty > 0 
          ? (stat.netPurchaseCost / stat.purchaseQty) 
          : (c.purchaseCost || 0);
        
        stat.cogsCost = stat.salesQty * avgUnitCost;
        totalCogs += stat.cogsCost;
      }
    });

    // ==========================================
    // C. OPERATING EXPENSES
    // ==========================================
    const filteredExpenses = (db.expenses || []).filter(exp => {
      const d = exp.date || '';
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    let totalOperatingExpenses = 0;
    const expenseCategories: Record<string, number> = {
      Wages: 0,
      Rent: 0,
      Fuel: 0,
      Office: 0,
      Other: 0
    };

    filteredExpenses.forEach(exp => {
      const amt = Number(exp.amount || 0);
      totalOperatingExpenses += amt;
      const cat = exp.category || 'Other';
      if (expenseCategories[cat] !== undefined) {
        expenseCategories[cat] += amt;
      } else {
        expenseCategories.Other += amt;
      }
    });

    // ==========================================
    // D. PROFIT & MARGIN METRICS
    // ==========================================
    const grossProfit = grossSalesRevenue - totalCogs;
    const netProfit = grossProfit - totalOperatingExpenses;
    const grossMarginPercent = grossSalesRevenue > 0 ? (grossProfit / grossSalesRevenue) * 100 : 0;
    const netMarginPercent = grossSalesRevenue > 0 ? (netProfit / grossSalesRevenue) * 100 : 0;

    return {
      grossSalesRevenue,
      totalSalesQty,
      salesFreightIncome,
      salesTaxCollected,
      grossPurchaseCost,
      totalQcRebateSavings,
      netPurchaseCost,
      purchaseFreightExpense,
      totalPurchaseQty,
      totalCogs,
      totalOperatingExpenses,
      expenseCategories,
      grossProfit,
      netProfit,
      grossMarginPercent,
      netMarginPercent,
      commodityStats,
      filteredSalesInvoices,
      filteredPurchaseInvoices
    };
  }, [db.salesInvoices, db.purchaseInvoices, db.expenses, fromDate, toDate, commodities]);

  // Combined Transaction-Level Sales & Purchases Ledger
  const transactionsLedger = useMemo(() => {
    const list: Array<{
      date: string;
      type: 'Sale' | 'Purchase';
      docNo: string;
      partyName: string;
      commodityName: string;
      quantity: number;
      unitRate: number;
      grossAmount: number;
      qcRebate: number;
      netAmount: number;
      profitAmount?: number;
      status: string;
    }> = [];

    // Add Sales Invoices
    (db.salesInvoices || []).forEach(inv => {
      const d = inv.invoiceDate || '';
      if ((!fromDate || d >= fromDate) && (!toDate || d <= toDate)) {
        const cust = customers.find(c => c.id === inv.customerId);
        const firstItem = inv.items?.[0];
        const comm = commodities.find(c => c.id === firstItem?.commodityId);
        const qty = inv.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
        const rate = firstItem?.rate || 0;
        const gross = inv.taxableAmount || (qty * rate);
        const avgCost = comm?.purchaseCost || 0;
        const cogs = qty * avgCost;

        list.push({
          date: d,
          type: 'Sale',
          docNo: inv.invoiceNo,
          partyName: cust?.name || 'Customer Buyer',
          commodityName: comm?.name || 'Commodity',
          quantity: qty,
          unitRate: rate,
          grossAmount: gross,
          qcRebate: 0,
          netAmount: inv.grandTotal || gross,
          profitAmount: gross - cogs,
          status: inv.paymentStatus || 'Approved'
        });
      }
    });

    // Add Purchase Invoices
    (db.purchaseInvoices || []).forEach(inv => {
      const d = inv.invoiceDate || '';
      if ((!fromDate || d >= fromDate) && (!toDate || d <= toDate)) {
        const supName = inv.partyType === 'supplier'
          ? suppliers.find(s => s.id === inv.supplierId)?.name
          : farmers.find(f => f.id === inv.supplierId)?.name;
        
        const comm = commodities.find(c => c.id === inv.items?.[0]?.item || (c as any)._id === inv.items?.[0]?.item);
        const item = inv.items?.[0];
        const qty = item?.invoiceQty || item?.receivedQty || 0;
        const rate = item?.baseRate || item?.rate || 0;
        const gross = inv.baseSubtotal || inv.subtotal || (qty * rate);
        const rebate = inv.qualityRebateDeduction || 0;

        list.push({
          date: d,
          type: 'Purchase',
          docNo: inv.invoiceNo,
          partyName: supName || 'Vendor Sourcing',
          commodityName: comm?.name || 'Commodity',
          quantity: qty,
          unitRate: rate,
          grossAmount: gross,
          qcRebate: rebate,
          netAmount: inv.grandTotal || (gross - rebate),
          status: inv.status || 'Approved'
        });
      }
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [db.salesInvoices, db.purchaseInvoices, fromDate, toDate, customers, suppliers, farmers, commodities]);

  // Export CSV function
  const handleExportCSV = () => {
    const rows = [
      ['BRIJRANI AGRO FOODS LIMITED - FINANCIAL PROFIT & LOSS REPORT'],
      [`Period: ${fromDate} to ${toDate}`],
      [],
      ['1. REVENUE FROM OPERATIONS (SALES)', 'AMOUNT (INR)'],
      ['  Gross Commodity Sales (Sales Invoices)', plData.grossSalesRevenue],
      ['  Freight & Handling Income', plData.salesFreightIncome],
      ['  TOTAL REVENUE (A)', plData.grossSalesRevenue + plData.salesFreightIncome],
      [],
      ['2. DIRECT PROCUREMENT & COST OF GOODS SOLD (COGS)', 'AMOUNT (INR)'],
      ['  Gross Material Purchases', plData.grossPurchaseCost],
      ['  Quality Laboratory QC Rebate Deductions (Savings)', -plData.totalQcRebateSavings],
      ['  Inbound Sourcing Transport & Freight', plData.purchaseFreightExpense],
      ['  Net Purchases Sourced', plData.netPurchaseCost],
      ['  TOTAL DIRECT COST OF GOODS SOLD (COGS) (B)', plData.totalCogs],
      [],
      ['GROSS TRADING PROFIT (A - B)', plData.grossProfit],
      ['Gross Trading Margin (%)', `${plData.grossMarginPercent.toFixed(2)}%`],
      [],
      ['3. OPERATING OVERHEAD EXPENDITURES', 'AMOUNT (INR)'],
      ['  Labor & Silo Operations Wages', plData.expenseCategories.Wages],
      ['  Warehouse Facility Rent', plData.expenseCategories.Rent],
      ['  Logistics & Fuel Transportation', plData.expenseCategories.Fuel],
      ['  Office Administration & Governance', plData.expenseCategories.Office],
      ['  Other Overheads', plData.expenseCategories.Other],
      ['  TOTAL OPERATING OVERHEADS (C)', plData.totalOperatingExpenses],
      [],
      ['NET OPERATING PROFIT / LOSS (GROSS PROFIT - C)', plData.netProfit],
      ['Net Profit Margin (%)', `${plData.netMarginPercent.toFixed(2)}%`]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + rows.map(e => e.map(val => typeof val === 'string' ? `"${val}"` : val).join(',')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `brijrani_profit_loss_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Bar Calculations
  const chartHeight = 130;
  const values = [plData.grossSalesRevenue, plData.totalCogs, plData.totalOperatingExpenses, Math.max(0, plData.netProfit)];
  const maxVal = Math.max(...values, 10000);
  const getBarHeight = (val: number) => Math.max(4, Math.round((val / maxVal) * chartHeight));

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Financial Profit & Loss Statement</h1>
          <p className="text-xs font-medium text-slate-400">
            Real-time accounting of Sales, Purchases, QC Rebate deductions, Cost of Goods Sold (COGS), and Net Profit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-xs cursor-pointer transition shadow-xs"
          >
            <Printer size={13} className="text-slate-500" />
            <span>Print Statement</span>
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

      {/* Print Corporate Header */}
      <div className="hidden print:flex justify-between items-start border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">BRIJRANI AGRO FOODS LIMITED</h1>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mt-0.5">
            Patna Bypass Road, Didarganj, Patna, Bihar, 800008
          </span>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Trading Profit & Loss Statement</h2>
          <span className="text-xs text-slate-500 block mt-1 font-mono">Period: {fromDate} to {toDate}</span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={14} className="text-primary-600" />
              Statement Range:
            </span>
            <div className="flex items-center gap-1.5">
              <IndianDateInput
                value={fromDate}
                onChange={val => setFromDate(val)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-slate-400 font-bold">to</span>
              <IndianDateInput
                value={toDate}
                onChange={val => setToDate(val)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleQuickSelect('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                fromDate === '2026-01-01' && toDate === '2026-12-31' 
                  ? 'bg-primary-50 text-primary-700 border-primary-300 shadow-xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleQuickSelect('fy')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                fromDate === '2026-04-01' && toDate === '2027-03-31' 
                  ? 'bg-primary-50 text-primary-700 border-primary-300 shadow-xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              FY 2026-27
            </button>
            <button
              onClick={() => handleQuickSelect('current-month')}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickSelect('last-30')}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* View mode toggle tabs */}
        <div className="flex border-t border-slate-100 pt-3 gap-2">
          <button
            onClick={() => setActiveViewTab('statement')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeViewTab === 'statement'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText size={13} />
            <span>P&amp;L Financial Statement</span>
          </button>
          <button
            onClick={() => setActiveViewTab('commodities')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeViewTab === 'commodities'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Warehouse size={13} />
            <span>Commodity Margins</span>
          </button>
          <button
            onClick={() => setActiveViewTab('transactions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeViewTab === 'transactions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Scale size={13} />
            <span>Sales &amp; Purchases Ledger ({transactionsLedger.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Sales Revenue</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><DollarSign size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-850 block font-mono">₹{plData.grossSalesRevenue.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Billed Volume: {plData.totalSalesQty} MT</span>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Warehouse size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-850 block font-mono">₹{plData.totalCogs.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Purchased: {plData.totalPurchaseQty} MT</span>
          </div>
        </div>

        {/* QC Rebate Deductions (Savings) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quality QC Savings</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><FlaskConical size={14} /></span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-emerald-700 block font-mono">
              +₹{plData.totalQcRebateSavings.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Lab settlement deductions</span>
          </div>
        </div>

        {/* Gross Margin */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gross Trading Profit</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600"><Percent size={14} /></span>
          </div>
          <div className="mt-3">
            <span className={`text-lg font-bold block font-mono ${plData.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ₹{plData.grossProfit.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
              Trading Margin: {plData.grossMarginPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between ring-2 ring-emerald-500/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Operating Profit</span>
            <span className={`p-1.5 rounded-lg ${plData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Award size={14} />
            </span>
          </div>
          <div className="mt-3">
            <span className={`text-lg font-bold block font-mono ${plData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ₹{plData.netProfit.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
              Net Margin: {plData.netMarginPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeViewTab === 'statement' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Structured Bookkeeping Ledger */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5 print:border-none print:shadow-none print:p-0">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Trading &amp; Profit Loss Statement</h3>
              <span className="text-[10px] text-slate-400 block mt-0.5">Accrual accounting statement of sales revenues, sourcing costs, and overhead expenditures.</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {/* 1. Operating Revenue */}
              <div className="pb-3.5 space-y-1.5">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">1. Revenue from Sales Operations</span>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Gross Commodity Sales (Billed Invoices)</span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.grossSalesRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Freight &amp; Transportation Recovery</span>
                  <span className="font-mono text-slate-700">₹{plData.salesFreightIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-150 pt-2 mt-1">
                  <span>TOTAL OPERATING REVENUE (A)</span>
                  <span className="font-mono text-indigo-700 text-sm">₹{(plData.grossSalesRevenue + plData.salesFreightIncome).toLocaleString()}</span>
                </div>
              </div>

              {/* 2. Direct Procurement & COGS */}
              <div className="py-3.5 space-y-1.5">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">2. Direct Procurement &amp; Cost of Goods Sold (COGS)</span>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Gross Material Sourcing Purchases</span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.grossPurchaseCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-700 font-bold">
                  <span className="flex items-center gap-1">
                    <FlaskConical size={12} />
                    Quality Rebate Deductions (QC Savings)
                  </span>
                  <span className="font-mono">-₹{plData.totalQcRebateSavings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Inbound Logistics &amp; Transport Charges</span>
                  <span className="font-mono text-slate-700">₹{plData.purchaseFreightExpense.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-150 pt-2 mt-1">
                  <span>TOTAL COST OF GOODS SOLD (COGS) (B)</span>
                  <span className="font-mono text-amber-700 text-sm">₹{plData.totalCogs.toLocaleString()}</span>
                </div>
              </div>

              {/* 3. Gross Profit Margin */}
              <div className="py-3.5 bg-slate-50/70 px-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-slate-800 font-bold">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">GROSS TRADING PROFIT (A - B)</span>
                  <span className="text-xs text-indigo-700 block mt-0.5">Gross Margin: {plData.grossMarginPercent.toFixed(2)}%</span>
                </div>
                <span className={`text-base font-bold font-mono ${plData.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  ₹{plData.grossProfit.toLocaleString()}
                </span>
              </div>

              {/* 4. Operating Overhead Expenses */}
              <div className="py-3.5 space-y-1.5">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">3. Operating Overhead Expenses</span>
                <div className="flex justify-between py-1 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Wages &amp; Silo Operations Labor
                  </span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.expenseCategories.Wages.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Warehouse Silo Facility Rent
                  </span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.expenseCategories.Rent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Logistics Dispatch &amp; Fuel Charges
                  </span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.expenseCategories.Fuel.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Office Operations &amp; Admin
                  </span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.expenseCategories.Office.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    Other Overhead Expenditures
                  </span>
                  <span className="font-mono font-bold text-slate-800">₹{plData.expenseCategories.Other.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-150 pt-2 mt-1">
                  <span>TOTAL OPERATING OVERHEADS (C)</span>
                  <span className="font-mono text-rose-600 text-sm">₹{plData.totalOperatingExpenses.toLocaleString()}</span>
                </div>
              </div>

              {/* 5. Net Operating Profit */}
              <div className="pt-3.5 bg-emerald-50/50 px-3.5 rounded-xl border border-emerald-200 flex justify-between items-center text-slate-900 font-bold">
                <div>
                  <span className="block text-[10px] text-emerald-800 font-bold uppercase tracking-wider">NET OPERATING PROFIT / LOSS</span>
                  <span className="text-xs text-emerald-700 block mt-0.5">Net Return Margin: {plData.netMarginPercent.toFixed(2)}%</span>
                </div>
                <span className={`text-lg font-extrabold font-mono ${plData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  ₹{plData.netProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Trend Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5 print:hidden">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Financial Ratio Chart</h3>
              <span className="text-[10px] text-slate-400 block mt-0.5">Visual comparison of revenue, direct COGS, overheads, and net yield.</span>
            </div>

            {/* SVG Custom Rendered Bar Chart */}
            <div className="flex justify-center items-center py-2">
              <svg width="240" height="190" viewBox="0 0 240 190" className="font-sans">
                {/* Grid lines */}
                <line x1="30" y1="20" x2="220" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="30" y1="60" x2="220" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="30" y1="100" x2="220" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="30" y1="145" x2="220" y2="145" stroke="#cbd5e1" strokeWidth="1.5" />

                {/* Bar 1: Gross Sales */}
                <rect 
                  x="45" 
                  y={145 - getBarHeight(plData.grossSalesRevenue)} 
                  width="28" 
                  height={getBarHeight(plData.grossSalesRevenue)} 
                  fill="#4f46e5" 
                  rx="4" 
                />
                {/* Bar 2: COGS */}
                <rect 
                  x="90" 
                  y={145 - getBarHeight(plData.totalCogs)} 
                  width="28" 
                  height={getBarHeight(plData.totalCogs)} 
                  fill="#f59e0b" 
                  rx="4" 
                />
                {/* Bar 3: Expenses */}
                <rect 
                  x="135" 
                  y={145 - getBarHeight(plData.totalOperatingExpenses)} 
                  width="28" 
                  height={getBarHeight(plData.totalOperatingExpenses)} 
                  fill="#f43f5e" 
                  rx="4" 
                />
                {/* Bar 4: Net Profit */}
                <rect 
                  x="180" 
                  y={145 - getBarHeight(Math.max(0, plData.netProfit))} 
                  width="28" 
                  height={getBarHeight(Math.max(0, plData.netProfit))} 
                  fill="#10b981" 
                  rx="4" 
                />

                {/* X Axis Labels */}
                <text x="59" y="162" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">SALES</text>
                <text x="104" y="162" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">COGS</text>
                <text x="149" y="162" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">EXP</text>
                <text x="194" y="162" fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">NET</text>

                {/* Y Axis Max Value Indicator */}
                <text x="26" y="24" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="end">₹{(maxVal / 1000).toFixed(0)}K</text>
                <text x="26" y="148" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="end">₹0</text>
              </svg>
            </div>

            {/* Chart Legend */}
            <div className="space-y-2 text-xs font-semibold text-slate-600 bg-slate-50 p-3 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-600" />
                  Sales Revenue
                </span>
                <span className="font-mono font-bold text-slate-800">₹{plData.grossSalesRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                  Direct COGS
                </span>
                <span className="font-mono font-bold text-slate-800">₹{plData.totalCogs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                  Operating Expenses
                </span>
                <span className="font-mono font-bold text-slate-800">₹{plData.totalOperatingExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-bold text-emerald-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                  Net Operating Profit
                </span>
                <span className="font-mono">₹{plData.netProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commodity Profitability Tab */}
      {activeViewTab === 'commodities' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Commodity Trading Margins &amp; QC Deductions</h3>
              <span className="text-[10px] text-slate-400 block mt-0.5">Granular performance showing sales volume, sourcing cost, QC laboratory rebates, and net trading yield per commodity.</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3.5">Commodity</th>
                  <th className="py-3 px-3.5 text-right">Sales Volume</th>
                  <th className="py-3 px-3.5 text-right">Sales Revenue (₹)</th>
                  <th className="py-3 px-3.5 text-right">Purchase Sourced (₹)</th>
                  <th className="py-3 px-3.5 text-right">QC Rebate Savings (₹)</th>
                  <th className="py-3 px-3.5 text-right">COGS Cost (₹)</th>
                  <th className="py-3 px-3.5 text-right">Trading Profit (₹)</th>
                  <th className="py-3 px-3.5 text-right">Trading Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commodities.map(c => {
                  const stat = plData.commodityStats[c.id] || {
                    salesQty: 0,
                    salesRevenue: 0,
                    grossPurchaseCost: 0,
                    qcRebateSavings: 0,
                    cogsCost: 0
                  };
                  const profit = stat.salesRevenue - stat.cogsCost;
                  const margin = stat.salesRevenue > 0 ? (profit / stat.salesRevenue) * 100 : 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-3.5 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3.5 px-3.5 text-right font-mono">{stat.salesQty} MT</td>
                      <td className="py-3.5 px-3.5 text-right font-mono font-bold text-indigo-700">
                        ₹{stat.salesRevenue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono text-slate-700">
                        ₹{stat.grossPurchaseCost.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono text-emerald-600 font-bold">
                        {stat.qcRebateSavings > 0 ? `+₹${stat.qcRebateSavings.toLocaleString()}` : '₹0'}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono text-amber-700">
                        ₹{stat.cogsCost.toLocaleString()}
                      </td>
                      <td className={`py-3.5 px-3.5 text-right font-mono font-extrabold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₹{profit.toLocaleString()}
                      </td>
                      <td className={`py-3.5 px-3.5 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}

                {/* Summary Row */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900 text-xs">
                  <td className="py-3.5 px-3.5 uppercase tracking-wider">TOTAL COMMODITIES</td>
                  <td className="py-3.5 px-3.5 text-right font-mono">{plData.totalSalesQty} MT</td>
                  <td className="py-3.5 px-3.5 text-right font-mono text-indigo-700">₹{plData.grossSalesRevenue.toLocaleString()}</td>
                  <td className="py-3.5 px-3.5 text-right font-mono">₹{plData.grossPurchaseCost.toLocaleString()}</td>
                  <td className="py-3.5 px-3.5 text-right font-mono text-emerald-600">+₹{plData.totalQcRebateSavings.toLocaleString()}</td>
                  <td className="py-3.5 px-3.5 text-right font-mono text-amber-700">₹{plData.totalCogs.toLocaleString()}</td>
                  <td className={`py-3.5 px-3.5 text-right font-mono font-extrabold ${plData.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{plData.grossProfit.toLocaleString()}
                  </td>
                  <td className={`py-3.5 px-3.5 text-right font-mono font-bold ${plData.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {plData.grossMarginPercent.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Combined Transactions Ledger Tab */}
      {activeViewTab === 'transactions' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Sales &amp; Purchases Financial Transaction Ledger</h3>
              <span className="text-[10px] text-slate-400 block mt-0.5">Comprehensive audit trail of all Sales Invoices and Purchase Invoices contributing to the financial P&amp;L.</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Doc No</th>
                  <th className="py-3 px-3">Party (Customer / Vendor)</th>
                  <th className="py-3 px-3">Commodity</th>
                  <th className="py-3 px-3 text-right">Qty (MT)</th>
                  <th className="py-3 px-3 text-right">Rate / MT (₹)</th>
                  <th className="py-3 px-3 text-right">Gross Value (₹)</th>
                  <th className="py-3 px-3 text-right">QC Rebate (₹)</th>
                  <th className="py-3 px-3 text-right">Net Value (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactionsLedger.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                      No sales or purchase transactions found in the selected date range.
                    </td>
                  </tr>
                ) : (
                  transactionsLedger.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono text-slate-600">{formatDate(tx.date)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          tx.type === 'Sale'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{tx.docNo}</td>
                      <td className="py-3 px-3 text-slate-800 font-medium">{tx.partyName}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{tx.commodityName}</td>
                      <td className="py-3 px-3 text-right font-mono">{tx.quantity} MT</td>
                      <td className="py-3 px-3 text-right font-mono">₹{tx.unitRate.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">₹{tx.grossAmount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 font-bold">
                        {tx.qcRebate > 0 ? `-₹${tx.qcRebate.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                        ₹{tx.netAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          tx.status === 'Paid' || tx.status === 'Matched' || tx.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
