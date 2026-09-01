'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { formatDate } from '../../../utils/dateUtils';
import DataTable from '../../../components/shared/DataTable';
import { Layers, Printer, Barcode, CheckCircle } from 'lucide-react';

function PackingPageContent() {
  const { db } = useErp();
  const [selectedPack, setSelectedPack] = useState<any>(null);

  const customers = db.customers;
  const commodities = db.commodities;

  const columns: any[] = [
    { header: 'Packing No', accessor: 'packingNo', sortable: true },
    { header: 'SO Number', accessor: 'soNo' },
    { 
      header: 'Customer', 
      accessor: (row: any) => customers.find(c => c.id === row.customerId)?.name || 'Unknown'
    },
    { 
      header: 'Commodity', 
      accessor: (row: any) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Quantity (MT)', accessor: 'quantity' },
    { header: 'Packages', accessor: (row: any) => `${row.numPackages} (${row.packageType})` },
    { header: 'Weight (MT)', accessor: 'weight' },
    { header: 'Date', accessor: (row: any) => formatDate(row.packingDate) },
    {
      header: 'Status',
      accessor: (row: any) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-250">
          Completed
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Packing Slips</h1>
        <p className="text-xs font-medium text-slate-400">Generate PP Bag package labels, manage gross/tare weights, and inspect sealed shipment labels.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.packingSlips || []}
            columns={columns}
            searchPlaceholder="Search packing slip number..."
            searchField="packingNo"
            onRowClick={(row) => setSelectedPack(row)}
            exportFileName="packing_slips_register"
          />
        </div>

        {/* Selected Package Label View */}
        <div>
          {selectedPack ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedPack.packingNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Date: {formatDate(selectedPack.packingDate)}</span>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg text-xs font-bold transition"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
              </div>

              {/* Package Label Card Graphic */}
              <div className="bg-slate-50 border border-slate-250 rounded-xl p-5 text-xs font-semibold space-y-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 bg-primary-600 text-white text-[9px] px-2 py-0.5 rounded-bl font-bold uppercase tracking-wider">
                  Verified Pack
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Consignee Details</span>
                  <span className="text-slate-800 font-bold block">{customers.find(c => c.id === selectedPack.customerId)?.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] border-t border-b border-slate-200/60 py-3 text-slate-700">
                  <div>
                    <span className="text-[9px] text-slate-450 block font-bold uppercase">Commodity</span>
                    <span className="font-bold text-slate-800">{commodities.find(c => c.id === selectedPack.commodityId)?.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block font-bold uppercase">Batch Number</span>
                    <span className="font-mono text-slate-800">{selectedPack.batchNo}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block font-bold uppercase">Net Weight</span>
                    <span>{selectedPack.weight} MT</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block font-bold uppercase">Bag Quantity</span>
                    <span>{selectedPack.numPackages} Bags</span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-1.5 pt-2">
                  <Barcode size={44} className="text-slate-750" />
                  <span className="text-[9px] font-mono text-slate-450 tracking-wider">*{selectedPack.packingNo}*</span>
                </div>
              </div>

              <div className="bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-lg p-3 text-xs flex items-center gap-2 font-bold">
                <CheckCircle size={15} />
                <span>Sealed PP Bags weight verified against silo load cell readings</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-xl p-8 text-center text-xs text-slate-450 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <Layers size={24} className="text-slate-300" />
              <span>Select a Packing Slip to view consignment details, print shipping labels, and verify barcodes.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SalesPackingPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <PackingPageContent />
    </React.Suspense>
  );
}
