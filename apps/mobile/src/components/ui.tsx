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
import { useTheme } from "@/providers/theme-provider";

export function Screen({
  children,
  scroll = true,
  keyboard = false,
  style,
}: PropsWithChildren<{ scroll?: boolean; keyboard?: boolean; style?: ViewStyle }>) {
  const { colors: themeColors } = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, style]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safe, { backgroundColor: themeColors.background }]}
    >
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors: themeColors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.headingBlock}>
      <Text accessibilityRole="header" style={[styles.heading, { color: themeColors.text }]}>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.muted, { color: themeColors.textMuted }]}>{description}</Text>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  accessibilityLabel?: string;
}) {
  const { colors: themeColors, effectiveTheme } = useTheme();

  const variantStyle = {
    primary: {
      backgroundColor: themeColors.action,
      borderColor: "transparent",
      textColor: themeColors.actionText,
    },
    secondary: {
      backgroundColor: themeColors.surfaceMuted,
      borderColor: themeColors.border,
      textColor: themeColors.text,
    },
    danger: {
      backgroundColor: effectiveTheme === "dark" ? "rgba(239, 68, 68, 0.16)" : "#FDECEC",
      borderColor: effectiveTheme === "dark" ? "#EF4444" : "#F2BABA",
      textColor: effectiveTheme === "dark" ? "#FCA5A5" : "#C93E3E",
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderColor: variantStyle.borderColor,
          borderWidth: variant === "primary" ? 0 : 1,
        },
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: variantStyle.textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  keyboardType,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
}) {
  const { colors: themeColors } = useTheme();
  const errorId = error ? `${String(props.nativeID ?? label)}-error` : undefined;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-describedby={errorId}
        placeholderTextColor={themeColors.textMuted}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            backgroundColor: themeColors.surface,
            borderColor: error ? themeColors.danger : themeColors.border,
            color: themeColors.text,
          },
        ]}
        {...props}
      />
      {error ? (
        <Text nativeID={errorId} accessibilityRole="alert" style={[styles.error, { color: themeColors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const { colors: themeColors, effectiveTheme } = useTheme();

  const toneStyle = {
    neutral: {
      backgroundColor: themeColors.surfaceMuted,
      textColor: themeColors.text,
    },
    success: {
      backgroundColor: effectiveTheme === "dark" ? "rgba(34, 197, 94, 0.18)" : "#E7F5ED",
      textColor: effectiveTheme === "dark" ? "#4ADE80" : "#287A4C",
    },
    warning: {
      backgroundColor: effectiveTheme === "dark" ? "rgba(245, 158, 11, 0.18)" : "#FFF3DC",
      textColor: effectiveTheme === "dark" ? "#FBBF24" : "#9B671A",
    },
    danger: {
      backgroundColor: effectiveTheme === "dark" ? "rgba(239, 68, 68, 0.18)" : "#FDECEC",
      textColor: effectiveTheme === "dark" ? "#F87171" : "#C93E3E",
    },
  }[tone];

  return (
    <View style={[styles.chip, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.chipText, { color: toneStyle.textColor }]}>{label}</Text>
    </View>
  );
}

export function ScreenState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      <Text accessibilityRole="header" style={[styles.heading, { color: themeColors.text }]}>
        {title}
      </Text>
      <Text style={[styles.muted, styles.center, { color: themeColors.textMuted }]}>{message}</Text>
      {action}
    </View>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  const { colors: themeColors } = useTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.state}>
      <ActivityIndicator color={themeColors.brandDark} />
      <Text style={[styles.muted, { color: themeColors.textMuted }]}>{label}</Text>
    </View>
  );
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
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation,
  },
  headingBlock: { gap: spacing.xs },
  heading: { ...typography.heading, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...typography.label, color: colors.actionText },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.82 },
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.text },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  error: { ...typography.caption, color: colors.danger },
  chip: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  chipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  state: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  center: { textAlign: "center" },
});
