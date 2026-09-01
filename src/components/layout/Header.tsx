'use client';

import React, { useState } from 'react';
import { Plus, UserCircle2, ArrowRightLeft, LogOut } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import GlobalSearch from './GlobalSearch';
import NotificationsDropdown from './NotificationsDropdown';
import QuickCreateModal from './QuickCreateModal';

export default function Header() {
  const { currentUserRole, setRole, currentUser, logout } = useErp();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const roles = [
    'Super Admin',
    'Purchase Manager',
    'Sales Manager',
    'Warehouse Staff',
    'Accountant'
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm relative z-[99]">
      {/* Left Section: Global Search */}
      <div className="flex items-center gap-4">
        {/* Global Search */}
        <GlobalSearch />
      </div>

      {/* Right Section: Quick Create, Alerts, Role Switcher */}
      <div className="flex items-center gap-4">
        {/* Quick Create (+) */}
        <button
          onClick={() => setQuickCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-md shadow-primary-600/10 cursor-pointer transition"
        >
          <Plus size={14} />
          <span>New</span>
        </button>

        {/* System Alert Center */}
        <NotificationsDropdown />

        {/* Role Switcher & User Profile */}
        <div className="relative group flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 cursor-pointer transition select-none">
            <UserCircle2 size={16} className="text-slate-500" />
            <div className="text-left hidden sm:block">
              <span className="block text-[10px] text-slate-400 font-semibold leading-none">
                {currentUserRole === 'Super Admin' ? 'Admin Switcher' : 'Employee Session'}
              </span>
              <span className="text-[11px] font-bold text-slate-700 block mt-0.5">{currentUser?.name || 'Staff User'}</span>
            </div>
            {currentUserRole === 'Super Admin' && <ArrowRightLeft size={10} className="text-slate-400 ml-1" />}
          </div>

          {/* User & Role Dropdown */}
          <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg hidden group-hover:block z-[999] overflow-hidden py-1">
            {/* User Account Info */}
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/30">
              <span className="block text-xs font-bold text-slate-700 leading-tight">{currentUser?.name || 'Staff User'}</span>
              <span className="block text-[9px] text-slate-400 font-mono mt-0.5 truncate">{currentUser?.email || 'staff@brijrani.com'}</span>
              <span className="inline-block mt-1.5 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[8px] font-bold rounded uppercase">
                {currentUserRole}
              </span>
            </div>

            {/* Developer Role Switcher (Super Admin Only) */}
            {currentUserRole === 'Super Admin' && (
              <div className="border-b border-slate-100 py-1">
                <div className="px-4 py-1.5 bg-slate-50/10">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Dev Role Switcher</span>
                </div>
                {roles.map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`w-full text-left px-4 py-1.5 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer ${
                      r === currentUserRole ? 'text-primary-600 bg-primary-50/30 font-bold' : 'text-slate-655'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Logout Action */}
            <div className="p-1">
              <button
                onClick={() => logout()}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition flex items-center gap-1.5 rounded-md cursor-pointer"
              >
                <LogOut size={13} className="text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Create overlay */}
      <QuickCreateModal isOpen={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
    </header>
  );
}
