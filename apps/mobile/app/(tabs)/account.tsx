import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, LoadingState, Screen, ScreenState, SectionHeading, uiStyles } from "@/components/ui";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { useAuth } from "@/providers/auth-provider";
import { useTheme, type ThemePreference } from "@/providers/theme-provider";
import { radius, spacing, typography } from "@/theme/tokens";

const destinations: readonly [string, AppIconName, string][] = [
  ["Dashboard", "grid-outline", "/dashboard"],
  ["Listings", "list-outline", "/dashboard/listings"],
  ["Analytics", "analytics-outline", "/dashboard/analytics"],
  ["Messages", "chatbubble-ellipses-outline", "/dashboard/messages"],
  ["Purchased Properties", "home-outline", "/dashboard/purchased-properties"],
  ["Saved Properties", "bookmark-outline", "/saved-properties"],
  ["Referrals", "people-outline", "/dashboard/referrals"],
  ["Withdraw Earnings", "wallet-outline", "/dashboard/referrals/withdraw"],
  ["Sell Assistance", "help-buoy-outline", "/sell-assistance"],
  ["Buy Assistance", "compass-outline", "/buy-assistance"],
  ["Settings", "settings-outline", "/dashboard/settings"],
  ["KYC", "shield-checkmark-outline", "/dashboard/kyc"],
  ["Support", "help-circle-outline", "/support"],
] as const;

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

export default function AccountScreen() {
  const { status, customer, restore, logout } = useAuth();
  const { colors } = useTheme();

  if (status === "loading") {
    return (
      <Screen>
        <LoadingState label="Restoring your secure session" />
      </Screen>
    );
  }

  if (status === "unavailable") {
    return (
      <Screen>
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
      <Screen>
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

  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Beryl customer";

  return (
    <Screen>
      <SectionHeading title="Account" />
      <Card>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.avatarText, { color: colors.brandDark }]}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={[uiStyles.title, { color: colors.text }]}>{name}</Text>
            <Text style={[uiStyles.muted, { color: colors.textMuted }]}>{customer?.email}</Text>
          </View>
        </View>
      </Card>

      <ThemeCard />

      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {destinations.map(([label, icon, href]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => router.push(href as never)}
            style={({ pressed }) => [
              styles.menuItem,
              { borderBottomColor: colors.border },
              pressed && { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <AppIcon name={icon} size={22} color={colors.brandDark} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
            <AppIcon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Button label="Log out" variant="danger" onPress={() => void logout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identityText: { flex: 1, gap: spacing.xs },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.heading },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { ...typography.body, flex: 1 },
});
