import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { counterValue, sellerSteps } from "@/seller-marketplace/helpers";
import { colors, radii, sizes, spacing } from "@/theme/tokens";
import type { SellerStep } from "@/types/seller-marketplace";

export const SellerPage = ({ children }: { children: ReactNode }) => <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>{children}</SafeAreaView>;

export function SellerHeader({ title, onBack, action }: { title?: string; onBack?: () => void; action?: ReactNode }) {
  return <View style={styles.header}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.touch}><Feather name="chevron-left" size={25} color={colors.brown}/></Pressable> : <Image accessibilityLabel="Beryl Shelter" source={require("../../../assets/brand/beryl-shelter-logo.png")} style={styles.logo}/>}
    <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
    {action ?? <View style={styles.touch}/>}
  </View>;
}

export function StepHeader({ step, status, onBack }: { step: SellerStep; status: string; onBack: () => void }) {
  const index = sellerSteps.indexOf(step);
  const label = step === "PROPERTY_INFORMATION" ? "Property Information" : step === "PHOTOS_DOCUMENTS" ? "Photos & Documents" : step === "SALES_MANDATE" ? "Sales Mandate" : "Review";
  return <>
    <SellerHeader onBack={onBack} action={<View style={styles.saveState}><Feather name={status === "Failed" ? "alert-circle" : "cloud"} size={16} color={status === "Failed" ? colors.danger : colors.muted}/><Text accessibilityLiveRegion="polite" style={[styles.saveText, status === "Failed" && styles.saveFailed]}>{status}</Text></View>}/>
    <View style={styles.step}><Text style={styles.stepText}>Step {index + 1} of 4: {label}</Text><View style={styles.segments}>{sellerSteps.map((item, itemIndex) => <View key={item} style={[styles.segment, itemIndex <= index && styles.segmentOn]}/>)}</View></View>
  </>;
}

export function SellerInput({ label, value, onChange, placeholder, multiline = false, keyboardType = "default", maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: "default" | "number-pad"; maxLength?: number }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} multiline={multiline} maxLength={maxLength} keyboardType={keyboardType} placeholderTextColor={colors.inputPlaceholder} selectionColor={colors.selectionColor} cursorColor={colors.selectionColor} textAlignVertical={multiline ? "top" : "center"} style={[styles.input, multiline && styles.multiline]}/></View>;
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value?: T; options: readonly (readonly [T, string, string?])[]; onChange: (value: T) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.choiceWrap}>{options.map(([key, title, copy]) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={[styles.choice, value === key && styles.choiceOn]}><View style={styles.choiceBody}><Text style={styles.choiceTitle}>{title}</Text>{copy ? <Text style={styles.choiceCopy}>{copy}</Text> : null}</View><View style={[styles.radio, value === key && styles.radioOn]}>{value === key ? <Feather name="check" size={13} color={colors.white}/> : null}</View></Pressable>)}</View></View>;
}

export function Counter({ label, value, onChange, min = 0 }: { label: string; value: number | null | undefined; onChange: (value: number) => void; min?: number }) {
  const current = Number.isInteger(value) ? Number(value) : min;
  const displayLabel = ({ Bedrooms: "Bedroom", Bathrooms: "Bathroom", Toilets: "Toilet", "Parking spaces": "Parking" } as Record<string, string>)[label] ?? label;
  return <View style={styles.counter}><Text style={styles.counterLabel}>{displayLabel}</Text><View style={styles.counterActions}><Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${displayLabel}`} disabled={current <= min} onPress={() => onChange(counterValue(current, -1, min))} style={styles.counterButton}><Feather name="minus" size={18} color={colors.ink}/></Pressable><Text accessibilityLabel={`${displayLabel}: ${current}`} style={styles.counterNumber}>{current}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Increase ${displayLabel}`} onPress={() => onChange(counterValue(current, 1, min))} style={[styles.counterButton, styles.counterAdd]}><Feather name="plus" size={18} color={colors.brown}/></Pressable></View></View>;
}

