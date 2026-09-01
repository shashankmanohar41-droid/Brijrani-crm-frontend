'use client';

import React, { useRef } from 'react';
import { formatDate } from '../../utils/dateUtils';
import { Calendar } from 'lucide-react';

interface IndianDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (val: string) => void;
}

export default function IndianDateInput({ value, onChange, className, ...props }: IndianDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (inputRef.current) {
      try {
        // Trigger Chrome/Firefox/Safari native calendar picker popover
        inputRef.current.showPicker();
      } catch (err) {
        // Fallback for older browsers
        inputRef.current.focus();
      }
    }
  };

  return (
    <div 
      onClick={handleContainerClick}
      className={`relative flex items-center justify-between cursor-pointer ${className || ''}`}
    >
      {/* Display the formatted date or a placeholder */}
      <span className={value ? 'text-slate-700 font-medium' : 'text-slate-400 font-medium'}>
        {value ? formatDate(value) : 'dd/mm/yyyy'}
      </span>
      
      {/* Show the calendar icon */}
      <Calendar className="text-slate-400 shrink-0 pointer-events-none ml-2" size={14} />

      {/* Hidden native date input layered on top to capture clicks */}
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          e.stopPropagation(); // Prevent container click event loop
          try {
            (e.target as HTMLInputElement).showPicker();
          } catch (err) {}
        }}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
        {...props}
      />
    </div>
  );
}
