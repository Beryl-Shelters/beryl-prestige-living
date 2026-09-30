import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { formatNaira } from "@/lib/money";
import type { PublicProperty } from "@/lib/property-types";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

export function PropertyCard({
  property,
  saved,
  saving = false,
  referralCode,
  onToggleSaved,
  compareSelected,
  compareDisabled,
  onToggleCompare,
}: {
  property: PublicProperty;
  saved?: boolean;
  saving?: boolean;
  referralCode?: string;
  onToggleSaved?: () => void;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const path = {
    pathname: "/properties/[propertyCode]" as const,
    params: { propertyCode: property.code, ...(referralCode ? { ref: referralCode } : {}) },
  };

  return (
    <View style={styles.card} accessibilityLabel={`${property.title}, ${formatNaira(property.priceMinor)}`}>
      <Pressable accessibilityRole="link" accessibilityLabel={`View ${property.title}`} onPress={() => router.push(path)}>
        {property.images[0] ? (
          <Image
            source={{ uri: property.images[0] }}
            resizeMode="cover"
            accessibilityLabel={`Property photograph of ${property.title}`}
            style={styles.image}
          />
        ) : (
          <View accessibilityLabel={`No photograph available for ${property.title}`} accessibilityRole="image" style={styles.placeholder}>
            <AppIcon name="image-outline" size={34} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Photo unavailable</Text>
          </View>
        )}
      </Pressable>
      {onToggleSaved ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${property.title} from saved properties` : `Save ${property.title}`}
          accessibilityState={{ selected: saved, disabled: saving }}
          disabled={saving}
          onPress={onToggleSaved}
          hitSlop={8}
          style={styles.save}
        >
          <AppIcon name={saved ? "heart" : "heart-outline"} color={saved ? colors.danger : colors.text} size={24} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text style={styles.price}>{formatNaira(property.priceMinor)}</Text>
        <Text numberOfLines={1} style={styles.type}>
          {property.propertySubtype} · {property.propertyType}
        </Text>
        <Pressable accessibilityRole="link" onPress={() => router.push(path)}>
          <Text numberOfLines={2} style={styles.title}>{property.title}</Text>
        </Pressable>
        <View style={styles.location}>
          <AppIcon name="location-outline" size={16} color={colors.textMuted} />
          <Text numberOfLines={1} style={styles.muted}>{property.city}, {property.state}</Text>
        </View>
        <View style={styles.facts}>
          <Text style={styles.fact}>{property.bedrooms} bed</Text>
          <Text style={styles.fact}>{property.bathrooms} bath</Text>
          <Text style={styles.fact}>{property.parkingSpaces} parking</Text>
        </View>
        <Text style={styles.code}>Property code: {property.code}</Text>
        {onToggleCompare ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`${compareSelected ? "Remove" : "Add"} ${property.title} ${compareSelected ? "from" : "to"} comparison`}
            accessibilityState={{ checked: compareSelected, disabled: compareDisabled }}
            disabled={compareDisabled}
            onPress={onToggleCompare}
            style={[styles.compare, compareSelected && styles.compareSelected, compareDisabled && styles.disabled]}
          >
            <AppIcon
              name={compareSelected ? "checkmark-circle" : "git-compare-outline"}
              size={18}
              color={compareSelected ? colors.actionText : colors.brandDark}
            />
            <Text style={[styles.compareText, compareSelected && styles.compareTextSelected]}>
              {compareSelected ? "Selected" : "Compare"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      position: "relative",
    },
    image: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.surfaceMuted },
    placeholder: {
      width: "100%",
      aspectRatio: 16 / 10,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceMuted,
    },
    placeholderText: { ...typography.caption, color: colors.textMuted },
    save: {
      position: "absolute",
      right: spacing.md,
      top: spacing.md,
      minWidth: 44,
      minHeight: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    copy: { padding: spacing.lg, gap: spacing.sm },
    price: { ...typography.heading, color: colors.brandDark },
    type: { ...typography.caption, color: colors.textMuted },
    title: { ...typography.heading, color: colors.text },
    location: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    muted: { ...typography.caption, color: colors.textMuted, flex: 1 },
    facts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    fact: {
      ...typography.caption,
      color: colors.text,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    code: { ...typography.caption, color: colors.textMuted },
    compare: {
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    compareSelected: { backgroundColor: colors.action, borderColor: colors.action },
    compareText: { ...typography.label, color: colors.brandDark },
    compareTextSelected: { color: colors.actionText },
    disabled: { opacity: 0.45 },
  });
}
