import { Suspense } from "react";
import { ComparePropertiesPage } from "../../components/public/compare-properties-page";
import "./compare-properties.css";

export default function Page(){return <Suspense fallback={null}><ComparePropertiesPage/></Suspense>}
