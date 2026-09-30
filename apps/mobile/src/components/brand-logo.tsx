import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { typography } from "@/theme/tokens";

const logo = require("../../../web/public/brand/beryl-shelter-logo.png");

export function BrandLogo({ compact = false, style }: { compact?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Beryl Shelter" style={[styles.lockup, style]}>
      <Image source={logo} resizeMode="contain" style={compact ? styles.compactLogo : styles.logo} />
      <Text style={[styles.name, compact && styles.compactName, { color: colors.brandDark }]}>Beryl Shelter</Text>
    </View>
  );
}

export { logo as brandLogoSource };

const styles = StyleSheet.create({
  lockup: { alignItems: "center", alignSelf: "flex-start", gap: 4 },
  logo: { width: 44, height: 44 },
  compactLogo: { width: 48, height: 48 },
  name: { ...typography.heading, fontSize: 16, fontWeight: "800", lineHeight: 20 },
  compactName: { fontSize: 14, lineHeight: 18 },
});
