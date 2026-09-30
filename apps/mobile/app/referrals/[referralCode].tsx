import { Redirect, useLocalSearchParams } from "expo-router";

const referralPattern = /^REF-[A-HJ-NP-Z2-9]{6}$/;

export default function ReferralLink() {
  const { referralCode } = useLocalSearchParams<{ referralCode?: string }>();
  if (!referralCode || !referralPattern.test(referralCode)) return <Redirect href="/+not-found" />;
  return <Redirect href={{ pathname: "/(auth)/register", params: { ref: referralCode } }} />;
}
