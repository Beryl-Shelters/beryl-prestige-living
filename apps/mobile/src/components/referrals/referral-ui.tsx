import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, sizes, spacing } from "@/theme/tokens";

export function ReferralPage({ children, keyboard = false, background = colors.white }: { children: ReactNode; keyboard?: boolean; background?: string }) {
  const content = keyboard
    ? <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} bottomOffset={24} extraKeyboardSpace={24} contentContainerStyle={styles.scroll}>{children}</KeyboardAwareScrollView>
    : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{children}</ScrollView>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={["top", "left", "right", "bottom"]}>{content}</SafeAreaView>;
}

export function ReferralBack({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace("/refer")} style={styles.back}><Feather name="chevron-left" size={22} color={colors.brown}/><Text style={styles.backText}>{label}</Text></Pressable>;
}

export function ReferralButton({ label, onPress, loading, disabled, outline = false, icon }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; outline?: boolean; icon?: keyof typeof Feather.glyphMap }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled || loading) }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, outline && styles.buttonOutline, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={outline ? colors.brown : colors.white}/> : <>{icon ? <Feather name={icon} size={18} color={outline ? colors.brown : colors.white}/> : null}<Text style={[styles.buttonText, outline && styles.buttonTextOutline]}>{label}</Text></>}</Pressable>;
}

export function ReferralAlert({ message, tone = "error" }: { message?: string; tone?: "error" | "info" | "success" }) {
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={[styles.alert, tone === "info" && styles.alertInfo, tone === "success" && styles.alertSuccess]}><Feather name={tone === "error" ? "alert-circle" : tone === "success" ? "check-circle" : "info"} size={18} color={tone === "error" ? colors.white : tone === "success" ? colors.success : "#1766bd"}/><Text style={[styles.alertText, tone !== "error" && styles.alertTextDark]}>{message}</Text></View>;
}

export function CopyReferralLink({ value, compact = false }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return <View style={[styles.copyRow, compact && styles.copyCompact]}><View style={styles.copyValue}><Feather name="link-2" size={18} color={colors.brown}/><Text numberOfLines={1} ellipsizeMode="middle" style={styles.copyText}>{value}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={copied ? "Referral link copied" : "Copy referral link"} accessibilityState={{ selected: copied }} onPress={() => void copy()} style={styles.copyButton}><Feather name={copied ? "check" : "copy"} size={17} color={colors.white}/><Text style={styles.copyButtonText}>{copied ? "Copied!" : "Copy"}</Text></Pressable></View>;
}

export function ReferralState({ title, copy, loading, onRetry }: { title: string; copy?: string; loading?: boolean; onRetry?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="large" color={colors.brown}/> : <Feather name="users" size={34} color={colors.brown}/>}<Text accessibilityRole="header" style={styles.stateTitle}>{title}</Text>{copy ? <Text style={styles.stateCopy}>{copy}</Text> : null}{onRetry ? <View style={styles.retry}><ReferralButton label="Try again" onPress={onRetry}/></View> : null}</View>;
}

export function ReferralChoice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View accessibilityRole="radiogroup" style={styles.choices}>{options.map(([key, title]) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={[styles.choice, value === key && styles.choiceSelected]}><Text style={[styles.choiceText, value === key && styles.choiceTextSelected]}>{value === key ? "✓ " : ""}{title}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  back: { alignSelf: "flex-start", minHeight: sizes.touch, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8, paddingHorizontal: 6 }, backText: { fontSize: 12, color: colors.brown },
  button: { minHeight: sizes.button, borderRadius: radii.pill, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: colors.brown }, buttonOutline: { borderWidth: 1, borderColor: colors.brown, backgroundColor: "transparent" }, buttonText: { flexShrink: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: colors.white }, buttonTextOutline: { color: colors.brown }, disabled: { opacity: .55 }, pressed: { opacity: .82 },
  alert: { marginVertical: 10, borderRadius: radii.control, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: colors.danger }, alertInfo: { backgroundColor: "#e8f2ff" }, alertSuccess: { backgroundColor: colors.verifiedBackground }, alertText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.white }, alertTextDark: { color: colors.ink },
  copyRow: { minWidth: 0, flexDirection: "row", alignItems: "stretch", gap: 8 }, copyCompact: { marginTop: 14 }, copyValue: { flex: 1, minWidth: 0, minHeight: 56, borderRadius: radii.control, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.field }, copyText: { flex: 1, minWidth: 0, fontSize: 13, color: colors.ink }, copyButton: { minWidth: 88, minHeight: 56, borderRadius: radii.control, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.brown }, copyButtonText: { fontSize: 13, fontWeight: "800", color: colors.white },
  state: { minHeight: 360, alignItems: "center", justifyContent: "center", padding: spacing.lg }, stateTitle: { marginTop: 14, textAlign: "center", fontSize: 21, fontWeight: "900", color: colors.ink }, stateCopy: { marginTop: 7, textAlign: "center", fontSize: 13, lineHeight: 20, color: colors.muted }, retry: { width: "100%", marginTop: 18 },
  field: { marginTop: 18 }, label: { marginBottom: 8, fontSize: 13, lineHeight: 18, fontWeight: "800", color: colors.ink }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minWidth: 96, minHeight: 46, flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, choiceSelected: { borderColor: colors.brown, backgroundColor: colors.cream }, choiceText: { textAlign: "center", fontSize: 13, color: colors.muted }, choiceTextSelected: { fontWeight: "800", color: colors.brown }
});
