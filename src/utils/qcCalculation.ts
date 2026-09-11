import { QualityRebateRule, QCTestedParameter } from '../types/erp';

export interface FrontendCalculationInput {
  commodityId?: string;
  commodityName?: string;
  quantity: number;
  baseRate: number;
  calculationMethod: 'Discount' | 'Pro-Rata' | 'Both';
  rebateType: 'Standard Rebate' | 'Single Rebate' | 'Double Rebate' | 'All' | 'All Types';
  discountRate?: number;
  discountType?: 'PERCENT' | 'FLAT';
  qualityParameters?: Array<{
    parameterName: string;
    actualValue: number;
    unit?: string;
    standardValue?: number;
    tolerance?: number;
  }>;
  applicableRules?: QualityRebateRule[];
  transactionDate?: string | Date;
}

export interface FrontendCalculationOutput {
  baseValue: number;
  parameterCalculations: QCTestedParameter[];
  totalRebate: number;
  totalDeduction: number;
  finalRate: number;
  finalValue: number;
  calculationBreakdown: {
    method: string;
    rebateType: string;
    baseRate: number;
    quantity: number;
    totalRebatePerUnit: number;
    totalDeduction: number;
    finalRate: number;
    finalValue: number;
    summaryText: string;
    details: string[];
  };
  ruleIdsUsed: string[];
}

