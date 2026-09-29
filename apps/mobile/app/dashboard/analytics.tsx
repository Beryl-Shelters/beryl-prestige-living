import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppIcon } from "@/components/app-icon";
import { AnalyticsChart } from "@/components/dashboard/analytics-chart";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button, Card, LoadingState, ScreenState } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import { dashboardApi, type CustomerAnalytics } from "@/lib/dashboard-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function DashboardAnalyticsScreen() {
  const [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [year, setYear] = useState(() => new Date().getFullYear());

  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    void dashboardApi
      .getAnalytics({
        q: debouncedQuery,
        year,
      })
      .then((data) => {
        if (active) setAnalytics(data);
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
  }, [debouncedQuery, year]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const data = await dashboardApi.getAnalytics({
        q: debouncedQuery,
        year,
      });
      setAnalytics(data);
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
      .getAnalytics({
        q: debouncedQuery,
        year,
      })
      .then((data) => setAnalytics(data))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  const overview = analytics?.listingsOverview;
  const bedrooms = analytics?.bedrooms;
  const propertyTypes = analytics?.propertyTypes;

  const bedroomKeys: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];

  return (
    <View style={styles.container}>
      <DashboardNav active="analytics" />

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <AppIcon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search your listings by title or code"
          placeholder="Search your listings by title or code"
          placeholderTextColor="#9C948C"
          value={search}
          onChangeText={setSearch}
          maxLength={100}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch("")}
          >
            <AppIcon name="close-circle-outline" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <LoadingState label="Loading analytics…" />
        </View>
      ) : error && !analytics ? (
        <View style={styles.centered}>
          <ScreenState
            title="Analytics Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={handleRetry} />}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              colors={[colors.brandDark]}
              tintColor={colors.brandDark}
            />
          }
        >
          {/* Category Performance Chart */}
          {analytics ? (
            <AnalyticsChart analytics={analytics} changeYear={(y) => setYear(y)} />
          ) : null}

          {/* Listings Overview */}
          {overview ? (
            <Card style={styles.overviewCard}>
              <Text accessibilityRole="header" style={styles.cardHeading}>
                Listings Overview
              </Text>

              <View style={styles.totalBadge}>
                <Text style={styles.totalNumber}>{overview.total}</Text>
                <Text style={styles.totalLabel}>Total Listings</Text>
              </View>

              <View style={styles.statusBreakdown}>
                {/* Listed / Approved */}
                <View style={styles.statusItem}>
                  <View style={styles.statusHeader}>
                    <Text style={styles.statusTitle}>Approved</Text>
                    <Text style={styles.statusValue}>
                      {overview.listed.count} (
                      {new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(
                        overview.listed.percentage
                      )}
                      %)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        styles.fillApproved,
                        { width: `${Math.min(100, overview.listed.percentage)}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Pending */}
                <View style={styles.statusItem}>
                  <View style={styles.statusHeader}>
                    <Text style={styles.statusTitle}>Pending</Text>
                    <Text style={styles.statusValue}>
                      {overview.pending.count} (
                      {new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(
                        overview.pending.percentage
                      )}
                      %)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        styles.fillPending,
                        { width: `${Math.min(100, overview.pending.percentage)}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Rejected */}
                <View style={styles.statusItem}>
                  <View style={styles.statusHeader}>
                    <Text style={styles.statusTitle}>Rejected</Text>
                    <Text style={styles.statusValue}>
                      {overview.rejected.count} (
                      {new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(
                        overview.rejected.percentage
                      )}
                      %)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        styles.fillRejected,
                        { width: `${Math.min(100, overview.rejected.percentage)}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Unlisted (if provided) */}
                {overview.unlisted ? (
                  <View style={styles.statusItem}>
                    <View style={styles.statusHeader}>
                      <Text style={styles.statusTitle}>Unlisted</Text>
                      <Text style={styles.statusValue}>
                        {overview.unlisted.count} (
                        {new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(
                          overview.unlisted.percentage
                        )}
                        %)
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          styles.fillUnlisted,
                          { width: `${Math.min(100, overview.unlisted.percentage)}%` },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* Bedrooms Breakdown */}
          {bedrooms ? (
            <Card style={styles.breakdownCard}>
              <Text accessibilityRole="header" style={styles.cardHeading}>
                Bedrooms Contained in Properties
              </Text>
              <View style={styles.gridList}>
                {bedroomKeys.map((key) => {
                  const label = key === 1 ? "1 bedroom" : key === 6 ? "6+ bedrooms" : `${key} bedrooms`;
                  return (
                    <View key={key} style={styles.gridItem}>
                      <Text style={styles.gridLabel}>{label}</Text>
                      <Text style={styles.gridCount}>{bedrooms[key] ?? 0}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {/* Property Types Breakdown */}
          {propertyTypes ? (
            <Card style={styles.breakdownCard}>
              <Text accessibilityRole="header" style={styles.cardHeading}>
                Property Type Distribution
              </Text>
              <View style={styles.gridList}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Residential</Text>
                  <Text style={styles.gridCount}>{propertyTypes.residential ?? 0}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Commercial</Text>
                  <Text style={styles.gridCount}>{propertyTypes.commercial ?? 0}</Text>
                </View>
              </View>
            </Card>
          ) : null}
        </ScrollView>
      )}
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
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  overviewCard: {
    gap: spacing.md,
  },
  cardHeading: {
    ...typography.heading,
    color: colors.text,
  },
  totalBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: 2,
  },
  totalNumber: {
    ...typography.display,
    color: colors.text,
    fontSize: 36,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  statusBreakdown: {
    gap: spacing.md,
  },
  statusItem: {
    gap: 4,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: {
    ...typography.label,
    color: colors.text,
  },
  statusValue: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  fillApproved: {
    backgroundColor: colors.success,
  },
  fillPending: {
    backgroundColor: colors.warning,
  },
  fillRejected: {
    backgroundColor: colors.danger,
  },
  fillUnlisted: {
    backgroundColor: colors.textMuted,
  },
  breakdownCard: {
    gap: spacing.md,
  },
  gridList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gridItem: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  gridLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  gridCount: {
    ...typography.label,
    color: colors.brandDark,
    fontWeight: "700",
  },
});
