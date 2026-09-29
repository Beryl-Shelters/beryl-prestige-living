import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "../app-icon";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export type DashboardSection =
  | "overview"
  | "listings"
  | "analytics"
  | "messages"
  | "purchased"
  | "referrals";

const navItems: { id: DashboardSection; label: string; icon: AppIconName; route: string }[] = [
  { id: "overview", label: "Overview", icon: "grid-outline", route: "/dashboard" },
  { id: "listings", label: "My Listings", icon: "list-outline", route: "/dashboard/listings" },
  { id: "analytics", label: "Analytics", icon: "analytics-outline", route: "/dashboard/analytics" },
  { id: "messages", label: "Messages", icon: "chatbubble-ellipses-outline", route: "/dashboard/messages" },
  { id: "purchased", label: "Purchased", icon: "home-outline", route: "/dashboard/purchased-properties" },
  { id: "referrals", label: "Referrals", icon: "people-outline", route: "/dashboard/referrals" },
];

export function DashboardNav({ active }: { active: DashboardSection }) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="tablist"
      >
        {navItems.map((item) => {
          const isActive = item.id === active;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                if (!isActive) {
                  router.push(item.route as never);
                }
              }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <AppIcon
                name={item.icon}
                size={16}
                color={isActive ? colors.actionText : colors.textMuted}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  tabActive: {
    backgroundColor: colors.action,
  },
  tabText: {
    ...typography.label,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.actionText,
  },
});
