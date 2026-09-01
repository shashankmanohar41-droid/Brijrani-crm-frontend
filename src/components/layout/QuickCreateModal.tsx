'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, ClipboardPlus, ShoppingCart, Truck, 
  IndianRupee, RefreshCw, X, FileCheck, Layers
} from 'lucide-react';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickCreateModal({ isOpen, onClose }: QuickCreateModalProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { name: 'Purchase Order', icon: ShoppingCart, href: '/procurement/orders?action=new', color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { name: 'GRN (Receipt Slips)', icon: FileText, href: '/procurement/grn?action=new', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
    { name: 'Sales Quotation', icon: ClipboardPlus, href: '/sales/quotations?action=new', color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
    { name: 'Sales Order', icon: FileCheck, href: '/sales/orders?action=new', color: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
    { name: 'Sales Invoice', icon: Layers, href: '/sales/invoices?action=new', color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
    { name: 'Receive Payment', icon: IndianRupee, href: '/finance/receipts?action=new', color: 'bg-green-50 text-green-600 hover:bg-green-100' },
    { name: 'Supplier Payment', icon: IndianRupee, href: '/finance/payments?action=new', color: 'bg-red-50 text-red-600 hover:bg-red-100' },
    { name: 'Stock Transfer', icon: RefreshCw, href: '/warehouse/transfers?action=new', color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
    { name: 'Vehicle Dispatch', icon: Truck, href: '/logistics/dispatch?action=new', color: 'bg-orange-50 text-orange-600 hover:bg-orange-100' }
  ];

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Quick Create Transaction</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Select a voucher or slip to create it immediately</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Grid */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.name}
                onClick={() => handleNavigate(action.href)}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-slate-100 text-center transition cursor-pointer ${action.color}`}
              >
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100/50">
                  <Icon size={20} />
                </div>
                <span className="text-xs font-semibold">{action.name}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 text-right bg-slate-50">
          <span className="text-[9px] font-medium text-slate-400">Esc to close | BrijRani ERP Core Engine</span>
        </div>
      </div>
    </div>
  );
}
