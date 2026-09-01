'use client';

import React, { useState, useEffect } from 'react';
import { useErp } from '../../context/ErpContext';
import Sidebar from './Sidebar';
import Header from './Header';
import LoginPage from './LoginPage';

export default function ErpLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useErp();
  const [mounted, setMounted] = useState(false);

  // Prevent Next.js hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  // Intercept layout if not logged in
  if (!isLoggedIn) {
    return <LoginPage />;
  }

  // Normal dashboard layout
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar Left */}
      <Sidebar />

      {/* Main Section Right */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        {/* Header Top */}
        <Header />

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto p-6 focus:outline-none">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
