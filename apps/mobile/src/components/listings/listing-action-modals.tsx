import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../app-icon";
import { Button } from "../ui";
import { friendlyError } from "@/lib/api-error";
import { listingsApi, type CustomerListing } from "@/lib/listings-api";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type UnlistModalProps = {
  visible: boolean;
  listing: CustomerListing;
  onClose: () => void;
  onSuccess: (updated: CustomerListing) => void;
};

export function UnlistModal({ visible, listing, onClose, onSuccess }: UnlistModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlist() {
    setSubmitting(true);
    setError("");
    try {
      const updated = await listingsApi.unlist(listing.id, listing.version);
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconCircleWarning}>
            <AppIcon name="alert-circle-outline" size={28} color={colors.warning} />
          </View>

          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Unlist Listing?
          </Text>

          <Text style={styles.dialogMessage}>
            Are you sure you want to unlist <Text style={styles.bold}>{listing.title}</Text> (
            {listing.listing_code})?
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>What happens next</Text>
            <Text style={styles.warningText}>
              The property will stop appearing in public Buy results and direct public property
              pages until it is reviewed and listed again.
            </Text>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Button label="Cancel" variant="secondary" disabled={submitting} onPress={onClose} />
            <Button
              label={submitting ? "Unlisting…" : "Unlist"}
              variant="danger"
              disabled={submitting}
              loading={submitting}
              onPress={handleUnlist}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type DeleteModalProps = {
  visible: boolean;
  listing: CustomerListing;
  onClose: () => void;
  onSuccess: () => void;
};

export function DeleteModal({ visible, listing, onClose, onSuccess }: DeleteModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setSubmitting(true);
    setError("");
    try {
      await listingsApi.delete(listing.id, listing.version);
      onSuccess();
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconCircleDanger}>
            <AppIcon name="trash-outline" size={28} color={colors.danger} />
          </View>

          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Delete Listing?
          </Text>

          <Text style={styles.dialogMessage}>
            Are you sure you want to permanently delete{" "}
            <Text style={styles.bold}>{listing.title}</Text> ({listing.listing_code})?
          </Text>

          <View style={[styles.warningBox, styles.dangerBox]}>
            <Text style={[styles.warningTitle, styles.dangerTitle]}>Warning</Text>
            <Text style={styles.warningText}>
              This removes the property and its attached listing media permanently. This action
              cannot be reversed.
            </Text>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Button label="Cancel" variant="secondary" disabled={submitting} onPress={onClose} />
            <Button
              label={submitting ? "Deleting…" : "Delete"}
              variant="danger"
              disabled={submitting}
              loading={submitting}
              onPress={handleDelete}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type RejectionModalProps = {
  visible: boolean;
  listing: CustomerListing;
  onClose: () => void;
  onMakeChanges: () => void;
  onResubmit: () => void;
};

export function RejectionModal({
  visible,
  listing,
  onClose,
  onMakeChanges,
  onResubmit,
}: RejectionModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rejectedDate = listing.rejected_at
    ? new Date(listing.rejected_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.rejectionHeader}>
            <View style={styles.rejectionTitleRow}>
              <View style={styles.statusBadgeRejected}>
                <Text style={styles.statusBadgeText}>Rejected</Text>
              </View>
              <Text style={styles.rejectionListingCode}>{listing.listing_code}</Text>
            </View>
            <Text numberOfLines={2} style={styles.rejectionListingTitle}>
              {listing.title}
            </Text>
          </View>

          <View style={styles.reviewAlert}>
            <Text style={styles.reviewAlertTitle}>A few changes needed</Text>
            <Text style={styles.reviewAlertText}>
              {rejectedDate ? `We reviewed your listing on ${rejectedDate}. ` : ""}
              Fix the requested items and send it back for review.
            </Text>
          </View>

          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>From Beryl Review Team</Text>
            <Text style={styles.feedbackBody}>
              {listing.rejection_reason ||
                "No specific review feedback was provided. Please check property details and resubmit."}
            </Text>
          </View>

          <View style={styles.rejectionActions}>
            <Button label="Make changes" onPress={onMakeChanges} />
            <Button
              label="Resubmit for Review"
              variant="secondary"
              onPress={onResubmit}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close review dialog"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    dialog: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      width: "100%",
      maxWidth: 400,
      gap: spacing.md,
    },
    iconCircleWarning: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTint,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
    iconCircleDanger: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
    dialogTitle: {
      ...typography.title,
      color: colors.text,
      textAlign: "center",
    },
    dialogMessage: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: "center",
    },
    bold: {
      fontWeight: "700",
      color: colors.text,
    },
    warningBox: {
      backgroundColor: colors.brandTint,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    warningTitle: {
      ...typography.label,
      color: colors.warning,
    },
    warningText: {
      ...typography.caption,
      color: colors.text,
    },
    dangerBox: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    dangerTitle: {
      color: colors.danger,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
      marginTop: spacing.xs,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      textAlign: "center",
    },
    rejectionHeader: {
      gap: spacing.xs,
    },
    rejectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    statusBadgeRejected: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    statusBadgeText: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.danger,
    },
    rejectionListingCode: {
      ...typography.caption,
      color: colors.textMuted,
    },
    rejectionListingTitle: {
      ...typography.heading,
      color: colors.text,
    },
    reviewAlert: {
      backgroundColor: colors.brandTint,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    reviewAlertTitle: {
      ...typography.label,
      color: colors.brandDark,
    },
    reviewAlertText: {
      ...typography.caption,
      color: colors.text,
    },
    feedbackCard: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    feedbackTitle: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "700",
    },
    feedbackBody: {
      ...typography.body,
      color: colors.text,
    },
    rejectionActions: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    closeBtn: {
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    closeBtnText: {
      ...typography.label,
      color: colors.textMuted,
    },
  });
}
