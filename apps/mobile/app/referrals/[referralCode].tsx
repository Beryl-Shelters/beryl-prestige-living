import { useLocalSearchParams } from "expo-router";
import { FeaturePlaceholder } from "@/components/feature-placeholder";
export default function ReferralLink(){const {referralCode}=useLocalSearchParams<{referralCode:string}>();return <FeaturePlaceholder title="Beryl referral" description={`Referral code: ${referralCode??"Unavailable"}`} phase="Phase 5"/>}
