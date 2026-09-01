'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface TimelineStep {
  name: string;
  description?: string;
}

interface DocumentTimelineProps {
  steps: TimelineStep[];
  currentStepName: string; // The step we are currently at
  activeStepName?: string;  // The step currently selected by user to view details
  onStepClick?: (stepName: string) => void;
  isCompleted?: boolean;   // If the whole workflow is 100% finished
}

export default function DocumentTimeline({ 
  steps, 
  currentStepName, 
  activeStepName, 
  onStepClick, 
  isCompleted = false 
}: DocumentTimelineProps) {
  // Find current step index
  const currentIdx = steps.findIndex(s => s.name.toLowerCase() === currentStepName.toLowerCase());

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">Document Lifecycle Timeline</h4>
      
      {/* Horizontal Steps Layout */}
      <div className="flex items-center justify-between relative select-none overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const isPassed = isCompleted || idx < currentIdx;
          const isCurrent = !isCompleted && idx === currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <React.Fragment key={step.name}>
              {/* Step Circle & Details */}
              <div 
                onClick={() => onStepClick?.(step.name)}
                className={`flex flex-col items-center flex-1 min-w-[90px] relative z-10 text-center ${
                  onStepClick ? 'cursor-pointer group' : ''
                }`}
              >
                {/* Node circle */}
                <div 
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 ${
                    isPassed 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                      : isCurrent 
                      ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-600/20 ring-4 ring-primary-100' 
                      : 'bg-white border-slate-200 text-slate-400'
                  } ${
                    activeStepName === step.name 
                      ? 'ring-2 ring-primary-500 ring-offset-2 scale-110' 
                      : 'group-hover:scale-105'
                  }`}
                >
                  {isPassed ? <Check size={12} className="stroke-[3]" /> : idx + 1}
                </div>

                {/* Labels */}
                <span 
                  className={`text-[10px] font-bold mt-2.5 block truncate max-w-[120px] ${
                    activeStepName === step.name 
                      ? 'text-primary-600 font-bold underline decoration-2 underline-offset-4' 
                      : isCurrent 
                      ? 'text-primary-600 font-bold' 
                      : isPassed 
                      ? 'text-slate-700 font-semibold' 
                      : 'text-slate-400 font-medium'
                  }`}
                >
                  {step.name}
                </span>
                
                {step.description && (
                  <span className="text-[8px] text-slate-400 block mt-0.5 leading-none font-semibold">
                    {step.description}
                  </span>
                )}
              </div>

              {/* Connecting Bar */}
              {idx < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-slate-100 relative -top-3.5 min-w-[20px]">
                  <div 
                    className={`h-full bg-emerald-500 transition-all duration-500`}
                    style={{ width: isPassed ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
