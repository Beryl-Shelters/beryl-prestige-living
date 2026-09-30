import { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { AppIcon } from "@/components/app-icon";
import { Button, Card, LoadingState, ScreenState, SectionHeading } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import { kycApi, type KycStatus } from "@/lib/kyc-api";
import {
  settingsApi,
  type SettingsBusiness,
  type SettingsBusinessInput,
} from "@/lib/settings-api";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MiB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export default function SettingsBusinessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [business, setBusiness] = useState<SettingsBusiness | null>(null);
  const [draft, setDraft] = useState<SettingsBusinessInput>({
    companyName: "",
    companyEmail: "",
    companyPhoneNumber: "",
    aboutCompany: "",
    streetAddress: "",
    zipCode: "",
    city: "",
    state: "",
    country: "",
  });
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [logoFile, setLogoFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [bizData, kycData] = await Promise.all([
          settingsApi.getBusiness(),
          kycApi.getKyc().catch(() => null),
        ]);
        if (!active) return;
        setBusiness(bizData);
        setDraft({
          companyName: bizData.companyName || "",
          companyEmail: bizData.companyEmail || "",
          companyPhoneNumber: bizData.companyPhoneNumber || "",
          aboutCompany: bizData.aboutCompany || "",
          streetAddress: bizData.streetAddress || "",
          zipCode: bizData.zipCode || "",
          city: bizData.city || "",
          state: bizData.state || "",
          country: bizData.country || "",
        });
        if (kycData) setKycStatus(kycData.status);
      } catch (err) {
        if (!active) return;
        setError(friendlyError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    setSuccess("");
    try {
      const [bizData, kycData] = await Promise.all([
        settingsApi.getBusiness(),
        kycApi.getKyc().catch(() => null),
      ]);
      setBusiness(bizData);
      setDraft({
        companyName: bizData.companyName || "",
        companyEmail: bizData.companyEmail || "",
        companyPhoneNumber: bizData.companyPhoneNumber || "",
        aboutCompany: bizData.aboutCompany || "",
        streetAddress: bizData.streetAddress || "",
        zipCode: bizData.zipCode || "",
        city: bizData.city || "",
        state: bizData.state || "",
        country: bizData.country || "",
      });
      setLogoFile(null);
      if (kycData) setKycStatus(kycData.status);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePickLogo() {
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset) return;
      const mime = asset.mimeType || "image/jpeg";

      if (!ALLOWED_MIME.includes(mime)) {
        setError("Only PNG, JPG and WebP images are supported.");
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_LOGO_BYTES) {
        setError("Company logo must be 2 MiB or smaller.");
        return;
      }

      setLogoFile({
        uri: asset.uri,
        name: asset.fileName || `logo_${Date.now()}.jpg`,
        type: mime,
        size: asset.fileSize,
      });
    } catch {
      setError("Could not pick logo.");
    }
  }

  function handleCancel() {
    if (!business) return;
    setDraft({
      companyName: business.companyName || "",
      companyEmail: business.companyEmail || "",
      companyPhoneNumber: business.companyPhoneNumber || "",
      aboutCompany: business.aboutCompany || "",
      streetAddress: business.streetAddress || "",
      zipCode: business.zipCode || "",
      city: business.city || "",
      state: business.state || "",
      country: business.country || "",
    });
    setLogoFile(null);
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!draft.companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!draft.companyEmail.trim()) {
      setError("Company email address is required.");
      return;
    }
    if (!draft.companyPhoneNumber.trim()) {
      setError("Company phone number is required.");
      return;
    }
    if (
      !draft.streetAddress.trim() ||
      !draft.zipCode.trim() ||
      !draft.city.trim() ||
      !draft.state.trim() ||
      !draft.country.trim()
    ) {
      setError("Complete company address is required.");
      return;
    }

    setSaving(true);
    try {
      const updated = await settingsApi.updateBusiness(draft, logoFile ?? undefined);
      setBusiness(updated);
      setLogoFile(null);
      setSuccess("Business profile updated successfully.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState label="Loading business profile..." />
      </View>
    );
  }

  if (error && !business) {
    return (
      <View style={styles.screen}>
        <Card style={styles.errorCard}>
          <ScreenState
            title="Business Profile Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={() => void handleRefresh()} />}
          />
        </Card>
      </View>
    );
  }

  const initials =
    draft.companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "CO";
  const displayLogoUri = logoFile?.uri || business?.companyLogoUrl;

  const kycLabel =
    kycStatus === "APPROVED"
      ? "Account Verified"
      : kycStatus === "PENDING_REVIEW"
      ? "Verification Pending"
      : "Verify Account";

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
          title="Business Profile"
          description="Update your corporate details, public business ID, and company logo."
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

        {/* Identity & Company Header */}
        <Card style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View style={styles.logoContainer}>
              {displayLogoUri ? (
                <Image source={{ uri: displayLogoUri }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.identityMeta}>
              <Text style={styles.identityName}>{draft.companyName || "Company"}</Text>
              <Text style={styles.identityEmail}>{draft.companyEmail || "No email"}</Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.kycBadge,
              kycStatus === "APPROVED"
                ? styles.kycBadgeApproved
                : kycStatus === "PENDING_REVIEW"
                ? styles.kycBadgePending
                : styles.kycBadgeUnverified,
            ]}
            onPress={() => router.push("/dashboard/kyc" as never)}
          >
            <AppIcon
              name={
                kycStatus === "APPROVED"
                  ? "shield-checkmark"
                  : kycStatus === "PENDING_REVIEW"
                  ? "time-outline"
                  : "shield-outline"
              }
              size={16}
              color={
                kycStatus === "APPROVED"
                  ? colors.success
                  : kycStatus === "PENDING_REVIEW"
                  ? colors.warning
                  : colors.text
              }
            />
            <Text
              style={[
                styles.kycBadgeText,
                kycStatus === "APPROVED"
                  ? styles.kycTextApproved
                  : kycStatus === "PENDING_REVIEW"
                  ? styles.kycTextPending
                  : styles.kycTextUnverified,
              ]}
            >
              {kycLabel}
            </Text>
            <AppIcon name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* Company Logo Picker */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Company Logo</Text>
          <Text style={styles.cardSubtitle}>
            Upload your company logo. PNG, JPG, or WebP up to 2 MiB.
          </Text>
          <View style={styles.logoPickerRow}>
            <View style={styles.largeLogo}>
              {displayLogoUri ? (
                <Image source={{ uri: displayLogoUri }} style={styles.largeLogoImage} />
              ) : (
                <View style={styles.largeLogoFallback}>
                  <Text style={styles.largeLogoFallbackText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.logoPickerActions}>
              <Button
                label="Choose Logo"
                variant="secondary"
                onPress={() => void handlePickLogo()}
              />
              {logoFile && (
                <Pressable onPress={() => setLogoFile(null)}>
                  <Text style={styles.removePhotoText}>Remove selection</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Card>

        {/* Company Information */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Company Information</Text>

          {/* READ-ONLY PUBLIC COMPANY ID */}
          <View style={styles.inputGroup}>
            <View style={styles.readOnlyLabelRow}>
              <Text style={styles.inputLabel}>Company ID</Text>
              <Text style={styles.readOnlyBadge}>Public ID</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={business?.companyId || ""}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Company Name *</Text>
            <TextInput
              style={styles.input}
              value={draft.companyName}
              onChangeText={(text) => setDraft((d) => ({ ...d, companyName: text }))}
              placeholder="Corporate name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Company Email Address *</Text>
            <TextInput
              style={styles.input}
              value={draft.companyEmail}
              onChangeText={(text) => setDraft((d) => ({ ...d, companyEmail: text }))}
              placeholder="company@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Company Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={draft.companyPhoneNumber}
              onChangeText={(text) => setDraft((d) => ({ ...d, companyPhoneNumber: text }))}
              placeholder="+234..."
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>About Company</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={draft.aboutCompany}
              onChangeText={(text) => setDraft((d) => ({ ...d, aboutCompany: text }))}
              placeholder="Brief description of your business"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
            />
          </View>
        </Card>

        {/* Company Address */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Company Address</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Street Address *</Text>
            <TextInput
              style={styles.input}
              value={draft.streetAddress}
              onChangeText={(text) => setDraft((d) => ({ ...d, streetAddress: text }))}
              placeholder="Street address"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Zip Code *</Text>
            <TextInput
              style={styles.input}
              value={draft.zipCode}
              onChangeText={(text) => setDraft((d) => ({ ...d, zipCode: text }))}
              placeholder="Zip Code"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City *</Text>
            <TextInput
              style={styles.input}
              value={draft.city}
              onChangeText={(text) => setDraft((d) => ({ ...d, city: text }))}
              placeholder="City"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>State *</Text>
            <TextInput
              style={styles.input}
              value={draft.state}
              onChangeText={(text) => setDraft((d) => ({ ...d, state: text }))}
              placeholder="State"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country *</Text>
            <TextInput
              style={styles.input}
              value={draft.country}
              onChangeText={(text) => setDraft((d) => ({ ...d, country: text }))}
              placeholder="Country"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label={saving ? "Saving Changes..." : "Save Changes"}
            onPress={() => void handleSave()}
            loading={saving}
          />
          <Button
            label="Cancel"
            variant="secondary"
            disabled={saving}
            onPress={handleCancel}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
    gap: spacing.sm,
  },
  identityCard: {
    gap: spacing.md,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  logoFallbackText: {
    ...typography.subheading,
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  identityMeta: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    ...typography.subheading,
    color: colors.text,
  },
  identityEmail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  kycBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  kycBadgeApproved: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.success,
  },
  kycBadgePending: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.warning,
  },
  kycBadgeUnverified: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  kycBadgeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  kycTextApproved: {
    color: colors.success,
  },
  kycTextPending: {
    color: colors.warning,
  },
  kycTextUnverified: {
    color: colors.text,
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
  logoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  largeLogo: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  largeLogoImage: {
    width: "100%",
    height: "100%",
  },
  largeLogoFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  largeLogoFallbackText: {
    ...typography.heading,
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  logoPickerActions: {
    gap: spacing.xs,
  },
  removePhotoText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 4,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
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
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputReadOnly: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
    opacity: 0.8,
  },
  readOnlyLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readOnlyBadge: {
    fontSize: 10,
    color: colors.brandDark,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  successText: {
    ...typography.caption,
    color: colors.success,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  });
}
