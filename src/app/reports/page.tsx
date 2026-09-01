'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import DataTable from '../../components/shared/DataTable';
import IndianDateInput from '../../components/shared/IndianDateInput';
import { FileText, Calendar, BarChart3 } from 'lucide-react';

export default function ReportsHubPage() {
  const { db } = useErp();
  const [reportType, setReportType] = useState<'purchase' | 'sales' | 'inventory' | 'logistics' | 'finance'>('purchase');

  // Filter states
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [filterWarehouseId, setFilterWarehouseId] = useState('ALL');

  const commodities = db.commodities;
  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const customers = db.customers;
  const warehouses = db.warehouses;

  // 1. Purchase Register Report Data
  const purchaseReportData = useMemo(() => {
    return db.purchaseOrders
      .filter(po => {
        const isWithinDate = po.date >= fromDate && po.date <= toDate;
        const matchesWH = filterWarehouseId === 'ALL' || po.warehouseId === filterWarehouseId;
        return isWithinDate && matchesWH;
      })
      .map(po => {
        const partyName = po.partyType === 'supplier' 
          ? suppliers.find(s => s.id === po.partyId)?.name 
          : farmers.find(f => f.id === po.partyId)?.name;
        
        return {
          id: po.id,
          date: po.date,
          poNo: po.poNo,
          vendorName: partyName || 'Unknown',
          commodityName: commodities.find(c => c.id === po.commodityId)?.name || 'Unknown',
          quantity: po.quantity,
          value: po.total,
          status: po.status
        };
      });
  }, [db.purchaseOrders, fromDate, toDate, filterWarehouseId, suppliers, farmers, commodities]);

  // 2. Sales Register Report Data
  const salesReportData = useMemo(() => {
    return db.salesInvoices
      .filter(inv => {
        const isWithinDate = inv.invoiceDate >= fromDate && inv.invoiceDate <= toDate;
        return isWithinDate;
      })
      .map(inv => {
        const custName = customers.find(c => c.id === inv.customerId)?.name || 'Unknown';
        const itemsList = inv.items.map(item => commodities.find(c => c.id === item.commodityId)?.name).join('; ');
        
        return {
          id: inv.id,
          date: inv.invoiceDate,
          invoiceNo: inv.invoiceNo,
          customerName: custName,
          items: itemsList,
          taxable: inv.taxableAmount,
          grandTotal: inv.grandTotal,
          status: inv.paymentStatus
        };
      });
  }, [db.salesInvoices, fromDate, toDate, customers, commodities]);

  // 3. Inventory Valuation Data
  const stockReportData = useMemo(() => {
    return db.stockItems
      .filter(item => filterWarehouseId === 'ALL' || item.warehouseId === filterWarehouseId)
      .map(item => {
        const commodity = commodities.find(c => c.id === item.commodityId);
        const warehouse = warehouses.find(w => w.id === item.warehouseId);
        const value = item.quantity * item.purchaseCost;
        
        return {
          id: item.id,
          commodityName: commodity?.name || 'Unknown',
          sku: commodity?.sku || '',
          batchNo: item.batchNo,
          warehouseName: warehouse?.name || 'Unknown',
          binId: item.binId,
          qty: item.quantity,
          unit: item.unit,
          cost: item.purchaseCost,
          value
        };
      });
  }, [db.stockItems, filterWarehouseId, commodities, warehouses]);

  // 4. Logistics Dispatch Data
  const logisticsReportData = useMemo(() => {
    return db.deliveryChallans
      .filter(dc => {
        const isWithinDate = dc.dispatchDate >= fromDate && dc.dispatchDate <= toDate;
        const matchesWH = filterWarehouseId === 'ALL' || dc.warehouseId === filterWarehouseId;
        return isWithinDate && matchesWH;
      })
      .map(dc => {
        const custName = customers.find(c => c.id === dc.customerId)?.name || 'Unknown';
        const commodity = commodities.find(c => c.id === dc.commodityId)?.name || 'Unknown';
        
        return {
          id: dc.dcNo,
          date: dc.dispatchDate,
          dcNo: dc.dcNo,
          customerName: custName,
          commodity,
          qty: dc.quantity,
          vehicleNo: dc.vehicleNo,
          driver: dc.driverName,
          status: dc.status
        };
      });
  }, [db.deliveryChallans, fromDate, toDate, filterWarehouseId, customers, commodities]);

  // 5. Ledger Balance Data
  const financeReportData = useMemo(() => {
    return db.vouchers
      .filter(v => v.date >= fromDate && v.date <= toDate)
      .map(v => {
        let partnerName = 'None';
        if (v.partyType === 'customer') {
          partnerName = customers.find(c => c.id === v.partyId)?.name || 'Unknown';
        } else if (v.partyType === 'supplier') {
          partnerName = suppliers.find(s => s.id === v.partyId)?.name || 'Unknown';
        } else if (v.partyType === 'farmer') {
          partnerName = farmers.find(f => f.id === v.partyId)?.name || 'Unknown';
        }

        return {
          id: v.id,
          date: v.date,
          voucherNo: v.voucherNo,
          type: v.voucherType,
          partnerName,
          debit: v.debitAccount,
          credit: v.creditAccount,
          amount: v.amount
        };
      });
  }, [db.vouchers, fromDate, toDate, customers, suppliers, farmers]);

  // Column definitions for each report type
  const purchaseCols = [
    { header: 'PO Date', accessor: 'date' as any, sortable: true },
    { header: 'PO Number', accessor: 'poNo' as any },
    { header: 'Vendor (Supplier/Farmer)', accessor: 'vendorName' as any },
    { header: 'Commodity', accessor: 'commodityName' as any },
    { header: 'Quantity (MT)', accessor: 'quantity' as any },
    { header: 'Grand Value', accessor: (row: any) => `₹${row.value.toLocaleString()}`, csvAccessor: 'value' as any },
    { header: 'Status', accessor: 'status' as any }
  ];

  const salesCols = [
    { header: 'Invoice Date', accessor: 'date' as any, sortable: true },
    { header: 'Invoice No', accessor: 'invoiceNo' as any },
    { header: 'Customer', accessor: 'customerName' as any },
    { header: 'Items Sourced', accessor: 'items' as any },
    { header: 'Taxable Val', accessor: (row: any) => `₹${row.taxable.toLocaleString()}`, csvAccessor: 'taxable' as any },
    { header: 'Grand Value', accessor: (row: any) => `₹${row.grandTotal.toLocaleString()}`, csvAccessor: 'grandTotal' as any },
    { header: 'Payment Status', accessor: 'status' as any }
  ];

  const stockCols = [
    { header: 'Commodity Name', accessor: 'commodityName' as any, sortable: true },
    { header: 'SKU', accessor: 'sku' as any },
    { header: 'Batch Code', accessor: 'batchNo' as any },
    { header: 'Warehouse Location', accessor: 'warehouseName' as any },
    { header: 'Bin Shelf', accessor: 'binId' as any },
    { header: 'Sourced Quantity', accessor: (row: any) => `${row.qty} ${row.unit}` },
    { header: 'Average Sourced Price', accessor: (row: any) => `₹${row.cost.toLocaleString()}` },
    { header: 'Current Value Asset', accessor: (row: any) => `₹${row.value.toLocaleString()}`, csvAccessor: 'value' as any }
  ];

  const logisticsCols = [
    { header: 'Dispatch Date', accessor: 'date' as any, sortable: true },
    { header: 'Challan Number', accessor: 'dcNo' as any },
    { header: 'Customer Consignee', accessor: 'customerName' as any },
    { header: 'Commodity', accessor: 'commodity' as any },
    { header: 'Volume Quantity', accessor: (row: any) => `${row.qty} MT` },
    { header: 'Assigned Vehicle', accessor: 'vehicleNo' as any },
    { header: 'Assigned Driver', accessor: 'driver' as any },
    { header: 'Transit Status', accessor: 'status' as any }
  ];

  const financeCols = [
    { header: 'Posting Date', accessor: 'date' as any, sortable: true },
    { header: 'Voucher Number', accessor: 'voucherNo' as any },
    { header: 'Voucher Type', accessor: 'type' as any },
    { header: 'Account Partner', accessor: 'partnerName' as any },
    { header: 'Debit Account Ledger', accessor: 'debit' as any },
    { header: 'Credit Account Ledger', accessor: 'credit' as any },
    { header: 'Amount Cleared', accessor: (row: any) => `₹${row.amount.toLocaleString()}`, csvAccessor: 'amount' as any }
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">ERP Reporting Hub</h1>
          <p className="text-xs font-medium text-slate-400">Generate registers, query audit trails, export CSV databases, and print tax-compliant reports.</p>
        </div>
      </div>

      {/* Unified Filters bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Calendar size={15} />
          <span>Report Scope:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">From:</span>
          <IndianDateInput
            value={fromDate}
            onChange={val => setFromDate(val)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none font-medium text-slate-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">To:</span>
          <IndianDateInput
            value={toDate}
            onChange={val => setToDate(val)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none font-medium text-slate-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Facility:</span>
          <select
            value={filterWarehouseId}
            onChange={e => setFilterWarehouseId(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none font-medium text-slate-650"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setReportType('purchase')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'purchase' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Purchase Register
        </button>
        <button
          onClick={() => setReportType('sales')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'sales' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Sales Register
        </button>
        <button
          onClick={() => setReportType('inventory')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'inventory' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Inventory Valuation
        </button>
        <button
          onClick={() => setReportType('logistics')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'logistics' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Logistics Dispatch
        </button>
        <button
          onClick={() => setReportType('finance')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'finance' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Ledger Vouchers
        </button>
      </div>

      {/* Reports Render */}
      <div className="space-y-4">
        {reportType === 'purchase' && (
          <DataTable
            data={purchaseReportData}
            columns={purchaseCols}
            searchPlaceholder="Search vendor name..."
            searchField="vendorName"
            exportFileName="purchase_register_report"
          />
        )}

        {reportType === 'sales' && (
          <DataTable
            data={salesReportData}
            columns={salesCols}
            searchPlaceholder="Search customer name..."
            searchField="customerName"
            exportFileName="sales_register_report"
          />
        )}

        {reportType === 'inventory' && (
          <DataTable
            data={stockReportData}
            columns={stockCols}
            searchPlaceholder="Search commodity..."
            searchField="commodityName"
            exportFileName="inventory_valuation_report"
          />
        )}

        {reportType === 'logistics' && (
          <DataTable
            data={logisticsReportData}
            columns={logisticsCols}
            searchPlaceholder="Search vehicle number..."
            searchField="vehicleNo"
            exportFileName="logistics_dispatch_report"
          />
        )}

        {reportType === 'finance' && (
          <DataTable
            data={financeReportData}
            columns={financeCols}
            searchPlaceholder="Search debit/credit account..."
            searchField="debit"
            exportFileName="ledger_vouchers_audit_report"
          />
        )}
      </div>
    </div>
  );
}