export function Pills<T extends string>({ label, value, options, onChange, optional = false }: { label: string; value?: T | null; options: readonly (readonly [T, string])[]; onChange: (value: T | null) => void; optional?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{optional ? " · Optional" : ""}</Text><View style={styles.pills}>{options.map(([key, title]) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ selected: value === key }} onPress={() => onChange(optional && value === key ? null : key)} style={[styles.pill, value === key && styles.pillOn]}><Text style={[styles.pillText, value === key && styles.pillTextOn]}>{value === key ? "✓ " : ""}{title}</Text></Pressable>)}</View></View>;
}

export function BottomActions({ busy, onSave, onContinue, continueLabel = "Continue" }: { busy: boolean; onSave: () => void; onContinue: () => void; continueLabel?: string }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}><Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={styles.draft}><Text style={styles.draftText}>Save as draft</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onContinue} style={styles.primary}>{busy ? <ActivityIndicator color={colors.white}/> : <Text style={styles.primaryText}>{continueLabel}</Text>}</Pressable></View>;
}

export function SellerState({ label, error, onRetry }: { label?: string; error?: string; onRetry?: () => void }) {
  return <View style={styles.state}>{error ? <Feather name="alert-circle" size={30} color={colors.danger}/> : <ActivityIndicator color={colors.brown}/>}<Text style={styles.stateText}>{error ?? label ?? "Loading…"}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 58, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, touch: { width: sizes.touch, height: sizes.touch, alignItems: "center", justifyContent: "center" }, logo: { width: 34, height: 34, resizeMode: "contain" }, headerTitle: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: "900", color: colors.ink },
  saveState: { minHeight: sizes.touch, maxWidth: 110, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5 }, saveText: { flexShrink: 1, fontSize: 11, color: colors.muted }, saveFailed: { color: colors.danger }, step: { paddingHorizontal: spacing.md, paddingBottom: 16 }, stepText: { fontSize: 12, lineHeight: 17, fontWeight: "700", color: colors.brown }, segments: { marginTop: 10, flexDirection: "row", gap: 7 }, segment: { height: 4, flex: 1, borderRadius: 3, backgroundColor: colors.line }, segmentOn: { backgroundColor: colors.brown },
  field: { marginTop: 18 }, label: { marginBottom: 8, fontSize: 13, lineHeight: 18, fontWeight: "800", color: colors.ink }, input: { minHeight: sizes.input, borderRadius: radii.control, paddingHorizontal: 14, fontSize: 15, color: colors.inputText, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }, multiline: { minHeight: 110, paddingTop: 14 },
  choiceWrap: { gap: 9 }, choice: { minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: radii.control, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white }, choiceOn: { borderColor: colors.brown, backgroundColor: colors.cream }, choiceBody: { flex: 1, minWidth: 0 }, choiceTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800", color: colors.ink }, choiceCopy: { marginTop: 3, fontSize: 11, lineHeight: 16, color: colors.muted }, radio: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }, radioOn: { backgroundColor: colors.brown, borderColor: colors.brown },
  counter: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, counterLabel: { flex: 1, minWidth: 0, fontSize: 14, color: colors.ink }, counterActions: { flexDirection: "row", alignItems: "center", gap: 10 }, counterButton: { width: sizes.touch, height: sizes.touch, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }, counterAdd: { borderColor: colors.brown, backgroundColor: colors.cream }, counterNumber: { minWidth: 24, textAlign: "center", fontSize: 15, fontWeight: "800", color: colors.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 8 }, pill: { width: "48%", minHeight: 46, flexShrink: 0, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, pillOn: { borderColor: colors.brown, backgroundColor: colors.cream }, pillText: { width: "100%", flexShrink: 0, textAlign: "center", fontSize: 12, lineHeight: 17, color: colors.muted }, pillTextOn: { color: colors.brown, fontWeight: "800" },
  bottom: { paddingTop: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.canvas }, draft: { flex: 1, minHeight: sizes.button, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, draftText: { fontSize: 14, fontWeight: "800", color: colors.brown }, primary: { flex: 1.35, minHeight: sizes.button, borderRadius: radii.pill, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.brown }, primaryText: { fontSize: 15, fontWeight: "800", color: colors.white },
  state: { minHeight: 220, padding: spacing.xl, alignItems: "center", justifyContent: "center" }, stateText: { marginTop: 12, textAlign: "center", color: colors.muted }, retry: { marginTop: 15, minHeight: 44, paddingHorizontal: 20, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brown }, retryText: { color: colors.white, fontWeight: "800" }
});
