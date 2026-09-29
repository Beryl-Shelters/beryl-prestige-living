import { useLocalSearchParams } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
const labels: Record<string, [string, string]> = {
  messages: ["Messages", "Phase 5"],
  "saved-properties": ["Saved Properties", "Phase 2"],
  settings: ["Settings", "Phase 6"],
  kyc: ["KYC", "Phase 6"],
};
export default function DashboardFeature(){const {feature}=useLocalSearchParams<{feature:string}>();const [title,phase]=labels[feature??""]??["Customer Account","Later phase"];return <FeaturePlaceholder title={title} description="This destination is connected to authenticated customer navigation." phase={phase} authenticated/>}
