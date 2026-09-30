import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "./brand-logo";
import { useTheme } from "@/providers/theme-provider";
import { spacing, typography } from "@/theme/tokens";

export function BrandLoader({ label = "Loading" }: { label?: string }) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.root}>
      <Animated.View style={{ opacity }}><BrandLogo compact /></Animated.View>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  label: { ...typography.caption },
});
