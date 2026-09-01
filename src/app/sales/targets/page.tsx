'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { saveDb } from '../../../services/erpService';
import DataTable from '../../../components/shared/DataTable';
import { Plus, Target, Award, DollarSign } from 'lucide-react';

function TargetsPageContent() {
  const { db, refreshDb, showToast } = useErp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [employee, setEmployee] = useState('');
  const [period, setPeriod] = useState('2026-08');
  const [targetAmount, setTargetAmount] = useState(0);

  const handleCreateTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !targetAmount) {
      showToast('Please fill all fields', 'error');
      return;
    }

    const dbStore = db;
    dbStore.salesTargets = dbStore.salesTargets || [];
    dbStore.salesTargets.push({
      id: `TRG-${Date.now()}`,
      employee,
      period,
      targetAmount,
      actualAmount: 0
    });

    saveDb(dbStore);
    refreshDb();
    setIsCreateOpen(false);
    showToast(`Target set successfully for ${employee}`, 'success');
  };

  const columnsTargets: any[] = [
    { header: 'Sales Person', accessor: 'employee', sortable: true },
    { header: 'Period', accessor: 'period' },
    { header: 'Target (₹)', accessor: (row: any) => `₹${row.targetAmount.toLocaleString()}` },
    { header: 'Actual Sales (₹)', accessor: (row: any) => `₹${(row.actualAmount || 0).toLocaleString()}` },
    { 
      header: 'Achievement %', 
      accessor: (row: any) => {
        const pct = row.targetAmount > 0 ? Math.round((row.actualAmount || 0) * 100 / row.targetAmount) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary-600 h-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
            </div>
            <span className="text-[10px] font-bold text-slate-700">{pct}%</span>
          </div>
        );
      }
    }
  ];

  const columnsCommissions: any[] = [
    { header: 'Sales Executive', accessor: 'salesperson', sortable: true },
    { header: 'Invoice Value', accessor: (row: any) => `₹${row.amount.toLocaleString()}` },
    { header: 'Rate %', accessor: (row: any) => `${row.commissionRate}%` },
    { header: 'Commission (₹)', accessor: (row: any) => `₹${row.commission.toLocaleString()}`, sortable: true },
    { 
      header: 'Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-250' :
          'bg-amber-50 text-amber-600 border-amber-250'
        }`}>
          {row.status || 'Pending'}
        </span>
      )
    }
  ];

  const salesTargets = db.salesTargets || [];

  const salesCommissions = db.salesCommissions || [];

  return (
    <div className="space-y-8">
      {/* Target header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Target & Commissions</h1>
          <p className="text-xs font-medium text-slate-400">Manage sales quotas, track real-time target achievements, and check executive commission earnings.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Allocate Sales Quota</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
            <Target size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Average Achievement</span>
            <span className="text-lg font-bold text-slate-800">68.5%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Top Performer</span>
            <span className="text-lg font-bold text-slate-800">Rohan Sharma</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Commission Paid</span>
            <span className="text-lg font-bold text-slate-800">₹26,000</span>
          </div>
        </div>
      </div>

      {/* Target Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Quota Performance Table</h3>
        <DataTable
          data={salesTargets}
          columns={columnsTargets}
          searchPlaceholder="Search salesperson..."
          searchField="employee"
          exportFileName="sales_targets_report"
        />
      </div>

      {/* Commissions Table */}
      <div className="space-y-3 pt-4">
        <h3 className="text-sm font-bold text-slate-800">Invoice Commission Log</h3>
        <DataTable
          data={salesCommissions}
          columns={columnsCommissions}
          searchPlaceholder="Search salesperson..."
          searchField="salesperson"
          exportFileName="sales_commissions_report"
        />
      </div>

      {/* Quota Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Set Monthly Target Quota</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateTarget} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Sales Representative Email / Name *</label>
                <input
                  type="text"
                  value={employee}
                  onChange={e => setEmployee(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  placeholder="e.g. siddharth@brijrani.com"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Target Period Month *</label>
                <input
                  type="month"
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Target Turnover Amount (₹) *</label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={e => setTargetAmount(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold"
                >
                  Set Quota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesTargetsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <TargetsPageContent />
    </React.Suspense>
  );
}
