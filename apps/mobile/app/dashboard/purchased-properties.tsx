import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button, Card, LoadingState, ScreenState } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import { dashboardApi, type PurchasedProperty } from "@/lib/dashboard-api";
import { formatNaira } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function formatClosedDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

export default function PurchasedPropertiesScreen() {
  const [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [properties, setProperties] = useState<PurchasedProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    void dashboardApi
      .getPurchasedProperties({
        q: debouncedQuery,
        page: 1,
      })
      .then((response) => {
        if (!active) return;
        setProperties(response.items);
        setTotal(response.total);
        setPage(response.page);
        setTotalPages(response.totalPages);
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
  }, [debouncedQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const response = await dashboardApi.getPurchasedProperties({
        q: debouncedQuery,
        page: 1,
      });
      setProperties(response.items);
      setTotal(response.total);
      setPage(response.page);
      setTotalPages(response.totalPages);
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
      .getPurchasedProperties({
        q: debouncedQuery,
        page: 1,
      })
      .then((response) => {
        setProperties(response.items);
        setTotal(response.total);
        setPage(response.page);
        setTotalPages(response.totalPages);
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  async function handleLoadMore() {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await dashboardApi.getPurchasedProperties({
        q: debouncedQuery,
        page: nextPage,
      });
      setProperties((prev) => [...prev, ...response.items]);
      setTotal(response.total);
      setPage(response.page);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function renderPurchaseCard({ item }: { item: PurchasedProperty }) {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.placeholderBox}>
            <AppIcon name="home-outline" size={28} color={colors.brandDark} />
          </View>

          <View style={styles.cardHeaderMeta}>
            <View style={styles.topBadgeRow}>
              <View style={styles.approvedBadge}>
                <Text style={styles.approvedText}>Approved</Text>
              </View>
              <Text style={styles.propertyCode}>{item.propertyCode}</Text>
            </View>

            <Text numberOfLines={2} style={styles.propertyTitle}>
              {item.title}
            </Text>
          </View>
        </View>

        {/* Specifications */}
        <View style={styles.specsRow}>
          <View style={styles.specCell}>
            <Text style={styles.specKey}>State</Text>
            <Text style={styles.specVal}>{item.state}</Text>
          </View>
          <View style={styles.specCell}>
            <Text style={styles.specKey}>Type</Text>
            <Text style={styles.specVal}>{item.propertyType}</Text>
          </View>
          {item.propertySubtype && (
            <View style={styles.specCell}>
              <Text style={styles.specKey}>Subtype</Text>
              <Text style={styles.specVal}>{item.propertySubtype}</Text>
            </View>
          )}
        </View>

        {/* Price & Closed Date */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.priceLabel}>Purchase Price</Text>
            <Text style={styles.priceValue}>{formatNaira(item.priceMinor)}</Text>
          </View>

          <View style={styles.dateCol}>
            <Text style={styles.priceLabel}>Closed Date</Text>
            <Text style={styles.dateValue}>{formatClosedDate(item.closedAt)}</Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardNav active="purchased" />

      {/* Offline Verified Transaction Notice */}
      <View style={styles.offlineNoticeBanner}>
        <AppIcon name="shield-checkmark-outline" size={18} color={colors.brandDark} />
        <Text style={styles.offlineNoticeText}>
          Verified offline purchase records. Property purchases are completed offline with Beryl
          Shelter. There is no online property checkout in this app.
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <AppIcon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search by Title, Code, State…"
          placeholder="Search by Title, Code, State…"
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
          <LoadingState label="Loading purchased properties…" />
        </View>
      ) : error && properties.length === 0 ? (
        <View style={styles.centered}>
          <ScreenState
            title="Purchased Properties Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={handleRetry} />}
          />
        </View>
      ) : total === 0 && !debouncedQuery ? (
        <View style={styles.centered}>
          <Card style={styles.emptyContainer}>
            <AppIcon name="home-outline" size={48} color={colors.textMuted} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              No purchased properties yet
            </Text>
            <Text style={styles.emptyText}>
              Historical records of your verified offline property purchases with Beryl Shelter
              will appear here.
            </Text>
            <Button
              label="View Properties for Sale"
              onPress={() => router.push("/(tabs)/properties")}
            />
          </Card>
        </View>
      ) : properties.length === 0 ? (
        <View style={styles.centered}>
          <Card style={styles.emptyContainer}>
            <AppIcon name="search-outline" size={48} color={colors.textMuted} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              No matching purchased properties
            </Text>
            <Text style={styles.emptyText}>
              Try searching by a different title, code, or state.
            </Text>
            <Button
              label="Clear search"
              variant="secondary"
              onPress={() => setSearch("")}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => `${item.propertyCode}-${item.closedAt}`}
          renderItem={renderPurchaseCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              colors={[colors.brandDark]}
              tintColor={colors.brandDark}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreFooter}>
                <LoadingState label="Loading more purchases…" />
              </View>
            ) : null
          }
        />
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
  offlineNoticeBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "#FBF1E5",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#F0DFCA",
  },
  offlineNoticeText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
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
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  placeholderBox: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderMeta: {
    flex: 1,
    gap: 2,
  },
  topBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  approvedBadge: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  approvedText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },
  propertyCode: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  propertyTitle: {
    ...typography.heading,
    fontSize: 16,
    color: colors.text,
  },
  specsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    justifyContent: "space-around",
  },
  specCell: {
    alignItems: "center",
    gap: 2,
  },
  specKey: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  specVal: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  priceLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  priceValue: {
    ...typography.heading,
    fontSize: 16,
    color: colors.brandDark,
  },
  dateCol: {
    alignItems: "flex-end",
  },
  dateValue: {
    ...typography.label,
    color: colors.text,
  },
  emptyContainer: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    width: "100%",
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  loadMoreFooter: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
});
