import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "./app-icon";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type OptionSelectProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

export function OptionSelect({ label, value, options, onChange }: OptionSelectProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label.replace(/\s*\*$/, "")} selector`}
        accessibilityHint="Opens a vertically scrollable list of states"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
      >
        <Text style={styles.value}>{value}</Text>
        <AppIcon name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close state selector"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text accessibilityRole="header" style={styles.sheetTitle}>Select state</Text>
                <Text style={styles.sheetSubtitle}>{options.length} available options</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close state selector"
                onPress={() => setOpen(false)}
                hitSlop={10}
                style={styles.closeButton}
              >
                <AppIcon name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              accessibilityLabel="Nigerian states"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.options}
            >
              {options.map((option) => {
                const selected = option === value;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityLabel={option}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                    {selected ? <AppIcon name="checkmark" size={18} color={colors.brandDark} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    field: { gap: spacing.xs },
    label: { ...typography.label, color: colors.text },
    control: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    controlPressed: { backgroundColor: colors.surfaceMuted },
    value: { ...typography.body, color: colors.text, flex: 1 },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
    sheet: {
      maxHeight: "78%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: { ...typography.heading, color: colors.text },
    sheetSubtitle: { ...typography.caption, color: colors.textMuted },
    closeButton: { padding: spacing.xs },
    options: { padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl },
    option: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: { borderColor: colors.brand, backgroundColor: colors.brandTint },
    optionText: { ...typography.body, color: colors.text },
    optionTextSelected: { color: colors.brandDark, fontWeight: "700" },
  });
}
