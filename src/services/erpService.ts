import { 
  Farmer, Supplier, Customer, Commodity, Warehouse, Bin, Vehicle, Driver,
  PurchaseOrder, GRN, QualityInspection, StockItem, SalesOrder, SalesInvoice,
  Voucher, Expense, SalesQuotation, PurchaseQuotation, SalesEnquiry, PurchaseEnquiry,
  PickingSlip, PackingSlip, DeliveryChallan, EWayBill, POD, StockTransfer, PurchaseInvoice,
  Lead, SalesReturn, ReturnInspection, CreditNote, Refund, SalesTarget, SalesCommission
} from '../types/erp';

import {
  INITIAL_FARMERS, INITIAL_SUPPLIERS, INITIAL_CUSTOMERS, INITIAL_COMMODITIES,
  INITIAL_WAREHOUSES, INITIAL_BINS, INITIAL_VEHICLES, INITIAL_DRIVERS,
  INITIAL_PURCHASE_ORDERS, INITIAL_GRNS, INITIAL_QUALITY_INSPECTIONS,
  INITIAL_STOCK_ITEMS, INITIAL_SALES_ORDERS, INITIAL_SALES_INVOICES,
  INITIAL_VOUCHERS, INITIAL_EXPENSES, INITIAL_ENQUIRIES, INITIAL_PURCHASE_QUOTATIONS,
  INITIAL_SALES_ENQUIRIES, INITIAL_SALES_QUOTATIONS, INITIAL_PICKING_SLIPS,
  INITIAL_PACKING_SLIPS, INITIAL_DELIVERY_CHALLANS, INITIAL_EWAY_BILLS,
  INITIAL_PODS, INITIAL_STOCK_TRANSFERS, INITIAL_PURCHASE_INVOICES
} from './mockData';

interface ErpDatabase {
  farmers: Farmer[];
  suppliers: Supplier[];
  customers: Customer[];
  commodities: Commodity[];
  warehouses: Warehouse[];
  bins: Bin[];
  vehicles: Vehicle[];
  drivers: Driver[];
  purchaseEnquiries: PurchaseEnquiry[];
  purchaseQuotations: PurchaseQuotation[];
  purchaseOrders: PurchaseOrder[];
  grns: GRN[];
  qualityInspections: QualityInspection[];
  stockItems: StockItem[];
  salesEnquiries: SalesEnquiry[];
  salesQuotations: SalesQuotation[];
  salesOrders: SalesOrder[];
  pickingSlips: PickingSlip[];
  packingSlips: PackingSlip[];
  deliveryChallans: DeliveryChallan[];
  salesInvoices: SalesInvoice[];
  ewayBills: EWayBill[];
  pods: POD[];
  stockTransfers: StockTransfer[];
  vouchers: Voucher[];
  expenses: Expense[];
  purchaseInvoices: PurchaseInvoice[];
  purchaseReturns: any[];
  leads: Lead[];
  salesReturns: SalesReturn[];
  returnInspections: ReturnInspection[];
  creditNotes: CreditNote[];
  refunds: Refund[];
  salesTargets: SalesTarget[];
  salesCommissions: SalesCommission[];
}

const DB_KEY = 'brijrani_erp_database_v4';

export const recalculateStockTotals = (db: ErpDatabase) => {
  if (!db) return;
  
  db.bins = db.bins || [];
  db.warehouses = db.warehouses || [];
  db.commodities = db.commodities || [];
  db.stockItems = db.stockItems || [];

  // 1. Reset all occupancies and stock quantities
  db.bins.forEach(bin => {
    bin.occupiedMT = 0;
  });
  db.warehouses.forEach(wh => {
    wh.usedCapacityMT = 0;
  });
  db.commodities.forEach(comm => {
    comm.stockQty = 0;
  });

  // 2. Sum up quantities from stockItems
  db.stockItems.forEach(item => {
    // Update bin occupiedMT
    const bin = db.bins.find(b => b.id === item.binId);
    if (bin) {
      bin.occupiedMT = Number((bin.occupiedMT + item.quantity).toFixed(2));
    }
    
    // Update warehouse usedCapacityMT
    const wh = db.warehouses.find(w => w.id === item.warehouseId);
    if (wh) {
      wh.usedCapacityMT = Number((wh.usedCapacityMT + item.quantity).toFixed(2));
    }

    // Update commodity stockQty
    const comm = db.commodities.find(c => c.id === item.commodityId);
    if (comm) {
      comm.stockQty = Number((comm.stockQty + item.quantity).toFixed(2));
    }
  });
};

