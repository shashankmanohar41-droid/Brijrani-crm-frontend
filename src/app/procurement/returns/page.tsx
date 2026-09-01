'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import api from '../../../services/axios';
import { 
  FileText, ShieldAlert, CheckCircle2, Clock, 
  Plus, Search, ArrowRight, User, Package, Scale,
  Warehouse, ArrowUpRight, DollarSign, Printer, ListFilter,
  Check, Play, CreditCard, XCircle, Eye, Trash2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../../utils/dateUtils';

export default function PurchaseReturnsPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const [returns, setReturns] = useState<any[]>([]);
  const [qis, setQis] = useState<any[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [grnId, setGrnId] = useState('');
  const [returnType, setReturnType] = useState<'Full' | 'Partial' | 'Quality'>('Quality');
  const [reason, setReason] = useState('Quality Rejection');
  const [remarks, setRemarks] = useState('');

  // Selected items details for form
  const [selectedGrn, setSelectedGrn] = useState<any>(null);
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returnRate, setReturnRate] = useState<number>(0);
  const [selectedBinId, setSelectedBinId] = useState('');

  const loadReturnsData = async () => {
    try {
      const res = await api.get('/procurement/purchase-returns');
      if (res.data?.success) setReturns(res.data.data);

      const qisRes = await api.get('/procurement/quality-inspections');
      if (qisRes.data?.success) setQis(qisRes.data.data);
    } catch (err) {
      console.error('Failed to load purchase returns:', err);
    }
  };

  useEffect(() => {
    loadReturnsData();
  }, []);

  // When GRN selection changes, pre-fill items, rates, batches
  useEffect(() => {
    if (!grnId) {
      setSelectedGrn(null);
      setReturnQty(0);
      setReturnRate(0);
      return;
    }
    const grn = db.grns.find(g => g.id === grnId || g._id === grnId);
    setSelectedGrn(grn);

    if (grn) {
      setSupplierId(grn.partyId);
      const grnItem = grn.items[0];
      
      // Look if there's a failed QC Inspection for this GRN to auto-fill rejected quantities
      const relatedQc = qis.find(q => q.grnNo === grn.grnNo);
      if (relatedQc) {
        setReturnType('Quality');
        setReason('Quality Rejection');
        setReturnQty(relatedQc.rejectedQuantity || 0);
        setRemarks(`Auto-created from failed quality inspection ${relatedQc.grnNo.replace('GRN', 'QC')}. Parameters failed specifications.`);
      } else {
        setReturnType('Full');
        setReason('Excess Quantity');
        setReturnQty(grnItem?.receivedNow || 0);
        setRemarks('Returning excess supply/incorrect specification lot.');
      }
      
      // Get base rate from PO if possible, otherwise default
      const relatedPo = db.purchaseOrders.find(p => p.poNo === grn.poNo);
      const poItem = relatedPo?.items?.find(it => String(it.item) === String(grnItem?.item));
      setReturnRate(poItem?.rate || 2500);

      // Auto resolve bin
      const stockItem = db.stockItems?.find(s => s.batchNo === grnItem?.batchNo);
      if (stockItem) {
        setSelectedBinId(stockItem.binId);
      } else {
        const matchingBin = db.bins.find(b => String(b.allowedCommodityId) === String(grnItem?.item));
        if (matchingBin) {
          setSelectedBinId(matchingBin.id);
        } else if (db.bins.length > 0) {
          setSelectedBinId(db.bins[0].id);
        }
      }
    }
  }, [grnId, qis, db.stockItems, db.bins]);

  // Calculations
  const grnItemForCalc = selectedGrn?.items?.[0];
  const relatedCommodity = db.commodities.find(c => c.id === grnItemForCalc?.item || c._id === grnItemForCalc?.item);
  const gstRate = relatedCommodity?.defaultGst !== undefined ? relatedCommodity.defaultGst : 5;
  const subtotal = returnQty * (returnRate / 100); // rate is per quintal, qty is in KG
  const tax = subtotal * (gstRate / 100);
  const grandTotal = subtotal + tax;

  const handleOpenView = () => {
    if (!selectedReturn) return;
    setGrnId(selectedReturn.grnId || '');
    setReturnType(selectedReturn.returnType || 'Quality');
    setReason(selectedReturn.reason || 'Quality Rejection');
    setRemarks(selectedReturn.remarks || '');
    setReturnQty(selectedReturn.items?.[0]?.quantity || 0);
    setReturnRate(selectedReturn.items?.[0]?.rate || 0);
    if (selectedReturn.items?.[0]?.binId) {
      setSelectedBinId(selectedReturn.items[0].binId);
    }
    setIsViewMode(true);
    setIsCreateOpen(true);
  };

  const handleDeleteReturn = async () => {
    if (!selectedReturn) return;
    if (!confirm('Are you sure you want to delete this Purchase Return Request?')) return;
    try {
      await api.delete(`/procurement/purchase-returns/${selectedReturn.id || selectedReturn._id}`);
      showToast('Purchase Return Request deleted successfully', 'success');
      setSelectedReturn(null);
      loadReturnsData();
      refreshDb();
    } catch (err) {
      showToast('Failed to delete Purchase Return Request', 'error');
    }
  };

  // Create submission
  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnId || returnQty <= 0) {
      showToast('Please fill all required returns fields', 'error');
      return;
    }

    try {
      const grnItem = selectedGrn.items[0];
      await api.post('/procurement/purchase-returns', {
        supplierId,
        grnId: selectedGrn._id,
        grnNo: selectedGrn.grnNo,
        purchaseOrderId: selectedGrn.poId,
        warehouseId: selectedGrn.warehouseId,
        returnType,
        reason,
        remarks,
        subtotal,
        tax,
        grandTotal,
        items: [{
          commodityId: grnItem.item,
          batchNo: grnItem.batchNo,
          binId: selectedBinId || 'BIN-001',
          quantity: returnQty,
          unit: 'KG',
          rate: returnRate,
          taxableAmount: subtotal,
          taxAmount: tax,
          totalAmount: grandTotal,
          reason
        }]
      });

      showToast('Purchase Return request logged as Draft', 'success');
      setIsCreateOpen(false);
      loadReturnsData();
      refreshDb();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create return request', 'error');
    }
  };

  // Workflow triggers
  const handleWorkflowAction = async (id: string, action: 'submit' | 'approve' | 'reject' | 'dispatch' | 'complete') => {
    try {
      const res = await api.post(`/procurement/purchase-returns/${id}/${action}`);
      if (res.data?.success) {
        showToast(`Return request updated: ${action.toUpperCase()}`, 'success');
        loadReturnsData();
        refreshDb();
        setSelectedReturn(null);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to perform workflow ${action}`, 'error');
    }
  };

  const getSupplierName = (id: string) => {
    return db.suppliers.find(s => s.id === id || s._id === id)?.name || 
           db.farmers.find(f => f.id === id || f._id === id)?.name || 'Supplier';
  };

  const getCommodityName = (id: string) => {
    return db.commodities.find(c => c.id === id || c._id === id)?.name || 'Wheat';
  };

  const getBinCode = (id: string) => {
    return db.bins.find(b => b.id === id || b._id === id)?.binCode || 'Bin';
  };

  // Printable layout generator
  const handlePrintDebitNote = (pr: any) => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('BRIJRANI AGRO FOODS LIMITED', 14, 20);
    doc.setFontSize(12);
    doc.text(`OFFICIAL DEBIT NOTE: ${pr.debitNoteId || 'PENDING'}`, 14, 28);
    
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Supplier: ${getSupplierName(pr.supplierId)}`, 14, 42);
    doc.text(`Return No: ${pr.returnNumber}`, 14, 48);
    doc.text(`Return Date: ${formatDate(pr.returnDate)}`, 14, 54);
    doc.text(`Original GRN Ref: ${pr.items[0]?.batchNo || 'Lot'}`, 14, 60);

    doc.setFont('Helvetica', 'bold');
    doc.text('DEBIT STATEMENT DETAILS:', 14, 72);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Item Returned: ${getCommodityName(pr.items[0]?.commodityId)}`, 14, 78);
    doc.text(`Returned Qty: ${pr.items[0]?.quantity} KG`, 14, 84);
    doc.text(`Return Unit Cost: INR ${pr.items[0]?.rate} / QTL`, 14, 90);
    doc.text(`Taxable Amount: INR ${pr.subtotal}`, 14, 96);
    doc.text(`GST (5%): INR ${pr.tax}`, 14, 102);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Total Debit Value: INR ${pr.grandTotal}`, 14, 110);

    doc.save(`Debit_Note_${pr.returnNumber}.pdf`);
    showToast('Debit Note PDF printed successfully', 'success');
  };

  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      const matchSearch = r.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          getSupplierName(r.supplierId).toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'All' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [returns, searchQuery, filterStatus]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <XCircle className="text-rose-600 animate-pulse" size={24} />
            <span>Purchase Returns & Debit Notes</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Initiate supplier return requests, manage warehouse stock deductions, generate debit notes, and reconcile payables.
          </p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus size={14} /> Log Return Request
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Side List */}
        <div className="col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-150 pb-3">
            <div className="flex gap-2">
              {['All', 'Draft', 'Submitted', 'Approved', 'Goods Outward', 'Completed'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition ${filterStatus === st ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search PR..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-40"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredReturns.length === 0 ? (
              <div className="text-center py-12 text-xs font-semibold text-slate-400">No return requests logged.</div>
            ) : (
              filteredReturns.map(r => (
                <div
                  key={r._id}
                  onClick={() => setSelectedReturn(r)}
                  className={`p-3 border rounded-lg cursor-pointer transition flex justify-between items-center ${selectedReturn?._id === r._id ? 'border-rose-500 bg-rose-50/10' : 'border-slate-150 hover:bg-slate-50'}`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-700">{r.returnNumber}</div>
                    <div className="text-[10px] text-slate-500">Supplier: {getSupplierName(r.supplierId)} | Value: ₹{r.grandTotal}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      r.status === 'Completed' ? 'bg-green-50 text-green-700 border border-green-200' :
                      r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      r.status === 'Submitted' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side Detail panel */}
        <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <FileText size={18} className="text-rose-600" />
            <span>Return Request Details & Actions</span>
          </h3>

          {selectedReturn ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Return No</span>
                  <span className="font-bold text-slate-800">{selectedReturn.returnNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Workflow Status</span>
                  <span className="font-bold text-slate-800">{selectedReturn.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Returned Cost</span>
                  <span className="font-bold text-emerald-600">INR {selectedReturn.grandTotal}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Debit Note Ref</span>
                  <span className="font-bold text-indigo-600">{selectedReturn.debitNoteId || 'Pending Outward'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 p-2 font-bold text-slate-600 border-b border-slate-200">Returned Stock Lots</div>
                <div className="p-3 space-y-2">
                  {selectedReturn.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <div className="font-bold text-slate-700">{getCommodityName(it.commodityId)}</div>
                        <div className="text-[10px] text-slate-500">Batch: {it.batchNo} | Bin: {getBinCode(it.binId)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800">{it.quantity} {it.unit}</div>
                        <div className="text-[10px] text-slate-400">Rate: ₹{it.rate}/Qtl</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow Actions */}
              <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2 w-full">
                <div className="flex gap-2 w-full mb-1">
                  <button
                    onClick={handleOpenView}
                    className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-md shadow-slate-600/10 cursor-pointer transition"
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={handleDeleteReturn}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-755 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10 cursor-pointer transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
                {selectedReturn.status === 'Draft' && (
                  <button 
                    onClick={() => handleWorkflowAction(selectedReturn._id, 'submit')}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play size={14} /> Submit Return
                  </button>
                )}
                {selectedReturn.status === 'Submitted' && currentUserRole === 'Super Admin' && (
                  <>
                    <button 
                      onClick={() => handleWorkflowAction(selectedReturn._id, 'approve')}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button 
                      onClick={() => handleWorkflowAction(selectedReturn._id, 'reject')}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Reject
                    </button>
                  </>
                )}
                {selectedReturn.status === 'Approved' && (
                  <button 
                    onClick={() => handleWorkflowAction(selectedReturn._id, 'dispatch')}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowUpRight size={14} /> Goods Outward (Dispatch)
                  </button>
                )}
                {selectedReturn.status === 'Goods Outward' && (
                  <button 
                    onClick={() => handleWorkflowAction(selectedReturn._id, 'complete')}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CreditCard size={14} /> Complete (Debit Note)
                  </button>
                )}
                {selectedReturn.status === 'Completed' && (
                  <button 
                    onClick={() => handlePrintDebitNote(selectedReturn)}
                    className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer size={14} /> Print Debit Note
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-xs text-slate-400 font-semibold">
              Select a purchase return request to execute approval workflows and view debit notes.
            </div>
          )}
        </div>
      </div>

      {/* CREATE LOG REQUEST MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                <XCircle className="text-rose-600" size={18} />
                <span>{isViewMode ? 'View ' : 'Log '}Purchase Return Request</span>
              </h3>
              <button 
                onClick={() => { setIsCreateOpen(false); setGrnId(''); setIsViewMode(false); }}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateReturn} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Select Arrived GRN *</label>
                    <select
                      className="w-full p-2 border border-slate-200 rounded-lg"
                      value={grnId}
                      onChange={e => setGrnId(e.target.value)}
                      required
                      disabled={isViewMode}
                    >
                      <option value="">-- Choose GRN --</option>
                      {db.grns.map(g => (
                        <option key={g.id} value={g.id}>{g.grnNo} - Vehicle: {g.vehicleNo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Supplier / Farmer</label>
                    <input 
                      type="text"
                      className="w-full p-2 border border-slate-200 bg-slate-100 font-semibold"
                      value={supplierId ? getSupplierName(supplierId) : ''}
                      disabled
                    />
                  </div>
                </div>

                {selectedGrn && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Return Type *</label>
                        <select
                          className="w-full p-2 border border-slate-200 rounded"
                          value={returnType}
                          onChange={e => setReturnType(e.target.value as any)}
                        >
                          <option value="Quality">Quality Return</option>
                          <option value="Full">Full Return</option>
                          <option value="Partial">Partial Return</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Return Reason Category *</label>
                        <select
                          className="w-full p-2 border border-slate-200 rounded"
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                        >
                          <option value="Quality Rejection">Quality Rejection</option>
                          <option value="Damaged Goods">Damaged Goods</option>
                          <option value="Wrong Item">Wrong Item</option>
                          <option value="Excess Quantity">Excess Quantity</option>
                          <option value="Expired Goods">Expired Goods</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Return Quantity (KG) *</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border border-slate-200 rounded"
                          value={returnQty}
                          onChange={e => setReturnQty(Number(e.target.value))}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Original Rate (₹/QTL) *</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border border-slate-200 rounded"
                          value={returnRate}
                          onChange={e => setReturnRate(Number(e.target.value))}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Calculated Refund Value (INR)</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border border-slate-200 bg-slate-100 font-bold text-rose-600"
                          value={grandTotal}
                          disabled
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Return Remarks *</label>
                  <textarea 
                    className="w-full p-2 border border-slate-200 rounded"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
                {isViewMode ? (
                  <button
                    type="button"
                    onClick={() => { setIsCreateOpen(false); setGrnId(''); setIsViewMode(false); }}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold cursor-pointer shadow-md"
                  >
                    Close View
                  </button>
                ) : (
                  <>
                    <button 
                      type="button" 
                      onClick={() => { setIsCreateOpen(false); setGrnId(''); }}
                      className="px-4 py-2 border border-slate-200 rounded text-slate-600 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer"
                    >
                      Save Draft Request
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
