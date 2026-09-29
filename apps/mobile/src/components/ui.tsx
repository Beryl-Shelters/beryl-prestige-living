import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, elevation, radius, spacing, typography } from "@/theme/tokens";

export function Screen({ children, scroll = true, keyboard = false, style }: PropsWithChildren<{ scroll?: boolean; keyboard?: boolean; style?: ViewStyle }>) {
  const content = scroll
    ? <ScrollView contentContainerStyle={[styles.screenContent, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[styles.screenContent, styles.flex, style]}>{children}</View>;
  return <SafeAreaView edges={["left", "right"]} style={styles.safe}>{keyboard ? <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>{content}</KeyboardAvoidingView> : content}</SafeAreaView>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <View style={styles.headingBlock}><Text accessibilityRole="header" style={styles.heading}>{title}</Text>{description ? <Text style={styles.muted}>{description}</Text> : null}</View>;
}

export function Button({ label, onPress, disabled = false, loading = false, variant = "primary", accessibilityLabel }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: "primary" | "secondary" | "danger"; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], (disabled || loading) && styles.disabled, pressed && !disabled && styles.pressed]}>
    {loading ? <ActivityIndicator color={variant === "primary" ? colors.actionText : colors.text} /> : <Text style={[styles.buttonText, variant !== "primary" && styles.buttonTextDark]}>{label}</Text>}
  </Pressable>;
}

export function TextField({ label, error, keyboardType, ...props }: TextInputProps & { label: string; error?: string; keyboardType?: KeyboardTypeOptions }) {
  const errorId = error ? `${String(props.nativeID ?? label)}-error` : undefined;
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} accessibilityHint={error} aria-describedby={errorId} placeholderTextColor="#9C948C" keyboardType={keyboardType} style={[styles.input, Boolean(error) && styles.inputError]} {...props}/>{error ? <Text nativeID={errorId} accessibilityRole="alert" style={styles.error}>{error}</Text> : null}</View>;
}

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <View style={[styles.chip, styles[`chip_${tone}`]]}><Text style={styles.chipText}>{label}</Text></View>;
}

export function ScreenState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <View accessibilityLiveRegion="polite" style={styles.state}><Text accessibilityRole="header" style={styles.heading}>{title}</Text><Text style={[styles.muted, styles.center]}>{message}</Text>{action}</View>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.state}><ActivityIndicator color={colors.brandDark}/><Text style={styles.muted}>{label}</Text></View>;
}

export const uiStyles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  display: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
  stack: { gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  screenContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, ...elevation },
  headingBlock: { gap: spacing.xs }, heading: { ...typography.heading, color: colors.text }, muted: { ...typography.body, color: colors.textMuted },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  button_primary: { backgroundColor: colors.action }, button_secondary: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border }, button_danger: { backgroundColor: "#FDECEC", borderWidth: 1, borderColor: "#F2BABA" },
  buttonText: { ...typography.label, color: colors.actionText }, buttonTextDark: { color: colors.text }, disabled: { opacity: 0.48 }, pressed: { opacity: 0.82 },
  field: { gap: spacing.sm }, label: { ...typography.label, color: colors.text }, input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, ...typography.body }, inputError: { borderColor: colors.danger }, error: { ...typography.caption, color: colors.danger },
  chip: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceMuted }, chip_neutral: {}, chip_success: { backgroundColor: "#E7F5ED" }, chip_warning: { backgroundColor: "#FFF3DC" }, chip_danger: { backgroundColor: "#FDECEC" }, chipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  state: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }, center: { textAlign: "center" },
});
