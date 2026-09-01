'use client';

import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { Eye, EyeOff, Lock, User, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const { login } = useErp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const success = await login(email.trim(), password);
      setIsLoading(false);
      if (!success) {
        setErrorMsg('Invalid login credentials or inactive account.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg('Server connection failed. Please try again.');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans select-none">
      {/* Left Panel: Framed Mock Browser Canvas (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Futuristic Grid & Light Glow effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:100%_48px]" />
        
        {/* Top Branding Section */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-sm">
            BR
          </div>
          <div>
            <span className="font-bold text-white tracking-wide block text-sm leading-none">BrijRani Group</span>
            <span className="text-[9px] text-emerald-400 font-bold tracking-wider uppercase mt-1 block">Enterprise ERP Suite</span>
          </div>
        </div>

        {/* Framed Application Window (solves the white background image issue beautifully) */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-6">
          <div className="bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border border-white/5 overflow-hidden w-full max-w-[85%] transform transition-all duration-500 hover:scale-[1.01]">
            {/* Mock Window Title Bar */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center select-none">
              <div className="flex gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
              </div>
              <div className="w-full flex justify-center -ml-10">
                <div className="bg-slate-200/50 text-[10px] text-slate-500 font-medium font-mono px-6 py-0.5 rounded-md flex items-center gap-1">
                  <span>🔒</span>
                  <span>brijrani-erp.internal/dashboard</span>
                </div>
              </div>
            </div>
            {/* White Canvas area containing the illustration */}
            <div className="p-8 flex items-center justify-center bg-white">
              <img 
                src="/login01.png" 
                alt="Sourcing & Warehousing Illustration" 
                className="max-h-[280px] w-auto object-contain mx-auto"
              />
            </div>
          </div>
        </div>

        {/* Bottom Description Panel */}
        <div className="relative z-10 space-y-2 max-w-lg">
          <h2 className="text-xl font-bold text-white tracking-tight">Streamlining Grain Trading & Silo Storage</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Automating farmer purchasing quotes, lab quality ratings, real-time weighing logs, silo capacities, fleet route dispatch, and financial ledgers.
          </p>
        </div>
      </div>

      {/* Right Panel: Premium Auth Card */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-16 bg-white relative">
        {/* Subtle background glow on right panel */}
        <div className="absolute top-1/4 right-1/4 w-72 h-72 rounded-full bg-indigo-50/40 blur-3xl -z-10" />

        <div className="max-w-md w-full space-y-8">
          {/* Logo & Headline */}
          <div className="text-center space-y-4">
            <div className="inline-block transition-all hover:scale-[1.01] duration-300">
              <img 
                src="/feedrani-logo-removebg-preview.png" 
                alt="FeedRani Logo" 
                className="h-20 mx-auto object-contain"
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Sign In to Dashboard</h1>
              <p className="text-xs text-slate-400 font-semibold">Authorized personnel only. Please verify your identity.</p>
            </div>
          </div>

          {/* Validation Alert */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-150 text-rose-800 text-xs rounded-xl p-3.5 flex gap-3 items-start font-medium leading-normal animate-shake shadow-sm">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employee Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@brijrani.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-xs bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white font-mono text-slate-800 focus:outline-none pl-10 transition-all duration-200"
                />
                <User size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); alert('Please request a password reset from your system administrator.'); }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold focus:outline-none"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-xs bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white font-mono text-slate-800 focus:outline-none pl-10 pr-10 transition-all duration-200"
                />
                <Lock size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Session Option */}
            <div className="flex items-center justify-between py-0.5">
              <label className="flex items-center gap-2 select-none cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer" 
                  defaultChecked
                />
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 transition">Keep me logged in for 1 hour</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-white font-bold rounded-xl text-xs shadow-lg transition-all duration-200 flex items-center justify-center gap-1.5 focus:outline-none select-none cursor-pointer ${
                isLoading 
                  ? 'bg-slate-400 shadow-none cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 active:scale-[0.995]'
              }`}
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Checking credentials...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </button>

            {/* Quick Demo Credentials */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                Quick Demo Login
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { role: 'Super Admin', email: 'admin@brijrani.com' },
                  { role: 'Purchase Mgr', email: 'deepak@brijrani.com' },
                  { role: 'Warehouse Mgr', email: 'raman@brijrani.com' },
                  { role: 'Accountant', email: 'sanjay@brijrani.com' },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword('password123');
                      setErrorMsg('');
                    }}
                    className="p-2 text-left rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition text-[11px] group"
                  >
                    <div className="font-semibold text-slate-700 group-hover:text-indigo-600">{demo.role}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{demo.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Bottom Security Banner */}
          <div className="text-center border-t border-slate-100 pt-4">
            <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
              Default password for all demo accounts: <span className="font-mono font-bold text-indigo-600">password123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
