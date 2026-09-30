import { useMemo } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, LoadingState, Screen, ScreenState, SectionHeading, uiStyles } from "@/components/ui";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { useAuth } from "@/providers/auth-provider";
import { useTheme, type ThemePreference } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

function ThemeCard() {
  const { themePreference, effectiveTheme, setThemePreference, colors } = useTheme();

  const options: { value: ThemePreference; label: string; icon: AppIconName; description: string }[] = [
    {
      value: "system",
      label: "System",
      icon: "phone-portrait-outline",
      description: `Follows device (${effectiveTheme === "dark" ? "Dark" : "Light"})`,
    },
    {
      value: "light",
      label: "Light",
      icon: "sunny-outline",
      description: "Always use light theme",
    },
    {
      value: "dark",
      label: "Dark",
      icon: "moon-outline",
      description: "Always use dark theme",
    },
  ];

  return (
    <Card>
      <Text style={[uiStyles.title, { color: colors.text, fontSize: 18 }]}>Appearance</Text>
      <Text style={[uiStyles.muted, { color: colors.textMuted }]}>
        Choose how Beryl Shelter appears on this device.
      </Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {options.map((opt) => {
          const isSelected = themePreference === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${opt.label} appearance`}
              onPress={() => void setThemePreference(opt.value)}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.brand : colors.border,
                  backgroundColor: isSelected
                    ? effectiveTheme === "dark"
                      ? "rgba(197, 139, 67, 0.16)"
                      : colors.brandTint
                    : colors.surface,
                  gap: spacing.md,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <AppIcon
                name={opt.icon}
                size={22}
                color={isSelected ? colors.brand : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.label,
                    color: isSelected ? colors.brandDark : colors.text,
                  }}
                >
                  {opt.label}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textMuted,
                  }}
                >
                  {opt.description}
                </Text>
              </View>
              {isSelected ? (
                <AppIcon name="checkmark-circle" size={20} color={colors.brand} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

type HubItem = {
  label: string;
  icon: AppIconName;
  route: string;
  description: string;
};

const hubItems: HubItem[] = [
  {
    label: "Dashboard",
    icon: "grid-outline",
    route: "/dashboard",
    description: "Overview, investments, and activity summary",
  },
  {
    label: "Saved Properties",
    icon: "bookmark-outline",
    route: "/saved-properties",
    description: "Saved listings and side-by-side comparison",
  },
  {
    label: "Referrals",
    icon: "people-outline",
    route: "/dashboard/referrals",
    description: "Referral links and 2% commission tracking",
  },
  {
    label: "Withdraw Earnings",
    icon: "wallet-outline",
    route: "/dashboard/referrals/withdraw",
    description: "Payout requests for cleared referral funds",
  },
  {
    label: "Settings",
    icon: "settings-outline",
    route: "/dashboard/settings",
    description: "Personal profile, business, and password security",
  },
  {
    label: "Support",
    icon: "help-circle-outline",
    route: "/support",
    description: "FAQs, contact lines, and issue reports",
  },
];

export default function AccountScreen() {
  const { status, customer, restore, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (status === "loading") {
    return (
      <Screen edges={["top", "left", "right"]}>
        <LoadingState label="Restoring your secure session" />
      </Screen>
    );
  }

  if (status === "unavailable") {
    return (
      <Screen edges={["top", "left", "right"]}>
        <Card>
          <ScreenState
            title="Connection unavailable"
            message="Your secure session remains on this device. Reconnect to confirm your account."
            action={<Button label="Retry" onPress={() => void restore()} />}
          />
        </Card>
        <ThemeCard />
      </Screen>
    );
  }

  if (status === "signedOut") {
    return (
      <Screen edges={["top", "left", "right"]}>
        <SectionHeading title="Account" description="Sign in to manage your Beryl Shelter activity." />
        <Card>
          <Text style={[uiStyles.title, { color: colors.text }]}>Welcome</Text>
          <Text style={[uiStyles.muted, { color: colors.textMuted }]}>
            Use your verified customer account. Admin accounts are not supported in Mobile.
          </Text>
          <Button label="Log in" onPress={() => router.push("/(auth)/login")} />
          <Button label="Create account" variant="secondary" onPress={() => router.push("/(auth)/register")} />
        </Card>
        <ThemeCard />
      </Screen>
    );
  }

  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Beryl Customer";
  const profileType = customer?.profile_type === "BUSINESS" ? "Business" : "Individual";

  return (
    <Screen edges={["top", "left", "right"]}>
      {/* Profile Header Card matching image2 */}
      <Card>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.profileMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.verifiedBadge}>
                <AppIcon name="shield-checkmark-outline" size={14} color={colors.brandDark} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {customer?.email}
            </Text>
            <Text style={styles.profileType}>{profileType}</Text>
          </View>
        </View>

        {/* Primary CTA: Go to Dashboard */}
        <Button
          label="Go to Dashboard"
          onPress={() => router.push("/dashboard")}
        />
      </Card>

      {/* Quick Action Navigation Hub */}
      <View style={styles.hubContainer}>
        <Text style={styles.sectionTitle}>Account Features</Text>
        <View style={styles.hubCard}>
          {hubItems.map((item, idx) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => [
                styles.hubItem,
                idx < hubItems.length - 1 && styles.hubItemBorder,
                pressed && styles.hubItemPressed,
              ]}
            >
              <View style={styles.hubIconCircle}>
                <AppIcon name={item.icon} size={20} color={colors.brandDark} />
              </View>
              <View style={styles.hubTextContainer}>
                <Text style={styles.hubItemLabel}>{item.label}</Text>
                <Text style={styles.hubItemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Appearance Settings */}
      <ThemeCard />

      {/* Logout Action */}
      <Button label="Log out" variant="danger" onPress={() => void logout()} />
    </Screen>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarText: {
      ...typography.heading,
      color: colors.brandDark,
      fontSize: 22,
      fontWeight: "800",
    },
    profileMeta: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    profileName: {
      ...typography.heading,
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      flexShrink: 1,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.brandTint,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    verifiedText: {
      ...typography.caption,
      color: colors.brandDark,
      fontSize: 11,
      fontWeight: "700",
    },
    profileEmail: {
      ...typography.body,
      color: colors.textMuted,
      fontSize: 13,
    },
    profileType: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "500",
    },
    hubContainer: {
      gap: spacing.xs,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.xs,
    },
    hubCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    hubItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    hubItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    hubItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    hubIconCircle: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    hubTextContainer: {
      flex: 1,
      gap: 2,
    },
    hubItemLabel: {
      ...typography.body,
      color: colors.text,
      fontWeight: "600",
      fontSize: 15,
    },
    hubItemDesc: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
    },
  });
}