export const getDb = (): ErpDatabase => {
  const emptyDb: ErpDatabase = {
    farmers: [],
    suppliers: [],
    customers: [],
    commodities: [],
    warehouses: [],
    bins: [],
    vehicles: [],
    drivers: [],
    purchaseEnquiries: [],
    purchaseQuotations: [],
    purchaseOrders: [],
    grns: [],
    qualityInspections: [],
    stockItems: [],
    salesEnquiries: [],
    salesQuotations: [],
    salesOrders: [],
    pickingSlips: [],
    packingSlips: [],
    deliveryChallans: [],
    salesInvoices: [],
    ewayBills: [],
    pods: [],
    stockTransfers: [],
    vouchers: [],
    expenses: [],
    purchaseInvoices: [],
    purchaseReturns: [],
    leads: [],
    salesReturns: [],
    returnInspections: [],
    creditNotes: [],
    refunds: [],
    salesTargets: [],
    salesCommissions: []
  };

  if (typeof window === 'undefined') {
    recalculateStockTotals(emptyDb);
    return emptyDb;
  }

  const stored = localStorage.getItem(DB_KEY);
  if (!stored) {
    recalculateStockTotals(emptyDb);
    localStorage.setItem(DB_KEY, JSON.stringify(emptyDb));
    return emptyDb;
  }
  const db = JSON.parse(stored);
  db.purchaseInvoices = db.purchaseInvoices || [];
  db.purchaseEnquiries = db.purchaseEnquiries || [];
  db.purchaseQuotations = db.purchaseQuotations || [];
  db.purchaseOrders = db.purchaseOrders || [];
  db.grns = db.grns || [];
  db.qualityInspections = db.qualityInspections || [];
  db.leads = db.leads || [];
  db.salesReturns = db.salesReturns || [];
  db.returnInspections = db.returnInspections || [];
  db.creditNotes = db.creditNotes || [];
  db.refunds = db.refunds || [];
  db.salesTargets = db.salesTargets || [];
  db.salesCommissions = db.salesCommissions || [];
  recalculateStockTotals(db);
  return db;
};

export const saveDb = (db: ErpDatabase): void => {
  if (typeof window !== 'undefined') {
    recalculateStockTotals(db);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
};

import api from './axios';

export const mapToBackend = (dbField: string, item: any): any => {
  const payload = { ...item };
  if (dbField === 'customers' || dbField === 'suppliers') {
    payload.companyName = item.companyName || item.name;
    payload.billingAddress = item.address || 'N/A';
    payload.shippingAddress = item.address || 'N/A';
  } else if (dbField === 'farmers') {
    payload.village = item.address || 'N/A';
    payload.district = 'Patna';
  } else if (dbField === 'commodities') {
    payload.commodityCode = item.sku;
    payload.gstRate = item.defaultGst !== undefined ? item.defaultGst : 5;
    payload.purchasePrice = item.purchaseCost || 0;
    payload.sellingPrice = item.currentMarketPrice || 0;
    payload.minimumStock = item.minStockLevel || 10;
  } else if (dbField === 'vehicles') {
    payload.registrationNo = item.number;
    payload.owner = 'BrijRani Agro';
  } else if (dbField === 'drivers') {
    payload.licenseNo = item.licenseNumber;
  }
  return payload;
};

export const mapToFrontend = (dbField: string, backendItem: any): any => {
  const item = { ...backendItem, id: backendItem._id };
  if (dbField === 'customers' || dbField === 'suppliers') {
    item.address = backendItem.billingAddress || '';
  } else if (dbField === 'farmers') {
    item.address = backendItem.village || '';
  } else if (dbField === 'commodities') {
    item.sku = backendItem.commodityCode || '';
    item.defaultGst = backendItem.gstRate !== undefined ? backendItem.gstRate : 5;
    item.purchaseCost = backendItem.purchasePrice || 0;
    item.currentMarketPrice = backendItem.sellingPrice || 0;
    item.minStockLevel = backendItem.minimumStock || 10;
    item.targetPrice = backendItem.targetPrice || Math.round((backendItem.sellingPrice || 0) * 1.15) || 25000;
  } else if (dbField === 'vehicles') {
    item.number = backendItem.registrationNo || '';
  } else if (dbField === 'drivers') {
    item.licenseNumber = backendItem.licenseNo || '';
  }
  return item;
};

// Generic CRUD helper generator
const createCrudMethods = <T extends { id: string }>(dbField: keyof ErpDatabase) => {
  return {
    getAll: (): T[] => getDb()[dbField] as unknown as T[],
    getById: (id: string): T | undefined => {
      const items = getDb()[dbField] as unknown as T[];
      return items.find(item => item.id === id);
    },
    create: (newItem: T): void => {
      const db = getDb();
      (db[dbField] as unknown as T[]).push(newItem);
      saveDb(db);

      // Async Sync with backend
      if (['customers', 'suppliers', 'farmers', 'commodities', 'warehouses', 'vehicles', 'drivers'].includes(dbField)) {
        const payload = mapToBackend(dbField, newItem);
        api.post(`/masters/${dbField}`, payload)
          .then(res => {
            const backendItem = res.data?.data;
            if (backendItem && backendItem._id) {
              const currentDb = getDb();
              const items = currentDb[dbField] as unknown as T[];
              const idx = items.findIndex(item => item.id === newItem.id);
              if (idx !== -1) {
                items[idx].id = backendItem._id;
                saveDb(currentDb);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('erp-db-sync'));
                }
              }
            }
          })
          .catch(err => console.error('Failed to sync master creation to backend:', err));
      } else if (['purchaseEnquiries', 'purchaseQuotations', 'purchaseOrders', 'grns', 'purchaseInvoices'].includes(dbField)) {
        let endpoint = '';
        if (dbField === 'purchaseEnquiries') endpoint = '/procurement/enquiries';
        else if (dbField === 'purchaseQuotations') endpoint = '/procurement/quotations';
        else if (dbField === 'purchaseOrders') endpoint = '/procurement/orders';
        else if (dbField === 'grns') endpoint = '/procurement/grns';
        else if (dbField === 'purchaseInvoices') endpoint = '/procurement/invoices';

        api.post(endpoint, newItem)
          .then(res => {
            const backendItem = res.data?.data;
            if (backendItem && backendItem._id) {
              const currentDb = getDb();
              const items = currentDb[dbField] as unknown as T[];
              const idx = items.findIndex(item => item.id === newItem.id);
              if (idx !== -1) {
                items[idx].id = backendItem._id;
                saveDb(currentDb);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('erp-db-sync'));
                }
              }
            }
          })
          .catch(err => console.error(`Failed to sync procurement ${dbField} to backend:`, err));
      }
    },
    update: (updatedItem: T): void => {
      const db = getDb();
      const items = db[dbField] as unknown as T[];
      const idx = items.findIndex(item => item.id === updatedItem.id);
      if (idx !== -1) {
        items[idx] = updatedItem;
        saveDb(db);

        // Async Sync with backend
        if (['customers', 'suppliers', 'farmers', 'commodities', 'warehouses', 'vehicles', 'drivers'].includes(dbField)) {
          const payload = mapToBackend(dbField, updatedItem);
          api.put(`/masters/${dbField}/${updatedItem.id}`, payload).catch(err => console.error(err));
        } else if (dbField === 'purchaseInvoices') {
          if (updatedItem.id.match(/^[0-9a-fA-F]{24}$/)) {
            api.patch(`/procurement/invoices/${updatedItem.id}`, updatedItem)
              .catch(err => console.error('Failed to sync purchaseInvoice update to backend:', err));
          }
        } else if (dbField === 'purchaseEnquiries') {
          if (updatedItem.id.match(/^[0-9a-fA-F]{24}$/)) {
            api.patch(`/procurement/enquiries/${updatedItem.id}`, updatedItem)
              .catch(err => console.error('Failed to sync purchaseEnquiry update to backend:', err));
          }
        } else if (dbField === 'purchaseOrders') {
          if (updatedItem.id.match(/^[0-9a-fA-F]{24}$/)) {
            api.patch(`/procurement/orders/${updatedItem.id}`, updatedItem)
              .catch(err => console.error('Failed to sync purchaseOrder update to backend:', err));
          }
        } else if (dbField === 'purchaseQuotations') {
          if (updatedItem.id.match(/^[0-9a-fA-F]{24}$/)) {
            api.patch(`/procurement/quotations/${updatedItem.id}`, updatedItem)
              .catch(err => console.error('Failed to sync purchaseQuotation update to backend:', err));
          }
        } else if (dbField === 'grns') {
          if (updatedItem.id.match(/^[0-9a-fA-F]{24}$/)) {
            api.patch(`/procurement/grns/${updatedItem.id}`, updatedItem)
              .catch(err => console.error('Failed to sync GRN update to backend:', err));
          }
        } else if (dbField === 'qualityInspections') {
          if (updatedItem.id.match(/^[0-9a-fA-F]{24}$/)) {
            api.patch(`/procurement/quality-inspections/${updatedItem.id}`, updatedItem)
              .catch(err => console.error('Failed to sync QC update to backend:', err));
          }
        }
      }
    },
    delete: (id: string): void => {
      const db = getDb();
      const items = db[dbField] as unknown as T[];
      db[dbField] = items.filter(item => item.id !== id) as any;
      saveDb(db);

      // Async Sync with backend
      if (['customers', 'suppliers', 'farmers', 'commodities', 'warehouses', 'vehicles', 'drivers'].includes(dbField)) {
        api.delete(`/masters/${dbField}/${id}`)
          .then(() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('erp-db-sync'));
            }
          })
          .catch(err => console.error('Failed to sync master deletion to backend:', err));
      } else {
        let endpoint = '';
        if (dbField === 'purchaseEnquiries') endpoint = `/procurement/enquiries/${id}`;
        else if (dbField === 'purchaseQuotations') endpoint = `/procurement/quotations/${id}`;
        else if (dbField === 'purchaseOrders') endpoint = `/procurement/orders/${id}`;
        else if (dbField === 'grns') endpoint = `/procurement/grns/${id}`;
        else if (dbField === 'purchaseInvoices') endpoint = `/procurement/invoices/${id}`;
        else if (dbField === 'qualityInspections') endpoint = `/procurement/quality-inspections/${id}`;
        else if (dbField === 'purchaseReturns') endpoint = `/procurement/purchase-returns/${id}`;
        
        if (endpoint && id.match(/^[0-9a-fA-F]{24}$/)) {
          api.delete(endpoint)
            .then(() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('erp-db-sync'));
              }
            })
            .catch(err => console.error(`Failed to sync procurement ${dbField} deletion to backend:`, err));
        }
      }
    }
  };
};

