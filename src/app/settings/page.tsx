'use client';

import React, { useState, useEffect } from 'react';
import { useErp } from '../../context/ErpContext';
import { 
  Settings, Shield, Building2, Sliders, CheckCircle, 
  Users, Trash2, Edit2, UserPlus, Eye, EyeOff, Lock, ShieldAlert 
} from 'lucide-react';

interface PermissionRule {
  module: string;
  roles: {
    admin: boolean;
    buyer: boolean;
    warehouse: boolean;
    accountant: boolean;
  };
}

interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  status: 'Active' | 'Inactive';
}

const DEFAULT_PERMISSIONS: PermissionRule[] = [
  { module: 'Procurement (PO/GRN)', roles: { admin: true, buyer: true, warehouse: true, accountant: false } },
  { module: 'Quality Labs (QC Auditing)', roles: { admin: true, buyer: false, warehouse: true, accountant: false } },
  { module: 'Warehouse Inwarding', roles: { admin: true, buyer: false, warehouse: true, accountant: false } },
  { module: 'Stock adjustments', roles: { admin: true, buyer: false, warehouse: true, accountant: false } },
  { module: 'Sales Orders / Quotes', roles: { admin: true, buyer: false, warehouse: false, accountant: false } },
  { module: 'Logistics & Dispatch', roles: { admin: true, buyer: false, warehouse: true, accountant: false } },
  { module: 'Finance Receivables', roles: { admin: true, buyer: false, warehouse: false, accountant: true } },
  { module: 'Finance Payments', roles: { admin: true, buyer: false, warehouse: false, accountant: true } }
];

const DEFAULT_USERS: UserAccount[] = [
  { id: 'usr-1', name: 'Admin User', email: 'admin@brijrani.com', password: 'password123', role: 'Super Admin', status: 'Active' },
  { id: 'usr-2', name: 'Deepak Kumar', email: 'deepak@brijrani.com', password: 'password123', role: 'Purchase Manager', status: 'Active' },
  { id: 'usr-3', name: 'Raman Singh', email: 'raman@brijrani.com', password: 'password123', role: 'Warehouse Staff', status: 'Active' },
  { id: 'usr-4', name: 'Sanjay Verma', email: 'sanjay@brijrani.com', password: 'password123', role: 'Accountant', status: 'Active' }
];

