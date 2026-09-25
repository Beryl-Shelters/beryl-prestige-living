import { Suspense } from "react";
import { MortgageCalculatorPage } from "../../components/public/mortgage-calculator-page";
import "./mortgage-calculator.css";

export default function Page(){return <Suspense fallback={null}><MortgageCalculatorPage/></Suspense>}
