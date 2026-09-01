'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { SalesInvoice, SalesInvoiceItem } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Layers, FileText, IndianRupee, Printer, CheckCircle, Plus, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

export default function SalesInvoicesPage() {
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [freight, setFreight] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const customers = db.customers;
  const commodities = db.commodities;

  // Compute totals
  const subtotal = quantity * rate;
  const taxable = subtotal - Number(discountAmount);
  const cgst = Math.round(taxable * 0.025);
  const sgst = Math.round(taxable * 0.025);
  const igst = 0;
  const grandTotal = taxable + cgst + sgst + Number(freight) + Number(otherCharges);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const selectedCust = customers.find(c => c.id === customerId);
    if (!selectedCust) return;

    const selectedCmd = commodities.find(c => c.id === commodityId);
    if (!selectedCmd) return;

    const invoiceNo = `INV/BR/2026-27/${String(db.salesInvoices.length + 1).padStart(3, '0')}`;
    const id = `INV-${Date.now()}`;
    const invoiceDate = new Date().toISOString().split('T')[0];

    const invoiceItem: SalesInvoiceItem = {
      commodityId,
      hsn: selectedCmd.hsn || '1006',
      quantity,
      rate,
      discount: Number(discountAmount),
      taxableAmount: taxable,
      cgst,
      sgst,
      igst,
      total: taxable + cgst + sgst
    };

    const newInvoice: SalesInvoice = {
      id,
      invoiceNo,
      invoiceDate,
      customerId,
      gstin: selectedCust.gstin || 'N/A',
      billingAddress: selectedCust.address || 'N/A',
      shippingAddress: selectedCust.address || 'N/A',
      items: [invoiceItem],
      taxableAmount: taxable,
      cgst,
      sgst,
      igst,
      freight: Number(freight),
      otherCharges: Number(otherCharges),
      grandTotal,
      dueDate,
      paymentStatus: 'Unpaid'
    };

    erpService.salesInvoices.create(newInvoice);
    refreshDb();
    setIsCreateOpen(false);
    showToast(`Invoice ${invoiceNo} generated successfully!`, 'success');
  };

  const handlePrint = () => {
    showToast('Sent invoice printing job to spooler...', 'info');
  };

  const handleDownload = (invoice: SalesInvoice) => {
    const doc = new jsPDF();

    // Fonts and Styling
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    // Subtitle
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 26);
    doc.text("Email: accounts@brijranierp.com | Phone: +91 9988776655", 14, 31);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 36, 196, 36);

    // Invoice Meta
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("TAX INVOICE", 14, 46);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice No:     ${invoice.invoiceNo}`, 14, 53);
    doc.text(`Invoice Date:   ${formatDate(invoice.invoiceDate)}`, 14, 59);
    doc.text(`Due Date:       ${formatDate(invoice.dueDate)}`, 14, 65);
    doc.text(`Payment Status: ${invoice.paymentStatus}`, 14, 71);

    // Billing info (Two columns)
    const customerName = customers.find(c => c.id === invoice.customerId)?.name || 'Unknown';
    
    // Billed To column
    doc.setFont("Helvetica", "bold");
    doc.text("BILLED TO:", 14, 83);
    doc.setFont("Helvetica", "normal");
    doc.text(customerName, 14, 89);
    
    // Multi-line address wrapping for billing address
    const billingAddressLines = doc.splitTextToSize(invoice.billingAddress || 'N/A', 80);
    doc.text(billingAddressLines, 14, 94);
    doc.setFont("Helvetica", "bold");
    doc.text(`GSTIN: ${invoice.gstin}`, 14, 98 + (billingAddressLines.length * 5));

    // Shipped To column
    doc.setFont("Helvetica", "bold");
    doc.text("SHIPPED TO:", 110, 83);
    doc.setFont("Helvetica", "normal");
    const shippingAddressLines = doc.splitTextToSize(invoice.shippingAddress || 'N/A', 80);
    doc.text(shippingAddressLines, 110, 89);

    // Items table header
    const tableTop = 130;
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(14, tableTop, 182, 8, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Product Commodity Description", 16, tableTop + 5.5);
    doc.text("Qty", 120, tableTop + 5.5, { align: "right" });
    doc.text("Rate", 150, tableTop + 5.5, { align: "right" });
    doc.text("Total Value", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Items list
    let itemY = tableTop + 14;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    
    invoice.items.forEach((item) => {
      const commName = commodities.find(c => c.id === item.commodityId)?.name || 'Unknown';
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(`HSN Code: ${item.hsn}`, 16, itemY + 4.5);
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      doc.text(`${item.quantity} MT`, 120, itemY, { align: "right" });
      doc.text(`₹${item.rate.toLocaleString()}`, 150, itemY, { align: "right" });
      doc.text(`₹${item.taxableAmount.toLocaleString()}`, 194, itemY, { align: "right" });
      itemY += 15;
    });

    // Summary calculations block (aligned right)
    const summaryX = 140;
    let summaryY = itemY + 5;
    
    doc.setDrawColor(226, 232, 240);
    doc.line(14, summaryY - 2, 196, summaryY - 2);

    doc.setFont("Helvetica", "normal");
    doc.text("Taxable Value:", summaryX, summaryY);
    doc.text(`₹${invoice.taxableAmount.toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 6;

    if (invoice.cgst > 0) {
      doc.text("CGST (2.5%):", summaryX, summaryY);
      doc.text(`₹${invoice.cgst.toLocaleString()}`, 194, summaryY, { align: "right" });
      summaryY += 6;
    }
    if (invoice.sgst > 0) {
      doc.text("SGST (2.5%):", summaryX, summaryY);
      doc.text(`₹${invoice.sgst.toLocaleString()}`, 194, summaryY, { align: "right" });
      summaryY += 6;
    }
    if (invoice.igst > 0) {
      doc.text("IGST (5%):", summaryX, summaryY);
      doc.text(`₹${invoice.igst.toLocaleString()}`, 194, summaryY, { align: "right" });
      summaryY += 6;
    }

    doc.text("Transport Freight:", summaryX, summaryY);
    doc.text(`₹${invoice.freight.toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 8;

    // Grand total
    doc.line(120, summaryY - 3, 196, summaryY - 3);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grand Total:", summaryX, summaryY + 1);
    doc.text(`₹${invoice.grandTotal.toLocaleString()}`, 194, summaryY + 1, { align: "right" });

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an electronically generated tax invoice. No signature is required.", 14, 280);

    doc.save(`invoice_${invoice.invoiceNo.replace(/\//g, '_')}.pdf`);
    showToast(`Invoice ${invoice.invoiceNo} PDF downloaded successfully!`, 'success');
  };

  const filteredInvoices = statusFilter === 'All'
    ? db.salesInvoices
    : db.salesInvoices.filter(i => i.paymentStatus === statusFilter);

  const columns: any[] = [
    { header: 'Invoice No', accessor: 'invoiceNo' as keyof SalesInvoice, sortable: true },
    { header: 'Date', accessor: 'invoiceDate' as keyof SalesInvoice },
    { 
      header: 'Customer', 
      accessor: (row: SalesInvoice) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Taxable Val', 
      accessor: (row: SalesInvoice) => `₹${row.taxableAmount.toLocaleString()}`
    },
    { 
      header: 'Grand Total', 
      accessor: (row: SalesInvoice) => `₹${row.grandTotal.toLocaleString()}`
    },
    { header: 'Due Date', accessor: 'dueDate' as keyof SalesInvoice },
    { 
      header: 'Status', 
      accessor: (row: SalesInvoice) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.paymentStatus === 'Partially Paid' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          row.paymentStatus === 'Overdue' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
        }`}>
          {row.paymentStatus}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Invoices</h1>
          <p className="text-xs font-medium text-slate-400">Review corporate accounts billing invoices, print tax-compliant receipts, and receive outstanding customer balances.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Sales Invoice</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Unpaid', 'Partially Paid', 'Paid'].map(status => {
              const count = status === 'All' 
                ? db.salesInvoices.length 
                : db.salesInvoices.filter(i => i.paymentStatus === status).length;
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
            data={filteredInvoices}
            columns={columns}
            searchPlaceholder="Search invoice number..."
            searchField="invoiceNo"
            onRowClick={(row) => setSelectedInvoice(row)}
            exportFileName="sales_invoices_register"
          />
        </div>

        {/* Invoice template drawer */}
        <div>
          {selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6 relative overflow-hidden">
              {/* Payment status stamp */}
              <div className="absolute right-4 top-4 rotate-12 opacity-35 border-2 border-dashed px-3 py-1 text-xs font-bold uppercase rounded">
                {selectedInvoice.paymentStatus}
              </div>

              {/* Company details */}
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">BrijRani Agro Foods Ltd</span>
                <h3 className="text-sm font-bold text-slate-800">{selectedInvoice.invoiceNo}</h3>
                <span className="text-[9px] text-slate-400 block font-semibold">Dated: {formatDate(selectedInvoice.invoiceDate)}</span>
              </div>

              {/* Customer details */}
              <div className="grid grid-cols-2 gap-4 text-[10px] leading-relaxed">
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Billed To:</span>
                  <span className="font-bold text-slate-800 block">
                    {customers.find(c => c.id === selectedInvoice.customerId)?.name}
                  </span>
                  <span className="text-slate-500 font-semibold block">{selectedInvoice.billingAddress}</span>
                  <span className="text-slate-600 font-bold block mt-0.5">GSTIN: {selectedInvoice.gstin}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-bold uppercase">Shipped To:</span>
                  <span className="text-slate-650 font-semibold block">{selectedInvoice.shippingAddress}</span>
                </div>
              </div>

              {/* Invoice Item list */}
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
                      <th className="p-2">Item</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <span className="font-bold text-slate-800">
                            {commodities.find(c => c.id === item.commodityId)?.name}
                          </span>
                          <span className="text-[9px] text-slate-400 block">HSN: {item.hsn}</span>
                        </td>
                        <td className="p-2 text-right">{item.quantity} MT</td>
                        <td className="p-2 text-right">₹{item.rate.toLocaleString()}</td>
                        <td className="p-2 text-right">₹{item.taxableAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Taxation breakdown */}
              <div className="border-t border-slate-150 pt-4 space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Taxable Value:</span>
                  <span>₹{selectedInvoice.taxableAmount.toLocaleString()}</span>
                </div>
                {selectedInvoice.cgst > 0 && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5 text-[11px] font-medium text-slate-500">
                    <span>CGST (2.5%):</span>
                    <span>₹{selectedInvoice.cgst.toLocaleString()}</span>
                  </div>
                )}
                {selectedInvoice.sgst > 0 && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5 text-[11px] font-medium text-slate-500">
                    <span>SGST (2.5%):</span>
                    <span>₹{selectedInvoice.sgst.toLocaleString()}</span>
                  </div>
                )}
                {selectedInvoice.igst > 0 && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5 text-[11px] font-medium text-slate-500">
                    <span>IGST (5%):</span>
                    <span>₹{selectedInvoice.igst.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Transport Freight:</span>
                  <span>₹{selectedInvoice.freight.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-800">
                  <span>Grand Total:</span>
                  <span>₹{selectedInvoice.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Print / Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex-1 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Printer size={14} />
                    <span>Print Invoice</span>
                  </button>
                  <button
                    onClick={() => handleDownload(selectedInvoice)}
                    className="flex-1 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Download size={14} />
                    <span>Download Invoice</span>
                  </button>
                </div>

                {selectedInvoice.paymentStatus !== 'Paid' && (
                  <button
                    onClick={() => router.push(`/finance/receipts?action=new&invoice=${selectedInvoice.invoiceNo}&amount=${selectedInvoice.grandTotal}&customer=${selectedInvoice.customerId}`)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <IndianRupee size={14} />
                    <span>Receive Collection</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Layers size={24} className="text-slate-300" />
              <span>Select an invoice row to display tax breakdown, print invoices, and record incoming collection payments.</span>
            </div>
          )}
        </div>
      </div>
      {/* Create Modal Drawer */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Generate New Sales Invoice</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Define taxable items, quantities, client details, and tax breakdowns.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Corporate Client *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Commodity Selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Product Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                {/* Rate */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selling Rate per MT (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={rate}
                    onChange={e => setRate(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Freight */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight / Transport (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={freight}
                    onChange={e => setFreight(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                {/* Other charges */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Other Surcharges (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={otherCharges}
                    onChange={e => setOtherCharges(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                {/* Discount */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Trade Discount (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Due Date *</label>
                 <IndianDateInput
                   className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                   value={dueDate}
                   onChange={val => setDueDate(val)}
                   required
                 />
              </div>

              {/* Order total preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Estimated Invoice Total</span>
                  <span className="text-sm font-bold text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base Taxable: ₹{taxable.toLocaleString()}</span> <br />
                  <span>Freight/Charges: ₹{(Number(freight) + Number(otherCharges)).toLocaleString()}</span> <br />
                  <span>CGST/SGST (5%): ₹{(cgst + sgst).toLocaleString()}</span>
                </div>
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
