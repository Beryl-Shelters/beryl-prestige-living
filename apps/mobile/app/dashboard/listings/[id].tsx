import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AppIcon } from "@/components/app-icon";
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
} from "@/lib/listings-api";
import { formatNaira } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function OwnerListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<CustomerListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    "unlist" | "delete" | "rejection" | null
  >(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void listingsApi
      .get(id)
      .then((data) => {
        if (active) setListing(data);
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
  }, [id]);

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    void listingsApi
      .get(id)
      .then((data) => setListing(data))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <LoadingState label="Loading listing details…" />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centered}>
        <ScreenState
          title="Listing Unavailable"
          message={error || "Could not find this listing."}
          action={<Button label="Back to Listings" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const { label: statusLabel, tone: statusTone } = listingStatusPresentation(
    listing.listing_status
  );
  const place = [listing.city, listing.state].filter(Boolean).join(", ") || listing.location;
  const isEditable =
    listing.listing_status === "UNLISTED" || listing.listing_status === "REJECTED";

  const mainImage = listing.images[selectedImgIndex] || listing.images[0];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Gallery */}
        <View style={styles.gallery}>
          {mainImage ? (
            <Image
              source={{ uri: mainImage.url }}
              style={styles.mainImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <AppIcon name="image-outline" size={48} color={colors.textMuted} />
              <Text style={styles.placeholderText}>No property photos</Text>
            </View>
          )}

          {listing.images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
            >
              {listing.images.map((img, idx) => (
                <Pressable
                  key={img.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo ${idx + 1}`}
                  onPress={() => setSelectedImgIndex(idx)}
                  style={[
                    styles.thumbWrap,
                    selectedImgIndex === idx && styles.thumbWrapActive,
                  ]}
                >
                  <Image source={{ uri: img.url }} style={styles.thumb} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Header Information */}
        <Card style={styles.sectionCard}>
          <View style={styles.topStatusRow}>
            <View style={[styles.statusChip, styles[`statusChip_${statusTone}`]]}>
              <Text style={[styles.statusChipText, styles[`statusChipText_${statusTone}`]]}>
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.codeText}>Code: {listing.listing_code}</Text>
          </View>

          <Text accessibilityRole="header" style={styles.propertyTitle}>
            {listing.title}
          </Text>
          <Text style={styles.propertySubtitle}>
            {listing.bedrooms} Bedroom {listing.property_subtype} • {place}
          </Text>

          {/* Quick Facts */}
          <View style={styles.factsGrid}>
            <View style={styles.factCell}>
              <AppIcon name="bed-outline" size={18} color={colors.brandDark} />
              <Text style={styles.factVal}>{listing.bedrooms} Beds</Text>
            </View>
            <View style={styles.factCell}>
              <AppIcon name="water-outline" size={18} color={colors.brandDark} />
              <Text style={styles.factVal}>{listing.bathrooms} Baths</Text>
            </View>
            <View style={styles.factCell}>
              <AppIcon name="car-outline" size={18} color={colors.brandDark} />
              <Text style={styles.factVal}>{listing.parking_spaces} Parking</Text>
            </View>
            {listing.land_area !== null && (
              <View style={styles.factCell}>
                <AppIcon name="expand-outline" size={18} color={colors.brandDark} />
                <Text style={styles.factVal}>{listing.land_area} sqm</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Pending Review Alert if Pending */}
        {listing.listing_status === "PENDING" && (
          <Card style={styles.pendingCard}>
            <View style={styles.pendingTitleRow}>
              <AppIcon name="time-outline" size={24} color={colors.warning} />
              <Text style={styles.pendingHeading}>Under Review</Text>
            </View>
            <Text style={styles.pendingText}>
              This property is currently under review by the Beryl team. While under review,
              details cannot be edited or unlisted.
            </Text>
          </Card>
        )}

        {/* Rejection Alert if Rejected */}
        {listing.listing_status === "REJECTED" && (
          <Card style={styles.rejectionCard}>
            <View style={styles.rejectionTitleRow}>
              <AppIcon name="alert-circle-outline" size={24} color={colors.danger} />
              <Text style={styles.rejectionHeading}>Changes Needed</Text>
            </View>
            <Text style={styles.rejectionReasonText}>
              {listing.rejection_reason ||
                "Review feedback was submitted. Please check the property details and resubmit."}
            </Text>
            <View style={styles.rejectionBtnRow}>
              <Button
                label="Make changes"
                variant="primary"
                onPress={() => router.push(`/(tabs)/list?draftId=${listing.id}` as never)}
              />
              <Button
                label="Resubmit for Review"
                variant="secondary"
                onPress={async () => {
                  try {
                    await listingsApi.submit(listing.id);
                    void reload();
                  } catch (err) {
                    setError(friendlyError(err));
                  }
                }}
              />
            </View>
          </Card>
        )}

        {/* Pricing & Terms */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardHeader}>Pricing & Payment Terms</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceKey}>Property Cost</Text>
            <Text style={styles.priceVal}>{formatNaira(listing.property_cost_minor)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceKey}>Minimum Down Payment</Text>
            <Text style={styles.priceVal}>
              {formatNaira(listing.minimum_down_payment_minor)}
            </Text>
          </View>
          <View style={styles.offlineNotice}>
            <AppIcon name="information-circle-outline" size={16} color={colors.brandDark} />
            <Text style={styles.offlineNoticeText}>
              Informational only. Property purchases are completed offline with Beryl Shelter.
              There is no online property checkout in this app.
            </Text>
          </View>
        </Card>

        {/* Description */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardHeader}>Description</Text>
          <Text
            numberOfLines={descriptionExpanded ? undefined : 4}
            style={styles.descriptionText}
          >
            {listing.description}
          </Text>
          {listing.description.length > 180 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={descriptionExpanded ? "Show less" : "Show full description"}
              onPress={() => setDescriptionExpanded((prev) => !prev)}
              style={styles.expandBtn}
            >
              <Text style={styles.expandBtnText}>
                {descriptionExpanded ? "Show less" : "Show full description"}
              </Text>
            </Pressable>
          )}
        </Card>

        {/* Property Specs */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardHeader}>Property Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Occupancy Type</Text>
            <Text style={styles.detailVal}>{listing.occupancy_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Ownership Type</Text>
            <Text style={styles.detailVal}>{listing.ownership_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Property Type</Text>
            <Text style={styles.detailVal}>{listing.property_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Property Subtype</Text>
            <Text style={styles.detailVal}>{listing.property_subtype}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Lien Recorded</Text>
            <Text style={styles.detailVal}>{listing.has_lien ? "Yes" : "No"}</Text>
          </View>
          {listing.registered_title_document ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Registered Title Document</Text>
              <Text style={styles.detailVal}>{listing.registered_title_document}</Text>
            </View>
          ) : null}
          {listing.year_built !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Year Built</Text>
              <Text style={styles.detailVal}>{listing.year_built}</Text>
            </View>
          )}
          {listing.units !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Units</Text>
              <Text style={styles.detailVal}>{listing.units}</Text>
            </View>
          )}
        </Card>

        {/* Facilities */}
        {listing.facilities.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.cardHeader}>Facilities & Features</Text>
            <View style={styles.facilitiesWrap}>
              {listing.facilities.map((fac) => (
                <View key={fac} style={styles.facilityPill}>
                  <AppIcon name="checkmark" size={14} color={colors.brandDark} />
                  <Text style={styles.facilityText}>{fac}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Owner Details */}
        {listing.owner && (
          <Card style={styles.sectionCard}>
            <Text style={styles.cardHeader}>Owner Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Name</Text>
              <Text style={styles.detailVal}>{listing.owner.full_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Email</Text>
              <Text style={styles.detailVal}>{listing.owner.email}</Text>
            </View>
            {listing.owner.phone ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Phone</Text>
                <Text style={styles.detailVal}>{listing.owner.phone}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Actions Card */}
        <Card style={styles.actionsCard}>
          <Text style={styles.cardHeader}>Listing Management</Text>

          {isEditable && (
            <Button
              label={listing.listing_status === "REJECTED" ? "Make changes" : "Edit Listing"}
              variant="primary"
              onPress={() => router.push(`/(tabs)/list?draftId=${listing.id}` as never)}
            />
          )}

          {listing.listing_status === "REJECTED" && (
            <Button
              label="Review Rejection Reason"
              variant="secondary"
              onPress={() => setActiveModal("rejection")}
            />
          )}

          {listing.listing_status === "LISTED" && (
            <Button
              label="Unlist Property"
              variant="danger"
              onPress={() => setActiveModal("unlist")}
            />
          )}

          {isEditable && (
            <Button
              label="Delete Listing"
              variant="danger"
              onPress={() => setActiveModal("delete")}
            />
          )}
        </Card>
      </ScrollView>

      {/* Modals */}
      {activeModal === "unlist" && (
        <UnlistModal
          visible
          listing={listing}
          onClose={() => setActiveModal(null)}
          onSuccess={(updated) => {
            setListing(updated);
            void reload();
          }}
        />
      )}

      {activeModal === "delete" && (
        <DeleteModal
          visible
          listing={listing}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            router.replace("/dashboard/listings");
          }}
        />
      )}

      {activeModal === "rejection" && (
        <RejectionModal
          visible
          listing={listing}
          onClose={() => setActiveModal(null)}
          onMakeChanges={() => {
            setActiveModal(null);
            router.push(`/(tabs)/list?draftId=${listing.id}` as never);
          }}
          onResubmit={async () => {
            setActiveModal(null);
            try {
              await listingsApi.submit(listing.id);
              void reload();
            } catch {
              void reload();
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  gallery: {
    gap: spacing.sm,
  },
  mainImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.lg,
  },
  imagePlaceholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  thumbRow: {
    gap: spacing.xs,
  },
  thumbWrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbWrapActive: {
    borderColor: colors.brand,
  },
  thumb: {
    width: 60,
    height: 50,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  topStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  propertyTitle: {
    ...typography.title,
    color: colors.text,
  },
  propertySubtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  factsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  factCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  factVal: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  cardHeader: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  priceKey: {
    ...typography.body,
    color: colors.textMuted,
  },
  priceVal: {
    ...typography.heading,
    color: colors.brandDark,
  },
  offlineNotice: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: "#FBF1E5",
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: "flex-start",
    marginTop: spacing.xs,
  },
  offlineNoticeText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    fontSize: 12,
  },
  descriptionText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  expandBtn: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  expandBtnText: {
    ...typography.label,
    color: colors.brandDark,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailKey: {
    ...typography.body,
    color: colors.textMuted,
  },
  detailVal: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    paddingLeft: spacing.md,
  },
  facilitiesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  facilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  facilityText: {
    ...typography.caption,
    color: colors.text,
  },
  pendingCard: {
    backgroundColor: "#FEF7E0",
    borderColor: "#FEEFC3",
    gap: spacing.sm,
  },
  pendingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pendingHeading: {
    ...typography.heading,
    color: colors.warning,
  },
  pendingText: {
    ...typography.body,
    color: colors.text,
  },
  rejectionCard: {
    backgroundColor: "#FDEDED",
    borderColor: "#F5C6CB",
    gap: spacing.sm,
  },
  rejectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rejectionHeading: {
    ...typography.heading,
    color: colors.danger,
  },
  rejectionReasonText: {
    ...typography.body,
    color: colors.text,
  },
  rejectionBtnRow: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionsCard: {
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusChip_success: { backgroundColor: "#E6F4EA" },
  statusChip_warning: { backgroundColor: "#FEF7E0" },
  statusChip_danger: { backgroundColor: "#FCE8E6" },
  statusChip_neutral: { backgroundColor: colors.surfaceMuted },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  statusChipText_success: { color: colors.success },
  statusChipText_warning: { color: colors.warning },
  statusChipText_danger: { color: colors.danger },
  statusChipText_neutral: { color: colors.textMuted },
});
