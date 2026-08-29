import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getReferralContext } from "@/api/referrals";
import { CopyReferralLink, ReferralButton, ReferralPage, ReferralState } from "@/components/referrals/referral-ui";
import { referralQueryKeys } from "@/referrals/query-keys";
import { referralRoutes } from "@/referrals/helpers";
import { useCustomerSession } from "@/store/auth-flow";
import { colors, radii, spacing } from "@/theme/tokens";
import type { ReferralContext } from "@/types/referrals";

export function ReferralLandingScreen() {
  const router = useRouter();
  const session = useCustomerSession();
  const context = useQuery({
    queryKey: referralQueryKeys.context(session.isAuthenticated),
    enabled: !session.isHydrating,
    queryFn: () => session.isAuthenticated
      ? session.authenticatedRequest<ReferralContext>("/referrals/context", "GET")
      : getReferralContext()
  });
  const referrer = context.data?.data?.referrer;
  if (context.isLoading || session.isHydrating) return <ReferralPage background={colors.canvas}><ReferralState loading title="Preparing your referral page" copy="Your referral link and options will appear here."/></ReferralPage>;
  if (context.isError) return <ReferralPage background={colors.canvas}><ReferralState title="We could not load referrals" copy="Check your connection and try again." onRetry={() => void context.refetch()}/></ReferralPage>;
  return <ReferralPage background={colors.canvas}>
    <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Close referral page" onPress={() => router.canGoBack() ? router.back() : router.replace("/marketplace")} style={styles.close}><Feather name="x" size={22} color={colors.brown}/></Pressable><Pressable accessibilityRole="button" onPress={() => router.push(session.isAuthenticated ? referralRoutes.dashboard : referralRoutes.tracking)} style={styles.how}><Text style={styles.howText}>{session.isAuthenticated ? "Your referrals" : "Track referrals"}</Text></Pressable></View>
    <View style={styles.hero}><Image accessibilityLabel="A person holding a house-shaped gift" source={require("../../../assets/referrals/referral-hero.png")} resizeMode="contain" style={styles.heroImage}/></View>
    <View style={styles.sheet}>
      <Text accessibilityRole="header" style={styles.title}>Refer someone and{`\n`}earn up to <Text style={styles.gold}>₦2,500,000.</Text></Text>
      <Text style={styles.copy}>Know anyone buying or selling property in Nigeria? Introduce them to Beryl and earn up to 25% when the deal closes. No account needed. Takes a minute. Refer as many as you like.</Text>
      <View style={styles.linkSection}><Text style={styles.label}>Copy and share your referral link</Text>{referrer ? <CopyReferralLink value={referrer.referralLink}/> : <View style={styles.guestLink}><Feather name="link-2" size={18} color={colors.brown}/><Text style={styles.guestLinkText}>Your personal link is created after your first referral.</Text></View>}</View>
      <View style={styles.or}><View style={styles.line}/><Text style={styles.orText}>or</Text><View style={styles.line}/></View>
      <View style={styles.direct}><Text style={styles.directTitle}>Refer them directly</Text><Text style={styles.directCopy}>Give us their name & contact, and we&apos;ll reach out.</Text><View style={styles.directAction}><ReferralButton outline label="Fill in their details" onPress={() => router.push(referralRoutes.newReferral)}/></View></View>
    </View>
  </ReferralPage>;
}

const styles = StyleSheet.create({
  topBar: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, how: { minHeight: 40, borderRadius: radii.pill, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#f1d992" }, howText: { fontSize: 12, fontWeight: "700", color: colors.brown },
  hero: { height: 218, alignItems: "center", justifyContent: "flex-end" }, heroImage: { width: 205, height: 214 }, sheet: { marginHorizontal: -spacing.lg, marginBottom: -spacing.xxl, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: spacing.lg, paddingTop: 25, paddingBottom: spacing.xxl, backgroundColor: colors.white },
  title: { fontSize: 27, lineHeight: 34, letterSpacing: -.7, fontWeight: "900", color: colors.ink }, gold: { color: "#9b6b12" }, copy: { marginTop: 9, fontSize: 13, lineHeight: 20, color: colors.ink }, linkSection: { marginTop: 64 }, label: { marginBottom: 8, fontSize: 12, color: colors.muted }, guestLink: { minHeight: 56, borderRadius: radii.control, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.field }, guestLinkText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.muted },
  or: { marginVertical: 20, flexDirection: "row", alignItems: "center", gap: 14 }, line: { flex: 1, height: 1, backgroundColor: colors.line }, orText: { fontSize: 12, color: colors.ink }, direct: { borderRadius: radii.card, padding: 16, backgroundColor: colors.field }, directTitle: { fontSize: 14, fontWeight: "800", color: colors.ink }, directCopy: { marginTop: 3, fontSize: 11, lineHeight: 16, color: colors.ink }, directAction: { marginTop: 17 }
});
