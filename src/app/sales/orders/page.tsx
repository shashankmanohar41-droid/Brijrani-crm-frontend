'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import api from '../../../services/axios';
import { SalesOrder, PurchaseInvoice, QualityControl, QCTestedParameter } from '../../../types/erp';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { 
  FileCheck, Plus, Layers, PackagePlus, Truck, ShieldAlert, 
  FlaskConical, FileText, Download, Building2, Handshake, CheckCircle2,
  Clock, ArrowRight, Eye, Edit3, Trash2, Sparkles, Check, Info, ShieldCheck, X,
  ChevronDown, ChevronUp, Award, BarChart2, Scale
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import IndianDateInput from '../../../components/shared/IndianDateInput';

interface QCParamDisplay {
  parameterName: string;
  standardValue: number;
  tolerance: number;
  actualValue: number;
  deviation: number;
  unit: string;
  rebatePerUnit: number;
  totalDeduction: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

function extractQCParameters(qcDoc: any, invoice?: any): QCParamDisplay[] {
  if (!qcDoc && !invoice) return [];

  // 1. If qcDoc has qualityParameters array from QualityControl document
  if (qcDoc?.qualityParameters && Array.isArray(qcDoc.qualityParameters) && qcDoc.qualityParameters.length > 0) {
    const seen = new Set<string>();
    const uniqueParams = qcDoc.qualityParameters.filter((p: any) => {
      const k = (p.parameterName || '').toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return uniqueParams.map((p: any) => {
      const std = Number(p.standardValue ?? 0);
      const act = Number(p.actualValue ?? std);
      const tol = Number(p.tolerance ?? 0.5);
      const dev = Number(p.deviation ?? (act - std));
      return {
        parameterName: p.parameterName || 'Tested Parameter',
        standardValue: std,
        tolerance: tol,
        actualValue: act,
        deviation: Number(dev.toFixed(2)),
        unit: p.unit || '%',
        rebatePerUnit: Number(p.rebatePerUnit || 0),
        totalDeduction: Number(p.rebateTotal || p.totalDeduction || 0),
        status: p.status || (Math.abs(dev) <= tol ? 'PASS' : 'WARN')
      };
    });
  }

  // 2. If qcDoc has items array with testedParameters
  const item = qcDoc?.items?.[0];
  if (item?.testedParameters && Array.isArray(item.testedParameters) && item.testedParameters.length > 0) {
    const seen = new Set<string>();
    const uniqueParams = item.testedParameters.filter((p: any) => {
      const k = (p.parameterName || '').toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return uniqueParams.map((p: any) => {
      const std = Number(p.standardValue ?? 0);
      const act = Number(p.actualValue ?? std);
      const tol = Number(p.tolerance ?? 0.5);
      const dev = Number(p.deviation ?? (act - std));
      return {
        parameterName: p.parameterName || 'Tested Parameter',
        standardValue: std,
        tolerance: tol,
        actualValue: act,
        deviation: Number(dev.toFixed(2)),
        unit: p.unit || '%',
        rebatePerUnit: Number(p.rebatePerUnit || 0),
        totalDeduction: Number(p.rebateTotal || 0),
        status: p.status || 'PASS'
      };
    });
  }

  // 3. Fallback: build standard laboratory parameters from available fields
  const moistureAct = qcDoc?.moisturePercent ?? item?.moisturePercent ?? 14.0;
  const damageAct = qcDoc?.damagePercent ?? item?.damagePercent ?? 2.0;
  const foreignAct = qcDoc?.foreignMaterialPercent ?? item?.foreignMaterialPercent ?? 1.0;
  const brokenAct = qcDoc?.brokenGrainsPercent ?? item?.brokenGrainsPercent ?? 4.0;

  return [
    {
      parameterName: 'Broken Grains',
      standardValue: 4.0,
      tolerance: 1.0,
      actualValue: Number(brokenAct),
      deviation: Number((brokenAct - 4.0).toFixed(2)),
      unit: '%',
      rebatePerUnit: 0,
      totalDeduction: 0,
      status: brokenAct <= 5.0 ? 'PASS' : 'WARN'
    },
    {
      parameterName: 'Damaged Grains',
      standardValue: 2.0,
      tolerance: 0.5,
      actualValue: Number(damageAct),
      deviation: Number((damageAct - 2.0).toFixed(2)),
      unit: '%',
      rebatePerUnit: 0,
      totalDeduction: 0,
      status: damageAct <= 2.5 ? 'PASS' : 'WARN'
    },
    {
      parameterName: 'Foreign Matter',
      standardValue: 1.0,
      tolerance: 0.5,
      actualValue: Number(foreignAct),
      deviation: Number((foreignAct - 1.0).toFixed(2)),
      unit: '%',
      rebatePerUnit: 0,
      totalDeduction: 0,
      status: foreignAct <= 1.5 ? 'PASS' : 'WARN'
    },
    {
      parameterName: 'Moisture Content',
      standardValue: 14.0,
      tolerance: 1.0,
      actualValue: Number(moistureAct),
      deviation: Number((moistureAct - 14.0).toFixed(2)),
      unit: '%',
      rebatePerUnit: invoice?.qualityRebateDeduction ? Number(invoice.qualityRebateDeduction) : 0,
      totalDeduction: invoice?.qualityRebateDeduction ? Number(invoice.qualityRebateDeduction) : 0,
      status: moistureAct <= 15.0 ? 'PASS' : 'WARN'
    }
  ];
}

function SalesOrdersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [extraQcList, setExtraQcList] = useState<any[]>([]);

  // Form states
  const [orderType, setOrderType] = useState<'GT' | 'WH'>('WH');
  const [quotationNo, setQuotationNo] = useState('');
  const [selectedFinalInvoiceId, setSelectedFinalInvoiceId] = useState('');
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
  const quoteQuery = searchParams.get('quotation') || searchParams.get('quote');
  const customerQuery = searchParams.get('customer');
  const cmdQuery = searchParams.get('commodity');
  const qtyQuery = searchParams.get('qty');
  const rateQuery = searchParams.get('rate');

  useEffect(() => {
    // Load QC list from API for full lab parameters
    const loadQC = async () => {
      try {
        const [qcRes, qiRes] = await Promise.all([
          api.get('/quality/quality-control').catch(() => ({ data: { data: [] } })),
          api.get('/procurement/quality-inspections').catch(() => ({ data: { data: [] } }))
        ]);
        const list1 = qcRes.data?.data || [];
        const list2 = qiRes.data?.data || [];
        setExtraQcList([...list1, ...list2]);
      } catch (err) {
        console.error('QC fetch error', err);
      }
    };
    loadQC();
  }, []);

  const handleQuotationSelect = (selectedQuoteNo: string) => {
    setQuotationNo(selectedQuoteNo);
    if (!selectedQuoteNo) return;
    const quote = (db.salesQuotations || []).find((q: any) => q.quotationNo === selectedQuoteNo || q.id === selectedQuoteNo);
    if (quote) {
      setCustomerId(quote.customerId);
      setCommodityId(quote.commodityId);
      setQuantity(quote.quantity);
      setRate(quote.rate);
      setFreightCost(quote.freightCost || 0);
      setPaymentTerms(quote.paymentTerms || 'Net 15 Days');
      setNotes(`Booked against Quotation ${quote.quotationNo}${quote.enquiryNo ? ` (Ref Enquiry: ${quote.enquiryNo})` : ''}.`);
      showToast(`Loaded details from Sales Quotation ${quote.quotationNo}`, 'info');
    }
  };

  useEffect(() => {
    if (soQuery) {
      const order = db.salesOrders.find(s => s.id === soQuery || s.soNo === soQuery);
      if (order) setSelectedSO(order);
    }
    if (quoteQuery) {
      handleQuotationSelect(quoteQuery);
      if (customerQuery) setCustomerId(customerQuery);
      if (cmdQuery) setCommodityId(cmdQuery);
      if (qtyQuery) setQuantity(Number(qtyQuery));
      if (rateQuery) setRate(Number(rateQuery));
      setIsCreateOpen(true);
    }
  }, [soQuery, quoteQuery, customerQuery, cmdQuery, qtyQuery, rateQuery, db.salesOrders, db.salesQuotations]);

  const customers = db.customers || [];
  const commodities = db.commodities || [];
  const warehouses = db.warehouses || [];

  // Active unbooked Sales Quotations list
  const availableQuotations = useMemo(() => {
    return (db.salesQuotations || []).filter(q => {
      if (q.status === 'Converted' || q.status === 'Rejected') return false;
      const alreadyHasSO = (db.salesOrders || []).some(so => 
        (so.quotationNo === q.quotationNo || (so as any).quotationId === q.id) &&
        so.status !== 'Cancelled'
      );
      return !alreadyHasSO;
    });
  }, [db.salesQuotations, db.salesOrders]);

  // Final Purchase Invoices available for GT Direct Sourcing (exclude invoices already sold in a Sales Order)
  const finalInvoices = useMemo(() => {
    return (db.purchaseInvoices || []).filter(inv => {
      const isValidFinal = inv.isFinalInvoice === true || inv.invoiceType === 'Final' || inv.status === 'Approved' || inv.status === 'Paid' || inv.status === 'Partially Paid';
      if (!isValidFinal) return false;

      // Exclude invoices that already have an active Sales Order booked against them!
      const alreadyBookedInSO = (db.salesOrders || []).some(so => 
        (so.purchaseInvoiceId === inv.id || so.purchaseInvoiceNo === inv.invoiceNo || (so as any).purchaseInvoiceNo === inv.id) &&
        so.status !== 'Cancelled'
      );
      return !alreadyBookedInSO;
    });
  }, [db.purchaseInvoices, db.salesOrders]);

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

  const allQcRecords = useMemo(() => {
    const fromDb = (db as any).salesQcList || db.qualityInspections || [];
    return [...fromDb, ...extraQcList];
  }, [db, extraQcList]);

  // Find linked QC for selected Sales Order (either directly linked or through Final Purchase Invoice)
  const linkedSOQC = useMemo(() => {
    if (!selectedSO) return null;
    return allQcRecords.find((q: any) => 
      q.id === selectedSO.qcId ||
      q._id === selectedSO.qcId ||
      q.qcNumber === selectedSO.qcNumber ||
      q.qcNo === selectedSO.qcNumber ||
      q.soId === selectedSO.id || 
      q.soNumber === selectedSO.soNo || 
      q.referenceNumber === selectedSO.soNo ||
      (selectedSO.purchaseInvoiceNo && (q.invoiceNo === selectedSO.purchaseInvoiceNo || q.referenceNumber === selectedSO.purchaseInvoiceNo)) ||
      (linkedInvoice && (q.invoiceId === linkedInvoice.id || q.invoiceNo === linkedInvoice.invoiceNo))
    ) || null;
  }, [selectedSO, linkedInvoice, allQcRecords]);

  const linkedDC = useMemo(() => {
    if (!selectedSO) return null;
    return db.deliveryChallans.find(d => d.soId === selectedSO.id || d.soNo === selectedSO.soNo) || null;
  }, [selectedSO, db.deliveryChallans]);

  // Helper to calculate stock of a commodity inside a specific warehouse
  const getWarehouseCommodityStock = (whId: string, cId: string) => {
    if (!whId || !cId) return { totalStock: 0, reservedStock: 0, availableStock: 0 };
    
    const whStockItems = (db.stockItems || []).filter(s => 
      (s.warehouseId === whId || (s as any).warehouse === whId) && 
      (s.commodityId === cId || (s as any).commodity === cId)
    );
    let totalStock = whStockItems.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    
    if (totalStock === 0) {
      const whBins = (db.bins || []).filter(b => 
        (b.warehouseId === whId || (b as any).warehouse === whId) && 
        (b.allowedCommodityId === cId || String(b.allowedCommodityId) === String(cId))
      );
      whBins.forEach(b => {
        totalStock += Number(b.occupiedMT || (b as any).currentStock || 0);
      });
    }

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

  useEffect(() => {
    if (orderType === 'WH' && warehouseId && commodityId) {
      const exists = availableCommodities.some(c => c.id === commodityId);
      if (!exists) {
        setCommodityId('');
      }
    }
  }, [warehouseId, orderType, availableCommodities, commodityId]);

  // Handle Final Purchase Invoice Selection in GT mode
  const handleFinalInvoiceSelect = (invId: string) => {
    setSelectedFinalInvoiceId(invId);
    if (!invId) return;

    const inv = (db.purchaseInvoices || []).find(i => i.id === invId || i.invoiceNo === invId);
    if (inv) {
      // 1. Resolve Commodity
      const invItem = inv.items?.[0];
      if (invItem) {
        const matchedCommodity = commodities.find(c => 
          c.id === invItem.item || 
          (c as any)._id === invItem.item || 
          c.name.toLowerCase().includes(String(invItem.item).toLowerCase()) ||
          String(invItem.item).toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchedCommodity) {
          setCommodityId(matchedCommodity.id);
        } else if (commodities.length > 0) {
          setCommodityId(commodities[0].id);
        }
      }

      // 2. Resolve Quantity in MT (if raw value > 500, convert from KG to MT, otherwise treat as MT)
      const rawQty = inv.netWeight !== undefined && inv.netWeight > 0 
        ? inv.netWeight 
        : (invItem?.invoiceQty || 25);
      const netMT = rawQty > 500 ? Math.round(rawQty / 1000) : rawQty;
      setQuantity(netMT);

      // 3. Keep Selling Rate blank for manual input
      setRate(0);

      // 4. Resolve Vendor details & Notes
      const vendorName = inv.partyType === 'farmer'
        ? db.farmers?.find(f => f.id === inv.supplierId || (f as any)._id === inv.supplierId)?.name || 'Farmer Mandi'
        : db.suppliers?.find(s => s.id === inv.supplierId || (s as any)._id === inv.supplierId)?.name || 'Supplier';

      setNotes(`GT Sourced directly from Final Purchase Invoice ${inv.invoiceNo} (Vendor: ${vendorName}, QC: ${inv.qcNumber || 'QC-Verified'}, PO: ${inv.poNumber || 'N/A'}, Inward Weight: ${netMT} MT).`);
    }
  };

  // Create Sales Order Submission
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

    const linkedFinalInvoice = orderType === 'GT' && selectedFinalInvoiceId
      ? (db.purchaseInvoices || []).find(i => i.id === selectedFinalInvoiceId || i.invoiceNo === selectedFinalInvoiceId)
      : null;

    const so = erpService.createSalesOrder({
      orderType,
      fulfillmentType: orderType,
      quotationNo: quotationNo || undefined,
      date: new Date().toISOString().split('T')[0],
      customerId,
      commodityId,
      quantity,
      rate,
      gstPercent: 5,
      freightCost: Number(freightCost),
      total: grandTotal,
      warehouseId: orderType === 'WH' ? warehouseId : undefined,
      purchaseInvoiceId: linkedFinalInvoice ? linkedFinalInvoice.id : undefined,
      purchaseInvoiceNo: linkedFinalInvoice ? linkedFinalInvoice.invoiceNo : undefined,
      qcId: linkedFinalInvoice ? linkedFinalInvoice.qcId : undefined,
      qcNumber: linkedFinalInvoice ? linkedFinalInvoice.qcNumber : undefined,
      grnNumber: linkedFinalInvoice ? linkedFinalInvoice.grnNumber : undefined,
      deliveryLocation,
      expectedDispatch,
      paymentTerms,
      notes
    });

    if (quotationNo) {
      const q = (db.salesQuotations || []).find((quote: any) => quote.quotationNo === quotationNo || quote.id === quotationNo);
      if (q) {
        q.status = 'Converted';
        erpService.salesQuotations.update(q);
      }
    }

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
    doc.text(`Trade Type:      ${so.orderType === 'GT' ? 'GT - General Trade (Direct Grain Trading)' : 'WH - Warehouse Sourced'}`, 14, 58);
    
    if (so.purchaseInvoiceNo) {
      doc.text(`Sourced Inv:     ${so.purchaseInvoiceNo} (QC: ${so.qcNumber || 'Verified'})`, 14, 64);
      doc.text(`Exp Dispatch:    ${formatDate(so.expectedDispatch)}`, 14, 70);
      doc.text(`Payment Terms:   ${so.paymentTerms}`, 14, 76);
    } else {
      doc.text(`Exp Dispatch:    ${formatDate(so.expectedDispatch)}`, 14, 64);
      doc.text(`Payment Terms:   ${so.paymentTerms}`, 14, 70);
    }

    const cust = customers.find(c => c.id === so.customerId);
    const buyerTop = so.purchaseInvoiceNo ? 88 : 82;
    doc.setFont("Helvetica", "bold");
    doc.text("CUSTOMER / BUYER:", 14, buyerTop);
    doc.setFont("Helvetica", "normal");
    doc.text(cust?.name || 'Unknown Buyer', 14, buyerTop + 6);
    doc.text(`GSTIN: ${cust?.gstin || 'N/A'}`, 14, buyerTop + 12);
    doc.text(`Delivery Location: ${so.deliveryLocation || 'Customer Plant'}`, 14, buyerTop + 18);

    const tableTop = buyerTop + 28;
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

    // Include QC Lab Actuals Table in PDF if available
    const linkedQc = allQcRecords.find((q: any) => 
      q.id === so.qcId || q.qcNumber === so.qcNumber || q.qcNo === so.qcNumber
    );
    const qcParams = extractQCParameters(linkedQc, null);

    if (qcParams.length > 0) {
      let qcTop = sumY + 16;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`LABORATORY QUALITY ASSESSMENT (ACTUALS - REF: ${so.qcNumber || 'QC-PASSED'})`, 14, qcTop);

      qcTop += 5;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, qcTop, 182, 6, "F");

      doc.setFontSize(7.5);
      doc.text("Parameter Name", 16, qcTop + 4.5);
      doc.text("Standard", 80, qcTop + 4.5, { align: "right" });
      doc.text("Tolerance", 115, qcTop + 4.5, { align: "right" });
      doc.text("Actual Value (Tested)", 160, qcTop + 4.5, { align: "right" });
      doc.text("Status", 194, qcTop + 4.5, { align: "right" });

      qcParams.forEach(p => {
        qcTop += 6;
        doc.setFont("Helvetica", "normal");
        doc.text(p.parameterName, 16, qcTop + 4.5);
        doc.text(`${p.standardValue} ${p.unit}`, 80, qcTop + 4.5, { align: "right" });
        doc.text(`±${p.tolerance} ${p.unit}`, 115, qcTop + 4.5, { align: "right" });
        doc.setFont("Helvetica", "bold");
        doc.text(`${p.actualValue} ${p.unit}`, 160, qcTop + 4.5, { align: "right" });
        doc.setFont("Helvetica", "normal");
        doc.text(p.status, 194, qcTop + 4.5, { align: "right" });
      });
    }

    doc.save(`sales_order_${so.soNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    showToast(`Sales Order PDF exported successfully`, 'success');
  };

  const columns: any[] = [
    { 
      header: 'SO Number', 
      accessor: (row: SalesOrder) => (
        <div>
          <span className="font-bold text-slate-800">{row.soNo}</span>
          {row.quotationNo && (
            <span className="text-[9px] text-emerald-600 font-semibold block">
              Quote: {row.quotationNo}
            </span>
          )}
        </div>
      ), 
      sortable: true 
    },
    { 
      header: 'Trade Type', 
      accessor: (row: SalesOrder) => (
        <div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
            row.orderType === 'GT' 
              ? 'bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1 w-fit' 
              : 'bg-indigo-50 text-indigo-700 border-indigo-300 flex items-center gap-1 w-fit'
          }`}>
            {row.orderType === 'GT' ? <Handshake size={11} /> : <Building2 size={11} />}
            <span>{row.orderType === 'GT' ? 'GT (General Trade)' : 'WH (Warehouse)'}</span>
          </span>
          {row.purchaseInvoiceNo && (
            <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
              Inv: {row.purchaseInvoiceNo}
            </span>
          )}
        </div>
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
          <p className="text-xs font-medium text-slate-400">Book buyer agreements with GT (General Trade - Linked to Final Purchase Invoices &amp; QC Actuals) or WH (Warehouse Sourced) options.</p>
        </div>
        <button
          onClick={() => {
            setSelectedFinalInvoiceId('');
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
          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
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
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
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
            searchPlaceholder="Search SO number, customer, or commodity..."
            onRowClick={row => setSelectedSO(row)}
          />
        </div>

        {/* Right Details Drawer */}
        <div>
          {selectedSO ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{selectedSO.soNo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedSO.orderType === 'GT' 
                        ? 'bg-amber-50 text-amber-700 border-amber-300' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    }`}>
                      {selectedSO.orderType === 'GT' ? 'GT (General Trade)' : 'WH (Warehouse)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Booked: {formatDate(selectedSO.date)}</span>
                </div>
                <button 
                  onClick={() => setSelectedSO(null)}
                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* GT Direct Sourcing Info Card with QC Actuals */}
              {selectedSO.orderType === 'GT' && selectedSO.purchaseInvoiceNo && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 flex items-center gap-1 text-[11px]">
                      <Sparkles size={13} className="text-amber-600" />
                      <span>GT Sourced from Final Purchase Invoice</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                      Direct Trade
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-700 space-y-0.5">
                    <div>Final Invoice: <span className="font-bold text-slate-900">{selectedSO.purchaseInvoiceNo}</span></div>
                    {selectedSO.qcNumber && (
                      <div className="flex items-center gap-1 text-indigo-700 font-semibold">
                        <ShieldCheck size={13} />
                        <span>Verified QC Ref: {selectedSO.qcNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Laboratory QC Tested Actual Values Section */}
                  {(() => {
                    const qcParams = extractQCParameters(linkedSOQC, null);
                    if (qcParams.length === 0) return null;

                    return (
                      <div className="pt-2 border-t border-amber-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                            <FlaskConical size={12} className="text-emerald-600" />
                            <span>Actual Tested QC Parameters</span>
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Lab Certified
                          </span>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-[10px] text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <tr>
                                <th className="p-1.5">Parameter</th>
                                <th className="p-1.5 text-center">Std</th>
                                <th className="p-1.5 text-center">Tol</th>
                                <th className="p-1.5 text-center bg-emerald-50/70 text-emerald-800">Actual Value</th>
                                <th className="p-1.5 text-right">Dev</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {qcParams.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-1.5 font-semibold text-slate-800">{p.parameterName}</td>
                                  <td className="p-1.5 text-center text-slate-500">{p.standardValue}{p.unit}</td>
                                  <td className="p-1.5 text-center text-slate-400">&plusmn;{p.tolerance}{p.unit}</td>
                                  <td className="p-1.5 text-center font-extrabold text-emerald-700 bg-emerald-50/40">
                                    {p.actualValue}{p.unit}
                                  </td>
                                  <td className="p-1.5 text-right font-medium text-slate-600">
                                    {p.deviation > 0 ? `+${p.deviation}` : p.deviation}{p.unit}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Commodity summary */}
              {selectedCommodity && (
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">{selectedCommodity.name}</span>
                    <span className="text-[10px] text-slate-400">HSN: {selectedCommodity.hsn}</span>
                  </div>
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
                {selectedSO.quotationNo && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Linked Quotation:</span>
                    <button 
                      onClick={() => router.push('/sales/quotations')}
                      className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded hover:underline cursor-pointer"
                    >
                      {selectedSO.quotationNo}
                    </button>
                  </div>
                )}
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

              {/* Lifecycle Flow Tracker */}
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
                      linkedSOQC ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {linkedSOQC ? '✓' : '2'}
                    </span>
                    <span className="font-semibold text-slate-700">2. Sales QC (Outward Lab)</span>
                  </div>
                  {linkedSOQC ? (
                    <button 
                      onClick={() => router.push('/sales/qc')} 
                      className="text-primary-600 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      {linkedSOQC.qcNumber || linkedSOQC.qcNo || 'QC Done'}
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
                      {linkedSOQC ? 'Ready for Outward' : 'Awaiting QC'}
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

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {!linkedInvoice ? (
                  <button
                    onClick={() => router.push(`/sales/invoices?action=new&so=${selectedSO.id}${selectedSO.purchaseInvoiceNo ? `&purchaseInvoice=${selectedSO.purchaseInvoiceNo}&qc=${selectedSO.qcNumber || ''}` : ''}`)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Create Sales Invoice (Step 1)</span>
                  </button>
                ) : !linkedSOQC ? (
                  <button
                    onClick={() => router.push(`/sales/qc?action=new&so=${selectedSO.id}&invoice=${linkedInvoice.id}${selectedSO.qcNumber ? `&procurementQc=${selectedSO.qcNumber}` : ''}`)}
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/10 cursor-pointer transition"
                  >
                    <FlaskConical size={14} />
                    <span>Process Quality Inspection (Sales QC - Step 2)</span>
                  </button>
                ) : !linkedDC ? (
                  <button
                    onClick={() => router.push(`/sales/delivery-challans?action=new&so=${selectedSO.id}&invoice=${linkedInvoice.id}&qc=${linkedSOQC?.id || linkedSOQC?.qcNumber}`)}
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
                    <span>View Sales Invoice &amp; Collections</span>
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
              <span>Select a Sales Order row to view details, verify GT/WH status, and inspect actual QC test results.</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Record Sales Order Bookings</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Approve customer orders with GT (General Trade - Linked to Final Invoices &amp; QC Actuals) or WH (Warehouse) mode.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full cursor-pointer transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSO} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Link to Sales Quotation Selector */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck size={13} className="text-emerald-600" />
                    <span>Link to Sales Quotation (Optional Auto-Fill)</span>
                  </label>
                  {quotationNo && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuotationNo('');
                        showToast('Cleared quotation link', 'info');
                      }}
                      className="text-[10px] text-emerald-800 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear Link
                    </button>
                  )}
                </div>

                <select
                  value={quotationNo}
                  onChange={e => handleQuotationSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Direct Order Booking (No Quotation) --</option>
                  {availableQuotations.map((q: any) => {
                    const cust = customers.find(c => c.id === q.customerId);
                    const comm = commodities.find(c => c.id === q.commodityId);
                    return (
                      <option key={q.id} value={q.quotationNo}>
                        {q.quotationNo} &minus; {cust?.name || 'Customer'} ({comm?.name || 'Commodity'} &minus; {q.quantity} MT @ ₹{q.rate?.toLocaleString()}/MT) &minus; Status: {q.status}
                      </option>
                    );
                  })}
                </select>

                {quotationNo && (() => {
                  const q = (db.salesQuotations || []).find((quote: any) => quote.quotationNo === quotationNo);
                  if (!q) return null;
                  return (
                    <div className="text-[11px] text-emerald-900 bg-white/90 p-2 rounded-lg border border-emerald-100 flex items-center justify-between">
                      <span>Linked: <strong>{q.quotationNo}</strong> &bull; Offered Rate: ₹{q.rate?.toLocaleString()}/MT &bull; Total: ₹{q.total?.toLocaleString()}</span>
                      {q.enquiryNo && (
                        <span className="text-[10px] bg-primary-100 text-primary-800 font-bold px-2 py-0.5 rounded">
                          Enq: {q.enquiryNo}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Order Sourcing Type Toggle (GT vs WH) */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Order Sourcing &amp; Fulfillment Mode *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType('WH');
                      setSelectedFinalInvoiceId('');
                    }}
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
                      <span className="text-[10px] opacity-75 block">Dispatched from Brijrani Silos / Bins</span>
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
                      <span className="text-[10px] opacity-75 block">Direct Final Invoice &amp; QC Sourcing</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* GT Final Purchase Invoice Sourcing Selector */}
              {orderType === 'GT' && (
                <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-600" />
                      <span>Link to Final Purchase Invoice (Verified QC Direct Sourcing)</span>
                    </label>
                    {selectedFinalInvoiceId && (
                      <button
                        type="button"
                        onClick={() => setSelectedFinalInvoiceId('')}
                        className="text-[10px] text-amber-800 hover:text-rose-600 font-semibold cursor-pointer"
                      >
                        Clear Link
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedFinalInvoiceId}
                    onChange={e => handleFinalInvoiceSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- Select Final Purchase Invoice (Direct Grain Sourcing) --</option>
                    {finalInvoices.map(inv => {
                      const vendorName = inv.partyType === 'farmer'
                        ? db.farmers?.find(f => f.id === inv.supplierId || (f as any)._id === inv.supplierId)?.name || 'Farmer Mandi'
                        : db.suppliers?.find(s => s.id === inv.supplierId || (s as any)._id === inv.supplierId)?.name || 'Supplier';
                      
                      const invItem = inv.items?.[0];
                      const comm = commodities.find(c => c.id === invItem?.item || (c as any)._id === invItem?.item);
                      const commName = comm?.name || invItem?.item || 'Grain';
                      const rawWeight = inv.netWeight !== undefined && inv.netWeight > 0 ? inv.netWeight : (invItem?.invoiceQty || 25);
                      const displayMT = rawWeight > 500 ? Math.round(rawWeight / 1000) : rawWeight;

                      return (
                        <option key={inv.id} value={inv.id}>
                          Final Inv: {inv.invoiceNo} &minus; {vendorName} ({commName} - {displayMT} MT) &minus; QC: {inv.qcNumber || 'Verified'}
                        </option>
                      );
                    })}
                  </select>

                  {/* GT Sourced Breakdown Card with Laboratory QC Parameter Actuals Table */}
                  {selectedFinalInvoiceId && (() => {
                    const inv = (db.purchaseInvoices || []).find(i => i.id === selectedFinalInvoiceId || i.invoiceNo === selectedFinalInvoiceId);
                    if (!inv) return null;

                    const vendorName = inv.partyType === 'farmer'
                      ? db.farmers?.find(f => f.id === inv.supplierId || (f as any)._id === inv.supplierId)?.name || 'Farmer Mandi'
                      : db.suppliers?.find(s => s.id === inv.supplierId || (s as any)._id === inv.supplierId)?.name || 'Supplier';

                    const invItem = inv.items?.[0];
                    const rawWeight = inv.netWeight !== undefined && inv.netWeight > 0 ? inv.netWeight : (invItem?.invoiceQty || 25);
                    const netMT = rawWeight > 500 ? Math.round(rawWeight / 1000) : rawWeight;

                    // Lookup QC Document
                    const qcDoc = allQcRecords.find((q: any) => 
                      q.qcNumber === inv.qcNumber || q.qcNo === inv.qcNumber || q.id === inv.qcId || q._id === inv.qcId
                    );
                    const qcParams = extractQCParameters(qcDoc, inv);

                    return (
                      <div className="p-3.5 bg-white border border-amber-300 rounded-xl shadow-xs space-y-3 text-xs animate-fade-in">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              Final Invoice: {inv.invoiceNo}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700">{vendorName}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">Dated: {formatDate(inv.invoiceDate)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Inward Sourced Qty</span>
                            <span className="font-extrabold text-emerald-700 text-xs">{netMT} MT</span>
                            <span className="text-[9px] text-slate-500 block">Direct GT Allotment</span>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Purchased Rate</span>
                            <span className="font-bold text-slate-800">₹{invItem?.settledRate || invItem?.rate || 0}/Qtl</span>
                            <span className="text-[9px] text-slate-500 block">Total: ₹{(inv.grandTotal || 0).toLocaleString()}</span>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Linked QC Ref</span>
                            <span className="font-extrabold text-indigo-700">{inv.qcNumber || 'QC Passed'}</span>
                            <span className="text-[9px] text-emerald-600 font-bold block">
                              {inv.qualityRebateDeduction ? `Rebate: -₹${inv.qualityRebateDeduction}` : 'Zero Deduction'}
                            </span>
                          </div>
                        </div>

                        {/* Laboratory Tested Actuals Table (Matches QC Lab UI) */}
                        {qcParams.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                <FlaskConical size={12} className="text-emerald-600" />
                                <span>Laboratory Tested Quality Parameters (Actuals)</span>
                              </span>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Verified Lab Results
                              </span>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/30">
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                                  <tr>
                                    <th className="p-2">Parameter Name</th>
                                    <th className="p-2 text-center">Standard Value</th>
                                    <th className="p-2 text-center">Tolerance</th>
                                    <th className="p-2 text-center bg-emerald-100/70 text-emerald-900">Actual Value *</th>
                                    <th className="p-2 text-center">Deviation</th>
                                    <th className="p-2 text-right">Rebate / Unit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {qcParams.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                                      <td className="p-2 font-bold text-slate-800">{p.parameterName}</td>
                                      <td className="p-2 text-center font-medium text-slate-600">{p.standardValue} {p.unit}</td>
                                      <td className="p-2 text-center text-slate-500">&plusmn;{p.tolerance} {p.unit}</td>
                                      <td className="p-2 text-center bg-emerald-50/50">
                                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-extrabold text-xs border border-emerald-300 inline-block">
                                          {p.actualValue} {p.unit}
                                        </span>
                                      </td>
                                      <td className="p-2 text-center font-semibold text-slate-700">
                                        {p.deviation > 0 ? `+${p.deviation}` : p.deviation} {p.unit}
                                      </td>
                                      <td className="p-2 text-right font-extrabold text-rose-600">
                                        {p.rebatePerUnit > 0 ? `₹${p.rebatePerUnit}/MT` : '₹0.00/MT'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setQuantity(netMT)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={11} /> Use Full Sourced Qty ({netMT} MT)
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuantity(Math.max(1, Math.round(netMT / 2)))}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer border border-slate-200"
                          >
                            Use 50% Sourced Qty ({Math.max(1, Math.round(netMT / 2))} MT)
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Warehouse / Customer selection */}
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
                    <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                      1. Sourcing Mode
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-xs bg-amber-50/40 font-bold text-amber-900 cursor-not-allowed"
                      value={selectedFinalInvoiceId ? `GT Sourced (Final Invoice: ${(db.purchaseInvoices || []).find(i => i.id === selectedFinalInvoiceId)?.invoiceNo || 'Selected'})` : 'GT (General Trade - Direct Back-to-Back)'}
                      disabled
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    2. Customer Name *
                  </label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Commodity Selector (Only required and shown for Warehouse WH sales) */}
              {orderType === 'WH' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    3. Product Commodity (Only In-Stock at Selected Warehouse) *
                  </label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold ${
                      !warehouseId
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500'
                    }`}
                    disabled={!warehouseId}
                    required
                  >
                    {!warehouseId ? (
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
                    )}
                  </select>

                  {warehouseId && availableCommodities.length === 0 && (
                    <p className="text-[11px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                      ⚠️ This warehouse currently has no commodity stock. Please select another warehouse or switch to General Trade (GT).
                    </p>
                  )}
                </div>
              )}

              {/* Live Warehouse Inventory Verification Card for WH */}
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
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Enter quantity in MT..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={quantity === 0 ? '' : quantity}
                    onChange={e => {
                      const val = e.target.value;
                      setQuantity(val === '' ? 0 : Number(val));
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Selling Rate per MT (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Enter selling rate..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={rate === 0 ? '' : rate}
                    onChange={e => {
                      const val = e.target.value;
                      setRate(val === '' ? 0 : Number(val));
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Estimated Freight Cost (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={freightCost || ''}
                    onChange={e => setFreightCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
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
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Expected Dispatch Date</label>
                  <IndianDateInput
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={expectedDispatch}
                    onChange={val => setExpectedDispatch(val)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Delivery Address *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={deliveryLocation}
                    onChange={e => setDeliveryLocation(e.target.value)}
                    placeholder="e.g. Fatuha Factory Gate 1, Patna"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Notes &amp; Sourcing Remarks</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none h-14 resize-none"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional order terms, quality covenants, or direct sourcing references..."
                />
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition cursor-pointer"
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
