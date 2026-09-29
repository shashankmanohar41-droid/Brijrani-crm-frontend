'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { SalesQuotation } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { ClipboardList, Plus, TrendingUp, HelpCircle, FileCheck, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';

function SalesQuotationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedQuote, setSelectedQuote] = useState<SalesQuotation | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [enquiryNo, setEnquiryNo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [freightCost, setFreightCost] = useState(0);
  const [loadingCost, setLoadingCost] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Handle conversion query params from Enquiries or Market Price Monitor
  const enqQuery = searchParams.get('enquiry');
  const custQuery = searchParams.get('customer');
  const cmdQuery = searchParams.get('commodity');
  const qtyQuery = searchParams.get('qty');
  const rateQuery = searchParams.get('rate');

  useEffect(() => {
    if (enqQuery) {
      setEnquiryNo(enqQuery);
      if (custQuery) setCustomerId(custQuery);
      if (cmdQuery) setCommodityId(cmdQuery);
      if (qtyQuery) setQuantity(Number(qtyQuery));
      if (rateQuery) setRate(Number(rateQuery));
      setIsCreateOpen(true);
    } else if (cmdQuery) {
      setCommodityId(cmdQuery);
      if (qtyQuery) setQuantity(Number(qtyQuery));
      if (rateQuery) setRate(Number(rateQuery));
      setIsCreateOpen(true);
    }
  }, [enqQuery, custQuery, cmdQuery, qtyQuery, rateQuery]);

  const customers = db.customers;
  const commodities = db.commodities;
  const enquiries = db.salesEnquiries || [];

  // Available unquoted/active enquiries (exclude enquiries that already have an active Sales Quotation)
  const availableEnquiries = useMemo(() => {
    return (db.salesEnquiries || []).filter((enq: any) => {
      if (enq.status === 'Won' || enq.status === 'Lost' || enq.status === 'Closed' || enq.status === 'Quoted') return false;
      const alreadyHasQuote = (db.salesQuotations || []).some(sq => 
        (sq.enquiryNo === enq.enquiryNo || (sq as any).enquiryId === enq.id) &&
        sq.status !== 'Rejected'
      );
      return !alreadyHasQuote;
    });
  }, [db.salesEnquiries, db.salesQuotations]);

  const handleSelectEnquiry = (selectedEnqNo: string) => {
    setEnquiryNo(selectedEnqNo);
    if (!selectedEnqNo) return;
    const enq = (db.salesEnquiries || []).find((e: any) => e.enquiryNo === selectedEnqNo || e.id === selectedEnqNo);
    if (enq) {
      setCustomerId(enq.customerId);
      setCommodityId(enq.commodityId);
      setQuantity(enq.quantity);
      setRate(enq.expectedRate || 0);
      setNotes(`Quoted against Sales Enquiry ${enq.enquiryNo}. Target Delivery: ${enq.requiredDeliveryDate || 'Immediate'}`);
      showToast(`Loaded details from Sales Enquiry ${enq.enquiryNo}`, 'info');
    }
  };

  const filteredQuotes = statusFilter === 'All'
    ? db.salesQuotations
    : db.salesQuotations.filter(q => q.status === statusFilter);

  // Real-time margin calculations
  const commodity = commodities.find(c => c.id === commodityId);
  const purchaseCost = commodity?.purchaseCost || 0;
  const subtotal = quantity * rate;
  const charges = Number(freightCost) + Number(loadingCost) - Number(discountAmount);
  const gstRate = commodity?.defaultGst !== undefined ? commodity.defaultGst : 5;
  const gstAmt = Math.round((subtotal + charges) * (gstRate / 100)); // Dynamic GST
  const grandTotal = subtotal + charges + gstAmt;

  const expectedCostValue = quantity * purchaseCost;
  const expectedRevenueValue = quantity * rate;
  const grossMargin = expectedRevenueValue - expectedCostValue;
  const marginPercent = purchaseCost > 0 ? Math.round((grossMargin / expectedCostValue) * 100) : 0;

  const columns: any[] = [
    { 
      header: 'Quotation No', 
      accessor: (row: SalesQuotation) => (
        <div>
          <span className="font-bold text-slate-800">{row.quotationNo}</span>
          {row.enquiryNo && (
            <span className="text-[9px] text-primary-600 font-semibold block">
              Enq: {row.enquiryNo}
            </span>
          )}
        </div>
      ), 
      sortable: true 
    },
    { 
      header: 'Customer Name', 
      accessor: (row: SalesQuotation) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: SalesQuotation) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Qty (MT)', accessor: 'quantity' as keyof SalesQuotation },
    { header: 'Offered Rate/MT', accessor: (row: SalesQuotation) => `₹${row.rate.toLocaleString()}` },
    { header: 'Grand Total', accessor: (row: SalesQuotation) => `₹${row.total.toLocaleString()}` },
    { 
      header: 'Expected Profit', 
      accessor: (row: SalesQuotation) => (
        <span className={`font-bold flex items-center gap-0.5 ${row.expectedProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          ₹{row.expectedProfit.toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: (row: SalesQuotation) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Converted' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const quotationNo = `SQ/BR/2026-27/${String(db.salesQuotations.length + 1).padStart(3, '0')}`;
    const id = `SQ-${Date.now()}`;

    const newQuote: SalesQuotation = {
      id,
      quotationNo,
      enquiryNo: enquiryNo || undefined,
      date: new Date().toISOString().split('T')[0],
      customerId,
      commodityId,
      quantity,
      rate,
      gstPercent: 5,
      freightCost,
      loadingCost,
      otherCharges: 0,
      discountAmount,
      total: grandTotal,
      validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 15 Days',
      deliveryTerms: 'Door Delivery',
      purchaseCost,
      expectedProfit: grossMargin,
      status: 'Sent'
    };

    erpService.salesQuotations.create(newQuote);

    if (enquiryNo) {
      const enq = (db.salesEnquiries || []).find((e: any) => e.enquiryNo === enquiryNo || e.id === enquiryNo);
      if (enq) {
        enq.status = 'Quoted';
        erpService.salesEnquiries.update(enq);
      }
    }

    refreshDb();
    setIsCreateOpen(false);
    setSelectedQuote(newQuote);
    showToast(`Quotation ${quotationNo} generated and sent to customer`, 'success');
  };

  const convertToOrder = () => {
    if (!selectedQuote) return;

    // Call service to create sales order
    const so = erpService.createSalesOrder({
      quotationNo: selectedQuote.quotationNo,
      date: new Date().toISOString().split('T')[0],
      customerId: selectedQuote.customerId,
      commodityId: selectedQuote.commodityId,
      quantity: selectedQuote.quantity,
      rate: selectedQuote.rate,
      gstPercent: selectedQuote.gstPercent,
      freightCost: selectedQuote.freightCost,
      total: selectedQuote.total,
      warehouseId: 'WH-001', // default WH
      deliveryLocation: 'Door Delivery Address',
      expectedDispatch: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: selectedQuote.paymentTerms,
      notes: `Converted from quotation ${selectedQuote.quotationNo}.`
    });

    // Mark quote as converted
    selectedQuote.status = 'Converted';
    erpService.salesQuotations.update(selectedQuote);

    refreshDb();
    showToast(`Converted to Sales Order ${so.soNo}! Stock reserved.`, 'success');
    router.push(`/sales/orders?so=${so.id}`); // navigate to see the order
  };

  const handlePrintPDF = (quote: SalesQuotation) => {
    const doc = new jsPDF();

    // Fonts and Branding
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    // Subtitle
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 26);
    doc.text("Email: trade@brijranierp.com | Phone: +91 9988776655", 14, 31);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 36, 196, 36);

    // Quote Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("SALES PRICE QUOTATION", 14, 46);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Quotation No:   ${quote.quotationNo}`, 14, 53);
    doc.text(`Offer Date:     ${formatDate(quote.date)}`, 14, 59);
    doc.text(`Valid Until:    ${formatDate(quote.validUntil)}`, 14, 65);
    doc.text(`Doc Status:     ${quote.status}`, 14, 71);

    // Client/Prospect Details
    const customerName = customers.find(c => c.id === quote.customerId)?.name || 'Unknown';
    doc.setFont("Helvetica", "bold");
    doc.text("PROSPECT CLIENT DETAILS:", 14, 83);
    doc.setFont("Helvetica", "normal");
    doc.text(customerName, 14, 89);
    
    // Items table header
    const tableTop = 105;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Offered Commodity Description", 16, tableTop + 5.5);
    doc.text("Qty", 120, tableTop + 5.5, { align: "right" });
    doc.text("Offered Rate", 155, tableTop + 5.5, { align: "right" });
    doc.text("Estimated Net Value", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(203, 213, 225);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Item line
    const itemY = tableTop + 14;
    const commName = commodities.find(c => c.id === quote.commodityId)?.name || 'Unknown';
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(commName, 16, itemY);
    doc.setFont("Helvetica", "normal");
    doc.text(`${quote.quantity} MT`, 120, itemY, { align: "right" });
    doc.text(`₹${quote.rate.toLocaleString()} / MT`, 155, itemY, { align: "right" });
    doc.text(`₹${(quote.quantity * quote.rate).toLocaleString()}`, 194, itemY, { align: "right" });

    // Pricing details block
    const summaryX = 135;
    let summaryY = itemY + 15;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, summaryY - 3, 196, summaryY - 3);

    doc.setFont("Helvetica", "normal");
    doc.text("Base Value:", summaryX, summaryY);
    doc.text(`₹${(quote.quantity * quote.rate).toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 6;

    doc.text("Freight & Loading:", summaryX, summaryY);
    doc.text(`₹${(quote.freightCost + quote.loadingCost).toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 6;

    if (quote.otherCharges > 0) {
      doc.text("Other Adjustments:", summaryX, summaryY);
      doc.text(`₹${quote.otherCharges.toLocaleString()}`, 194, summaryY, { align: "right" });
      summaryY += 6;
    }

    if (quote.discountAmount > 0) {
      doc.text("Trade Discount:", summaryX, summaryY);
      doc.text(`- ₹${quote.discountAmount.toLocaleString()}`, 194, summaryY, { align: "right" });
      summaryY += 6;
    }

    const gstAmt = quote.total - (quote.quantity * quote.rate + quote.freightCost + quote.loadingCost + quote.otherCharges - quote.discountAmount);
    if (gstAmt > 0) {
      doc.text(`GST (${quote.gstPercent || 5}%):`, summaryX, summaryY);
      doc.text(`₹${Math.round(gstAmt).toLocaleString()}`, 194, summaryY, { align: "right" });
      summaryY += 6;
    }

    // Grand total
    doc.line(120, summaryY - 2, 196, summaryY - 2);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grand Total:", summaryX, summaryY + 2);
    doc.text(`₹${quote.total.toLocaleString()}`, 194, summaryY + 2, { align: "right" });
    summaryY += 15;

    // Terms
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COMMERCIAL TERMS:", 14, summaryY);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment: ${quote.paymentTerms || 'Standard 30-day corporate terms'}`, 14, summaryY + 6);
    doc.text(`Delivery: ${quote.deliveryTerms || 'Sourced ex-warehouse silo loading'}`, 14, summaryY + 12);

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an electronically generated price quotation. Valid until the expiry date shown above.", 14, 280);

    doc.save(`sales_quotation_${quote.quotationNo.replace(/\//g, '_')}.pdf`);
    showToast(`Quotation ${quote.quotationNo} PDF downloaded successfully!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Quotations</h1>
          <p className="text-xs font-medium text-slate-400">Offer price quotations to buyers, analyze profit margins, and lock in sales orders.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Quotation Offer</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Draft', 'Sent', 'Viewed', 'Negotiation', 'Accepted', 'Rejected', 'Expired', 'Converted'].map(status => {
              const count = status === 'All' 
                ? db.salesQuotations.length 
                : db.salesQuotations.filter(q => q.status === status).length;
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
            data={filteredQuotes}
            columns={columns}
            searchPlaceholder="Search quotation number..."
            searchField="quotationNo"
            onRowClick={(row) => setSelectedQuote(row)}
            exportFileName="sales_quotations_offers"
          />
        </div>

        {/* Selected Quote details panel */}
        <div>
          {selectedQuote ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedQuote.quotationNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Offer Date: {formatDate(selectedQuote.date)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{selectedQuote.total.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block font-semibold">Includes 5% GST</span>
                </div>
              </div>

              {/* Profit Margin indicator */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs flex justify-between items-center text-emerald-800 font-medium">
                <div>
                  <span className="text-[9px] text-emerald-600 uppercase block font-bold tracking-wider">Projected Sourcing Margin</span>
                  <span className="text-base font-extrabold">₹{selectedQuote.expectedProfit.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-emerald-600 uppercase block font-bold tracking-wider">Profit Ratio</span>
                  <span className="text-sm font-extrabold">{purchaseCost > 0 ? Math.round((selectedQuote.expectedProfit / (selectedQuote.quantity * selectedQuote.purchaseCost)) * 100) : 0}%</span>
                </div>
              </div>

              {/* General Details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                {selectedQuote.enquiryNo && (
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span className="text-slate-400">Linked Enquiry:</span>
                    <span className="text-primary-700 font-bold bg-primary-50 px-2 py-0.5 rounded">{selectedQuote.enquiryNo}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Customer Name:</span>
                  <span>{customers.find(c => c.id === selectedQuote.customerId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Commodity:</span>
                  <span>{commodities.find(c => c.id === selectedQuote.commodityId)?.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Offered Volume:</span>
                  <span>{selectedQuote.quantity} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valid Until:</span>
                  <span>{formatDate(selectedQuote.validUntil)}</span>
                </div>
              </div>

              {/* Items pricing details */}
              <div className="border-t border-slate-100 pt-3 space-y-1.5 text-[11px] font-medium text-slate-500">
                <div className="flex justify-between">
                  <span>Base Sourced Cost (Average):</span>
                  <span>₹{(selectedQuote.quantity * selectedQuote.purchaseCost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Base Quote Value:</span>
                  <span>₹{(selectedQuote.quantity * selectedQuote.rate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Freight/Loading adjustments:</span>
                  <span>₹{(selectedQuote.freightCost + selectedQuote.loadingCost).toLocaleString()}</span>
                </div>
              </div>

              {/* Action buttons (convert to sales order if active) */}
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handlePrintPDF(selectedQuote)}
                  className="w-full py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Printer size={14} />
                  <span>Print Quotation PDF</span>
                </button>

                {selectedQuote.status === 'Sent' && (
                  <button
                    onClick={convertToOrder}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Convert to Sales Order</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <ClipboardList size={24} className="text-slate-300" />
              <span>Select a Sales Quotation row to view expected margins and convert to sales order.</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">New Sales Quotation Offer</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Determine selling prices, check product sourcing costs, and review profits.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Link to Sales Enquiry Selector */}
              <div className="p-3 bg-primary-50/60 border border-primary-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-primary-950 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList size={13} className="text-primary-600" />
                    <span>Link to Sales Enquiry (Optional Auto-Fill)</span>
                  </label>
                  {enquiryNo && (
                    <button
                      type="button"
                      onClick={() => {
                        setEnquiryNo('');
                        showToast('Cleared enquiry link', 'info');
                      }}
                      className="text-[10px] text-primary-800 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear Link
                    </button>
                  )}
                </div>

                <select
                  value={enquiryNo}
                  onChange={e => handleSelectEnquiry(e.target.value)}
                  className="w-full px-3 py-2 border border-primary-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">-- Direct Quotation (No Linked Enquiry) --</option>
                  {availableEnquiries.map((enq: any) => {
                    const cust = customers.find(c => c.id === enq.customerId);
                    const comm = commodities.find(c => c.id === enq.commodityId);
                    return (
                      <option key={enq.id} value={enq.enquiryNo}>
                        {enq.enquiryNo} &minus; {cust?.name || 'Customer'} ({comm?.name || 'Commodity'} &minus; {enq.quantity} MT @ ₹{enq.expectedRate?.toLocaleString() || 0})
                      </option>
                    );
                  })}
                </select>

                {enquiryNo && (() => {
                  const enq = (db.salesEnquiries || []).find((e: any) => e.enquiryNo === enquiryNo);
                  if (!enq) return null;
                  return (
                    <div className="text-[11px] text-primary-900 bg-white/80 p-2 rounded-lg border border-primary-100 flex items-center justify-between">
                      <span>Linked: <strong>{enq.enquiryNo}</strong> &bull; Target Rate: ₹{enq.expectedRate?.toLocaleString()}/MT</span>
                      <span className="text-[10px] bg-primary-100 text-primary-800 font-bold px-2 py-0.5 rounded">
                        Required: {formatDate(enq.requiredDeliveryDate)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Customer Name *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Product Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Stock: {c.stockQty} MT)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Offered Volume (MT)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={quantity === 0 ? '' : quantity}
                    placeholder="e.g. 50"
                    onChange={e => setQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Offered Selling Price per MT (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={rate === 0 ? '' : rate}
                    placeholder="e.g. 24500"
                    onChange={e => setRate(e.target.value === '' ? 0 : Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Freight Cost (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={freightCost}
                    onChange={e => setFreightCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loading Charges (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={loadingCost}
                    onChange={e => setLoadingCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount Allowed (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              {/* Profit margin live feedback */}
              {commodityId && (
                <div className={`p-4 rounded-xl border text-xs flex justify-between items-center ${grossMargin >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                  <div>
                    <span className="text-[9px] font-bold uppercase block tracking-wide">Live Profit Margin Preview</span>
                    <span className="text-sm font-extrabold">₹{grossMargin.toLocaleString()} ({marginPercent}%)</span>
                  </div>
                  <div className="text-right text-[10px] opacity-80 leading-normal font-semibold">
                    <span>Sourced Cost: ₹{expectedCostValue.toLocaleString()}</span> <br />
                    <span>Selling Cost: ₹{expectedRevenueValue.toLocaleString()}</span>
                  </div>
                </div>
              )}

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
                  Send Quotation Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function SalesQuotationsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <SalesQuotationsPageContent />
    </React.Suspense>
  );
}
