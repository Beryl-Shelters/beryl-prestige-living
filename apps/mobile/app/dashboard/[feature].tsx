import { Redirect, useLocalSearchParams } from "expo-router";

export default function DashboardFeature() {
  const { feature } = useLocalSearchParams<{ feature: string }>();

  if (feature === "messages") {
    return <Redirect href="/dashboard/messages" />;
  }
  if (feature === "settings") {
    return <Redirect href="/dashboard/settings" />;
  }
  if (feature === "kyc") {
    return <Redirect href="/dashboard/kyc" />;
  }
  if (feature === "saved-properties") {
    return <Redirect href="/saved-properties" />;
  }
  if (feature === "referrals") {
    return <Redirect href="/dashboard/referrals" />;
  }

  return <Redirect href="/+not-found" />;
}
