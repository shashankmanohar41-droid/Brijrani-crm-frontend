'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { SalesOrder } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { 
  FileCheck, Plus, Layers, PackagePlus, Truck, ShieldAlert, 
  FlaskConical, FileText, Download, Building2, Handshake, CheckCircle2,
  Clock, ArrowRight, Eye, Edit3, Trash2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

function SalesOrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [orderType, setOrderType] = useState<'GT' | 'WH'>('WH');
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [freightCost, setFreightCost] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [expectedDispatch, setExpectedDispatch] = useState(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('Net 15 Days');
  const [notes, setNotes] = useState('');

  // Handle URL query parameters for conversions
  const soQuery = searchParams.get('so') || searchParams.get('po');
  const quoteQuery = searchParams.get('quotation');
  const customerQuery = searchParams.get('customer');
  const cmdQuery = searchParams.get('commodity');
  const qtyQuery = searchParams.get('qty');
  const rateQuery = searchParams.get('rate');

  useEffect(() => {
    if (soQuery) {
      const order = db.salesOrders.find(s => s.id === soQuery || s.soNo === soQuery);
      if (order) setSelectedSO(order);
    }
    if (quoteQuery) {
      if (customerQuery) setCustomerId(customerQuery);
      if (cmdQuery) setCommodityId(cmdQuery);
      if (qtyQuery) setQuantity(Number(qtyQuery));
      if (rateQuery) setRate(Number(rateQuery));
      setIsCreateOpen(true);
    }
  }, [soQuery, quoteQuery, customerQuery, cmdQuery, qtyQuery, rateQuery, db.salesOrders]);

  const customers = db.customers;
  const commodities = db.commodities;
  const warehouses = db.warehouses;

  const filteredOrders = statusFilter === 'All'
    ? db.salesOrders
    : db.salesOrders.filter(o => o.status === statusFilter);

  // Selected order details calculations
  const selectedCommodity = selectedSO ? commodities.find(c => c.id === selectedSO.commodityId) : null;
  const availableToSell = selectedCommodity 
    ? selectedCommodity.stockQty - selectedCommodity.reservedQty 
    : 0;

  // Track linked lifecycle records
  const linkedInvoice = useMemo(() => {
    if (!selectedSO) return null;
    return db.salesInvoices.find(i => i.soId === selectedSO.id || i.soNo === selectedSO.soNo) || null;
  }, [selectedSO, db.salesInvoices]);

  const linkedQC = useMemo(() => {
    if (!selectedSO) return null;
    const qcList = (db as any).salesQcList || db.qualityInspections || [];
    return qcList.find((q: any) => 
      q.soId === selectedSO.id || 
      q.soNumber === selectedSO.soNo || 
      q.referenceNumber === selectedSO.soNo ||
      (linkedInvoice && (q.invoiceId === linkedInvoice.id || q.invoiceNo === linkedInvoice.invoiceNo))
    ) || null;
  }, [selectedSO, linkedInvoice, db]);

  const linkedDC = useMemo(() => {
    if (!selectedSO) return null;
    return db.deliveryChallans.find(d => d.soId === selectedSO.id || d.soNo === selectedSO.soNo) || null;
  }, [selectedSO, db.deliveryChallans]);

  // Helper to calculate stock of a commodity inside a specific warehouse
  const getWarehouseCommodityStock = (whId: string, cId: string) => {
    if (!whId || !cId) return { totalStock: 0, reservedStock: 0, availableStock: 0 };
    
    // 1. From stockItems
    const whStockItems = (db.stockItems || []).filter(s => 
      (s.warehouseId === whId || (s as any).warehouse === whId) && 
      (s.commodityId === cId || (s as any).commodity === cId)
    );
    let totalStock = whStockItems.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    
    // Fallback: check bins for this warehouse
    if (totalStock === 0) {
      const whBins = (db.bins || []).filter(b => 
        (b.warehouseId === whId || (b as any).warehouse === whId) && 
        (b.allowedCommodityId === cId || String(b.allowedCommodityId) === String(cId))
      );
      whBins.forEach(b => {
        totalStock += Number(b.occupiedMT || (b as any).currentStock || 0);
      });
    }

    // 2. Reserved stock for this warehouse from pending/active sales orders
    const reservedStock = (db.salesOrders || [])
      .filter(so => 
        so.orderType === 'WH' && 
        so.warehouseId === whId && 
        so.commodityId === cId && 
        (so.status === 'Approved' || so.status === 'Packing' || so.status === 'Picking')
      )
      .reduce((sum, so) => sum + (Number(so.quantity) || 0), 0);

    const availableStock = Math.max(0, totalStock - reservedStock);

    return { totalStock, reservedStock, availableStock };
  };

  // Filter available commodities: if WH order, ONLY show commodities having stock in selected warehouse
  const availableCommodities = useMemo(() => {
    if (orderType !== 'WH') {
      return commodities;
    }
    if (!warehouseId) {
      return [];
    }
    return commodities.filter(c => {
      const { totalStock } = getWarehouseCommodityStock(warehouseId, c.id);
      return totalStock > 0;
    });
  }, [commodities, orderType, warehouseId, db.stockItems, db.bins, db.salesOrders]);

  // Reset selected commodity if user switches warehouse and the commodity isn't in stock there
  useEffect(() => {
    if (orderType === 'WH' && warehouseId && commodityId) {
      const exists = availableCommodities.some(c => c.id === commodityId);
      if (!exists) {
        setCommodityId('');
      }
    }
  }, [warehouseId, orderType, availableCommodities, commodityId]);

  const handleCreateSO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    if (orderType === 'WH') {
      if (!warehouseId) {
        showToast('Please select a sourcing warehouse for Warehouse (WH) sale', 'error');
        return;
      }
      const stock = getWarehouseCommodityStock(warehouseId, commodityId);
      const whName = warehouses.find(w => w.id === warehouseId)?.name || 'selected warehouse';
      const cmdName = commodities.find(c => c.id === commodityId)?.name || 'commodity';

      if (stock.totalStock <= 0) {
        showToast(`Selected ${whName} has NO stock for ${cmdName}. Only warehouses with available stock can fulfill WH sales.`, 'error');
        return;
      }

      if (quantity > stock.availableStock) {
        showToast(`Insufficient warehouse stock! Required: ${quantity} MT, but only ${stock.availableStock} MT is available in ${whName} (${stock.reservedStock} MT reserved).`, 'error');
        return;
      }
    }

    const subtotal = quantity * rate;
    const grandTotal = Math.round((subtotal + Number(freightCost)) * 1.05);

    const so = erpService.createSalesOrder({
      orderType,
      fulfillmentType: orderType,
      date: new Date().toISOString().split('T')[0],
      customerId,
      commodityId,
      quantity,
      rate,
      gstPercent: 5,
      freightCost: Number(freightCost),
      total: grandTotal,
      warehouseId: orderType === 'WH' ? warehouseId : undefined,
      deliveryLocation,
      expectedDispatch,
      paymentTerms,
      notes
    });

    refreshDb();
    setIsCreateOpen(false);
    setSelectedSO(so);
    showToast(`Sales Order ${so.soNo} (${orderType === 'GT' ? 'General Trade' : 'Warehouse Sourced'}) booked successfully!`, 'success');
  };

  const handleDownloadPDF = (so: SalesOrder) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 25);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("OFFICIAL SALES ORDER (SO) BOOKING", 14, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`SO Number:       ${so.soNo}`, 14, 46);
    doc.text(`Order Date:      ${formatDate(so.date)}`, 14, 52);
    doc.text(`Trade Type:      ${so.orderType === 'GT' ? 'GT - General Trade (Direct Mill)' : 'WH - Warehouse Sourced'}`, 14, 58);
    doc.text(`Exp Dispatch:    ${formatDate(so.expectedDispatch)}`, 14, 64);
    doc.text(`Payment Terms:   ${so.paymentTerms}`, 14, 70);

    const cust = customers.find(c => c.id === so.customerId);
    doc.setFont("Helvetica", "bold");
    doc.text("CUSTOMER / BUYER:", 14, 82);
    doc.setFont("Helvetica", "normal");
    doc.text(cust?.name || 'Unknown Buyer', 14, 88);
    doc.text(`GSTIN: ${cust?.gstin || 'N/A'}`, 14, 94);
    doc.text(`Delivery Location: ${so.deliveryLocation || 'Customer Plant'}`, 14, 100);

    const tableTop = 112;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Product Commodity", 16, tableTop + 5.5);
    doc.text("Ordered Qty", 90, tableTop + 5.5, { align: "right" });
    doc.text("Rate / MT", 130, tableTop + 5.5, { align: "right" });
    doc.text("Line Total", 194, tableTop + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    const commName = commodities.find(c => c.id === so.commodityId)?.name || 'Grain Commodity';
    const subtotal = so.quantity * so.rate;
    doc.setFont("Helvetica", "normal");
    doc.text(commName, 16, tableTop + 15);
    doc.text(`${so.quantity} MT`, 90, tableTop + 15, { align: "right" });
    doc.text(`₹${so.rate.toLocaleString()}`, 130, tableTop + 15, { align: "right" });
    doc.text(`₹${subtotal.toLocaleString()}`, 194, tableTop + 15, { align: "right" });

    doc.line(14, tableTop + 20, 196, tableTop + 20);

    const summaryX = 130;
    let sumY = tableTop + 26;
    doc.text("Taxable Subtotal:", summaryX, sumY);
    doc.text(`₹${subtotal.toLocaleString()}`, 194, sumY, { align: "right" });
    sumY += 6;

    if (so.freightCost > 0) {
      doc.text("Freight Cost:", summaryX, sumY);
      doc.text(`₹${so.freightCost.toLocaleString()}`, 194, sumY, { align: "right" });
      sumY += 6;
    }

    const gstVal = Math.round((subtotal + (so.freightCost || 0)) * 0.05);
    doc.text("GST (5%):", summaryX, sumY);
    doc.text(`₹${gstVal.toLocaleString()}`, 194, sumY, { align: "right" });
    sumY += 8;

    doc.line(120, sumY - 3, 196, sumY - 3);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Total Order Value:", summaryX, sumY);
    doc.text(`₹${so.total.toLocaleString()}`, 194, sumY, { align: "right" });

    doc.save(`sales_order_${so.soNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    showToast(`Sales Order PDF exported successfully`, 'success');
  };

  const columns: any[] = [
    { header: 'SO Number', accessor: 'soNo' as keyof SalesOrder, sortable: true },
    { 
      header: 'Trade Type', 
      accessor: (row: SalesOrder) => (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          row.orderType === 'GT' 
            ? 'bg-amber-50 text-amber-700 border-amber-250 flex items-center gap-1 w-fit' 
            : 'bg-indigo-50 text-indigo-700 border-indigo-250 flex items-center gap-1 w-fit'
        }`}>
          {row.orderType === 'GT' ? <Handshake size={11} /> : <Building2 size={11} />}
          <span>{row.orderType === 'GT' ? 'GT (General Trade)' : 'WH (Warehouse)'}</span>
        </span>
      )
    },
    { 
      header: 'Customer Name', 
      accessor: (row: SalesOrder) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: SalesOrder) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Volume (MT)', accessor: 'quantity' as keyof SalesOrder },
    { header: 'Dispatch Date', accessor: 'expectedDispatch' as keyof SalesOrder },
    { 
      header: 'Total Value', 
      accessor: (row: SalesOrder) => `₹${row.total.toLocaleString()}`
    },
    { 
      header: 'Status', 
      accessor: (row: SalesOrder) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Shipped' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          row.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
          row.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sales Orders (SO)</h1>
          <p className="text-xs font-medium text-slate-400">Book buyer agreements with GT (General Trade) or WH (Warehouse Sourced) options, lock stock, and authorize dispatches.</p>
        </div>
        <button
          onClick={() => {
            setCustomerId('');
            setCommodityId('');
            setQuantity(0);
            setRate(0);
            setFreightCost(0);
            setWarehouseId('');
            setDeliveryLocation('');
            setNotes('');
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record New Sales Order</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Status Tabs Bar */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Draft', 'Pending Approval', 'Approved', 'Shipped', 'Completed', 'Cancelled'].map(status => {
              const count = status === 'All' 
                ? db.salesOrders.length 
                : db.salesOrders.filter(o => o.status === status).length;
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
            data={filteredOrders}
            columns={columns}
            searchPlaceholder="Search SO number..."
            searchField="soNo"
            onRowClick={(row) => setSelectedSO(row)}
            exportFileName="sales_orders_register"
          />
        </div>

        {/* Details card */}
        <div>
          {selectedSO ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedSO.soNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Order Date: {formatDate(selectedSO.date)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{selectedSO.total.toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold inline-block mt-0.5 border ${
                    selectedSO.orderType === 'GT' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {selectedSO.orderType === 'GT' ? 'GT (General Trade)' : 'WH (Warehouse)'}
                  </span>
                </div>
              </div>

              {/* Physical Inventory status if WH order */}
              {selectedSO.orderType !== 'GT' && selectedCommodity && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Warehouse Inventory Check</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-650">
                    <span>Sourced: {selectedCommodity.stockQty} MT</span>
                    <span>Reserved: {selectedCommodity.reservedQty} MT</span>
                    <span className="col-span-2 border-t border-slate-200/60 pt-1.5 flex justify-between font-bold text-slate-800">
                      <span>Available to Sell:</span>
                      <span className={availableToSell >= selectedSO.quantity ? 'text-emerald-600' : 'text-red-600'}>
                        {availableToSell} MT
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Sourcing details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-slate-800 font-bold">{customers.find(c => c.id === selectedSO.customerId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sourcing Mode:</span>
                  <span>{selectedSO.orderType === 'GT' ? 'General Trade (Direct Sourcing / Mill)' : (warehouses.find(w => w.id === selectedSO.warehouseId)?.name || 'Warehouse Storage')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Delivery Address:</span>
                  <span className="truncate max-w-[150px]">{selectedSO.deliveryLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Exp Dispatch:</span>
                  <span>{selectedSO.expectedDispatch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Terms:</span>
                  <span>{selectedSO.paymentTerms}</span>
                </div>
              </div>

              {/* Lifecycle Flow Tracker (SO -> Sales Invoice -> Sales QC -> GRN Outward -> Returns/Receipts) */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sales Lifecycle Progression
                </span>

                {/* Step 1: Sales Invoice */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      linkedInvoice ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {linkedInvoice ? '✓' : '1'}
                    </span>
                    <span className="font-semibold text-slate-700">1. Sales Invoice</span>
                  </div>
                  {linkedInvoice ? (
                    <button 
                      onClick={() => router.push('/sales/invoices')} 
                      className="text-primary-600 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      {linkedInvoice.invoiceNo}
                    </button>
                  ) : (
                    <span className="text-amber-600 font-bold text-[11px]">Ready for Invoice</span>
                  )}
                </div>

                {/* Step 2: Sales QC */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      linkedQC ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {linkedQC ? '✓' : '2'}
                    </span>
                    <span className="font-semibold text-slate-700">2. Sales QC (Outward Lab)</span>
                  </div>
                  {linkedQC ? (
                    <button 
                      onClick={() => router.push('/sales/qc')} 
                      className="text-primary-600 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      {linkedQC.qcNumber || linkedQC.qcNo || 'QC Done'}
                    </button>
                  ) : (
                    <span className="text-slate-400 font-medium text-[11px]">
                      {linkedInvoice ? 'Ready for QC' : 'Awaiting Invoice'}
                    </span>
                  )}
                </div>

                {/* Step 3: GRN Outward (Delivery Challan) */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      linkedDC ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {linkedDC ? '✓' : '3'}
                    </span>
                    <span className="font-semibold text-slate-700">3. GRN Outward (Challan)</span>
                  </div>
                  {linkedDC ? (
                    <button 
                      onClick={() => router.push('/sales/delivery-challans')} 
                      className="text-primary-600 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      {linkedDC.dcNo}
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      {linkedQC ? 'Ready for Outward' : 'Awaiting QC'}
                    </span>
                  )}
                </div>

                {/* Step 4: Collection / Receipt */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      linkedInvoice?.paymentStatus === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {linkedInvoice?.paymentStatus === 'Paid' ? '✓' : '4'}
                    </span>
                    <span className="font-semibold text-slate-700">4. Customer Receipt</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${
                    linkedInvoice?.paymentStatus === 'Paid' ? 'text-emerald-600 font-bold' : 'text-slate-400'
                  }`}>
                    {linkedInvoice?.paymentStatus === 'Paid' ? 'Paid (Closed)' : linkedInvoice ? `${linkedInvoice.paymentStatus}` : 'Awaiting Outward'}
                  </span>
                </div>
              </div>

              {/* Intelligent Next Action Buttons */}
              <div className="space-y-2 pt-2">
                {!linkedInvoice ? (
                  <button
                    onClick={() => router.push(`/sales/invoices?action=new&so=${selectedSO.id}`)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Create Sales Invoice (Step 1)</span>
                  </button>
                ) : !linkedQC ? (
                  <button
                    onClick={() => router.push(`/sales/qc?action=new&so=${selectedSO.id}&invoice=${linkedInvoice.id}`)}
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/10 cursor-pointer transition"
                  >
                    <FlaskConical size={14} />
                    <span>Process Quality Inspection (Sales QC - Step 2)</span>
                  </button>
                ) : !linkedDC ? (
                  <button
                    onClick={() => router.push(`/sales/delivery-challans?action=new&so=${selectedSO.id}&invoice=${linkedInvoice.id}&qc=${linkedQC?.id || linkedQC?.qcNumber}`)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition"
                  >
                    <Truck size={14} />
                    <span>Record Gate Outward (GRN Outward - Step 3)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/sales/invoices')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>View Sales Invoice & Collections</span>
                  </button>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedSO)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download Sales Order PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Layers size={24} className="text-slate-300" />
              <span>Select a Sales Order row to view details, verify GT/WH status, and progress lifecycle actions.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Record Sales Order Bookings</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Approve customer orders with GT (General Trade) or WH (Warehouse) fulfillment mode.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSO} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Order Sourcing Type Toggle (GT vs WH) */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Order Sourcing & Fulfillment Mode *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderType('WH')}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition text-left cursor-pointer ${
                      orderType === 'WH'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${orderType === 'WH' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Building2 size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">WH (Warehouse Sourced)</span>
                      <span className="text-[10px] opacity-75 block">Dispatched from Brijrani Silos / Storage Bins</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('GT')}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition text-left cursor-pointer ${
                      orderType === 'GT'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${orderType === 'GT' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Handshake size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">GT (General Trade)</span>
                      <span className="text-[10px] opacity-75 block">Direct Sourcing / Mill & Cross-Dock Dispatch</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Warehouse & Customer selection */}
              <div className="grid grid-cols-2 gap-4">
                {orderType === 'WH' ? (
                  <div>
                    <label className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block mb-1">
                      1. Sourcing Warehouse *
                    </label>
                    <select
                      value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value)}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs bg-indigo-50/30 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Select Sourcing Warehouse --</option>
                      {warehouses.map(w => {
                        const inStockCount = commodities.filter(c => getWarehouseCommodityStock(w.id, c.id).totalStock > 0).length;
                        return (
                          <option key={w.id} value={w.id}>
                            {w.name} ({inStockCount} {inStockCount === 1 ? 'commodity' : 'commodities'} in stock)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      1. Sourcing Mode
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium text-slate-700 cursor-not-allowed"
                      value="General Trade (Direct Sourcing / Cross-dock)"
                      disabled
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    2. Customer Name *
                  </label>
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
              </div>

              {/* Commodity Selector (Filtered by Warehouse for WH sales) */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  {orderType === 'WH' ? '3. Product Commodity (Only In-Stock at Selected Warehouse) *' : '3. Product Commodity *'}
                </label>
                <select
                  value={commodityId}
                  onChange={e => setCommodityId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold ${
                    orderType === 'WH' && !warehouseId
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500'
                  }`}
                  disabled={orderType === 'WH' && !warehouseId}
                  required
                >
                  {orderType === 'WH' ? (
                    !warehouseId ? (
                      <option value="">-- Select Sourcing Warehouse first --</option>
                    ) : availableCommodities.length === 0 ? (
                      <option value="">-- No commodities in stock at this warehouse --</option>
                    ) : (
                      <>
                        <option value="">Select In-Stock Commodity</option>
                        {availableCommodities.map(c => {
                          const stock = getWarehouseCommodityStock(warehouseId, c.id);
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} (In WH: {stock.totalStock} MT | Available to Sell: {stock.availableStock} MT)
                            </option>
                          );
                        })}
                      </>
                    )
                  ) : (
                    <>
                      <option value="">Select Commodity</option>
                      {commodities.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (Total Global Stock: {c.stockQty} MT)</option>
                      ))}
                    </>
                  )}
                </select>

                {orderType === 'WH' && warehouseId && availableCommodities.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                    ⚠️ This warehouse currently has no commodity stock. Please select another warehouse or switch to General Trade (GT).
                  </p>
                )}
              </div>

              {/* Live Warehouse Inventory Verification Card */}
              {orderType === 'WH' && warehouseId && commodityId && (
                (() => {
                  const stock = getWarehouseCommodityStock(warehouseId, commodityId);
                  const isOverCapacity = quantity > stock.availableStock;
                  const whName = warehouses.find(w => w.id === warehouseId)?.name || 'Warehouse';
                  const cmdName = commodities.find(c => c.id === commodityId)?.name || 'Commodity';

                  return (
                    <div className={`p-3.5 rounded-xl border transition ${
                      isOverCapacity 
                        ? 'bg-rose-50 border-rose-300 text-rose-900' 
                        : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    }`}>
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className={isOverCapacity ? 'text-rose-600' : 'text-emerald-600'} />
                          <div>
                            <span className="font-bold">{whName} — {cmdName} Inventory Link</span>
                            <span className="text-[10px] text-slate-500 block">Sale permitted strictly against physical bin stock</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isOverCapacity ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {isOverCapacity ? 'INSUFFICIENT STOCK' : 'IN-STOCK & AVAILABLE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-center text-xs">
                        <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">Physical Stock</span>
                          <span className="font-extrabold text-slate-800">{stock.totalStock} MT</span>
                        </div>
                        <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">Reserved</span>
                          <span className="font-extrabold text-amber-700">{stock.reservedStock} MT</span>
                        </div>
                        <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">Available to Sell</span>
                          <span className={`font-extrabold ${isOverCapacity ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {stock.availableStock} MT
                          </span>
                        </div>
                      </div>

                      {isOverCapacity && (
                        <p className="text-[10px] text-rose-700 font-bold mt-2 text-center">
                          ⚠️ Entered quantity ({quantity} MT) exceeds available warehouse stock ({stock.availableStock} MT). Please reduce quantity or transfer stock from another warehouse.
                        </p>
                      )}
                    </div>
                  );
                })()
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={quantity || ''}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Selling Rate per MT (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={rate || ''}
                    onChange={e => setRate(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Freight Cost (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={freightCost || ''}
                    onChange={e => setFreightCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="Immediate upon Outward">Immediate upon Outward</option>
                    <option value="Net 7 Days">Net 7 Days</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Advance Payment">Advance Payment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expected Dispatch Date</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={expectedDispatch}
                    onChange={val => setExpectedDispatch(val)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Address *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={deliveryLocation}
                    onChange={e => setDeliveryLocation(e.target.value)}
                    placeholder="e.g. Fatuha Factory Gate 1, Patna"
                    required
                  />
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
                  Confirm Order Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesOrdersPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <SalesOrdersPageContent />
    </React.Suspense>
  );
}
