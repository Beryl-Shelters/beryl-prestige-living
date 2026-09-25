"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { formatNairaInput, nairaToKobo } from "../../lib/buy-query";
import { fetchPublicProperties } from "../../lib/public-properties-api";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

const loanTerms = [5, 10, 15, 20, 25, 30] as const;
type Calculation = { monthlyPaymentMinor: number; totalRepaymentMinor: number; totalInterestMinor: number };

function inputFromMinor(value: number) {
  const whole = Math.floor(value / 100);
  return formatNairaInput(`${whole}.${String(value % 100).padStart(2, "0")}`) ?? "";
}

function formatMortgageNaira(value: number) {
  const minor = BigInt(value);
  return `₦${new Intl.NumberFormat("en-NG").format(Number(minor / 100n))}.${(minor % 100n).toString().padStart(2, "0")}`;
}

export function calculateMortgage(purchasePriceMinor: number, downPaymentMinor: number, years: number, annualRatePercent: number): Calculation {
  const principal = Math.max(0, purchasePriceMinor - downPaymentMinor);
  const months = years * 12;
  if (principal === 0) return { monthlyPaymentMinor: 0, totalRepaymentMinor: 0, totalInterestMinor: 0 };
  if (annualRatePercent === 0) {
    return { monthlyPaymentMinor: Math.round(principal / months), totalRepaymentMinor: principal, totalInterestMinor: 0 };
  }
  const monthlyRate = annualRatePercent / 100 / 12;
  const growth = (1 + monthlyRate) ** months;
  const monthlyPayment = principal * (monthlyRate * growth) / (growth - 1);
  const totalRepaymentMinor = Math.round(monthlyPayment * months);
  return { monthlyPaymentMinor: Math.round(monthlyPayment), totalRepaymentMinor, totalInterestMinor: totalRepaymentMinor - principal };
}

