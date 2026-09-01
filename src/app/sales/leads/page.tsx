'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { saveDb } from '../../../services/erpService';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Plus, Users, UserCheck, Phone, Mail, ArrowRight, Layers } from 'lucide-react';

function LeadsPageContent() {
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Trade Show');
  const [interestedProducts, setInterestedProducts] = useState('Wheat');
  const [expectedValue, setExpectedValue] = useState(500000);
  const [expectedCloseDate, setExpectedCloseDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState('');

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      showToast('Please enter lead contact name and phone number', 'error');
      return;
    }

    const dbStore = db;
    dbStore.leads = dbStore.leads || [];
    const leadNo = `LD-2026-${String(dbStore.leads.length + 1).padStart(5, '0')}`;
    
    const newLead = {
      id: `LD-${Date.now()}`,
      leadNo,
      name,
      companyName,
      phone,
      email,
      source,
      interestedProducts,
      expectedValue,
      expectedCloseDate,
      status: 'New',
      priority,
      notes,
      date: new Date().toISOString().split('T')[0]
    };

    dbStore.leads.push(newLead);
    saveDb(dbStore);

    refreshDb();
    setIsCreateOpen(false);
    setSelectedLead(newLead);
    showToast(`Lead ${leadNo} created successfully.`, 'success');
  };

  const handleConvertLead = (lead: any) => {
    // 1. Create a customer from the lead details
    const dbStore = db;
    dbStore.customers = dbStore.customers || [];
    
    // Check if customer already exists to prevent duplicate entries
    const existing = dbStore.customers.find(c => c.phone === lead.phone || c.email === lead.email);
    let customerId = '';
    
    if (existing) {
      customerId = existing.id;
      showToast('Customer already exists. Reusing record.', 'info');
    } else {
      const custCode = `CUS-2026-${String(dbStore.customers.length + 1).padStart(5, '0')}`;
      const newCust = {
        id: `CUS-${Date.now()}`,
        customerCode: custCode,
        name: lead.name,
        companyName: lead.companyName || 'Individual',
        phone: lead.phone,
        email: lead.email,
        address: 'Prefilled from CRM Lead Profile',
        state: 'Bihar',
        gstin: '10MOCKGSTIN123Z',
        balance: 0,
        creditLimit: 500000,
        status: 'Active' as const
      };
      dbStore.customers.push(newCust);
      customerId = newCust.id;
    }

    // Update lead status
    const targetLead = dbStore.leads.find((l: any) => l.id === lead.id);
    if (targetLead) {
      targetLead.status = 'Won';
    }

    saveDb(dbStore);
    refreshDb();
    showToast('Lead converted successfully to Customer!', 'success');

    // 2. Redirect directly to Create Enquiry page prefilled
    router.push(`/sales/enquiries?customer=${customerId}`);
  };

  const leadsList = db.leads || [];

  const filteredLeads = statusFilter === 'All'
    ? leadsList
    : leadsList.filter((l: any) => l.status === statusFilter);

  const columns: any[] = [
    { header: 'Lead ID', accessor: 'leadNo', sortable: true },
    { header: 'Lead Name', accessor: 'name', sortable: true },
    { header: 'Company', accessor: 'companyName' },
    { header: 'Source', accessor: 'source' },
    { 
      header: 'Value (Expected)', 
      accessor: (row: any) => `₹${(row.expectedValue || 0).toLocaleString()}`
    },
    { 
      header: 'Priority', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.priority === 'High' ? 'bg-red-50 text-red-600 border-red-200' :
          row.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
          'bg-slate-50 text-slate-650 border-slate-200'
        }`}>
          {row.priority}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Won' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Lost' ? 'bg-slate-100 text-slate-500 border-slate-250' :
          'bg-indigo-50 text-indigo-600 border-indigo-205'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Lead Management (CRM)</h1>
          <p className="text-xs font-medium text-slate-400">Capture buyer inquiries, monitor deal priority pipelines, and convert deals directly into customers.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record CRM Lead</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'New', 'Contacted', 'Qualified', 'Won', 'Lost'].map(status => {
              const count = status === 'All' 
                ? leadsList.length 
                : leadsList.filter((l: any) => l.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === status 
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40 font-extrabold' 
                      : 'hover:text-slate-700'
                  }`}
                >
                  {status} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          <DataTable
            data={filteredLeads}
            columns={columns}
            searchPlaceholder="Search Lead Name..."
            searchField="name"
            onRowClick={(row) => setSelectedLead(row)}
            exportFileName="crm_leads_register"
          />
        </div>

        {/* Lead Profile Sidebar */}
        <div>
          {selectedLead ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedLead.name}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{selectedLead.companyName || 'Individual'}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  selectedLead.status === 'Won' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-indigo-50 text-indigo-650'
                }`}>
                  {selectedLead.status}
                </span>
              </div>

              <div className="space-y-3.5 text-xs font-semibold text-slate-650">
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-slate-400" />
                  <span>{selectedLead.phone}</span>
                </div>
                <div className="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                  <Mail size={13} className="text-slate-400" />
                  <span>{selectedLead.email}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Pipeline Value:</span>
                  <span>₹{selectedLead.expectedValue?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Marketing Source:</span>
                  <span>{selectedLead.source}</span>
                </div>
                {selectedLead.notes && (
                  <div>
                    <span className="text-slate-400 block mb-1">Lead Notes:</span>
                    <p className="p-2 bg-slate-50 rounded-lg text-slate-600 font-medium border border-slate-100">{selectedLead.notes}</p>
                  </div>
                )}
              </div>

              {selectedLead.status !== 'Won' && (
                <div className="pt-2">
                  <button
                    onClick={() => handleConvertLead(selectedLead)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
                  >
                    <UserCheck size={14} />
                    <span>Convert to Customer Portal</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-xl p-8 text-center text-xs text-slate-450 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Users size={24} className="text-slate-350" />
              <span>Select a Lead profile to view contact logs and convert to customer accounts.</span>
            </div>
          )}
        </div>
      </div>

      {/* New Lead Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Record CRM Sales Lead</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Lead Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Expected Deal Value (₹)</label>
                  <input
                    type="number"
                    value={expectedValue}
                    onChange={e => setExpectedValue(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Lead Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Interested Commodities / Description</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  placeholder="Commodity type requirements or pipeline remarks..."
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
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesLeadsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <LeadsPageContent />
    </React.Suspense>
  );
}
