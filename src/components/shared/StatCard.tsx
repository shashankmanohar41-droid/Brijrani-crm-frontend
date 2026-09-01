'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  trend?: {
    value: number;
    label: string;
    type: 'positive' | 'negative' | 'neutral';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onClick?: () => void;
}

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  subtext, 
  trend, 
  color = 'neutral',
  onClick 
}: StatCardProps) {

  const getColorClasses = () => {
    switch (color) {
      case 'primary':
        return {
          bg: 'bg-primary-50/50',
          iconBg: 'bg-primary-100 text-primary-600',
          border: 'border-primary-100'
        };
      case 'success':
        return {
          bg: 'bg-emerald-50/40',
          iconBg: 'bg-emerald-100 text-emerald-600',
          border: 'border-emerald-100'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50/40',
          iconBg: 'bg-amber-100 text-amber-600',
          border: 'border-amber-100'
        };
      case 'danger':
        return {
          bg: 'bg-red-50/40',
          iconBg: 'bg-red-100 text-red-600',
          border: 'border-red-100'
        };
      case 'info':
        return {
          bg: 'bg-blue-50/40',
          iconBg: 'bg-blue-100 text-blue-600',
          border: 'border-blue-100'
        };
      default:
        return {
          bg: 'bg-white',
          iconBg: 'bg-slate-100 text-slate-500',
          border: 'border-slate-100'
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div 
      onClick={onClick}
      className={`border rounded-xl p-5 shadow-sm transition flex flex-col justify-between ${colors.bg} ${colors.border} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">{value}</h2>
        </div>
        <div className={`p-2.5 rounded-lg ${colors.iconBg} shadow-sm`}>
          <Icon size={20} />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {trend && (
            <span className={`font-semibold px-1.5 py-0.5 rounded-md ${
              trend.type === 'positive' ? 'bg-emerald-100 text-emerald-700' :
              trend.type === 'negative' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {trend.type === 'positive' && '+'}
              {trend.type === 'negative' && '-'}
              {trend.value}%
            </span>
          )}
          {trend && <span className="text-slate-400 font-medium">{trend.label}</span>}
          {!trend && subtext && <span className="text-slate-400 font-semibold">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
