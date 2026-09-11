export interface Farmer {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin?: string;
  balance: number; // Positive is payable (we owe them)
  status: 'Active' | 'Inactive';
  pan?: string;
  aadhar?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
}

export interface Supplier {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin: string;
  balance: number; // Positive is payable (we owe them)
  status: 'Active' | 'Inactive';
  companyName?: string;
  pan?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export interface Customer {
  id: string;
  _id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin: string;
  balance: number; // Positive is receivable (they owe us)
  status: 'Active' | 'Inactive';
  companyName?: string;
  pan?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  creditLimit?: number;
}

export interface Commodity {
  id: string;
  _id?: string;
  name: string;
  sku: string;
  category: 'Grains' | 'Oilseeds' | 'Pulses' | 'Other';
  unit: 'MT' | 'Qtl' | 'Kg';
  hsn: string;
  defaultGst: number; // e.g. 5
  purchaseCost: number; // Avg cost per unit
  currentMarketPrice: number; // Market price per unit
  targetPrice: number; // Trigger alerts when market price is >= target
  stockQty: number; // Total available
  reservedQty: number; // Allocated to Sales Orders but not dispatched
  minStockLevel: number;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacityMT: number;
  usedCapacityMT: number;
  status: 'Active' | 'Inactive';
}

export interface Zone {
  id: string;
  warehouseId: string;
  name: string;
}

export interface Rack {
  id: string;
  zoneId: string;
  name: string;
}

export interface Bin {
  id: string;
  _id?: string;
  rackId: string;
  name: string;
  capacityMT: number;
  occupiedMT: number;
  warehouseId?: string;
  allowedCommodityId?: string;
  binCode?: string;
}

export interface Vehicle {
  id: string;
  number: string;
  type: string;
  capacityMT: number;
  driverId?: string;
  status: 'Available' | 'On Route' | 'Maintenance';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  status: 'Active' | 'On Route' | 'Inactive';
}

// Procurement Flows
export type DocumentStatus = 'Draft' | 'Sent' | 'Under Negotiation' | 'Approved' | 'Rejected' | 'Cancelled' | 'Converted' | 'Completed' | 'Pending Approval' | 'Received' | 'Selected';

export interface PurchaseEnquiryItem {
  id?: string;
  item: string;
  description: string;
  sku: string;
  quantity: number;
  unit: string;
  estimatedRate: number;
  estimatedAmount: number;
  requiredDate: string;
  remarks?: string;
}

export interface PurchaseEnquiry {
  id: string;
  enquiryNo: string;
  date: string;
  requiredByDate: string;
  department: string;
  requestedBy: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  warehouseId: string;
  purpose?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'RFQ Created' | 'Closed' | 'Cancelled';
  items: PurchaseEnquiryItem[];
  // Backward compatibility:
  commodityId: string;
  quantity: number;
  expectedPrice: number;
  requiredDate: string;
  partyType?: 'supplier' | 'farmer';
  partyId?: string;
  notes?: string;
}

export interface PurchaseQuotationItem {
  id?: string;
  item: string;
  description?: string;
  sku: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
  deliveryDate: string;
}

export interface PurchaseQuotation {
  id: string;
  quotationNo: string;
  enquiryNo?: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  validUntil: string;
  paymentTerms: string;
  deliveryDays: number;
  freight: number;
  discount: number;
  tax: number;
  grandTotal: number;
  remarks?: string;
  status: DocumentStatus;
  items: PurchaseQuotationItem[];
  // Backward compatibility:
  commodityId: string;
  quantity: number;
  rate: number;
  transportCost: number;
  loadingCost: number;
  otherCharges: number;
  gstPercent: number;
  total: number;
  deliveryTerms?: string;
}

export interface ApprovalHistoryItem {
  step: string;
  user: string;
  action: 'Created' | 'Approved' | 'Rejected' | 'Changes Requested';
  date: string;
  comment?: string;
}

export interface PurchaseOrderItem {
  id?: string;
  item: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  amount: number;
  expectedDelivery: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  quotationNo?: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  supplierContact?: string;
  billingAddress?: string;
  shippingAddress?: string;
  expectedDelivery: string;
  paymentTerms: string;
  currency: string;
  referenceQuotation?: string;
  buyer: string;
  department: string;
  deliveryTerms?: string;
  freight: number;
  otherCharges: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  attachment?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Partially Received' | 'Received' | 'Cancelled';
  items: PurchaseOrderItem[];
  approvalHistory: ApprovalHistoryItem[];
  // Backward compatibility:
  commodityId: string;
  quantity: number;
  rate: number;
  transportCost: number;
  gstPercent: number;
  warehouseId: string;
}

export interface GRNItem {
  id?: string;
  item: string;
  orderedQty: number;
  previouslyReceived: number;
  receivedNow: number;
  totalReceived: number;
  pendingQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  unit: string;
  batchNo: string;
  serialNo?: string;
  expiryDate?: string;
  storageLocation?: string;
  remarks?: string;
}

export interface GRN {
  id: string;
  _id?: string;
  grnNo: string;
  poId: string;
  poNo: string;
  invoiceId?: string;
  invoiceNo?: string;
  qcId?: string;
  qcNo?: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  vehicleNo: string;
  driverName: string;
  arrivalDate: string;
  warehouseId: string;
  challanNo: string;
  challanDate: string;
  transporter?: string;
  remarks?: string;
  attachment?: string;
  qualityStatus: 'Pending' | 'Passed' | 'Rejected' | 'Partially Passed' | 'On Hold';
  inwardStatus: 'Pending' | 'Completed';
  status: 'Draft' | 'Pending QC' | 'Completed' | 'Cancelled' | 'Accepted' | 'Rejected';
  items: GRNItem[];
  // Backward compatibility:
  commodityId: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  weight: number;
  batchNo: string;
}

export interface QualityInspectionItem {
  item: string;
  quantity: number;
  moisturePercent: number;
  grade: 'A' | 'B' | 'C' | 'Rejected';
  color: string;
  foreignMaterialPercent: number;
  damagePercent: number;
  purityPercent: number;
  qualityScore: number;
  status: 'Pending' | 'Passed' | 'Partially Passed' | 'Rejected';
  remarks?: string;
}

export interface QualityInspection {
  id: string;
  qcNo?: string;
  poId?: string;
  poNo?: string;
  grnId?: string;
  grnNo?: string;
  inspector: string;
  date: string;
  status: 'Pending' | 'Passed' | 'Partially Passed' | 'Rejected';
  decision?: 'ACCEPT' | 'PARTIAL ACCEPT' | 'REJECT' | 'HOLD';
  grade?: string;
  receivedQuantity?: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  holdQuantity?: number;
  damagedQuantity?: number;
  basePrice?: number;
  finalPrice?: number;
  priceDeduction?: number;
  notes?: string;
  items: QualityInspectionItem[];
  // Backward compatibility:
  commodityId: string;
  batchNo: string;
  quantity: number;
  moisturePercent: number;
  weight: number;
  color: string;
  foreignMaterialPercent: number;
  damagePercent: number;
  qualityScore: number;
}

// ----------------------------------------------------
// Quality Parameter Master
// ----------------------------------------------------
export interface QualityParameter {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  unit: string;
  description?: string;
  status: 'Active' | 'Inactive';
  standardValue?: number;
  minLimit?: number;
  maxLimit?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// Quality / Rebate Master Rule
// ----------------------------------------------------
export interface RebateSlab {
  minDeviation: number;
  maxDeviation: number;
  rebateRate: number;
  rateType?: 'Fixed Amount' | 'Per Unit Deviation' | 'Percentage';
  description?: string;
}

export interface QualityRebateRule {
  id?: string;
  _id?: string;
  ruleCode: string;
  commodityId: string;
  commodityName: string;
  parameterId?: string;
  parameterName: string;
  unit: string;
  standardValue: number;
  minValue?: number;
  maxValue?: number;
  tolerance: number;
  rebateType: 'Standard Rebate' | 'Single Rebate' | 'Double Rebate' | 'All' | 'All Types';
  calculationMethod: 'Discount' | 'Pro-Rata' | 'Both';
  rebateBasis: 'Per % Deviation' | 'Flat Rate per MT' | 'Percentage of Base Rate' | 'Tiered Slabs';
  rebateRate: number;
  slabs: RebateSlab[];
  direction: 'HIGHER_IS_WORSE' | 'LOWER_IS_WORSE';
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Active' | 'Inactive';
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// Quality Control Document
// ----------------------------------------------------
export interface QCTestedParameter {
  parameterName: string;
  unit: string;
  standardValue: number;
  actualValue: number;
  deviation: number;
  tolerance: number;
  applicableRuleId?: string;
  ruleCode?: string;
  rebateBasis: string;
  rebateRate: number;
  rebatePerUnit: number;
  rebateTotal: number;
  formulaDescription: string;
  status: 'PASS' | 'WARN' | 'FAIL';
}

export interface QCAuditTrailEntry {
  action: 'Created' | 'Updated' | 'Submitted' | 'Reviewed' | 'Approved' | 'Rejected' | 'Modified_After_Approval';
  user: string;
  timestamp: string;
  reason?: string;
  previousValues?: any;
  newValues?: any;
  changes?: Array<{ field: string; oldValue: any; newValue: any }>;
}

export interface QualityControl {
  id?: string;
  _id?: string;
  qcNumber: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  partyName: string;
  commodityId: string;
  commodityName: string;
  vehicleNumber: string;
  quantity: number;
  unit: string;
  baseRate: number;
  date: string;
  referenceNumber?: string;
  poId?: string;
  poNumber?: string;
  grnId?: string;
  grnNumber?: string;
  rebateType: 'Standard Rebate' | 'Single Rebate' | 'Double Rebate' | 'All' | 'All Types';
  calculationMethod: 'Discount' | 'Pro-Rata' | 'Both';
  discountRate: number;
  discountType?: 'PERCENT' | 'FLAT';
  discountAmount: number;
  qualityParameters: QCTestedParameter[];
  totalRebate: number;
  totalDeduction: number;
  baseValue: number;
  finalRate: number;
  finalValue: number;
  calculationBreakdown?: any;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  inspector?: string;
  notes?: string;
  rejectionReason?: string;
  modificationReason?: string;
  createdBy: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  auditTrail: QCAuditTrailEntry[];
  createdAt?: string;
  updatedAt?: string;
}

// Purchase Invoice types
export interface PurchaseInvoiceItem {
  id?: string;
  item: string;
  poQty: number;
  receivedQty: number;
  invoiceQty: number;
  rate: number;
  baseRate?: number;
  qualityRebatePerUnit?: number;
  qualityRebateTotal?: number;
  settledRate?: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  amount: number;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  supplierId: string; // References Supplier/Farmer id
  partyType: 'supplier' | 'farmer';
  poNumber: string;
  qcId?: string;
  qcNumber?: string;
  grnNumber?: string;
  dueDate: string;
  paymentTerms: string;
  supplierGSTIN?: string;
  billingAddress?: string;
  shippingAddress?: string;
  taxType: string;
  subtotal: number;
  baseSubtotal?: number;
  qualityRebateDeduction?: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  status: 'Draft' | 'Pending Verification' | 'Matched' | 'Mismatch' | 'Approved' | 'Partially Paid' | 'Paid' | 'Disputed' | 'Cancelled';
  items: PurchaseInvoiceItem[];
  mismatchReason?: string;
  remarks?: string;
  amountPaid?: number;
  remainingAmount?: number;
  paymentHistory?: Array<{
    date: string;
    reference: string;
    mode: string;
    account: string;
    amount: number;
    notes?: string;
  }>;
}


export interface StockItem {
  id: string;
  commodityId: string;
  batchNo: string;
  warehouseId: string;
  binId: string; // Format: Zone-Rack-Bin
  quantity: number;
  unit: 'MT' | 'Qtl' | 'Kg';
  purchaseCost: number; // Purchase price for this batch
  averageCost: number;
  entryDate: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  commodityId: string;
  batchNo: string;
  fromWarehouseId: string;
  fromBinId: string;
  toWarehouseId: string;
  toBinId: string;
  quantity: number;
  transferDate: string;
  reason: string;
  vehicleNo?: string;
  driverName?: string;
  status: 'Draft' | 'Approved' | 'In Transit' | 'Completed';
}

// Sales Flows
export interface SalesEnquiry {
  id: string;
  enquiryNo: string;
  date: string;
  customerId: string;
  commodityId: string;
  quantity: number;
  expectedRate: number;
  requiredDeliveryDate: string;
  deliveryLocation: string;
  notes?: string;
  status: DocumentStatus;
}

export interface SalesQuotation {
  id: string;
  quotationNo: string;
  enquiryNo?: string;
  date: string;
  customerId: string;
  commodityId: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  freightCost: number;
  loadingCost: number;
  otherCharges: number;
  discountAmount: number;
  total: number;
  validUntil: string;
  paymentTerms: string;
  deliveryTerms: string;
  purchaseCost: number; // Benchmark for margins
  expectedProfit: number; // rate * qty - purchaseCost * qty
  status: DocumentStatus;
}

export interface SalesOrder {
  id: string;
  soNo: string;
  quotationNo?: string;
  date: string;
  customerId: string;
  commodityId: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  freightCost: number;
  total: number;
  warehouseId: string;
  deliveryLocation: string;
  expectedDispatch: string;
  paymentTerms: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Picking' | 'Packing' | 'Shipped' | 'Completed' | 'Cancelled';
  notes?: string;
}

export interface PickingSlip {
  id: string;
  pickingNo: string;
  soId: string;
  soNo: string;
  date: string;
  warehouseId: string;
  commodityId: string;
  batchNo: string;
  binId: string;
  qtyToPick: number;
  qtyPicked: number;
  status: 'Pending' | 'Completed';
}

export interface PackingSlip {
  id: string;
  packingNo: string;
  pickingId: string;
  soId: string;
  soNo: string;
  customerId: string;
  commodityId: string;
  batchNo: string;
  quantity: number;
  packageType: string;
  numPackages: number;
  weight: number;
  packingDate: string;
  status: 'Pending' | 'Completed';
}

export interface DeliveryChallan {
  id: string;
  dcNo: string;
  soId: string;
  soNo: string;
  customerId: string;
  warehouseId: string;
  vehicleNo: string;
  driverName: string;
  commodityId: string;
  quantity: number;
  deliveryAddress: string;
  dispatchDate: string;
  status: 'Draft' | 'Dispatched' | 'Delivered' | 'Cancelled';
}

export interface SalesInvoiceItem {
  commodityId: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  taxableAmount: number;
  cgst: number; // Amount
  sgst: number; // Amount
  igst: number; // Amount
  total: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dcNo?: string;
  customerId: string;
  gstin: string;
  billingAddress: string;
  shippingAddress: string;
  items: SalesInvoiceItem[];
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight: number;
  otherCharges: number;
  grandTotal: number;
  dueDate: string;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  ewayBillNo?: string;
}

export interface EWayBill {
  id: string;
  ewayBillNo: string;
  invoiceNo: string;
  customerId: string;
  partyName: string;
  vehicleNo: string;
  transporterName: string;
  mode: 'Road' | 'Rail' | 'Air' | 'Ship';
  distance: number;
  validFrom: string;
  validUntil: string;
  status: 'Active' | 'Expired' | 'Cancelled';
}

export interface POD {
  id: string;
  podNo: string;
  dcNo: string;
  invoiceNo?: string;
  customerId: string;
  customerName: string;
  vehicleNo: string;
  driverName: string;
  deliveryDate: string;
  deliveredQty: number;
  receivedBy: string;
  signatureUrl?: string; // Mock
  photoUrl?: string; // Mock
  status: 'Delivered' | 'Partially Delivered' | 'Rejected';
  remarks?: string;
}

// Finance Vouchers
export type VoucherType = 'Receipt' | 'Payment' | 'Contra' | 'Journal' | 'Expense' | 'Customer Advance' | 'Supplier Advance';

export interface Voucher {
  id: string;
  voucherNo: string;
  voucherType: VoucherType;
  date: string;
  referenceNo?: string;
  partyId?: string; // Customer, Supplier, Farmer or Employee
  partyType?: 'supplier' | 'farmer' | 'customer' | 'none';
  amount: number;
  paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI';
  cashBankLink: string; // e.g. "HDFC Bank A/c" or "Petty Cash"
  debitAccount: string;
  creditAccount: string;
  narration: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Cancelled';
  createdBy: string;
  approvedBy?: string;
}

export interface Expense {
  id: string;
  expenseNo: string;
  category: string; // Rent, Fuel, Wages, Office, Other
  vendor: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  paymentMode: 'Cash' | 'Bank Transfer' | 'UPI';
  date: string;
  referenceNo?: string;
  attachmentUrl?: string;
  narration?: string;
}

export interface Lead {
  id: string;
  leadNo: string;
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  source: string;
  interestedProducts?: string;
  expectedValue?: number;
  expectedCloseDate?: string;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  notes?: string;
  date: string;
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  customerId: string;
  invoiceNo?: string;
  date: string;
  reason: string;
  items: Array<{
    commodityId: string;
    quantity: number;
    rate: number;
    batchNo: string;
  }>;
  status: string;
}

export interface ReturnInspection {
  id: string;
  inspectionNo: string;
  returnId: string;
  date: string;
  inspector: string;
  items: Array<{
    commodityId: string;
    quantity: number;
    condition: string;
    result: string;
  }>;
  status: string;
}

export interface CreditNote {
  id: string;
  creditNoteNo: string;
  returnId?: string;
  customerId: string;
  date: string;
  reason: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  status: string;
}

export interface Refund {
  id: string;
  refundNo: string;
  creditNoteId: string;
  customerId: string;
  amount: number;
  date: string;
  paymentMethod: string;
  referenceNo: string;
  bank?: string;
  status: string;
}

export interface SalesTarget {
  id: string;
  employee: string;
  period: string;
  targetAmount: number;
  actualAmount: number;
}

export interface SalesCommission {
  id: string;
  salesperson: string;
  amount: number;
  commissionRate: number;
  commission: number;
  status: string;
}
