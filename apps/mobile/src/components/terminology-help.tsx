import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./app-icon";
import { terminology, type TerminologyKey } from "@/lib/terminology";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

export function TerminologyHelp({ term }: { term: TerminologyKey }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const content = terminology[term];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Explain ${content.title}`}
        accessibilityHint="Opens a short explanation"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <AppIcon name="help-circle-outline" size={18} color={colors.brandDark} />
      </Pressable>
      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close explanation"
          onPress={() => setOpen(false)}
          style={styles.backdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={styles.card}
          >
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" style={styles.title}>{content.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close explanation"
                hitSlop={8}
                onPress={() => setOpen(false)}
                style={styles.close}
              >
                <AppIcon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.description}>{content.description}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    trigger: { alignItems: "center", justifyContent: "center", width: 24, height: 24 },
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
    },
    card: {
      width: "100%",
      maxWidth: 360,
      gap: spacing.sm,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    title: { ...typography.heading, flex: 1, color: colors.text },
    close: { padding: spacing.xs },
    description: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  });
}
