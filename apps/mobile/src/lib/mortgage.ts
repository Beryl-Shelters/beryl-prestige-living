export const mortgageTerms = [5, 10, 15, 20, 25, 30] as const;
export type MortgageCalculation = { monthlyPaymentMinor: number; totalRepaymentMinor: number; totalInterestMinor: number };

export function calculateMortgage(purchasePriceMinor: number, downPaymentMinor: number, years: number, annualRatePercent: number): MortgageCalculation {
  const principal = Math.max(0, purchasePriceMinor - downPaymentMinor);
  const months = years * 12;
  if (principal === 0) return { monthlyPaymentMinor: 0, totalRepaymentMinor: 0, totalInterestMinor: 0 };
  if (annualRatePercent === 0) return { monthlyPaymentMinor: Math.round(principal / months), totalRepaymentMinor: principal, totalInterestMinor: 0 };
  const monthlyRate = annualRatePercent / 100 / 12;
  const growth = (1 + monthlyRate) ** months;
  const monthlyPayment = principal * (monthlyRate * growth) / (growth - 1);
  const totalRepaymentMinor = Math.round(monthlyPayment * months);
  return { monthlyPaymentMinor: Math.round(monthlyPayment), totalRepaymentMinor, totalInterestMinor: totalRepaymentMinor - principal };
}
