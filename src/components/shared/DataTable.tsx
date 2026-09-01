'use client';

import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { formatIfDate } from '../../utils/dateUtils';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  csvAccessor?: keyof T | ((row: T) => string); // for exporting text
  className?: string;
  sortable?: boolean;
}

interface FilterOption {
  label: string;
  value: string;
}

interface Filter {
  name: string;
  field: string;
  options: FilterOption[];
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchField?: keyof T;
  filters?: Filter[];
  exportFileName?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}

export default function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  searchField,
  filters = [],
  exportFileName = 'erp-export',
  onRowClick,
  pageSize = 10
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Reset page when search or filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleFilterChange = (field: string, val: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [field]: val
    }));
    setCurrentPage(1);
  };

  // 1. Apply Search and Filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Apply Search Query
      if (searchQuery.trim() && searchField) {
        const itemVal = item[searchField];
        if (itemVal && !String(itemVal).toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      } else if (searchQuery.trim()) {
        // Fallback: search across all keys
        const match = Object.values(item).some(val => 
          val && String(val).toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (!match) return false;
      }

      // Apply Dropdown Filters
      for (const filter of filters) {
        const activeVal = activeFilters[filter.field];
        if (activeVal && activeVal !== 'ALL') {
          const itemVal = item[filter.field as keyof T];
          if (String(itemVal) !== activeVal) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, searchQuery, searchField, activeFilters, filters]);

  // 2. Sort Data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const key = sortConfig.key as keyof T;
      let valA = a[key];
      let valB = b[key];

      if (typeof valA === 'string') valA = valA.toLowerCase() as any;
      if (typeof valB === 'string') valB = valB.toLowerCase() as any;

      if (valA < valB) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig]);

  // 3. Paginate Data
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const startEntry = sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, sortedData.length);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 4. Export CSV Handler
  const exportToCSV = () => {
    // Compile headers
    const headers = columns.map(c => c.header).join(',');
    
    // Compile rows
    const rows = sortedData.map(row => {
      return columns.map(col => {
        let val = '';
        if (col.csvAccessor) {
          if (typeof col.csvAccessor === 'function') {
            val = col.csvAccessor(row);
          } else {
            val = String(row[col.csvAccessor] || '');
          }
        } else if (typeof col.accessor === 'function') {
          // Fallback if no csvAccessor provided
          val = 'Custom Render';
        } else {
          val = String(row[col.accessor] || '');
        }

        // Apply date formatting if applicable
        val = formatIfDate(val, typeof col.accessor === 'string' ? col.accessor : undefined);

        // Clean value for CSV formatting
        val = val.replace(/"/g, '""');
        return val.includes(',') || val.includes('\n') ? `"${val}"` : val;
      }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${exportFileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Table Action Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-primary-500 rounded-lg text-xs focus:outline-none bg-white font-medium text-slate-700"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Filters & Export */}
        <div className="flex flex-wrap items-center gap-3">
          {filters.map(filter => (
            <select
              key={filter.field}
              value={activeFilters[filter.field] || 'ALL'}
              onChange={e => handleFilterChange(filter.field, e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white font-medium text-slate-600"
            >
              <option value="ALL">All {filter.name}</option>
              {filter.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg font-semibold text-xs cursor-pointer transition"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed min-w-[800px] dense-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`py-3 px-4 font-bold ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
            {paginatedData.length > 0 ? (
              paginatedData.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, colIdx) => {
                    let cellVal = typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : (row[col.accessor] as React.ReactNode);
                    
                    if (typeof cellVal === 'string') {
                      cellVal = formatIfDate(cellVal, typeof col.accessor === 'string' ? col.accessor : undefined);
                    }

                    return (
                      <td key={colIdx} className={`py-3.5 px-4 truncate ${col.className || ''}`}>
                        {cellVal}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-slate-400 font-semibold">
                  No records matching the search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-[11px] font-semibold text-slate-400">
            Showing <span className="text-slate-600">{startEntry}</span> to{' '}
            <span className="text-slate-600">{endEntry}</span> of{' '}
            <span className="text-slate-600">{sortedData.length}</span> entries
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-slate-500"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="text-xs font-semibold px-2 text-slate-600">
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-slate-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
