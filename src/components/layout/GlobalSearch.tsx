'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDb } from '../../services/erpService';

interface SearchResult {
  id: string;
  title: string;
  category: 'Products' | 'Suppliers' | 'Customers' | 'Purchase Orders' | 'Sales Orders' | 'Invoices';
  url: string;
  metadata?: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Perform search across local DB
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const delayDebounce = setTimeout(() => {
      const db = getDb();
      const searchTerms = query.toLowerCase();
      const matches: SearchResult[] = [];

      // 1. Search Commodities
      db.commodities.forEach(cmd => {
        if (cmd.name.toLowerCase().includes(searchTerms) || cmd.sku.toLowerCase().includes(searchTerms)) {
          matches.push({
            id: cmd.id,
            title: cmd.name,
            category: 'Products',
            url: `/warehouse/stock`,
            metadata: `SKU: ${cmd.sku} | Qty: ${cmd.stockQty} ${cmd.unit}`
          });
        }
      });

      // 2. Search Suppliers & Farmers
      db.suppliers.forEach(sup => {
        if (sup.name.toLowerCase().includes(searchTerms) || sup.phone.includes(searchTerms)) {
          matches.push({
            id: sup.id,
            title: sup.name,
            category: 'Suppliers',
            url: `/masters?tab=suppliers`,
            metadata: `Supplier | GSTIN: ${sup.gstin}`
          });
        }
      });
      db.farmers.forEach(farmer => {
        if (farmer.name.toLowerCase().includes(searchTerms) || farmer.phone.includes(searchTerms)) {
          matches.push({
            id: farmer.id,
            title: farmer.name,
            category: 'Suppliers', // grouped under suppliers for routing ease
            url: `/masters?tab=farmers`,
            metadata: `Farmer | State: ${farmer.state}`
          });
        }
      });

      // 3. Search Customers
      db.customers.forEach(cus => {
        if (cus.name.toLowerCase().includes(searchTerms) || cus.phone.includes(searchTerms)) {
          matches.push({
            id: cus.id,
            title: cus.name,
            category: 'Customers',
            url: `/masters?tab=customers`,
            metadata: `Customer | State: ${cus.state}`
          });
        }
      });

      // 4. Search POs
      db.purchaseOrders.forEach(po => {
        if (po.poNo.toLowerCase().includes(searchTerms)) {
          matches.push({
            id: po.id,
            title: po.poNo,
            category: 'Purchase Orders',
            url: `/procurement/orders`,
            metadata: `PO | Total: ₹${po.total.toLocaleString()} | Status: ${po.status}`
          });
        }
      });

      // 5. Search SOs
      db.salesOrders.forEach(so => {
        if (so.soNo.toLowerCase().includes(searchTerms)) {
          matches.push({
            id: so.id,
            title: so.soNo,
            category: 'Sales Orders',
            url: `/sales/orders`,
            metadata: `SO | Total: ₹${so.total.toLocaleString()} | Status: ${so.status}`
          });
        }
      });

      // 6. Search Invoices
      db.salesInvoices.forEach(inv => {
        if (inv.invoiceNo.toLowerCase().includes(searchTerms)) {
          matches.push({
            id: inv.id,
            title: inv.invoiceNo,
            category: 'Invoices',
            url: `/sales/invoices`,
            metadata: `Invoice | Total: ₹${inv.grandTotal.toLocaleString()} | ${inv.paymentStatus}`
          });
        }
      });

      setResults(matches.slice(0, 8)); // cap results at 8
      setLoading(false);
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSelectResult = (url: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(url);
  };

  return (
    <div ref={searchRef} className="relative w-72 max-w-xs">
      {/* Search Input trigger */}
      <div 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-500 cursor-pointer select-none transition"
      >
        <Search size={14} className="text-slate-400" />
        <span className="flex-1 text-left">Search anything...</span>
        <kbd className="hidden sm:inline-block bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 shadow-sm leading-none">
          Ctrl+K
        </kbd>
      </div>

      {/* Expanded search card popup */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-[999] overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search customers, invoices, POs, bins..."
              className="flex-1 bg-transparent text-sm border-0 focus:outline-none text-slate-800"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {results.length > 0 ? (
              <div className="py-2">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectResult(r.url)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex flex-col transition border-b border-slate-50/50 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{r.title}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
                        {r.category}
                      </span>
                    </div>
                    {r.metadata && (
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
                        {r.metadata}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching results found for "{query}"
              </div>
            ) : (
              <div className="p-4 text-center text-[11px] text-slate-400 leading-relaxed">
                Type above to search across Farmers, Suppliers, Customers, Products, Purchase Orders, Sales Orders, and Invoices.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
