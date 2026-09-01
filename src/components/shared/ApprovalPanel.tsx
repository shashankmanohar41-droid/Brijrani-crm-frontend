'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Send, ShieldAlert } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { ApprovalHistoryItem } from '../../types/erp';

interface ApprovalPanelProps {
  documentId: string;
  documentNo: string;
  documentTotal: number;
  approvalHistory: ApprovalHistoryItem[];
  status: string;
  onApprove: (comment?: string) => void;
  onReject: (comment?: string) => void;
}

export default function ApprovalPanel({
  documentId,
  documentNo,
  documentTotal,
  approvalHistory,
  status,
  onApprove,
  onReject
}: ApprovalPanelProps) {
  const { currentUserRole, showToast } = useErp();
  const [comment, setComment] = useState('');

  // RBAC validation: Approver must be Super Admin
  const isAuthorized = currentUserRole === 'Super Admin';
  const isPending = status === 'Pending Approval';

  const handleApprove = () => {
    if (!isAuthorized) {
      showToast('Unauthorized: You do not have approval permissions!', 'error');
      return;
    }
    onApprove(comment);
    setComment('');
    showToast(`Document ${documentNo} approved successfully`, 'success');
  };

  const handleReject = () => {
    if (!isAuthorized) {
      showToast('Unauthorized: You do not have approval permissions!', 'error');
      return;
    }
    onReject(comment);
    setComment('');
    showToast(`Document ${documentNo} rejected/cancelled`, 'info');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approval Workflow Panel</h4>
        <div className="flex items-center gap-1">
          {status === 'Approved' || status === 'Received' || status === 'Completed' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 size={12} /> Approved
            </span>
          ) : status === 'Cancelled' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
              <XCircle size={12} /> Cancelled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">
              <Clock size={12} /> Pending Approval
            </span>
          )}
        </div>
      </div>

      {/* Threshold Information */}
      {documentTotal >= 1000000 && isPending && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 flex gap-2">
          <ShieldAlert size={16} className="shrink-0 text-amber-600" />
          <div className="space-y-0.5 font-medium">
            <span className="font-bold">High-Value Approval Threshold Raised</span>
            <p className="leading-normal text-[11px] text-amber-600">
              This document total exceeds ₹10,00,000. It requires manual authorization by a Super Admin before stock and invoicing can proceed.
            </p>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Workflow Log</span>
        <div className="space-y-3.5 border-l-2 border-slate-100 pl-4 ml-2">
          {approvalHistory.map((history, idx) => (
            <div key={idx} className="relative text-xs">
              {/* Timeline marker */}
              <div className="absolute -left-[23px] top-0.5 w-2 h-2 rounded-full bg-slate-300 border border-white" />
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{history.user}</span>
                  <span className="text-[9px] text-slate-400 font-semibold">{history.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">Step:</span>
                  <span className="text-[10px] font-semibold text-slate-600">{history.step}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 rounded text-slate-500 uppercase ml-1">
                    {history.action}
                  </span>
                </div>
                {history.comment && (
                  <p className="text-[11px] italic text-slate-500 bg-slate-50 rounded p-1.5 border border-slate-100/50 mt-1">
                    "{history.comment}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Box (only shown if pending) */}
      {isPending && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Action Center</span>
          
          {isAuthorized ? (
            <div className="space-y-2.5">
              <textarea
                placeholder="Enter remarks/comments for approval or rejection..."
                className="w-full border border-slate-200 focus:border-primary-500 rounded-lg p-2.5 text-xs focus:outline-none bg-white font-medium text-slate-700 min-h-[60px]"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10 transition"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-red-600/10 transition"
                >
                  <XCircle size={14} /> Reject & Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-500 font-medium leading-normal">
              🔒 Approval controls are locked. You are currently viewed as a <span className="font-bold text-slate-700">{currentUserRole}</span>. Switch your role to <span className="font-bold text-slate-700">Super Admin</span> in the top header to authorize this document.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
