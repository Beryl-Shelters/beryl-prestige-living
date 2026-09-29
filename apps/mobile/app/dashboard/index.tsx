import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Button, Card, LoadingState, ScreenState } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import { dashboardApi, type DashboardOverview } from "@/lib/dashboard-api";
import { listingStatusPresentation } from "@/lib/listings-api";
import { formatNaira } from "@/lib/money";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardOverviewScreen() {
  const { customer } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void dashboardApi
      .getOverview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((err) => {
        if (active) setError(friendlyError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const data = await dashboardApi.getOverview();
      setOverview(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  function handleRetry() {
    setLoading(true);
    setError("");
    void dashboardApi
      .getOverview()
      .then((data) => setOverview(data))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <DashboardNav active="overview" />
        <View style={styles.centered}>
          <LoadingState label="Loading dashboard overview…" />
        </View>
      </View>
    );
  }

  if (error && !overview) {
    return (
      <View style={styles.container}>
        <DashboardNav active="overview" />
        <View style={styles.centered}>
          <ScreenState
            title="Overview Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={handleRetry} />}
          />
        </View>
      </View>
    );
  }

  const name =
    [overview?.customer.first_name, overview?.customer.last_name]
      .filter(Boolean)
      .join(" ") ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "Customer";

  const greeting = getGreeting();
  const summary = overview?.summary;

  const kpis: {
    label: string;
    value: string;
    icon: AppIconName;
    route?: string;
  }[] = [
    {
      label: "Total Investments",
      value: formatNaira(summary?.total_investments ?? 0),
      icon: "trending-up-outline",
    },
    {
      label: "Properties Owned",
      value: String(summary?.properties_owned ?? 0),
      icon: "home-outline",
      route: "/dashboard/purchased-properties",
    },
    {
      label: "Referral Earnings",
      value: formatNaira(summary?.referral_earnings ?? 0),
      icon: "people-outline",
      route: "/dashboard/referrals",
    },
    {
      label: "New Messages",
      value: String(summary?.new_messages ?? 0),
      icon: "chatbubble-ellipses-outline",
      route: "/dashboard/messages",
    },
  ];

  const recentListings = overview?.recent_property_listings ?? [];
  const recentMessages = overview?.recent_messages ?? [];

  return (
    <View style={styles.container}>
      <DashboardNav active="overview" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.brandDark]}
            tintColor={colors.brandDark}
          />
        }
      >
        {/* Salutation Greeting */}
        <View style={styles.greetingBox}>
          <Text accessibilityRole="header" style={styles.greetingText}>
            {greeting}, {name}!
          </Text>
          <Text style={styles.greetingSubtext}>
            Here is a summary of your Beryl Shelter activity and portfolio.
          </Text>
        </View>

        {/* 4 KPI Summary Cards */}
        <View style={styles.kpiGrid} accessibilityLabel="Overview summary">
          {kpis.map((kpi) => {
            const cardContent = (
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconCircle}>
                  <AppIcon name={kpi.icon} size={20} color={colors.brandDark} />
                </View>
                <View style={styles.kpiTextCol}>
                  <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  <Text style={styles.kpiValue}>{kpi.value}</Text>
                </View>
              </View>
            );

            if (kpi.route) {
              return (
                <Pressable
                  key={kpi.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${kpi.label}: ${kpi.value}`}
                  onPress={() => router.push(kpi.route as never)}
                  style={styles.kpiWrapper}
                >
                  {cardContent}
                </Pressable>
              );
            }

            return (
              <View key={kpi.label} style={styles.kpiWrapper}>
                {cardContent}
              </View>
            );
          })}
        </View>

        {/* Cumulative Revenue Chart */}
        {overview?.revenue ? (
          <RevenueChart revenue={overview.revenue} />
        ) : null}

        {/* Recent Property Listings */}
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Recent Property Listings
          </Text>
          {recentListings.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all listings"
              onPress={() => router.push("/dashboard/listings")}
            >
              <Text style={styles.seeAllLink}>See all listings</Text>
            </Pressable>
          )}
        </View>

        {recentListings.length > 0 ? (
          <View style={styles.listingsList}>
            {recentListings.map((listing) => {
              const { label, tone } = listingStatusPresentation(listing.status);
              return (
                <Pressable
                  key={listing.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Listing: ${listing.title}, status: ${label}, price: ${formatNaira(listing.priceMinor)}`}
                  onPress={() => router.push(`/dashboard/listings/${listing.id}` as never)}
                  style={styles.recentListingCard}
                >
                  {listing.imageUrl ? (
                    <Image
                      source={{ uri: listing.imageUrl }}
                      style={styles.recentListingImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.recentListingImg, styles.recentListingImgPlaceholder]}>
                      <AppIcon name="home-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}

                  <View style={styles.recentListingMeta}>
                    <View style={styles.recentListingTopRow}>
                      <View style={[styles.statusChip, styles[`statusChip_${tone}`]]}>
                        <Text style={[styles.statusChipText, styles[`statusChipText_${tone}`]]}>
                          {label}
                        </Text>
                      </View>
                      <Text style={styles.recentListingPrice}>
                        {formatNaira(listing.priceMinor)}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={styles.recentListingTitle}>
                      {listing.title}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <AppIcon name="list-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No properties listed yet</Text>
            <Text style={styles.emptyMessage}>
              Create your first property listing to sell with Beryl Shelter.
            </Text>
            <Button
              label="List a Property"
              onPress={() => router.push("/(tabs)/list")}
            />
          </Card>
        )}

        {/* Recent Messages Summary */}
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Recent Messages
          </Text>
          {recentMessages.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all messages"
              onPress={() => router.push("/dashboard/messages")}
            >
              <Text style={styles.seeAllLink}>See all</Text>
            </Pressable>
          )}
        </View>

        {recentMessages.length > 0 ? (
          <View style={styles.messagesList}>
            {recentMessages.map((msg) => (
              <Pressable
                key={msg.id}
                accessibilityRole="button"
                accessibilityLabel={`Message: ${msg.subject}`}
                onPress={() => router.push("/dashboard/messages")}
                style={styles.messageRow}
              >
                <View style={styles.messageAvatar}>
                  <Text style={styles.messageAvatarText}>
                    {msg.subject.trim().slice(0, 1).toUpperCase() || "M"}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.messageSubject}>
                  {msg.subject}
                </Text>
                <AppIcon name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <AppIcon name="chatbubble-ellipses-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyMessage}>
              Support and inquiry communications will appear here.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  greetingBox: {
    gap: spacing.xs,
  },
  greetingText: {
    ...typography.title,
    color: colors.text,
  },
  greetingSubtext: {
    ...typography.caption,
    color: colors.textMuted,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  kpiWrapper: {
    width: "48%",
    flexGrow: 1,
  },
  kpiCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: "#FBF1E5",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiTextCol: {
    flex: 1,
    gap: 2,
  },
  kpiLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  kpiValue: {
    ...typography.label,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  seeAllLink: {
    ...typography.label,
    color: colors.brandDark,
  },
  listingsList: {
    gap: spacing.sm,
  },
  recentListingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recentListingImg: {
    width: 64,
    height: 56,
    borderRadius: radius.sm,
  },
  recentListingImgPlaceholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  recentListingMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  recentListingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusChip: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  statusChip_success: { backgroundColor: "#E6F4EA" },
  statusChip_warning: { backgroundColor: "#FEF7E0" },
  statusChip_danger: { backgroundColor: "#FCE8E6" },
  statusChip_neutral: { backgroundColor: colors.surfaceMuted },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  statusChipText_success: { color: colors.success },
  statusChipText_warning: { color: colors.warning },
  statusChipText_danger: { color: colors.danger },
  statusChipText_neutral: { color: colors.textMuted },
  recentListingPrice: {
    ...typography.label,
    color: colors.brandDark,
  },
  recentListingTitle: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  messagesList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "#FBF1E5",
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatarText: {
    ...typography.label,
    color: colors.brandDark,
    fontWeight: "700",
  },
  messageSubject: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
});