export default function SettingsPage() {
  const { currentCompany, currentUserRole, showToast, clearAllData } = useErp();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'company' | 'vouchers' | 'roles' | 'users'>('company');

  // Company Profile states
  const [address, setAddress] = useState('Didarganj, ByPass Road, Patna, Bihar, 800008');
  const [gstin, setGstin] = useState('10AAACS8931M2Z1');
  const [pan, setPan] = useState('AAACS8931M');
  const [contactName, setContactName] = useState('Deepak Kumar (Director)');

  // Voucher prefixes states
  const [poPrefix, setPoPrefix] = useState('PO/BR/2026-27/');
  const [grnPrefix, setGrnPrefix] = useState('GRN/BR/2026-27/');
  const [invPrefix, setInvPrefix] = useState('INV/BR/2026-27/');
  const [vchPrefix, setVchPrefix] = useState('VCH/BR/2026-27/');

  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(DEFAULT_PERMISSIONS);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // States for user modal/form
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('Purchase Manager');
  const [userStatus, setUserStatus] = useState<'Active' | 'Inactive'>('Active');

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Load permission rules
    const savedPermissions = localStorage.getItem('brijrani_permission_rules');
    if (savedPermissions) {
      try {
        setPermissionRules(JSON.parse(savedPermissions));
      } catch (e) {
        console.error('Failed to parse saved permission rules:', e);
      }
    }

    // Load users
    const savedUsers = localStorage.getItem('brijrani_users');
    if (savedUsers) {
      try {
        setUsers(JSON.parse(savedUsers));
      } catch (e) {
        console.error('Failed to parse saved users:', e);
        setUsers(DEFAULT_USERS);
      }
    } else {
      setUsers(DEFAULT_USERS);
      localStorage.setItem('brijrani_users', JSON.stringify(DEFAULT_USERS));
    }
  }, []);

  const isSuperAdmin = currentUserRole === 'Super Admin';

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('Purchase Manager');
    setUserStatus('Active');
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPassword('');
    setUserRole(user.role);
    setUserStatus(user.status);
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }

    if (!editingUser && !userPassword.trim()) {
      showToast('Password is required for new users', 'error');
      return;
    }

    let updatedUsers: UserAccount[];

    if (editingUser) {
      // Edit User
      updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            name: userName,
            email: userEmail,
            role: userRole,
            status: userStatus,
            password: userPassword.trim() ? userPassword : u.password
          };
        }
        return u;
      });
      showToast('User account updated successfully', 'success');
    } else {
      // Create User
      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        name: userName,
        email: userEmail,
        password: userPassword,
        role: userRole,
        status: userStatus
      };
      updatedUsers = [...users, newUser];
      showToast('New user account created successfully', 'success');
    }

    setUsers(updatedUsers);
    localStorage.setItem('brijrani_users', JSON.stringify(updatedUsers));
    setIsUserModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    if (id === 'usr-1') {
      showToast('Cannot delete the primary administrator account', 'error');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user account?')) {
      const updatedUsers = users.filter(u => u.id !== id);
      setUsers(updatedUsers);
      localStorage.setItem('brijrani_users', JSON.stringify(updatedUsers));
      showToast('User account deleted successfully', 'success');
    }
  };

  const handleTogglePermission = (moduleName: string, roleKey: keyof PermissionRule['roles']) => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin can edit role permissions', 'error');
      return;
    }

    const updated = permissionRules.map(rule => {
      if (rule.module === moduleName) {
        return {
          ...rule,
          roles: {
            ...rule.roles,
            [roleKey]: !rule.roles[roleKey]
          }
        };
      }
      return rule;
    });

    setPermissionRules(updated);
    localStorage.setItem('brijrani_permission_rules', JSON.stringify(updated));
    showToast(`Updated permission for ${moduleName}`, 'success');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Global settings updated successfully', 'success');
  };

  const renderPermissionCell = (rule: PermissionRule, roleKey: keyof PermissionRule['roles'], value: boolean) => {
    if (isSuperAdmin) {
      return (
        <button
          onClick={() => handleTogglePermission(rule.module, roleKey)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 transition-all border shadow-sm select-none cursor-pointer focus:outline-none ${
            value
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/50'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300 hover:shadow-rose-100/50'
          }`}
          title="Click to toggle permission"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span>{value ? 'Allowed' : 'Locked'}</span>
        </button>
      );
    }

    return value ? (
      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50/50 px-2.5 py-1 rounded-full border border-emerald-100/80 select-none text-[11px]">
        ✔ Allowed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-rose-500 font-semibold bg-rose-50/50 px-2.5 py-1 rounded-full border border-rose-100/80 select-none text-[11px]">
        ❌ Locked
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">ERP Settings & Configurations</h1>
        <p className="text-xs font-medium text-slate-400">Configure global invoice options, voucher serialization prefixes, and employee profile privileges.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveSettingsTab('company')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSettingsTab === 'company' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <Building2 size={14} />
          Company Profile
        </button>
        <button
          onClick={() => setActiveSettingsTab('vouchers')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSettingsTab === 'vouchers' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <Sliders size={14} />
          Voucher Numbering
        </button>
        <button
          onClick={() => setActiveSettingsTab('roles')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSettingsTab === 'roles' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <Shield size={14} />
          Role Permissions Matrix
        </button>
        <button
          onClick={() => setActiveSettingsTab('users')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSettingsTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-655'
          }`}
        >
          <Users size={14} />
          User Management
        </button>
      </div>

      {/* Body tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {activeSettingsTab === 'company' && (
          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-xl">
            <h3 className="text-sm font-bold text-slate-800">Operating Company Profile</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company Entity Name</label>
                <input
                  type="text"
                  disabled
                  value={currentCompany}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tax Contact Person</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company GSTIN Number</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Income Tax PAN Number</label>
                <input
                  type="text"
                  value={pan}
                  onChange={e => setPan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Registered Address</label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none min-h-[60px]"
              />
            </div>

            <button
              type="submit"
              className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-md shadow-primary-600/10 cursor-pointer transition"
            >
              Update Company Profile
            </button>
          </form>
        )}

        {activeSettingsTab === 'company' && isSuperAdmin && (
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-500" />
              Danger Zone
            </h4>
            <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800">Clear All Local Database Data</span>
                <p className="text-[10px] text-slate-450 leading-normal">
                  Permanently erase all transaction history, sales, purchases, warehouse inventory ledger data, and registered customers/suppliers. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('CRITICAL WARNING: Are you sure you want to permanently delete ALL data in the database? This will clear all transactions, invoices, and master records.')) {
                    clearAllData();
                  }
                }}
                className="shrink-0 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition cursor-pointer select-none shadow-sm"
              >
                Delete All Data
              </button>
            </div>
          </div>
        )}


        {activeSettingsTab === 'vouchers' && (
          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-xl">
            <h3 className="text-sm font-bold text-slate-800">Voucher Serialization Prefixes</h3>
            <p className="text-[11px] text-slate-400 leading-normal">
              Map auto-numbering prefixes for transaction documents generated by BrijRani ERP.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Purchase Order Prefix</label>
                <input
                  type="text"
                  value={poPrefix}
                  onChange={e => setPoPrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GRN (Receipt) Prefix</label>
                <input
                  type="text"
                  value={grnPrefix}
                  onChange={e => setGrnPrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sales Invoice Prefix</label>
                <input
                  type="text"
                  value={invPrefix}
                  onChange={e => setInvPrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">General Voucher Prefix</label>
                <input
                  type="text"
                  value={vchPrefix}
                  onChange={e => setVchPrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-md shadow-primary-600/10 cursor-pointer transition"
            >
              Update Prefix Serialization
            </button>
          </form>
        )}

        {activeSettingsTab === 'roles' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Role-Based Access Control Privileges</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Summary of page authorizations and creation privileges for each role profile.</p>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset all permissions to system defaults?')) {
                      setPermissionRules(DEFAULT_PERMISSIONS);
                      localStorage.setItem('brijrani_permission_rules', JSON.stringify(DEFAULT_PERMISSIONS));
                      showToast('Permissions reset to system defaults', 'success');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg cursor-pointer transition shadow-sm"
                >
                  Reset Defaults
                </button>
              )}
            </div>

            {/* Current status display */}
            <div className={`border rounded-lg p-3 text-xs flex gap-2 transition-all duration-300 ${
              isSuperAdmin 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-indigo-50 border-indigo-100 text-indigo-800'
            }`}>
              <Shield size={16} className={`shrink-0 mt-0.5 ${isSuperAdmin ? 'text-emerald-600' : 'text-indigo-600'}`} />
              <div className="space-y-0.5 font-medium leading-normal">
                <span>
                  Active profile privileges: <span className="font-bold">{currentUserRole}</span>
                  {isSuperAdmin && <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-emerald-600 text-white rounded font-bold uppercase tracking-wider">Editor Mode</span>}
                </span>
                <p className={isSuperAdmin ? 'text-[10px] text-emerald-700' : 'text-[10px] text-indigo-700'}>
                  {isSuperAdmin 
                    ? 'As a Super Admin, you can click on any permission cell below to toggle Allowed/Locked states. Changes are saved instantly.'
                    : 'Changing your profile in the top header role selector will instantly re-arrange sidebar links, lock approval buttons, and enable forms accordingly.'}
                </p>
              </div>
            </div>

            {/* Permissions Matrix Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-lg shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-3">ERP Operation Module</th>
                    <th className="p-3 text-center">Super Admin</th>
                    <th className="p-3 text-center">Purchase Manager</th>
                    <th className="p-3 text-center">Warehouse Staff</th>
                    <th className="p-3 text-center">Accountant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-655 font-medium">
                  {permissionRules.map(rule => (
                    <tr key={rule.module} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{rule.module}</td>
                      <td className="p-3 text-center">
                        {renderPermissionCell(rule, 'admin', rule.roles.admin)}
                      </td>
                      <td className="p-3 text-center">
                        {renderPermissionCell(rule, 'buyer', rule.roles.buyer)}
                      </td>
                      <td className="p-3 text-center">
                        {renderPermissionCell(rule, 'warehouse', rule.roles.warehouse)}
                      </td>
                      <td className="p-3 text-center">
                        {renderPermissionCell(rule, 'accountant', rule.roles.accountant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSettingsTab === 'users' && (
          <div className="space-y-5">
            {isSuperAdmin ? (
              <>
                {/* Header with Add Button */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Employee User Credentials</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Manage login emails, passwords, and access roles for company personnel.</p>
                  </div>
                  <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/10 cursor-pointer transition select-none"
                  >
                    <UserPlus size={14} />
                    Add Employee User
                  </button>
                </div>

                {/* Users List Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-lg shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="p-3">Employee Name</th>
                        <th className="p-3">Login Email</th>
                        <th className="p-3">Assigned Role</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-655 font-medium">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-semibold text-slate-850">{user.name}</td>
                          <td className="p-3 font-mono text-slate-600">{user.email}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {user.role}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              user.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {user.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(user)}
                                className="p-1 text-slate-500 hover:text-primary-600 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded transition cursor-pointer"
                                title="Edit user"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={user.id === 'usr-1'}
                                className={`p-1 rounded border border-transparent transition ${
                                  user.id === 'usr-1'
                                    ? 'text-slate-200 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-rose-600 hover:bg-slate-50 hover:border-slate-100 cursor-pointer'
                                }`}
                                title={user.id === 'usr-1' ? 'Admin account cannot be deleted' : 'Delete user'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              /* Access Restricted layout */
              <div className="py-8 px-4 max-w-md mx-auto text-center space-y-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Lock size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">Access Restricted</h4>
                  <p className="text-xs text-slate-405 leading-relaxed">
                    User management, credentials creation, and employee account modifications are restricted to the **Super Admin** role profile.
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-500 font-medium leading-normal flex items-start gap-2 text-left">
                  <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    To modify personnel lists or change login details, please switch your role to <span className="font-bold text-slate-700">Super Admin</span> via the top-right header role switch selector.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Employee User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {editingUser ? 'Edit User Credentials' : 'Create User Account'}
              </span>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-450 hover:text-slate-700 font-bold text-lg leading-none cursor-pointer focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Kumar"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 focus:border-primary-500 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Login Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. anand@brijrani.com"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 focus:border-primary-500 rounded-lg text-xs bg-white font-mono text-slate-750 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Password {editingUser && <span className="lowercase font-normal text-slate-400">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingUser ? '••••••••' : 'Enter login password'}
                    required={!editingUser}
                    value={userPassword}
                    onChange={e => setUserPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-primary-500 rounded-lg text-xs bg-white font-mono text-slate-750 focus:outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-655 cursor-pointer focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Access Role Profile</label>
                  <select
                    value={userRole}
                    onChange={e => setUserRole(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 focus:border-primary-500 rounded-lg text-xs bg-white font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Purchase Manager">Purchase Manager</option>
                    <option value="Sales Manager">Sales Manager</option>
                    <option value="Warehouse Staff">Warehouse Staff</option>
                    <option value="Accountant">Accountant</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">User Status</label>
                  <select
                    value={userStatus}
                    onChange={e => setUserStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full px-2.5 py-2 border border-slate-200 focus:border-primary-500 rounded-lg text-xs bg-white font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs transition cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-md shadow-primary-600/10 cursor-pointer transition select-none"
                >
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