const round2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export function calculateQualityRebateFrontend(input: FrontendCalculationInput): FrontendCalculationOutput {
  const {
    quantity = 0,
    baseRate = 0,
    calculationMethod = 'Pro-Rata',
    rebateType = 'Standard Rebate',
    discountRate = 0,
    discountType = 'PERCENT',
    qualityParameters = [],
    applicableRules = [],
    transactionDate = new Date()
  } = input;

  const validQty = Math.max(0, Number(quantity) || 0);
  const validBaseRate = Math.max(0, Number(baseRate) || 0);
  const baseValue = round2(validQty * validBaseRate);
  const txDate = new Date(transactionDate);

  const parameterCalculations: QCTestedParameter[] = [];
  const ruleIdsUsed: string[] = [];
  const breakdownDetails: string[] = [];

  let totalRebate = 0;
  let discountAmountPerUnit = 0;

  // 1. EVALUATE COMMERCIAL DISCOUNT (When Method is Discount or Both)
  if (calculationMethod === 'Discount' || calculationMethod === 'Both') {
    let rateVal = Number(discountRate) || 0;
    let effectiveDiscountType = discountType;

    // If discountRate wasn't explicitly provided, auto-read from matching Master Rule in applicableRules
    if (rateVal === 0 && applicableRules && applicableRules.length > 0) {
      const discountMasterRule = applicableRules.find(r => 
        (r.calculationMethod === 'Discount' || r.calculationMethod === 'Both') && (r.status === 'Active' || !r.status)
      );
      if (discountMasterRule) {
        rateVal = Number(discountMasterRule.rebateRate) || 0;
        if (discountMasterRule.rebateBasis === 'Flat Rate per MT') {
          effectiveDiscountType = 'FLAT';
        }
        if (discountMasterRule._id || discountMasterRule.id) {
          ruleIdsUsed.push(String(discountMasterRule._id || discountMasterRule.id));
        }
      }
    }

    if (effectiveDiscountType === 'FLAT') {
      discountAmountPerUnit = round2(rateVal);
      breakdownDetails.push(`Commercial Discount = Flat ₹${discountAmountPerUnit}/unit`);
    } else {
      // PERCENT discount: rateVal >= 0.1 is standard percent (e.g. 1% -> 0.01, 2% -> 0.02, 0.5% -> 0.005),
      // rateVal < 0.1 && rateVal > 0 supports legacy decimal fraction (e.g. 0.02 -> 0.02)
      const pct = rateVal >= 0.1 ? rateVal / 100 : rateVal;
      discountAmountPerUnit = round2(validBaseRate * pct);
      const displayPct = rateVal >= 0.1 ? rateVal : (pct * 100);
      breakdownDetails.push(`Commercial Discount = Base Rate (₹${validBaseRate.toLocaleString('en-IN')}) × Discount Rate (${displayPct.toFixed(2)}%) = ₹${discountAmountPerUnit}/unit`);
    }
  }

  // 2. DISCOUNT-ONLY MODE SHORT-CIRCUIT
  if (calculationMethod === 'Discount') {
    totalRebate = discountAmountPerUnit;
    const finalRate = round2(Math.max(0, validBaseRate - totalRebate));
    const totalDeduction = round2(validQty * totalRebate);
    const finalValue = round2(validQty * finalRate);

    for (const param of qualityParameters) {
      parameterCalculations.push({
        parameterName: param.parameterName,
        unit: param.unit || '%',
        standardValue: param.standardValue ?? 0,
        actualValue: param.actualValue,
        deviation: 0,
        tolerance: param.tolerance ?? 0,
        rebateBasis: 'Discount Calculation',
        rebateRate: Number(discountRate) || 0,
        rebatePerUnit: discountAmountPerUnit,
        rebateTotal: totalDeduction,
        formulaDescription: `Applied via Global Discount Method (₹${discountAmountPerUnit}/unit)`,
        status: 'PASS'
      });
    }

    const summaryText = `Discount calculation: Base ₹${validBaseRate.toLocaleString('en-IN')} - Discount ₹${totalRebate} = Final Rate ₹${finalRate.toLocaleString('en-IN')}/unit. Total = ₹${finalValue.toLocaleString('en-IN')}`;

    return {
      baseValue,
      parameterCalculations,
      totalRebate,
      totalDeduction,
      finalRate,
      finalValue,
      calculationBreakdown: {
        method: 'Discount',
        rebateType,
        baseRate: validBaseRate,
        quantity: validQty,
        totalRebatePerUnit: totalRebate,
        totalDeduction,
        finalRate,
        finalValue,
        summaryText,
        details: breakdownDetails
      },
      ruleIdsUsed
    };
  }

  // 3. PRO-RATA / HYBRID (BOTH) PARAMETER EVALUATION
  let paramsToProcess = qualityParameters;
  if (rebateType === 'Single Rebate') {
    paramsToProcess = qualityParameters.slice(0, 1);
  } else if (rebateType === 'Double Rebate') {
    paramsToProcess = qualityParameters.slice(0, 2);
  }

  let proRataRebateTotal = 0;

  for (const param of paramsToProcess) {
    const matchingRule = applicableRules.find(rule => {
      const nameMatch = rule.parameterName?.toLowerCase() === param.parameterName?.toLowerCase();
      if (!nameMatch) return false;
      if (rule.status && rule.status !== 'Active') return false;
      if (rule.effectiveFrom) {
        const fromDate = new Date(rule.effectiveFrom);
        if (txDate < fromDate) return false;
      }
      if (rule.effectiveTo) {
        const toDate = new Date(rule.effectiveTo);
        toDate.setHours(23, 59, 59, 999);
        if (txDate > toDate) return false;
      }
      return true;
    });

    if (matchingRule && (matchingRule._id || matchingRule.id)) {
      ruleIdsUsed.push(String(matchingRule._id || matchingRule.id));
    }

    const standardValue = matchingRule ? Number(matchingRule.standardValue) : Number(param.standardValue ?? 0);
    const tolerance = matchingRule ? Number(matchingRule.tolerance ?? 0) : Number(param.tolerance ?? 0);
    const actualValue = Number(param.actualValue ?? 0);
    const unit = matchingRule?.unit || param.unit || '%';

    const direction = matchingRule?.direction || (
      param.parameterName.toLowerCase().includes('protein') || param.parameterName.toLowerCase().includes('oil')
        ? 'LOWER_IS_WORSE'
        : 'HIGHER_IS_WORSE'
    );

    let rawDeviation = 0;
    if (direction === 'LOWER_IS_WORSE') {
      rawDeviation = round2(standardValue - actualValue);
    } else {
      rawDeviation = round2(actualValue - standardValue);
    }

    let rebatePerUnit = 0;
    let formulaDesc = '';
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (rawDeviation <= 0) {
      rebatePerUnit = 0;
      formulaDesc = `Actual (${actualValue}${unit}) meets Standard (${standardValue}${unit}) -> No Rebate (₹0/unit)`;
      status = 'PASS';
    } else if (rawDeviation <= tolerance) {
      rebatePerUnit = 0;
      formulaDesc = `Deviation (${rawDeviation.toFixed(2)}${unit}) within Tolerance (${tolerance}${unit}) -> Grace buffer (₹0/unit)`;
      status = 'PASS';
    } else {
      const netDeviation = round2(rawDeviation - tolerance);
      status = rawDeviation > 5 ? 'FAIL' : 'WARN';

      if (matchingRule && Array.isArray(matchingRule.slabs) && matchingRule.slabs.length > 0) {
        const matchingSlab = matchingRule.slabs.find((s: any) =>
          rawDeviation >= Number(s.minDeviation) && rawDeviation <= Number(s.maxDeviation)
        );

        if (matchingSlab) {
          const slabRate = Number(matchingSlab.rebateRate) || 0;
          if (matchingSlab.rateType === 'Fixed Amount') {
            rebatePerUnit = round2(slabRate);
            formulaDesc = `Deviation (${rawDeviation.toFixed(2)}${unit}) matches Slab [${matchingSlab.minDeviation}-${matchingSlab.maxDeviation}${unit}] -> Flat ₹${rebatePerUnit}/unit`;
          } else if (matchingSlab.rateType === 'Percentage') {
            rebatePerUnit = round2((validBaseRate * slabRate) / 100);
            formulaDesc = `Deviation (${rawDeviation.toFixed(2)}${unit}) matches Slab [${matchingSlab.minDeviation}-${matchingSlab.maxDeviation}${unit}] @ ${slabRate}% = ₹${rebatePerUnit}/unit`;
          } else {
            rebatePerUnit = round2(netDeviation * slabRate);
            formulaDesc = `Deviation (${rawDeviation.toFixed(2)}${unit}) in Slab [${matchingSlab.minDeviation}-${matchingSlab.maxDeviation}${unit}]: Net Dev (${netDeviation.toFixed(2)}${unit}) × ₹${slabRate} = ₹${rebatePerUnit}/unit`;
          }
        } else {
          const fallbackRate = Number(matchingRule.rebateRate) || 0;
          rebatePerUnit = round2(netDeviation * fallbackRate);
          formulaDesc = `Deviation (${rawDeviation.toFixed(2)}${unit}) beyond slabs: Net Dev (${netDeviation.toFixed(2)}${unit}) × Base Rate ₹${fallbackRate} = ₹${rebatePerUnit}/unit`;
        }
      } else if (matchingRule && matchingRule.rebateBasis === 'Percentage of Base Rate') {
        const pctRate = Number(matchingRule.rebateRate) || 0;
        rebatePerUnit = round2((validBaseRate * (pctRate / 100)) * netDeviation);
        formulaDesc = `Net Dev (${netDeviation.toFixed(2)}${unit}) × ${pctRate}% of Base (₹${validBaseRate}) = ₹${rebatePerUnit}/unit`;
      } else if (matchingRule && matchingRule.rebateBasis === 'Flat Rate per MT') {
        rebatePerUnit = round2(Number(matchingRule.rebateRate) || 0);
        formulaDesc = `Flat Rebate = ₹${rebatePerUnit}/unit`;
      } else {
        const unitRate = matchingRule ? Number(matchingRule.rebateRate) || 0 : 0;
        rebatePerUnit = round2(netDeviation * unitRate);
        formulaDesc = `Net Dev (${netDeviation.toFixed(2)}${unit}) × ₹${unitRate}/unit = ₹${rebatePerUnit}/unit`;
      }
    }

    const rebateTotal = round2(validQty * rebatePerUnit);
    proRataRebateTotal += rebatePerUnit;

    breakdownDetails.push(
      `${param.parameterName} (${matchingRule?.ruleCode || 'Master Rule'}): Standard ${standardValue}${unit}, Actual ${actualValue}${unit} | Dev: ${rawDeviation > 0 ? '+' : ''}${rawDeviation.toFixed(2)}${unit} (Tol: ±${tolerance}${unit}) -> ${formulaDesc}`
    );

    parameterCalculations.push({
      parameterName: param.parameterName,
      unit,
      standardValue,
      actualValue,
      deviation: rawDeviation,
      tolerance,
      applicableRuleId: matchingRule?._id || matchingRule?.id,
      ruleCode: matchingRule?.ruleCode || 'DEFAULT-RULE',
      rebateBasis: matchingRule?.rebateBasis || 'Per % Deviation',
      rebateRate: matchingRule?.rebateRate || 0,
      rebatePerUnit,
      rebateTotal,
      formulaDescription: formulaDesc,
      status
    });
  }

  // Combine Pro-Rata + Discount (for Both)
  totalRebate = round2(proRataRebateTotal + discountAmountPerUnit);
  const totalDeduction = round2(validQty * totalRebate);
  const finalRate = round2(Math.max(0, validBaseRate - totalRebate));
  const finalValue = round2(validQty * finalRate);

  const summaryText = calculationMethod === 'Both'
    ? `Hybrid Settlement (${rebateType}): Base Rate ₹${validBaseRate.toLocaleString('en-IN')} - (QC Rebate ₹${proRataRebateTotal} + Discount ₹${discountAmountPerUnit}) = Final Rate ₹${finalRate.toLocaleString('en-IN')}/unit. Final Value = ₹${finalValue.toLocaleString('en-IN')}`
    : `Pro-Rata (${rebateType}): Base Rate ₹${validBaseRate.toLocaleString('en-IN')} - Total Rebate ₹${totalRebate} = Final Rate ₹${finalRate.toLocaleString('en-IN')}/unit. Final Value = ₹${finalValue.toLocaleString('en-IN')}`;

  return {
    baseValue,
    parameterCalculations,
    totalRebate,
    totalDeduction,
    finalRate,
    finalValue,
    calculationBreakdown: {
      method: calculationMethod,
      rebateType,
      baseRate: validBaseRate,
      quantity: validQty,
      totalRebatePerUnit: totalRebate,
      totalDeduction,
      finalRate,
      finalValue,
      summaryText,
      details: breakdownDetails
    },
    ruleIdsUsed
  };
}
