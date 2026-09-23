'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Warehouse, Truck,
  IndianRupee, BarChart3, Database, Settings, ChevronDown, ChevronRight,
  Menu, X, Landmark, ClipboardList
} from 'lucide-react';
import { useErp } from '../../context/ErpContext';

interface SidebarSubItem {
  name: string;
  href: string;
}

interface SidebarItem {
  name: string;
  icon: React.ComponentType<any>;
  href?: string;
  subItems?: SidebarSubItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUserRole } = useErp();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Procurement: true,
    Sales: false,
    Warehouse: false,
    Logistics: false,
    Finance: false,
  });

  const toggleExpand = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const menuItems: SidebarItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    ...(currentUserRole === 'Super Admin' || currentUserRole === 'Purchase Manager' ? [{
      name: 'Procurement',
      icon: ShoppingCart,
      subItems: [
        { name: 'Overview Dashboard', href: '/procurement' },
        { name: 'Purchase Enquiry', href: '/procurement/enquiries' },
        { name: 'Quotations', href: '/procurement/quotations' },
        { name: 'Purchase Orders', href: '/procurement/orders' },
        { name: 'Purchase Invoices', href: '/procurement/invoices' },
        { name: 'Quality Control', href: '/procurement/qc' },
        { name: 'GRN (Inward Slips)', href: '/procurement/grn' },
        { name: 'Purchase Returns', href: '/procurement/returns' },
      ]
    }] : []),
    // Sales (Admin only)
    ...(currentUserRole === 'Super Admin' ? [{
      name: 'Sales',
      icon: ClipboardList,
      subItems: [
        { name: 'Overview Dashboard', href: '/sales/dashboard' },
        { name: 'Sales Enquiry', href: '/sales/enquiries' },
        { name: 'Quotations', href: '/sales/quotations' },
        { name: 'Sales Orders', href: '/sales/orders' },
        { name: 'Sales Invoices', href: '/sales/invoices' },
        { name: 'Quality Control', href: '/sales/qc' },
        { name: 'GRN (Outward Slips)', href: '/sales/delivery-challans' },
        { name: 'Sales Returns', href: '/sales/returns' },
      ]
    }] : []),

    // Warehouse (Admin & Warehouse Staff)
    ...(currentUserRole === 'Super Admin' || currentUserRole === 'Warehouse Staff' ? [{
      name: 'Warehouse',
      icon: Warehouse,
      subItems: [
        { name: 'WH Overview', href: '/warehouse/overview' },
        { name: 'Stock Inventory', href: '/warehouse/stock' },
        { name: 'Stock Transfers', href: '/warehouse/transfers' },
      ]
    }] : []),

    // Logistics (Admin & Warehouse Staff)
    ...(currentUserRole === 'Super Admin' || currentUserRole === 'Warehouse Staff' ? [{
      name: 'Logistics',
      icon: Truck,
      subItems: [
        { name: 'Vehicles Allocation', href: '/logistics/vehicles' },
        { name: 'Drivers List', href: '/logistics/drivers' },
        { name: 'Loading Slips', href: '/logistics/loading' },
        { name: 'Dispatches', href: '/logistics/dispatch' },
        { name: 'E-Way Bills', href: '/logistics/eway-bills' },
        { name: 'Proof of Delivery', href: '/logistics/pod' },
      ]
    }] : []),

    // Finance (Admin & Accountant)
    ...(currentUserRole === 'Super Admin' || currentUserRole === 'Accountant' ? [{
      name: 'Finance',
      icon: IndianRupee,
      subItems: [
        { name: 'Receipts (Collection)', href: '/finance/receipts' },
        { name: 'Payments (Vendor)', href: '/finance/payments' },
        { name: 'Contra Vouchers', href: '/finance/contra' },
        { name: 'Journal Vouchers', href: '/finance/journal' },
        { name: 'Expenses Log', href: '/finance/expenses' },
        { name: 'Ledger & Outstanding', href: '/finance/ledger' },
        { name: 'Profit & Loss', href: '/finance/profit-loss' },
      ]
    }] : []),

    // Reports (Admin only)
    ...(currentUserRole === 'Super Admin' ? [
      { name: 'Reports', icon: BarChart3, href: '/reports' }
    ] : []),

    // Masters Hub (Admin & Purchase Manager)
    ...(currentUserRole === 'Super Admin' || currentUserRole === 'Purchase Manager' ? [
      { name: 'Masters Hub', icon: Database, href: '/masters' }
    ] : []),

    // Settings (Admin only)
    ...(currentUserRole === 'Super Admin' ? [
      { name: 'Settings', icon: Settings, href: '/settings' }
    ] : [])
  ];

  const isLinkActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isGroupActive = (items?: SidebarSubItem[]) => {
    if (!items) return false;
    return items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'));
  };

  return (
    <aside
      className={`bg-sidebar-bg text-slate-300 flex flex-col transition-all duration-300 border-r border-slate-800 shrink-0 select-none ${collapsed ? 'w-16' : 'w-64'
        }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center font-bold text-white shadow-md shadow-primary-500/20">
              BR
            </div>
            <div>
              <span className="font-semibold text-white tracking-wide block leading-none">BrijRani</span>
              <span className="text-[10px] text-slate-400">Trading & Warehouse ERP</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded bg-primary-600 flex items-center justify-center font-bold text-white">
            BR
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
        >
          <Menu size={16} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedMenus[item.name];
          const activeGroup = isGroupActive(item.subItems);

          if (!hasSubItems) {
            const isActive = isLinkActive(item.href || '');
            return (
              <Link
                key={item.name}
                href={item.href || '#'}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10'
                    : 'hover:bg-sidebar-hover text-slate-400 hover:text-white'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          }

          return (
            <div key={item.name} className="space-y-1">
              <button
                onClick={() => {
                  if (collapsed) setCollapsed(false);
                  toggleExpand(item.name);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeGroup
                    ? 'bg-sidebar-active/30 text-white'
                    : 'hover:bg-sidebar-hover text-slate-400 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={activeGroup ? 'text-primary-500' : 'text-slate-400'} />
                  {!collapsed && <span>{item.name}</span>}
                </div>
                {!collapsed && (
                  isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                )}
              </button>

              {/* Submenu Items */}
              {!collapsed && isExpanded && (
                <div className="pl-9 pr-1 py-1 space-y-1 border-l border-slate-800 ml-5">
                  {item.subItems?.map(sub => {
                    const isSubActive = isLinkActive(sub.href);
                    return (
                      <Link
                        key={sub.name}
                        href={sub.href}
                        className={`block py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${isSubActive
                            ? 'bg-primary-600/15 text-primary-400 font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-sidebar-hover/50'
                          }`}
                      >
                        {sub.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-800 text-center">
          <div className="text-[10px] text-slate-500">v1.2.0-mock</div>
        </div>
      )}
    </aside>
  );
}
