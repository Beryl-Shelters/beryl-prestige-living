import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { AppIcon } from "@/components/app-icon";
import { Button, Card, LoadingState, ScreenState, SectionHeading } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import {
  kycApi,
  type KycDocumentType,
  type KycView,
} from "@/lib/kyc-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "United Kingdom",
  "United States",
  "Canada",
];

const DOC_TYPES: { value: KycDocumentType; label: string }[] = [
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVERS_LICENSE", label: "Driver's License" },
  { value: "NATIONAL_ID", label: "National ID" },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB

function formatSubmittedDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function KycScreen() {
  const [view, setView] = useState<KycView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form State
  const [country, setCountry] = useState("Nigeria");
  const [documentType, setDocumentType] = useState<KycDocumentType>("PASSPORT");
  const [frontFile, setFrontFile] = useState<PickedFile | null>(null);
  const [backFile, setBackFile] = useState<PickedFile | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    void kycApi
      .getKyc()
      .then((data) => {
        if (!active) return;
        setView(data);
        if (data.status === "REJECTED") {
          if (data.country) setCountry(data.country);
          if (data.documentType) setDocumentType(data.documentType);
        }
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
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    setSuccess("");
    try {
      const data = await kycApi.getKyc();
      setView(data);
      if (data.status === "REJECTED") {
        if (data.country) setCountry(data.country);
        if (data.documentType) setDocumentType(data.documentType);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePickFile(side: "front" | "back") {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset) return;
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        setError("Document file must be 10 MiB or smaller.");
        return;
      }

      const file: PickedFile = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/octet-stream",
        size: asset.size,
      };

      if (side === "front") {
        setFrontFile(file);
      } else {
        setBackFile(file);
      }
    } catch {
      setError("Could not select document.");
    }
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");

    if (!country.trim()) {
      setError("Please select or enter your country.");
      return;
    }
    if (!documentType) {
      setError("Please select a document type.");
      return;
    }
    if (!frontFile) {
      setError("Please upload the front of your document.");
      return;
    }
    if (documentType !== "PASSPORT" && !backFile) {
      setError("Please upload the back of your document.");
      return;
    }
    if (!declarationAccepted) {
      setError("You must confirm that you uploaded a valid government-issued photo ID.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await kycApi.submitKyc(
        { country, documentType },
        frontFile,
        documentType === "PASSPORT" ? undefined : (backFile ?? undefined)
      );
      setView(updated);
      setSuccess("KYC submitted for review.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState label="Checking verification status..." />
      </View>
    );
  }

  if (error && !view) {
    return (
      <View style={styles.screen}>
        <Card style={styles.errorCard}>
          <ScreenState
            title="Verification Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={() => void handleRefresh()} />}
          />
        </Card>
      </View>
    );
  }

  const isLocked = view?.status === "PENDING_REVIEW" || view?.status === "APPROVED";
  const isApproved = view?.status === "APPROVED";
  const isRejected = view?.status === "REJECTED";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
      >
        <SectionHeading
          title="KYC Verification"
          description="Verify your identity with government-issued photo identification."
        />

        {success ? (
          <View style={styles.successBanner}>
            <AppIcon name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <AppIcon name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* LOCKED STATUS (PENDING_REVIEW OR APPROVED) */}
        {isLocked ? (
          <Card style={styles.statusCard}>
            <View style={styles.statusIconCircle}>
              <AppIcon
                name={isApproved ? "shield-checkmark" : "time-outline"}
                size={32}
                color={isApproved ? "#166534" : "#92400E"}
              />
            </View>

            <View
              style={[
                styles.statusBadge,
                isApproved ? styles.statusBadgeApproved : styles.statusBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isApproved ? styles.statusTextApproved : styles.statusTextPending,
                ]}
              >
                {isApproved ? "Approved" : "Pending Review"}
              </Text>
            </View>

            <Text style={styles.statusTitle}>
              {isApproved
                ? "Your identity verification is approved"
                : "Your documents are awaiting review"}
            </Text>

            <Text style={styles.statusDescription}>
              {isApproved
                ? "Your approved submission cannot be replaced from this page."
                : "Your documents have been received securely and are being reviewed by our verification team. We will update your status when the review is complete."}
            </Text>

            {view?.submittedAt ? (
              <Text style={styles.submittedDateText}>
                Submitted {formatSubmittedDate(view.submittedAt)}
              </Text>
            ) : null}
          </Card>
        ) : (
          /* NOT_SUBMITTED OR REJECTED (ALLOW RESUBMISSION) */
          <>
            {/* Rejection Notice */}
            {isRejected && (
              <View style={styles.rejectedBanner}>
                <View style={styles.rejectedHeader}>
                  <AppIcon name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.rejectedTitle}>Submission rejected</Text>
                </View>
                <Text style={styles.rejectedReason}>
                  {view?.rejectionReason ||
                    "Please review your details and submit new documents."}
                </Text>
              </View>
            )}

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Upload proof of identity</Text>
              <Text style={styles.cardSubtitle}>
                Beryl Shelter Nigeria Limited requires a valid government-issued ID
                (Passport, Driver&apos;s License, or National ID).
              </Text>

              {/* Country Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Issuing Country *</Text>
                <View style={styles.pickerRow}>
                  {COUNTRIES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCountry(c)}
                      style={[
                        styles.countryChip,
                        country === c && styles.countryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.countryChipText,
                          country === c && styles.countryChipTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, styles.countryCustomInput]}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="Or enter country name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Document Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Document Type *</Text>
                <View style={styles.docTypeRow}>
                  {DOC_TYPES.map((dt) => (
                    <Pressable
                      key={dt.value}
                      onPress={() => {
                        setDocumentType(dt.value);
                        if (dt.value === "PASSPORT") {
                          setBackFile(null);
                        }
                      }}
                      style={[
                        styles.docTypeButton,
                        documentType === dt.value && styles.docTypeButtonActive,
                      ]}
                    >
                      <AppIcon
                        name={
                          dt.value === "PASSPORT"
                            ? "document-text-outline"
                            : "card-outline"
                        }
                        size={18}
                        color={
                          documentType === dt.value ? colors.brandDark : colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.docTypeText,
                          documentType === dt.value && styles.docTypeTextActive,
                        ]}
                      >
                        {dt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Document Upload Boxes */}
              <View style={styles.uploadsContainer}>
                {/* Front Side */}
                <View style={styles.uploadBox}>
                  <Text style={styles.uploadSideTitle}>
                    {documentType === "PASSPORT" ? "Passport Bio Page" : "Front Side"} *
                  </Text>
                  <Text style={styles.uploadSideDesc}>
                    Upload photo or PDF (max 10 MiB)
                  </Text>
                  {frontFile ? (
                    <View style={styles.fileSelectedRow}>
                      <AppIcon name="document-attach-outline" size={20} color={colors.brandDark} />
                      <Text style={styles.fileName} numberOfLines={1}>
                        {frontFile.name}
                      </Text>
                      <Pressable onPress={() => setFrontFile(null)}>
                        <AppIcon name="close-circle" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ) : (
                    <Button
                      label="Select Front Document"
                      variant="secondary"
                      onPress={() => void handlePickFile("front")}
                    />
                  )}
                </View>

                {/* Back Side (HIDDEN FOR PASSPORT) */}
                {documentType !== "PASSPORT" && (
                  <View style={styles.uploadBox}>
                    <Text style={styles.uploadSideTitle}>Back Side *</Text>
                    <Text style={styles.uploadSideDesc}>
                      Upload photo or PDF (max 10 MiB)
                    </Text>
                    {backFile ? (
                      <View style={styles.fileSelectedRow}>
                        <AppIcon name="document-attach-outline" size={20} color={colors.brandDark} />
                        <Text style={styles.fileName} numberOfLines={1}>
                          {backFile.name}
                        </Text>
                        <Pressable onPress={() => setBackFile(null)}>
                          <AppIcon name="close-circle" size={18} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Button
                        label="Select Back Document"
                        variant="secondary"
                        onPress={() => void handlePickFile("back")}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Declaration Checkbox */}
              <Pressable
                style={styles.declarationRow}
                onPress={() => setDeclarationAccepted((v) => !v)}
              >
                <View
                  style={[
                    styles.checkbox,
                    declarationAccepted && styles.checkboxChecked,
                  ]}
                >
                  {declarationAccepted && (
                    <AppIcon name="checkmark" size={14} color={colors.surface} />
                  )}
                </View>
                <Text style={styles.declarationText}>
                  I confirm that I uploaded a valid government-issued photo ID containing
                  my correct details.
                </Text>
              </Pressable>

              {/* Submit CTA */}
              <Button
                label={submitting ? "Submitting..." : "Submit for Verification"}
                disabled={submitting || !declarationAccepted || !frontFile || (documentType !== "PASSPORT" && !backFile)}
                onPress={() => void handleSubmit()}
                loading={submitting}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  errorCard: {
    margin: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  statusCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statusIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusBadgeApproved: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgePending: {
    backgroundColor: "#FEF3C7",
  },
  statusBadgeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
  },
  statusTextApproved: {
    color: "#166534",
  },
  statusTextPending: {
    color: "#92400E",
  },
  statusTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  statusDescription: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  submittedDateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  rejectedBanner: {
    backgroundColor: "#FEE2E2",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    gap: 4,
  },
  rejectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rejectedTitle: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.danger,
  },
  rejectedReason: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  countryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryChipActive: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brandGold,
  },
  countryChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  countryChipTextActive: {
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryCustomInput: {
    marginTop: spacing.xs,
  },
  docTypeRow: {
    gap: spacing.xs,
  },
  docTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docTypeButtonActive: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brandGold,
  },
  docTypeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.textMuted,
  },
  docTypeTextActive: {
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  uploadsContainer: {
    gap: spacing.sm,
  },
  uploadBox: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    gap: spacing.xs,
  },
  uploadSideTitle: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.text,
  },
  uploadSideDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  fileSelectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  fileName: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  declarationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  declarationText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#DCFCE7",
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  successText: {
    ...typography.caption,
    color: "#166534",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FEE2E2",
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
});
