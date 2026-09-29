import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
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
import {
  DeleteModal,
  RejectionModal,
  UnlistModal,
} from "@/components/listings/listing-action-modals";
import { Button, Card, LoadingState, ScreenState } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import {
  listingsApi,
  listingStatusPresentation,
  type CustomerListing,
  type ListingStatus,
} from "@/lib/listings-api";
import { formatNaira } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type FilterOption = {
  label: string;
  value: "" | ListingStatus;
};

const filterTabs: FilterOption[] = [
  { label: "All", value: "" },
  { label: "Approved", value: "LISTED" },
  { label: "Pending", value: "PENDING" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Unlisted", value: "UNLISTED" },
];

export default function MyListingsScreen() {
  const [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | ListingStatus>("");

  const [listings, setListings] = useState<CustomerListing[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    UNLISTED: 0,
    PENDING: 0,
    LISTED: 0,
    REJECTED: 0,
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Modals state
  const [activeModal, setActiveModal] = useState<
    | { type: "unlist"; listing: CustomerListing }
    | { type: "delete"; listing: CustomerListing }
    | { type: "rejection"; listing: CustomerListing }
    | null
  >(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    void listingsApi
      .list({
        q: debouncedQuery,
        status: selectedStatus,
        page: 1,
      })
      .then((response) => {
        if (!active) return;
        setListings(response.items);
        setCounts(response.counts);
        setPage(response.page);
        setTotalPages(response.total_pages);
      })
      .catch((err) => {
        if (!active) return;
        setError(friendlyError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, selectedStatus]);

  function handleFilterSelect(statusValue: "" | ListingStatus) {
    setLoading(true);
    setSelectedStatus(statusValue);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await listingsApi.list({
        q: debouncedQuery,
        status: selectedStatus,
        page: 1,
      });
      setListings(response.items);
      setCounts(response.counts);
      setPage(response.page);
      setTotalPages(response.total_pages);
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await listingsApi.list({
        q: debouncedQuery,
        status: selectedStatus,
        page: nextPage,
      });
      setListings((prev) => [...prev, ...response.items]);
      setCounts(response.counts);
      setPage(response.page);
      setTotalPages(response.total_pages);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRetry() {
    setLoading(true);
    setError("");
    void listingsApi
      .list({
        q: debouncedQuery,
        status: selectedStatus,
        page: 1,
      })
      .then((response) => {
        setListings(response.items);
        setCounts(response.counts);
        setPage(response.page);
        setTotalPages(response.total_pages);
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  function renderListingItem({ item }: { item: CustomerListing }) {
    const { label: statusLabel, tone: statusTone } = listingStatusPresentation(
      item.listing_status
    );
    const place = [item.city, item.state].filter(Boolean).join(", ") || item.location;
    const completeness = item.completeness ?? 0;
    const timeOnMarket =
      item.time_on_market !== null && item.time_on_market !== undefined
        ? `${item.time_on_market} days`
        : "Not listed";

    const isEditable =
      item.listing_status === "UNLISTED" || item.listing_status === "REJECTED";

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          {item.images[0] ? (
            <Image
              source={{ uri: item.images[0].url }}
              style={styles.propertyThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.propertyThumb, styles.thumbPlaceholder]}>
              <AppIcon name="home-outline" size={24} color={colors.textMuted} />
            </View>
          )}

          <View style={styles.cardMainInfo}>
            <View style={styles.cardTopRow}>
              <View style={[styles.statusChip, styles[`statusChip_${statusTone}`]]}>
                <Text style={[styles.statusChipText, styles[`statusChipText_${statusTone}`]]}>
                  {statusLabel}
                </Text>
              </View>
              <Text style={styles.listingCode}>{item.listing_code}</Text>
            </View>

            <Text numberOfLines={2} style={styles.propertyTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={styles.placeText}>
              {place}
            </Text>
          </View>
        </View>

        {/* Facts Row */}
        <View style={styles.factsRow}>
          <Text style={styles.factText}>{item.bedrooms} Bed</Text>
          <Text style={styles.factDivider}>•</Text>
          <Text style={styles.factText}>{item.bathrooms} Bath</Text>
          <Text style={styles.factDivider}>•</Text>
          <Text style={styles.factText}>{item.parking_spaces} Parking</Text>
          {item.land_area !== null && (
            <>
              <Text style={styles.factDivider}>•</Text>
              <Text style={styles.factText}>{item.land_area} sqm</Text>
            </>
          )}
        </View>

        {/* Pricing & Market Duration */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{formatNaira(item.property_cost_minor)}</Text>
          </View>
          <View style={styles.marketCol}>
            <Text style={styles.priceLabel}>Time on Market</Text>
            <Text style={styles.marketValue}>{timeOnMarket}</Text>
          </View>
        </View>

        {/* Completeness Bar */}
        <View style={styles.completenessRow}>
          <View style={styles.completenessHeader}>
            <Text style={styles.completenessLabel}>Completeness</Text>
            <Text style={styles.completenessPercent}>{completeness}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, Math.max(0, completeness))}%` },
              ]}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            label="View"
            variant="secondary"
            onPress={() => router.push(`/dashboard/listings/${item.id}` as never)}
          />

          {isEditable && (
            <Button
              label={item.listing_status === "REJECTED" ? "Make changes" : "Edit"}
              variant="secondary"
              onPress={() => router.push(`/(tabs)/list?draftId=${item.id}` as never)}
            />
          )}

          {item.listing_status === "REJECTED" && (
            <Button
              label="See reason"
              variant="primary"
              onPress={() => setActiveModal({ type: "rejection", listing: item })}
            />
          )}

          {item.listing_status === "LISTED" && (
            <Button
              label="Unlist"
              variant="danger"
              onPress={() => setActiveModal({ type: "unlist", listing: item })}
            />
          )}

          {isEditable && (
            <Button
              label="Delete"
              variant="danger"
              onPress={() => setActiveModal({ type: "delete", listing: item })}
            />
          )}
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardNav active="listings" />

      {/* Header bar with CTA */}
      <View style={styles.topHeader}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          My Listings
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create listing"
          onPress={() => router.push("/(tabs)/list")}
          style={styles.createBtn}
        >
          <AppIcon name="add" size={18} color="#FFF" />
          <Text style={styles.createBtnText}>Create Listing</Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <AppIcon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search listings"
          placeholder="Search by title, code or location"
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

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {filterTabs.map((tab) => {
          const isSelected = selectedStatus === tab.value;
          const count =
            tab.value === ""
              ? counts.all
              : counts[tab.value as keyof typeof counts] ?? 0;

          return (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} listings, ${count}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleFilterSelect(tab.value)}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
            >
              <Text
                style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
              >
                {tab.label}
              </Text>
              <View
                style={[styles.countBadge, isSelected && styles.countBadgeActive]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    isSelected && styles.countBadgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <LoadingState label="Loading your listings…" />
        </View>
      ) : error && listings.length === 0 ? (
        <View style={styles.centered}>
          <ScreenState
            title="Listings Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={handleRetry} />}
          />
        </View>
      ) : counts.all === 0 && !debouncedQuery ? (
        <View style={styles.centered}>
          <Card style={styles.emptyContainer}>
            <AppIcon name="list-outline" size={48} color={colors.textMuted} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              No listings yet
            </Text>
            <Text style={styles.emptyText}>
              Properties you list for sale will appear here with review status and management
              tools.
            </Text>
            <Button
              label="＋ Create a listing"
              onPress={() => router.push("/(tabs)/list")}
            />
          </Card>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.centered}>
          <Card style={styles.emptyContainer}>
            <AppIcon name="search-outline" size={48} color={colors.textMuted} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              No matching listings
            </Text>
            <Text style={styles.emptyText}>
              Try another search term or change your status filter.
            </Text>
            <Button
              label="Clear filters"
              variant="secondary"
              onPress={() => {
                setSearch("");
                setSelectedStatus("");
              }}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => `${item.id}-${item.version}`}
          renderItem={renderListingItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.brandDark]}
              tintColor={colors.brandDark}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreFooter}>
                <LoadingState label="Loading more listings…" />
              </View>
            ) : null
          }
        />
      )}

      {/* Modals */}
      {activeModal?.type === "unlist" && (
        <UnlistModal
          visible
          listing={activeModal.listing}
          onClose={() => setActiveModal(null)}
          onSuccess={(updated) => {
            setListings((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            );
            void handleRefresh();
          }}
        />
      )}

      {activeModal?.type === "delete" && (
        <DeleteModal
          visible
          listing={activeModal.listing}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setListings((prev) => prev.filter((item) => item.id !== activeModal.listing.id));
            void handleRefresh();
          }}
        />
      )}

      {activeModal?.type === "rejection" && (
        <RejectionModal
          visible
          listing={activeModal.listing}
          onClose={() => setActiveModal(null)}
          onMakeChanges={() => {
            const id = activeModal.listing.id;
            setActiveModal(null);
            router.push(`/(tabs)/list?draftId=${id}` as never);
          }}
          onResubmit={async () => {
            const item = activeModal.listing;
            setActiveModal(null);
            try {
              await listingsApi.requestApproval(item.id, item.version);
              void handleRefresh();
            } catch {
              // fall through to refresh
              void handleRefresh();
            }
          }}
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
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  pageTitle: {
    ...typography.title,
    color: colors.text,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.action,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  createBtnText: {
    ...typography.label,
    color: colors.actionText,
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
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  filterChipActive: {
    backgroundColor: colors.brandDark,
  },
  filterChipText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: "#FFF",
  },
  countBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  countBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  countBadgeTextActive: {
    color: "#FFF",
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
  },
  propertyThumb: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
  },
  thumbPlaceholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMainInfo: {
    flex: 1,
    gap: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listingCode: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  propertyTitle: {
    ...typography.label,
    color: colors.text,
    fontWeight: "700",
  },
  placeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  factsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  factText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text,
    fontWeight: "500",
  },
  factDivider: {
    color: colors.border,
  },
  priceRow: {
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
    color: colors.success,
  },
  marketCol: {
    alignItems: "flex-end",
  },
  marketValue: {
    ...typography.label,
    color: colors.text,
  },
  completenessRow: {
    gap: 4,
  },
  completenessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completenessLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  completenessPercent: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.brandDark,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
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
