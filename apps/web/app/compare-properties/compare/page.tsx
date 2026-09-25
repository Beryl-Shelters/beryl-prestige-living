import { Suspense } from "react";
import { CompareResultsPage } from "../../../components/public/compare-results-page";
import "../compare-properties.css";

export default function Page(){return <Suspense fallback={null}><CompareResultsPage/></Suspense>}
