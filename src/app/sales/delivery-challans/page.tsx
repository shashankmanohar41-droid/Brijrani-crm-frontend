'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { DeliveryChallan, SalesOrder, SalesInvoice } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { 
  Truck, Plus, CheckCircle, Navigation, FilePlus, Download, 
  Camera, ExternalLink, X, ZoomIn, Trash2, Wallet, FileText,
  Building2, Handshake, CheckCircle2, ShieldCheck, Scale, UploadCloud, Loader2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../../utils/dateUtils';
import IndianDateInput from '../../../components/shared/IndianDateInput';

function DeliveryChallansPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedDC, setSelectedDC] = useState<DeliveryChallan | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Preview gate photo state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form states for GRN Outward
  const [soId, setSoId] = useState('');
  const [soNo, setSoNo] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [qcId, setQcId] = useState('');
  const [qcNo, setQcNo] = useState('');
  const [orderType, setOrderType] = useState<'GT' | 'WH'>('WH');
  const [customerId, setCustomerId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [transporter, setTransporter] = useState('');
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Sourcing dropdown sources
  const customers = db.customers;
  const commodities = db.commodities;
  const warehouses = db.warehouses;
  const salesOrders = db.salesOrders;
  const salesInvoices = db.salesInvoices;
  const salesQcList = (db as any).salesQcList || db.qualityInspections || [];

  const availableSOs = useMemo(() => {
    return (db.salesOrders || []).filter(s => {
      if (s.status === 'Cancelled') return false;
      if (selectedDC && (selectedDC.soId === s.id || selectedDC.soNo === s.soNo)) {
        return true;
      }
      // Exclude SOs that already have an active Delivery Challan
      const hasDC = (db.deliveryChallans || []).some(dc => 
        (dc.soId === s.id || dc.soNo === s.soNo) && dc.status !== 'Cancelled'
      );
      return !hasDC;
    });
  }, [db.salesOrders, db.deliveryChallans, selectedDC]);

  // Handle URL query parameters
  const soQuery = searchParams.get('so');
  const invQuery = searchParams.get('invoice');
  const qcQuery = searchParams.get('qc');
  const actionQuery = searchParams.get('action');

  const handleSelectSo = (selectedSoId: string) => {
    setSoId(selectedSoId);
    if (!selectedSoId) {
      setSoNo('');
      return;
    }
    const order = db.salesOrders.find(s => s.id === selectedSoId || s.soNo === selectedSoId);
    if (order) {
      setSoNo(order.soNo);
      setOrderType(order.orderType || 'WH');
      setCustomerId(order.customerId);
      setCommodityId(order.commodityId);
      setQuantity(order.quantity);
      setWarehouseId(order.warehouseId || (warehouses[0]?.id || 'WH-01'));
      setDeliveryAddress(order.deliveryLocation);

      // Auto check if linked invoice exists
      const inv = db.salesInvoices.find(i => i.soId === order.id || i.soNo === order.soNo);
      if (inv) {
        setInvoiceId(inv.id);
        setInvoiceNo(inv.invoiceNo);
      }

      // Auto check if linked QC exists
      const qc = salesQcList.find((q: any) => q.soId === order.id || q.soNumber === order.soNo || q.referenceNumber === order.soNo);
      if (qc) {
        setQcId(qc.id || qc.qcNumber);
        setQcNo(qc.qcNumber || qc.qcNo);
        if (qc.vehicleNumber) setVehicleNo(qc.vehicleNumber);
      }
    }
  };

  useEffect(() => {
    if (soQuery) {
      handleSelectSo(soQuery);
      if (invQuery) {
        setInvoiceId(invQuery);
        const foundInv = salesInvoices.find(i => i.id === invQuery || i.invoiceNo === invQuery);
        if (foundInv) setInvoiceNo(foundInv.invoiceNo);
      }
      if (qcQuery) {
        setQcId(qcQuery);
        setQcNo(qcQuery);
      }
      setIsCreateOpen(true);
    } else if (actionQuery === 'new') {
      setIsCreateOpen(true);
    }
  }, [soQuery, invQuery, qcQuery, actionQuery, db.salesOrders, db.salesInvoices]);

  // Compute Net Weight from weighbridge scale
  const netWeight = useMemo(() => {
    if (grossWeight > 0 && tareWeight > 0) {
      return Number(Math.max(0, grossWeight - tareWeight).toFixed(2));
    }
    return quantity;
  }, [grossWeight, tareWeight, quantity]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos: string[] = [];

    Array.from(files).forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          newPhotos.push(event.target.result as string);
          if (newPhotos.length === files.length) {
            setPhotos(prev => [...prev, ...newPhotos]);
            setIsUploading(false);
            showToast(`${files.length} Outward Gate photo(s) attached`, 'success');
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !commodityId || !vehicleNo || !driverName) {
      showToast('Please fill all mandatory fields (Customer, Commodity, Vehicle, Driver)', 'error');
      return;
    }

    const order = soId ? db.salesOrders.find(s => s.id === soId || s.soNo === soId) : null;
    const dcNo = `DC/BR/2026-27/${String(db.deliveryChallans.length + 1).padStart(3, '0')}`;
    const id = `DC-${Date.now()}`;

    const newDc: DeliveryChallan = {
      id,
      dcNo,
      soId: soId || (order ? order.id : `SO-DIRECT-${Date.now()}`),
      soNo: soNo || (order ? order.soNo : 'DIRECT'),
      invoiceId: invoiceId || undefined,
      invoiceNo: invoiceNo || undefined,
      qcId: qcId || undefined,
      qcNo: qcNo || undefined,
      customerId,
      warehouseId: orderType === 'WH' ? warehouseId : undefined,
      orderType,
      vehicleNo,
      driverName,
      transporter,
      grossWeight: grossWeight || quantity + 12,
      tareWeight: tareWeight || 12,
      netWeight: netWeight || quantity,
      commodityId,
      quantity: netWeight || quantity,
      deliveryAddress,
      dispatchDate,
      challanDate: dispatchDate,
      remarks,
      photos,
      outwardStatus: 'Completed',
      status: 'Dispatched'
    };

    // Update Warehouse Stock Inventory (Deduct outgoing stock from storage bin)
    if (orderType === 'WH') {
      const comm = db.commodities.find(c => c.id === commodityId);
      if (comm) {
        comm.stockQty = Math.max(0, comm.stockQty - (netWeight || quantity));
        comm.reservedQty = Math.max(0, (comm.reservedQty || 0) - (netWeight || quantity));
        erpService.commodities.update(comm);
      }
    }

    // Update Sales Order status if linked
    if (order) {
      order.status = 'Shipped';
      erpService.salesOrders.update(order);
    }

    db.deliveryChallans.push(newDc);
    refreshDb();
    setIsCreateOpen(false);
    setSelectedDC(newDc);
    showToast(`GRN Outward (Gate Challan ${dcNo}) generated. Stock deducted from warehouse inventory!`, 'success');
  };

  const handleDownloadPDF = (dc: DeliveryChallan) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 25);
    doc.text("Official Delivery Challan & Weighbridge Gate Outward Slip", 14, 30);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 35, 196, 35);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("GRN OUTWARD (DELIVERY CHALLAN & GATE PASS)", 14, 45);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Challan No:      ${dc.dcNo}`, 14, 53);
    doc.text(`Dispatch Date:   ${formatDate(dc.dispatchDate)}`, 14, 59);
    doc.text(`Sales Order SO:  ${dc.soNo || 'N/A'}`, 14, 65);
    doc.text(`Commercial Inv:  ${dc.invoiceNo || 'N/A'}`, 14, 71);
    doc.text(`QC Slip Ref:     ${dc.qcNo || 'N/A'}`, 14, 77);
    doc.text(`Sourcing Mode:   ${dc.orderType === 'GT' ? 'General Trade (Direct Sourcing)' : 'Warehouse Storage Bins'}`, 14, 83);

    const cust = customers.find(c => c.id === dc.customerId);
    doc.setFont("Helvetica", "bold");
    doc.text("CONSIGNEE / BUYER:", 110, 53);
    doc.setFont("Helvetica", "normal");
    doc.text(cust?.name || 'Customer Name', 110, 59);
    doc.text(`GSTIN: ${cust?.gstin || 'N/A'}`, 110, 65);
    doc.text(`Destination: ${dc.deliveryAddress || 'Customer Facility'}`, 110, 71);

    // Logistics & Weighbridge measurements block
    const tableTop = 95;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Transport & Gate Exit Details", 16, tableTop + 5.5);
    doc.text("Weighbridge Scale Weight", 194, tableTop + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    doc.setFont("Helvetica", "normal");
    doc.text(`Truck Plate Number:  ${dc.vehicleNo}`, 16, tableTop + 16);
    doc.text(`Driver Name:         ${dc.driverName}`, 16, tableTop + 22);
    doc.text(`Transporter Agency:  ${dc.transporter || 'Self Logistics'}`, 16, tableTop + 28);

    doc.text(`Gross Weight: ${(dc.grossWeight || dc.quantity + 12)} MT`, 194, tableTop + 16, { align: "right" });
    doc.text(`Tare Weight:  ${(dc.tareWeight || 12)} MT`, 194, tableTop + 22, { align: "right" });
    doc.setFont("Helvetica", "bold");
    doc.text(`Net Dispatched: ${(dc.netWeight || dc.quantity)} MT`, 194, tableTop + 28, { align: "right" });

    // Item details
    const commName = commodities.find(c => c.id === dc.commodityId)?.name || 'Commodity';
    doc.line(14, tableTop + 34, 196, tableTop + 34);
    doc.text("Dispatched Commodity:", 16, tableTop + 42);
    doc.text(`${commName} — Total Quantity: ${dc.quantity} MT`, 80, tableTop + 42);

    // Signatures
    const sigY = tableTop + 75;
    doc.setFont("Helvetica", "bold");
    doc.text("Gate Security Officer", 20, sigY);
    doc.text("Truck Driver Signature", 80, sigY);
    doc.text("Consignee Receiving Stamp", 140, sigY);
    doc.line(20, sigY + 6, 65, sigY + 6);
    doc.line(80, sigY + 6, 125, sigY + 6);
    doc.line(140, sigY + 6, 185, sigY + 6);

    doc.save(`grn_outward_challan_${dc.dcNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    showToast(`GRN Outward Challan PDF exported successfully`, 'success');
  };

  const filteredChallans = statusFilter === 'All'
    ? db.deliveryChallans
    : db.deliveryChallans.filter(d => d.status === statusFilter);

  const columns: any[] = [
    { header: 'Challan Number', accessor: 'dcNo' as keyof DeliveryChallan, sortable: true },
    { 
      header: 'Trade Mode', 
      accessor: (row: DeliveryChallan) => (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          row.orderType === 'GT' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          {row.orderType === 'GT' ? 'GT' : 'WH'}
        </span>
      )
    },
    { header: 'Order Ref (SO)', accessor: 'soNo' as keyof DeliveryChallan },
    { 
      header: 'Customer', 
      accessor: (row: DeliveryChallan) => db.customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: DeliveryChallan) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Net Weight', accessor: (row: DeliveryChallan) => `${row.netWeight || row.quantity} MT` },
    { header: 'Vehicle Number', accessor: 'vehicleNo' as keyof DeliveryChallan },
    { 
      header: 'Gate Outward Status', 
      accessor: (row: DeliveryChallan) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1 w-fit">
          <CheckCircle2 size={11} />
          {row.status || 'Dispatched'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Truck className="text-primary-600" size={24} />
            <span>GRN Outward (Gate Outward Slips & Delivery Challans)</span>
          </h1>
          <p className="text-xs font-medium text-slate-400">
            Authorize cargo gate exit, record weighbridge gross/tare scale readings, attach vehicle delivery challan slips, and deduct warehouse stock.
          </p>
        </div>
        <button
          onClick={() => {
            setSoId('');
            setSoNo('');
            setInvoiceId('');
            setInvoiceNo('');
            setQcId('');
            setQcNo('');
            setCustomerId('');
            setCommodityId('');
            setQuantity(0);
            setVehicleNo('');
            setDriverName('');
            setTransporter('');
            setGrossWeight(0);
            setTareWeight(0);
            setDeliveryAddress('');
            setPhotos([]);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record Gate Outward (GRN)</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {/* Status Tabs */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-500 overflow-x-auto">
            {['All', 'Dispatched', 'Completed'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40 font-extrabold' 
                    : 'hover:text-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <DataTable
            data={filteredChallans}
            columns={columns}
            searchPlaceholder="Search Challan No, Customer, or Vehicle..."
            searchField="dcNo"
            onRowClick={(row) => setSelectedDC(row)}
            exportFileName="grn_outward_challans_list"
          />
        </div>

        {/* Selected DC Details Drawer */}
        <div>
          {selectedDC ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck size={15} className="text-indigo-600" />
                    <span>{selectedDC.dcNo}</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Dispatched: {formatDate(selectedDC.dispatchDate)}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedDC.status?.toUpperCase() || 'DISPATCHED'}
                </span>
              </div>

              {/* General details */}
              <div className="space-y-2 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-slate-800 font-bold">{customers.find(c => c.id === selectedDC.customerId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sales Order (SO):</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold">{selectedDC.soNo || 'Direct'}</span>
                </div>
                {selectedDC.invoiceNo && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Commercial Invoice:</span>
                    <span className="font-mono text-[10px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-bold">{selectedDC.invoiceNo}</span>
                  </div>
                )}
                {selectedDC.qcNo && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">QC Certificate:</span>
                    <span className="font-mono text-[10px] bg-pink-50 text-pink-800 px-1.5 py-0.5 rounded font-bold">{selectedDC.qcNo}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Truck Plate:</span>
                  <span className="text-slate-800 font-bold">{selectedDC.vehicleNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Driver:</span>
                  <span>{selectedDC.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="truncate max-w-[150px]">{selectedDC.deliveryAddress}</span>
                </div>
              </div>

              {/* Weighbridge measurements */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weighbridge Scale Readings</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-150">
                    <span className="text-[9px] text-slate-400 block font-bold">Gross Wt</span>
                    <span className="font-bold text-slate-800">{selectedDC.grossWeight || selectedDC.quantity + 12} MT</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-150">
                    <span className="text-[9px] text-slate-400 block font-bold">Tare Wt</span>
                    <span className="font-bold text-slate-600">{selectedDC.tareWeight || 12} MT</span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <span className="text-[9px] text-emerald-700 block font-bold">Net Dispatched</span>
                    <span className="font-extrabold text-emerald-800">{selectedDC.netWeight || selectedDC.quantity} MT</span>
                  </div>
                </div>
              </div>

              {/* Attached Photos */}
              {selectedDC.photos && selectedDC.photos.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gate Exit Photos & Slips</span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDC.photos.map((ph, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(ph)}
                        className="aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group relative"
                      >
                        <img src={ph} alt="Challan photo" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <ZoomIn size={14} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => router.push('/sales/invoices')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                >
                  <Wallet size={14} />
                  <span>View Sales Invoice & Receive Payment</span>
                </button>

                <button
                  onClick={() => handleDownloadPDF(selectedDC)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download Gate Outward Challan PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Truck size={24} className="text-slate-300" />
              <span>Select an Outward Gate Slip to verify weighbridge gross/net measurements, gate photos, and customer challan copies.</span>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Truck size={16} className="text-indigo-600" />
                  <span>Record GRN Outward (Delivery Challan & Gate Pass)</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Authorize gate exit, capture scale weighbridge net weight, and deduct warehouse inventory.</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleDispatch} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Approved Sales Order (SO) Reference</label>
                  <select
                    value={soId}
                    onChange={e => handleSelectSo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="">Select Sales Order (Optional)</option>
                    {availableSOs.map(s => (
                      <option key={s.id} value={s.id}>{s.soNo} - {customers.find(c => c.id === s.customerId)?.name} ({s.quantity} MT)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer / Buyer *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Commodity *</label>
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

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sourcing Channel</label>
                  <select
                    value={orderType}
                    onChange={e => setOrderType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  >
                    <option value="WH">WH (Warehouse Silos)</option>
                    <option value="GT">GT (General Trade Direct)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dispatched Qty (MT) *</label>
                  <input
                    type="number"
                    value={quantity || ''}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Truck Plate Number *</label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    placeholder="e.g. BR-01-GB-4592"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Name *</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="e.g. Ramesh Yadav"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transporter Agency</label>
                  <input
                    type="text"
                    value={transporter}
                    onChange={e => setTransporter(e.target.value)}
                    placeholder="Mithila Freight..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                  />
                </div>
              </div>

              {/* Weighbridge scale readings */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weighbridge Scale Calibration</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-1">Gross Weight (MT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={grossWeight || ''}
                      onChange={e => setGrossWeight(Number(e.target.value))}
                      placeholder="e.g. 62.5"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-1">Tare Weight (MT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tareWeight || ''}
                      onChange={e => setTareWeight(Number(e.target.value))}
                      placeholder="e.g. 12.5"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-emerald-700 block mb-1">Net Weight (MT)</label>
                    <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-extrabold text-emerald-800">
                      {netWeight} MT
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Address *</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Industrial Area Phase 2, Patna"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                  required
                />
              </div>

              {/* Gate Exit Photos Upload */}
              <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera size={14} className="text-indigo-600" />
                    <span>Attach Gate Outward Photos & Weighbridge Slips</span>
                  </span>
                  {photos.length > 0 && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {photos.length} Attached
                    </span>
                  )}
                </div>

                <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer bg-white transition">
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                  <UploadCloud size={20} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">Upload truck plate, weighbridge scale slip, and physical challan</span>
                </label>

                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {photos.map((ph, idx) => (
                      <div key={idx} className="aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-200 relative group">
                        <img src={ph} alt="Upload preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  Confirm Gate Outward & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/75 z-[99999] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] bg-black rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <img src={previewImage} alt="Gate Slip Full View" className="max-w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeliveryChallansPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <DeliveryChallansPageContent />
    </React.Suspense>
  );
}