export function MortgageCalculatorPage() {
  const params = useSearchParams();
  const propertyCode = (params.get("code") ?? "").trim();
  const [prefillMinor, setPrefillMinor] = useState<number | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [loanTerm, setLoanTerm] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calculation, setCalculation] = useState<Calculation | null>(null);

  useEffect(() => {
    if (!propertyCode || propertyCode.length > 80) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ q: propertyCode, page: "1", pageSize: "10" });
    void fetchPublicProperties(query, controller.signal).then(result => {
      const property = result.items.find(item => item.code.toLowerCase() === propertyCode.toLowerCase());
      if (!controller.signal.aborted && property) {
        setPrefillMinor(property.priceMinor);
        setPurchasePrice(inputFromMinor(property.priceMinor));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [propertyCode]);

  const purchaseMinor = useMemo(() => nairaToKobo(purchasePrice), [purchasePrice]);
  const downMinor = useMemo(() => downPayment.trim() === "" ? null : nairaToKobo(downPayment), [downPayment]);
  const downPercentage = purchaseMinor !== null && downMinor !== null && BigInt(purchaseMinor) > 0n
    ? Number(BigInt(downMinor)) / Number(BigInt(purchaseMinor)) * 100 : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const price = purchaseMinor === null ? null : Number(purchaseMinor);
    const down = downMinor === null ? null : Number(downMinor);
    const years = Number(loanTerm);
    const rate = interestRate.trim() === "" ? Number.NaN : Number(interestRate);
    if (price === null || price <= 0) nextErrors.purchasePrice = "Enter a valid Home Purchase Price greater than zero.";
    if (down === null || down < 0) nextErrors.downPayment = "Enter a valid non-negative Down Payment.";
    else if (price !== null && down > price) nextErrors.downPayment = "Down Payment cannot exceed Home Purchase Price.";
    if (!loanTerms.includes(years as typeof loanTerms[number])) nextErrors.loanTerm = "Select a valid Loan Term.";
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) nextErrors.interestRate = "Enter an Interest Rate from 0 to 100%.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || price === null || down === null) { setCalculation(null); return; }
    setCalculation(calculateMortgage(price, down, years, rate));
  }

  function reset() {
    setPurchasePrice(prefillMinor === null ? "" : inputFromMinor(prefillMinor));
    setDownPayment(""); setLoanTerm(""); setInterestRate(""); setErrors({}); setCalculation(null);
  }

  const result = calculation ?? { monthlyPaymentMinor: 0, totalRepaymentMinor: 0, totalInterestMinor: 0 };
  return <div className="mortgage-page"><PublicHeader sessionAware mobileMenu/><main>
    <section className="mortgage-intro"><p>MORTGAGE CALCULATOR</p><h1>Estimate how much house you can afford</h1><div>Enter the price of the home, your down payment, and a few details about your new home and loan terms to estimate your monthly payment breakdown.</div></section>
    <div className="mortgage-layout">
      <form className="mortgage-form-card" onSubmit={submit} noValidate><div className="mortgage-card-heading"><h2>Mortgage Calculator</h2><button type="button" onClick={reset}>Reset</button></div>
        <div className="mortgage-field"><label htmlFor="purchase-price">Home Purchase Price <span>*</span></label><div className="mortgage-control"><b>NGN</b><input id="purchase-price" name="purchasePrice" inputMode="decimal" autoComplete="off" placeholder="Enter amount" value={purchasePrice} aria-invalid={!!errors.purchasePrice} aria-describedby={`purchase-help${errors.purchasePrice?" purchase-error":""}`} onChange={event=>{const value=formatNairaInput(event.target.value);if(value!==null)setPurchasePrice(value)}}/></div><p id="purchase-help">This is the price of the property you are currently viewing.</p>{errors.purchasePrice&&<p className="mortgage-error" id="purchase-error">{errors.purchasePrice}</p>}</div>
        <div className="mortgage-field"><label htmlFor="down-payment">Down Payment <span>*</span></label><div className="mortgage-control"><b>NGN</b><input id="down-payment" name="downPayment" inputMode="decimal" autoComplete="off" placeholder="Enter amount" value={downPayment} aria-invalid={!!errors.downPayment} aria-describedby={`down-help${errors.downPayment?" down-error":""}`} onChange={event=>{const value=formatNairaInput(event.target.value);if(value!==null)setDownPayment(value)}}/><output className="mortgage-percentage" htmlFor="down-payment purchase-price">{Number.isFinite(downPercentage)?downPercentage.toFixed(2):"0.00"} %</output></div><p id="down-help">Enter the amount you can pay upfront towards this property&apos;s purchase</p>{errors.downPayment&&<p className="mortgage-error" id="down-error">{errors.downPayment}</p>}</div>
        <div className="mortgage-field"><label htmlFor="loan-term">Loan Term <span>*</span></label><select id="loan-term" name="loanTerm" value={loanTerm} aria-invalid={!!errors.loanTerm} aria-describedby={`term-help${errors.loanTerm?" term-error":""}`} onChange={event=>setLoanTerm(event.target.value)}><option value="">Select Loan Duration</option>{loanTerms.map(years=><option value={years} key={years}>{years} years</option>)}</select><p id="term-help">Specify the length of time over which you&apos;ll pay the loan</p>{errors.loanTerm&&<p className="mortgage-error" id="term-error">{errors.loanTerm}</p>}</div>
        <div className="mortgage-field"><label htmlFor="interest-rate">Interest Rate <span>*</span></label><div className="mortgage-control"><b>%</b><input id="interest-rate" name="interestRate" inputMode="decimal" autoComplete="off" placeholder="Enter Interest Rate" value={interestRate} aria-invalid={!!errors.interestRate} aria-describedby={`rate-help${errors.interestRate?" rate-error":""}`} onChange={event=>setInterestRate(event.target.value)}/></div><p id="rate-help">This is the interest rate for your loan, which affects your monthly payments.</p>{errors.interestRate&&<p className="mortgage-error" id="rate-error">{errors.interestRate}</p>}</div>
        <button className="mortgage-calculate" type="submit">Calculate</button>
      </form>
      <section className="mortgage-result-card" aria-live="polite" aria-label="Mortgage calculation results"><h2>Estimated Monthly Payment</h2><strong>{formatMortgageNaira(result.monthlyPaymentMinor)}</strong><div><dl><div><dt>Total Repayment Amount</dt><dd>{formatMortgageNaira(result.totalRepaymentMinor)}</dd></div><div><dt>Total Interest to pay</dt><dd>{formatMortgageNaira(result.totalInterestMinor)}</dd></div></dl></div><p>Estimate only. This is not a mortgage offer, approval, or financial advice.</p></section>
    </div>
  </main><PublicSiteFooter/></div>;
}
