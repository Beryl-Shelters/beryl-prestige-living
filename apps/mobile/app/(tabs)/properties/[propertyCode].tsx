import { useLocalSearchParams } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
export default function PropertyDetailRoute(){const {propertyCode}=useLocalSearchParams<{propertyCode:string}>();return <FeaturePlaceholder title="Property details" description={`Canonical property code: ${propertyCode??"Unavailable"}`} phase="Phase 2"/>}