export const erpService = {
  farmers: createCrudMethods<Farmer>('farmers'),
  suppliers: createCrudMethods<Supplier>('suppliers'),
  customers: createCrudMethods<Customer>('customers'),
  commodities: createCrudMethods<Commodity>('commodities'),
  warehouses: createCrudMethods<Warehouse>('warehouses'),
  bins: createCrudMethods<Bin>('bins'),
  vehicles: createCrudMethods<Vehicle>('vehicles'),
  drivers: createCrudMethods<Driver>('drivers'),
  purchaseEnquiries: createCrudMethods<PurchaseEnquiry>('purchaseEnquiries'),
  purchaseQuotations: createCrudMethods<PurchaseQuotation>('purchaseQuotations'),
  purchaseOrders: createCrudMethods<PurchaseOrder>('purchaseOrders'),
  grns: createCrudMethods<GRN>('grns'),
  qualityInspections: createCrudMethods<QualityInspection>('qualityInspections'),
  stockItems: createCrudMethods<StockItem>('stockItems'),
  salesEnquiries: createCrudMethods<SalesEnquiry>('salesEnquiries'),
  salesQuotations: createCrudMethods<SalesQuotation>('salesQuotations'),
  salesOrders: createCrudMethods<SalesOrder>('salesOrders'),
  pickingSlips: createCrudMethods<PickingSlip>('pickingSlips'),
  packingSlips: createCrudMethods<PackingSlip>('packingSlips'),
  deliveryChallans: createCrudMethods<DeliveryChallan>('deliveryChallans'),
  salesInvoices: createCrudMethods<SalesInvoice>('salesInvoices'),
  ewayBills: createCrudMethods<EWayBill>('ewayBills'),
  pods: createCrudMethods<POD>('pods'),
  stockTransfers: createCrudMethods<StockTransfer>('stockTransfers'),
  vouchers: createCrudMethods<Voucher>('vouchers'),
  expenses: createCrudMethods<Expense>('expenses'),
  purchaseInvoices: createCrudMethods<PurchaseInvoice>('purchaseInvoices'),
  purchaseReturns: createCrudMethods<any>('purchaseReturns'),

  // Specialized Workflow Actions

  // 1. Approve a Purchase Order
  approvePurchaseOrder: (poId: string, approverName: string, comment?: string): void => {
    const db = getDb();
    const po = db.purchaseOrders.find(p => p.id === poId);
    if (po) {
      po.status = 'Approved';
      po.approvalHistory = po.approvalHistory || [];
      po.approvalHistory.push({
        step: 'Manager Approval',
        user: approverName,
        action: 'Approved',
        date: new Date().toISOString().split('T')[0],
        comment
      });
      saveDb(db);

      // Sync PO approval to backend
      if (poId.match(/^[0-9a-fA-F]{24}$/)) {
        api.patch(`/procurement/orders/${poId}/approve`, { comment })
          .catch(err => console.error('Failed to sync PO approval to backend:', err));
      }
    }
  },

  // 2. Reject a Purchase Order
  rejectPurchaseOrder: (poId: string, approverName: string, comment?: string): void => {
    const db = getDb();
    const po = db.purchaseOrders.find(p => p.id === poId);
    if (po) {
      po.status = 'Cancelled';
      po.approvalHistory = po.approvalHistory || [];
      po.approvalHistory.push({
        step: 'Manager Approval',
        user: approverName,
        action: 'Rejected',
        date: new Date().toISOString().split('T')[0],
        comment
      });
      saveDb(db);

      // Sync PO rejection to backend by patching status to Cancelled
      if (poId.match(/^[0-9a-fA-F]{24}$/)) {
        api.patch(`/procurement/orders/${poId}`, po)
          .catch(err => console.error('Failed to sync PO rejection to backend:', err));
      }
    }
  },

  // 3. Create GRN & update PO status
  createGRNFromPO: (grnData: any): GRN => {
    const db = getDb();
    const grnNo = `GRN/BR/2026-27/${String(db.grns.length + 1).padStart(3, '0')}`;
    const id = `GRN-${Date.now()}`;
    
    const items = grnData.items || [];
    const firstItem = items[0];
    const totalOrderedQty = items.reduce((sum: number, i: any) => sum + i.orderedQty, 0);
    const totalReceivedQty = items.reduce((sum: number, i: any) => sum + i.receivedNow, 0);

    const newGrn: GRN = {
      ...grnData,
      id,
      grnNo,
      qualityStatus: 'Pending',
      inwardStatus: 'Pending',
      status: 'Pending QC',
      items,
      // Fallback root properties
      commodityId: grnData.commodityId || firstItem?.item || '',
      orderedQty: grnData.orderedQty || totalOrderedQty,
      receivedQty: grnData.receivedQty || totalReceivedQty,
      acceptedQty: 0,
      rejectedQty: 0,
      weight: grnData.weight || totalReceivedQty,
      batchNo: grnData.batchNo || `BAT-${Date.now().toString().slice(-4)}`
    };
    
    db.grns.push(newGrn);

    // Update PO status
    const po = db.purchaseOrders.find(p => p.id === grnData.poId);
    if (po) {
      po.status = 'Partially Received';
    }

    saveDb(db);

    // Sync GRN creation to backend
    api.post('/procurement/grns', newGrn)
      .then(res => {
        const backendItem = res.data?.data;
        if (backendItem && backendItem._id) {
          const currentDb = getDb();
          const idx = currentDb.grns.findIndex(g => g.id === newGrn.id);
          if (idx !== -1) {
            currentDb.grns[idx].id = backendItem._id;
            saveDb(currentDb);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('erp-db-sync'));
            }
          }
        }
      })
      .catch(err => console.error('Failed to sync GRN creation to backend:', err));

    return newGrn;
  },

  // 4. Submit Quality Inspection
  submitQualityInspection: (qiData: any): QualityInspection => {
    const db = getDb();
    const id = `QI-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const newQi: QualityInspection = {
      ...qiData,
      id,
      date
    };

    db.qualityInspections.push(newQi);

    // Update GRN quality status
    const grn = db.grns.find(g => g.id === qiData.grnId || g.grnNo === qiData.grnNo);
    if (grn) {
      grn.qualityStatus = qiData.status;
      grn.status = qiData.status === 'Passed' ? 'Accepted' : qiData.status === 'Rejected' ? 'Rejected' : 'Accepted';
      
      // Update item quantities based on inspection results
      if (qiData.items) {
        qiData.items.forEach((qiItem: any) => {
          const grnItem = grn.items.find(i => i.item === qiItem.item);
          if (grnItem) {
            grnItem.acceptedQuantity = qiItem.status === 'Rejected' ? 0 : grnItem.receivedNow - (qiItem.rejectedQuantity || 0) - (qiItem.damagedQuantity || 0);
            grnItem.rejectedQuantity = qiItem.rejectedQuantity || 0;
            grnItem.damagedQuantity = qiItem.damagedQuantity || 0;
            grnItem.pendingQuantity = Math.max(0, grnItem.orderedQty - grnItem.previouslyReceived - grnItem.acceptedQuantity);
            grnItem.totalReceived = grnItem.previouslyReceived + grnItem.acceptedQuantity;
            grnItem.batchNo = grnItem.batchNo || `BAT-${Date.now().toString().slice(-4)}`;
          }
        });
      }

      // Sync root properties
      const firstItem = grn.items[0];
      if (firstItem) {
        grn.acceptedQty = grn.items.reduce((sum, i) => sum + i.acceptedQuantity, 0);
        grn.rejectedQty = grn.items.reduce((sum, i) => sum + i.rejectedQuantity, 0);
        grn.receivedQty = grn.items.reduce((sum, i) => sum + i.receivedNow, 0);
        grn.commodityId = grn.commodityId || firstItem.item;
        grn.batchNo = firstItem.batchNo;
      }
    }

    saveDb(db);

    // Sync Quality Inspection creation to backend
    api.post('/procurement/quality-inspections', newQi)
      .then(res => {
        const backendItem = res.data?.data;
        if (backendItem && backendItem._id) {
          const currentDb = getDb();
          const idx = currentDb.qualityInspections.findIndex(q => q.id === newQi.id);
          if (idx !== -1) {
            currentDb.qualityInspections[idx].id = backendItem._id;
          }
          const grnIdx = currentDb.grns.findIndex(g => g.id === qiData.grnId || g.grnNo === qiData.grnNo);
          if (grnIdx !== -1) {
            currentDb.grns[grnIdx].qualityStatus = qiData.status;
            currentDb.grns[grnIdx].status = qiData.status === 'Passed' ? 'Accepted' : qiData.status === 'Rejected' ? 'Rejected' : 'Accepted';
          }
          saveDb(currentDb);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('erp-db-sync'));
          }
        }
      })
      .catch(err => console.error('Failed to sync Quality Inspection to backend:', err));

    return newQi;
  },

  // 5. Warehouse Inward (Store goods into physical Bin & increase stock level)
  inwardStock: (grnId: string, binId: string): void => {
    const db = getDb();
    const grn = db.grns.find(g => g.id === grnId);
    if (!grn) return;

    const po = db.purchaseOrders.find(p => p.id === grn.poId);

    // Inward each item in GRN
    grn.items.forEach(grnItem => {
      if (grnItem.acceptedQuantity <= 0) return;

      const commId = grnItem.item;
      const commodity = db.commodities.find(c => c.id === commId || c.name === grnItem.item || c.sku === grnItem.item)
        || db.commodities.find(c => c.id === grn.commodityId);
      if (!commodity) return;

      const stockId = `STK-${Date.now()}-${Math.random().toString().slice(-4)}`;
      const poItem = po?.items?.find(i => i.item === grnItem.item);
      const purchaseCost = poItem?.rate || commodity.purchaseCost;

      const newStockItem: StockItem = {
        id: stockId,
        commodityId: commodity.id,
        batchNo: grnItem.batchNo,
        warehouseId: grn.warehouseId,
        binId: binId,
        quantity: grnItem.acceptedQuantity,
        unit: grnItem.unit as any,
        purchaseCost: purchaseCost,
        averageCost: purchaseCost,
        entryDate: new Date().toISOString().split('T')[0]
      };

      db.stockItems.push(newStockItem);

      // Update Bin occupancy
      const bin = db.bins.find(b => b.id === binId);
      if (bin) {
        bin.occupiedMT = Number((bin.occupiedMT + grnItem.acceptedQuantity).toFixed(2));
      }

      // Update Warehouse occupancy
      const warehouse = db.warehouses.find(w => w.id === grn.warehouseId);
      if (warehouse) {
        warehouse.usedCapacityMT = Number((warehouse.usedCapacityMT + grnItem.acceptedQuantity).toFixed(2));
      }

      // Recalculate Commodity Average Purchase Cost & Quantity
      const currentStockVal = commodity.stockQty * commodity.purchaseCost;
      const incomingVal = grnItem.acceptedQuantity * purchaseCost;
      
      commodity.stockQty += grnItem.acceptedQuantity;
      if (commodity.stockQty > 0) {
        commodity.purchaseCost = Math.round((currentStockVal + incomingVal) / commodity.stockQty);
      }
    });

    // Mark GRN as Inwarded
    grn.inwardStatus = 'Completed';

    // Update PO Status
    if (po) {
      let allCompleted = true;
      po.items.forEach(poItem => {
        const totalAccepted = db.grns
          .filter(g => g.poId === po.id && g.inwardStatus === 'Completed')
          .reduce((sum, g) => {
            const git = g.items.find(gi => gi.item === poItem.item);
            return sum + (git ? git.acceptedQuantity : 0);
          }, 0);

        if (totalAccepted < poItem.quantity) {
          allCompleted = false;
        }
      });
      po.status = allCompleted ? 'Received' : 'Partially Received';
    }

    saveDb(db);
  },

  // 3-Way Match Verification
  verifyThreeWayMatch: (invoice: PurchaseInvoice): { isMatch: boolean; details: string[] } => {
    const db = getDb();
    const po = db.purchaseOrders.find(p => p.poNo === invoice.poNumber);
    const grn = db.grns.find(g => g.grnNo === invoice.grnNumber);
    const warnings: string[] = [];

    if (!po) {
      warnings.push(`Reference PO ${invoice.poNumber} not found.`);
      return { isMatch: false, details: warnings };
    }
    if (!grn) {
      warnings.push(`Reference GRN ${invoice.grnNumber} not found.`);
      return { isMatch: false, details: warnings };
    }

    invoice.items.forEach(invItem => {
      const poItem = po.items?.find(i => i.item === invItem.item || String(i.item) === String(invItem.item));
      const grnItem = grn.items?.find(i => i.item === invItem.item || String(i.item) === String(invItem.item));

      if (!poItem) {
        warnings.push(`Item "${invItem.item}" not found in PO.`);
        return;
      }
      if (!grnItem) {
        warnings.push(`Item "${invItem.item}" not found in GRN.`);
        return;
      }

      if (invItem.invoiceQty > grnItem.acceptedQuantity) {
        warnings.push(`Item "${invItem.item}": Invoice quantity (${invItem.invoiceQty}) exceeds QC accepted quantity (${grnItem.acceptedQuantity}) by ${invItem.invoiceQty - grnItem.acceptedQuantity} units.`);
      }

      if (invItem.rate > poItem.rate) {
        warnings.push(`Item "${invItem.item}": Invoice rate (₹${invItem.rate}) exceeds PO rate (₹${poItem.rate}) by ₹${invItem.rate - poItem.rate}.`);
      }
    });

    return {
      isMatch: warnings.length === 0,
      details: warnings.length === 0 ? ['All quantities and rates match. Ready for verification.'] : warnings
    };
  },

  // 6. Create Sales Order (Reserves quantity in commodity database)
  createSalesOrder: (soData: Omit<SalesOrder, 'id' | 'soNo' | 'status'>): SalesOrder => {
    const db = getDb();
    const soNo = `SO/BR/2026-27/${String(db.salesOrders.length + 1).padStart(3, '0')}`;
    const id = `SO-${Date.now()}`;

    const newSo: SalesOrder = {
      ...soData,
      id,
      soNo,
      status: 'Approved' // Ready to pick
    };

    db.salesOrders.push(newSo);

    // Reserve commodity quantity
    const commodity = db.commodities.find(c => c.id === soData.commodityId);
    if (commodity) {
      commodity.reservedQty += soData.quantity;
    }

    saveDb(db);
    return newSo;
  },

  // 7. Complete Picking & Packing (converts SO ➔ Picking Slip ➔ Packing Slip)
  completePickingAndPacking: (soId: string, batchNo: string, binId: string, packageType: string, numPackages: number): void => {
    const db = getDb();
    const so = db.salesOrders.find(s => s.id === soId);
    if (!so) return;

    so.status = 'Packing';

    // Create Picking Slip
    const pickId = `PCK-${Date.now()}`;
    const newPick: PickingSlip = {
      id: pickId,
      pickingNo: `PCK/BR/2026-27/${String(db.pickingSlips.length + 1).padStart(3, '0')}`,
      soId: so.id,
      soNo: so.soNo,
      date: new Date().toISOString().split('T')[0],
      warehouseId: so.warehouseId,
      commodityId: so.commodityId,
      batchNo,
      binId,
      qtyToPick: so.quantity,
      qtyPicked: so.quantity,
      status: 'Completed'
    };
    db.pickingSlips.push(newPick);

    // Create Packing Slip
    const packId = `PAK-${Date.now()}`;
    const newPack: PackingSlip = {
      id: packId,
      packingNo: `PAK/BR/2026-27/${String(db.packingSlips.length + 1).padStart(3, '0')}`,
      pickingId: pickId,
      soId: so.id,
      soNo: so.soNo,
      customerId: so.customerId,
      commodityId: so.commodityId,
      batchNo,
      quantity: so.quantity,
      packageType,
      numPackages,
      weight: so.quantity,
      packingDate: new Date().toISOString().split('T')[0],
      status: 'Completed'
    };
    db.packingSlips.push(newPack);

    saveDb(db);
  },

  // 8. Create Delivery Challan & Generate Invoice + EWay Bill
  dispatchOrder: (soId: string, vehicleNo: string, driverName: string, deliveryAddress: string): void => {
    const db = getDb();
    const so = db.salesOrders.find(s => s.id === soId);
    if (!so) return;

    so.status = 'Shipped';

    const dcNo = `DC/BR/2026-27/${String(db.deliveryChallans.length + 1).padStart(3, '0')}`;
    const newDc: DeliveryChallan = {
      id: `DC-${Date.now()}`,
      dcNo,
      soId: so.id,
      soNo: so.soNo,
      customerId: so.customerId,
      warehouseId: so.warehouseId,
      vehicleNo,
      driverName,
      commodityId: so.commodityId,
      quantity: so.quantity,
      deliveryAddress,
      dispatchDate: new Date().toISOString().split('T')[0],
      status: 'Dispatched'
    };
    db.deliveryChallans.push(newDc);

    // Auto-generate Sales Invoice
    const customer = db.customers.find(c => c.id === so.customerId);
    const commodity = db.commodities.find(c => c.id === so.commodityId);
    const invoiceNo = `INV/BR/2026-27/${String(db.salesInvoices.length + 1).padStart(3, '0')}`;
    
    // Tax calculations (CGST/SGST if Intra-state Bihar, IGST if Inter-state)
    const isInterState = customer ? customer.state.toLowerCase() !== 'bihar' : false;
    const taxableAmount = so.quantity * so.rate;
    const taxRate = so.gstPercent;
    
    const cgst = isInterState ? 0 : Math.round(taxableAmount * (taxRate / 2) / 100);
    const sgst = isInterState ? 0 : Math.round(taxableAmount * (taxRate / 2) / 100);
    const igst = isInterState ? Math.round(taxableAmount * taxRate / 100) : 0;
    const grandTotal = taxableAmount + cgst + sgst + igst + so.freightCost;

    const newInvoice: SalesInvoice = {
      id: `INV-${Date.now()}`,
      invoiceNo,
      invoiceDate: new Date().toISOString().split('T')[0],
      dcNo,
      customerId: so.customerId,
      gstin: customer?.gstin || '10MOCKGSTIN123Z',
      billingAddress: customer?.address || '',
      shippingAddress: deliveryAddress,
      items: [{
        commodityId: so.commodityId,
        hsn: commodity?.hsn || '10019910',
        quantity: so.quantity,
        rate: so.rate,
        discount: 0,
        taxableAmount,
        cgst,
        sgst,
        igst,
        total: taxableAmount + cgst + sgst + igst
      }],
      taxableAmount,
      cgst,
      sgst,
      igst,
      freight: so.freightCost,
      otherCharges: 0,
      grandTotal,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 Days credit
      paymentStatus: 'Unpaid'
    };
    db.salesInvoices.push(newInvoice);

    // Auto-generate EWay Bill
    const ewayBillNo = String(Math.floor(100000000000 + Math.random() * 900000000000));
    const newEwayBill: EWayBill = {
      id: `EWB-${Date.now()}`,
      ewayBillNo,
      invoiceNo,
      customerId: so.customerId,
      partyName: customer?.name || '',
      vehicleNo,
      transporterName: 'Self Transport',
      mode: 'Road',
      distance: 85,
      validFrom: new Date().toISOString().replace('T', ' ').substring(0, 16),
      validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
      status: 'Active'
    };
    db.ewayBills.push(newEwayBill);

    // Add EWay bill reference to Invoice
    newInvoice.ewayBillNo = ewayBillNo;

    // Update customer outstanding receivables balance
    if (customer) {
      customer.balance += grandTotal;
    }

    saveDb(db);
  },

  // 9. Proof of Delivery (POD) - reduces actual stock quantities and completes SO
  deliverOrder: (dcNo: string, deliveredQty: number, receivedBy: string, status: 'Delivered' | 'Partially Delivered' | 'Rejected', remarks?: string): void => {
    const db = getDb();
    const dc = db.deliveryChallans.find(d => d.dcNo === dcNo);
    if (!dc) return;

    dc.status = status === 'Delivered' ? 'Delivered' : 'Cancelled';

    const so = db.salesOrders.find(s => s.id === dc.soId);
    if (so) {
      so.status = 'Completed';
    }

    // Create POD record
    const podNo = `POD/BR/2026-27/${String(db.pods.length + 1).padStart(3, '0')}`;
    const customer = db.customers.find(c => c.id === dc.customerId);
    const invoice = db.salesInvoices.find(inv => inv.dcNo === dcNo);

    const newPod: POD = {
      id: `POD-${Date.now()}`,
      podNo,
      dcNo,
      invoiceNo: invoice?.invoiceNo,
      customerId: dc.customerId,
      customerName: customer?.name || '',
      vehicleNo: dc.vehicleNo,
      driverName: dc.driverName,
      deliveryDate: new Date().toISOString().split('T')[0],
      deliveredQty,
      receivedBy,
      status,
      remarks
    };
    db.pods.push(newPod);

    // DEDUCT STOCK & WAREHOUSE CAPACITY
    const commodity = db.commodities.find(c => c.id === dc.commodityId);
    if (commodity) {
      commodity.stockQty -= deliveredQty;
      commodity.reservedQty -= so?.quantity || deliveredQty; // release reservation
    }

    // Find the picking details to deduct from specific bin
    const pick = db.pickingSlips.find(p => p.soId === dc.soId);
    if (pick) {
      const stock = db.stockItems.find(stk => stk.warehouseId === pick.warehouseId && stk.binId === pick.binId && stk.batchNo === pick.batchNo);
      if (stock) {
        stock.quantity = Math.max(0, stock.quantity - deliveredQty);
        if (stock.quantity === 0) {
          db.stockItems = db.stockItems.filter(s => s.id !== stock.id);
        }
      }

      // Deduct occupied capacities
      const bin = db.bins.find(b => b.id === pick.binId);
      if (bin) {
        bin.occupiedMT = Math.max(0, bin.occupiedMT - deliveredQty);
      }
      const warehouse = db.warehouses.find(w => w.id === pick.warehouseId);
      if (warehouse) {
        warehouse.usedCapacityMT = Math.max(0, warehouse.usedCapacityMT - deliveredQty);
      }
    }

    saveDb(db);
  },

  // 10. Financial Voucher Posting (Payment/Receipt) - Updates partner ledger balances and bank cash
  postVoucher: (vchData: Omit<Voucher, 'id' | 'voucherNo' | 'status' | 'createdBy'>, creatorName: string): Voucher => {
    const db = getDb();
    
    // Auto-generate voucher number
    let prefix = 'VCH';
    if (vchData.voucherType === 'Receipt') prefix = 'RCPT';
    else if (vchData.voucherType === 'Payment') prefix = 'PYMT';
    else if (vchData.voucherType === 'Contra') prefix = 'CNTR';
    else if (vchData.voucherType === 'Journal') prefix = 'JRNL';
    else if (vchData.voucherType === 'Expense') prefix = 'EXP';
    
    const voucherNo = `${prefix}/2026/${String(db.vouchers.length + 1).padStart(4, '0')}`;
    const id = `VCH-${Date.now()}`;

    const newVch: Voucher = {
      ...vchData,
      id,
      voucherNo,
      status: 'Approved',
      createdBy: creatorName
    };

    db.vouchers.push(newVch);

    // Apply financial ledger updates
    if (newVch.partyId && newVch.partyType) {
      if (newVch.partyType === 'customer') {
        const cus = db.customers.find(c => c.id === newVch.partyId);
        if (cus) {
          if (newVch.voucherType === 'Receipt') {
            cus.balance -= newVch.amount; // Received cash, reduce their outstanding
          } else if (newVch.voucherType === 'Payment') {
            cus.balance += newVch.amount; // Refunded customer, increase outstanding
          }
        }
      } else if (newVch.partyType === 'supplier') {
        const sup = db.suppliers.find(s => s.id === newVch.partyId);
        if (sup) {
          if (newVch.voucherType === 'Payment') {
            sup.balance -= newVch.amount; // Cleared bills, reduce payables
          } else if (newVch.voucherType === 'Receipt') {
            sup.balance += newVch.amount; // Received refund from supplier, increase payables
          }
        }
      } else if (newVch.partyType === 'farmer') {
        const farmer = db.farmers.find(f => f.id === newVch.partyId);
        if (farmer) {
          if (newVch.voucherType === 'Payment') {
            farmer.balance -= newVch.amount; // Cleared bills, reduce payables
          }
        }
      }
    }

    // Auto-update Invoice paid status if reference is an Invoice ID
    if (newVch.referenceNo && newVch.voucherType === 'Receipt') {
      const invoice = db.salesInvoices.find(inv => inv.invoiceNo === newVch.referenceNo || inv.id === newVch.referenceNo);
      if (invoice) {
        if (newVch.amount >= invoice.grandTotal) {
          invoice.paymentStatus = 'Paid';
        } else {
          invoice.paymentStatus = 'Partially Paid';
        }
      }
    }

    saveDb(db);
    return newVch;
  },

  // 11. Create Stock Transfer
  createStockTransfer: (trfData: Omit<StockTransfer, 'id' | 'transferNo' | 'status'>): StockTransfer => {
    const db = getDb();
    const transferNo = `TRF/BR/2026-27/${String(db.stockTransfers.length + 1).padStart(3, '0')}`;
    const id = `TRF-${Date.now()}`;

    const newTransfer: StockTransfer = {
      ...trfData,
      id,
      transferNo,
      status: 'Completed' // auto-completed for mock
    };

    db.stockTransfers.push(newTransfer);

    // Adjust specific stock item quantities
    const sourceStock = db.stockItems.find(stk => stk.warehouseId === trfData.fromWarehouseId && stk.binId === trfData.fromBinId && stk.batchNo === trfData.batchNo);
    if (sourceStock) {
      sourceStock.quantity = Math.max(0, sourceStock.quantity - trfData.quantity);
      if (sourceStock.quantity === 0) {
        db.stockItems = db.stockItems.filter(s => s.id !== sourceStock.id);
      }
    }

    // Check if item already exists in target bin
    const targetStock = db.stockItems.find(stk => stk.warehouseId === trfData.toWarehouseId && stk.binId === trfData.toBinId && stk.batchNo === trfData.batchNo);
    if (targetStock) {
      targetStock.quantity += trfData.quantity;
    } else {
      const commodity = db.commodities.find(c => c.id === trfData.commodityId);
      db.stockItems.push({
        id: `STK-TRF-${Date.now()}`,
        commodityId: trfData.commodityId,
        batchNo: trfData.batchNo,
        warehouseId: trfData.toWarehouseId,
        binId: trfData.toBinId,
        quantity: trfData.quantity,
        unit: commodity?.unit || 'MT',
        purchaseCost: sourceStock?.purchaseCost || commodity?.purchaseCost || 0,
        averageCost: sourceStock?.averageCost || commodity?.purchaseCost || 0,
        entryDate: trfData.transferDate
      });
    }

    // Adjust Bins capacities
    const fromBin = db.bins.find(b => b.id === trfData.fromBinId);
    if (fromBin) fromBin.occupiedMT = Math.max(0, fromBin.occupiedMT - trfData.quantity);

    const toBin = db.bins.find(b => b.id === trfData.toBinId);
    if (toBin) toBin.occupiedMT = Math.min(toBin.capacityMT, toBin.occupiedMT + trfData.quantity);

    // Adjust Warehouse capacities
    const fromWH = db.warehouses.find(w => w.id === trfData.fromWarehouseId);
    if (fromWH) fromWH.usedCapacityMT = Math.max(0, fromWH.usedCapacityMT - trfData.quantity);

    const toWH = db.warehouses.find(w => w.id === trfData.toWarehouseId);
    if (toWH) toWH.usedCapacityMT = Math.min(toWH.capacityMT, toWH.usedCapacityMT + trfData.quantity);

    saveDb(db);
    return newTransfer;
  },

  // 12. Update Market Price
  updateMarketPrice: (commodityId: string, newPrice: number): void => {
    const db = getDb();
    const commodity = db.commodities.find(c => c.id === commodityId);
    if (commodity) {
      commodity.currentMarketPrice = newPrice;
      saveDb(db);
    }
  }
};
