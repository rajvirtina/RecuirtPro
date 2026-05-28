/**
 * Salary formatting utilities for INR/LPA display.
 * Converts raw annual amounts → "₹12 LPA", "₹1.5 LPA" etc.
 */

export interface SalaryRange {
  min?: number;
  max?: number;
  amount?: number;
  currency?: string;
  frequency?: 'annual' | 'monthly';
}

/** Convert any annual INR amount to LPA string (e.g. 1200000 → "₹12 LPA") */
export function formatLPA(annualAmountINR: number): string {
  const lpa = annualAmountINR / 100_000;
  const display = lpa % 1 === 0 ? lpa.toString() : lpa.toFixed(1).replace(/\.0$/, '');
  return `₹${display} LPA`;
}

/** Format a full salary object for display */
export function formatSalary(salary: SalaryRange): string {
  if (!salary) return 'Not specified';

  const isINR = !salary.currency || salary.currency.toUpperCase() === 'INR';
  const isAnnual = !salary.frequency || salary.frequency === 'annual';

  if (salary.min !== undefined && salary.max !== undefined) {
    if (isINR && isAnnual) {
      return `${formatLPA(salary.min)} – ${formatLPA(salary.max)}`;
    }
    const sym = currencySymbol(salary.currency);
    const freq = salary.frequency === 'monthly' ? '/mo' : '/yr';
    return `${sym}${salary.min.toLocaleString()} – ${sym}${salary.max.toLocaleString()}${freq}`;
  }

  if (salary.amount !== undefined) {
    const annualAmt = isAnnual ? salary.amount : salary.amount * 12;
    if (isINR) return formatLPA(annualAmt);
    const sym = currencySymbol(salary.currency);
    const freq = salary.frequency === 'monthly' ? '/mo' : '/yr';
    return `${sym}${salary.amount.toLocaleString()}${freq}`;
  }

  return 'Not specified';
}

function currencySymbol(currency?: string): string {
  const map: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$',
  };
  return map[(currency || '').toUpperCase()] ?? (currency ? `${currency} ` : '');
}
