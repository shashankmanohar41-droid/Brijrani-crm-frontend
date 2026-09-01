import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ErpProvider } from '../context/ErpContext';
import ErpLayoutWrapper from '../components/layout/ErpLayoutWrapper';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BrijRani ERP - Trading, Warehouse & Logistics Management',
  description: 'Enterprise grade CRM and ERP system for agricultural trading, stock storage, and logistical dispatch.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-50 font-sans text-slate-900 antialiased overflow-hidden" suppressHydrationWarning>
        <ErpProvider>
          <ErpLayoutWrapper>
            {children}
          </ErpLayoutWrapper>
        </ErpProvider>
      </body>
    </html>
  );
}
