'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Info, AlertTriangle, AlertCircle, TrendingUp } from 'lucide-react';
import { useErp, ErpNotification } from '../../context/ErpContext';

export default function NotificationsDropdown() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useErp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: ErpNotification['type']) => {
    switch (type) {
      case 'success':
        return <TrendingUp className="text-emerald-500 shrink-0" size={16} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500 shrink-0" size={16} />;
      case 'danger':
        return <AlertCircle className="text-red-500 shrink-0" size={16} />;
      default:
        return <Info className="text-indigo-500 shrink-0" size={16} />;
    }
  };

  const getBg = (type: ErpNotification['type'], read: boolean) => {
    if (read) return 'bg-white opacity-60';
    switch (type) {
      case 'success': return 'bg-emerald-50/50 hover:bg-emerald-50';
      case 'warning': return 'bg-amber-50/50 hover:bg-amber-50';
      case 'danger': return 'bg-red-50/50 hover:bg-red-50';
      default: return 'bg-indigo-50/50 hover:bg-indigo-50';
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition focus:outline-none"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[9px] font-bold text-white flex items-center justify-center rounded-full border border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-[999] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              System Notifications ({unreadCount} unread)
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[10px] text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1"
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length > 0 ? (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`p-3.5 flex gap-3 cursor-pointer transition ${getBg(n.type, n.read)}`}
                >
                  {getIcon(n.type)}
                  <div className="flex-1 space-y-0.5">
                    <p className={`text-xs text-slate-700 leading-normal ${!n.read ? 'font-semibold' : ''}`}>
                      {n.message}
                    </p>
                    <span className="text-[9px] text-slate-400 block">{n.date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No active notifications. System healthy.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 text-center bg-slate-50">
            <span className="text-[10px] text-slate-400">Real-time alert engine active</span>
          </div>
        </div>
      )}
    </div>
  );
}
