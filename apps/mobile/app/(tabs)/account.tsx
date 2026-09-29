import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, LoadingState, Screen, ScreenState, SectionHeading, uiStyles } from "@/components/ui";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const destinations: readonly [string, AppIconName, string][] = [
  ["Dashboard", "grid-outline", "/dashboard"],
  ["Listings", "list-outline", "/dashboard/listings"],
  ["Analytics", "analytics-outline", "/dashboard/analytics"],
  ["Messages", "chatbubble-ellipses-outline", "/dashboard/messages"],
  ["Purchased Properties", "home-outline", "/dashboard/purchased-properties"],
  ["Saved Properties", "bookmark-outline", "/saved-properties"],
  ["Referrals", "people-outline", "/dashboard/referrals"],
  ["Withdraw Earnings", "wallet-outline", "/dashboard/referrals/withdraw"],
  ["Sell Assistance", "help-buoy-outline", "/sell-assistance"],
  ["Buy Assistance", "compass-outline", "/buy-assistance"],
  ["Settings", "settings-outline", "/dashboard/settings"],
  ["KYC", "shield-checkmark-outline", "/dashboard/kyc"],
  ["Support", "help-circle-outline", "/support"],
] as const;

export default function AccountScreen() {
  const { status, customer, restore, logout } = useAuth();
  if (status === "loading") return <Screen><LoadingState label="Restoring your secure session" /></Screen>;
  if (status === "unavailable") return <Screen><Card><ScreenState title="Connection unavailable" message="Your secure session remains on this device. Reconnect to confirm your account." action={<Button label="Retry" onPress={() => void restore()} />} /></Card></Screen>;
  if (status === "signedOut") return <Screen><SectionHeading title="Account" description="Sign in to manage your Beryl Shelter activity." /><Card><Text style={uiStyles.title}>Welcome</Text><Text style={uiStyles.muted}>Use your verified customer account. Admin accounts are not supported in Mobile.</Text><Button label="Log in" onPress={() => router.push("/(auth)/login")} /><Button label="Create account" variant="secondary" onPress={() => router.push("/(auth)/register")} /></Card></Screen>;
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Beryl customer";
  return <Screen><SectionHeading title="Account" /><Card><View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.identityText}><Text style={uiStyles.title}>{name}</Text><Text style={uiStyles.muted}>{customer?.email}</Text></View></View></Card><View style={styles.menu}>{destinations.map(([label, icon, href]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href as never)} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}><AppIcon name={icon} size={22} color={colors.brandDark} /><Text style={styles.menuLabel}>{label}</Text><AppIcon name="chevron-forward" size={18} color={colors.textMuted} /></Pressable>)}</View><Button label="Log out" variant="danger" onPress={() => void logout()} /></Screen>;
}
const styles = StyleSheet.create({ identity: { flexDirection: "row", alignItems: "center", gap: spacing.md }, identityText: { flex: 1, gap: spacing.xs }, avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }, avatarText: { ...typography.heading, color: colors.brandDark }, menu: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }, menuItem: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, menuLabel: { ...typography.body, color: colors.text, flex: 1 }, pressed: { backgroundColor: colors.surfaceMuted } });
