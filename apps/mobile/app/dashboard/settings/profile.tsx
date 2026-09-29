import { useEffect, useState } from "react";
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
  type SettingsProfile,
  type SettingsProfileInput,
} from "@/lib/settings-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MiB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export default function SettingsProfileScreen() {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [draft, setDraft] = useState<SettingsProfileInput>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    briefBio: "",
    accountName: "",
    bankName: "",
    accountNumber: "",
    streetAddress: "",
    zipCode: "",
    city: "",
    state: "",
    country: "",
  });
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [avatarFile, setAvatarFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [profData, kycData] = await Promise.all([
          settingsApi.getProfile(),
          kycApi.getKyc().catch(() => null),
        ]);
        if (!active) return;
        setProfile(profData);
        setDraft({
          firstName: profData.firstName || "",
          lastName: profData.lastName || "",
          phoneNumber: profData.phoneNumber || "",
          briefBio: profData.briefBio || "",
          accountName: profData.accountName || "",
          bankName: profData.bankName || "",
          accountNumber: profData.accountNumber || "",
          streetAddress: profData.streetAddress || "",
          zipCode: profData.zipCode || "",
          city: profData.city || "",
          state: profData.state || "",
          country: profData.country || "",
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
      const [profData, kycData] = await Promise.all([
        settingsApi.getProfile(),
        kycApi.getKyc().catch(() => null),
      ]);
      setProfile(profData);
      setDraft({
        firstName: profData.firstName || "",
        lastName: profData.lastName || "",
        phoneNumber: profData.phoneNumber || "",
        briefBio: profData.briefBio || "",
        accountName: profData.accountName || "",
        bankName: profData.bankName || "",
        accountNumber: profData.accountNumber || "",
        streetAddress: profData.streetAddress || "",
        zipCode: profData.zipCode || "",
        city: profData.city || "",
        state: profData.state || "",
        country: profData.country || "",
      });
      setAvatarFile(null);
      if (kycData) setKycStatus(kycData.status);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePickAvatar() {
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
      if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        setError("Profile picture must be 2 MiB or smaller.");
        return;
      }

      setAvatarFile({
        uri: asset.uri,
        name: asset.fileName || `avatar_${Date.now()}.jpg`,
        type: mime,
        size: asset.fileSize,
      });
    } catch {
      setError("Could not pick image.");
    }
  }

  function handleCancel() {
    if (!profile) return;
    setDraft({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      phoneNumber: profile.phoneNumber || "",
      briefBio: profile.briefBio || "",
      accountName: profile.accountName || "",
      bankName: profile.bankName || "",
      accountNumber: profile.accountNumber || "",
      streetAddress: profile.streetAddress || "",
      zipCode: profile.zipCode || "",
      city: profile.city || "",
      state: profile.state || "",
      country: profile.country || "",
    });
    setAvatarFile(null);
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!draft.firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!draft.lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    if (!draft.phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }

    // Bank details validation: all 3 filled or all 3 blank
    const hasAnyBank = Boolean(
      draft.accountName.trim() || draft.bankName.trim() || draft.accountNumber.trim()
    );
    const hasAllBank = Boolean(
      draft.accountName.trim() && draft.bankName.trim() && draft.accountNumber.trim()
    );
    if (hasAnyBank && !hasAllBank) {
      setError("To update bank details, please complete Account Name, Bank Name, and Account Number.");
      return;
    }

    if (!draft.streetAddress.trim() || !draft.zipCode.trim() || !draft.city.trim() || !draft.state.trim() || !draft.country.trim()) {
      setError("Complete address (Street, Zip Code, City, State, Country) is required.");
      return;
    }

    setSaving(true);
    try {
      const updated = await settingsApi.updateProfile(draft, avatarFile ?? undefined);
      setProfile(updated);
      setAvatarFile(null);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState label="Loading profile..." />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.screen}>
        <Card style={styles.errorCard}>
          <ScreenState
            title="Profile Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={() => void handleRefresh()} />}
          />
        </Card>
      </View>
    );
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Customer";
  const initials = `${draft.firstName[0] || ""}${draft.lastName[0] || ""}`.toUpperCase() || "CU";
  const displayAvatarUri = avatarFile?.uri || profile?.profileImageUrl;

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
          title="Profile Settings"
          description="Manage your personal details, profile picture, and private bank payout information."
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

        {/* Identity & KYC Badge Card */}
        <Card style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View style={styles.avatarContainer}>
              {displayAvatarUri ? (
                <Image source={{ uri: displayAvatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.identityMeta}>
              <Text style={styles.identityName}>{fullName}</Text>
              <Text style={styles.identityAccountType}>
                {profile?.accountType?.replace(/_/g, " ") || "Customer Account"}
              </Text>
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
                  ? "#166534"
                  : kycStatus === "PENDING_REVIEW"
                  ? "#92400E"
                  : colors.brandDark
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

        {/* Profile Picture Picker */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Profile Picture</Text>
          <Text style={styles.cardSubtitle}>
            Update your profile picture (PNG, JPG, WebP up to 2 MiB).
          </Text>
          <View style={styles.picturePickerRow}>
            <View style={styles.largeAvatar}>
              {displayAvatarUri ? (
                <Image source={{ uri: displayAvatarUri }} style={styles.largeAvatarImage} />
              ) : (
                <View style={styles.largeAvatarFallback}>
                  <Text style={styles.largeAvatarFallbackText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.picturePickerActions}>
              <Button
                label="Choose Photo"
                variant="secondary"
                onPress={() => void handlePickAvatar()}
              />
              {avatarFile && (
                <Pressable onPress={() => setAvatarFile(null)}>
                  <Text style={styles.removePhotoText}>Remove photo</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Card>

        {/* Personal Details */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={draft.firstName}
              onChangeText={(text) => setDraft((d) => ({ ...d, firstName: text }))}
              placeholder="First Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={draft.lastName}
              onChangeText={(text) => setDraft((d) => ({ ...d, lastName: text }))}
              placeholder="Last Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* READ-ONLY EMAIL */}
          <View style={styles.inputGroup}>
            <View style={styles.readOnlyLabelRow}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <Text style={styles.readOnlyBadge}>Read-only</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={profile?.email || ""}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={draft.phoneNumber}
              onChangeText={(text) => setDraft((d) => ({ ...d, phoneNumber: text }))}
              placeholder="08012345678"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Brief Bio</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={draft.briefBio}
              onChangeText={(text) => setDraft((d) => ({ ...d, briefBio: text }))}
              placeholder="Tell us a little about yourself"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
            />
          </View>
        </Card>

        {/* Bank Account Information */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Bank Account Details</Text>
          <Text style={styles.cardSubtitle}>
            Update your bank details for referral commission payouts. This is private and only visible to Beryl Shelter.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Name</Text>
            <TextInput
              style={styles.input}
              value={draft.accountName}
              onChangeText={(text) => setDraft((d) => ({ ...d, accountName: text }))}
              placeholder="Account holder name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Name</Text>
            <TextInput
              style={styles.input}
              value={draft.bankName}
              onChangeText={(text) => setDraft((d) => ({ ...d, bankName: text }))}
              placeholder="e.g. Zenith Bank"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Number</Text>
            <TextInput
              style={styles.input}
              value={draft.accountNumber}
              onChangeText={(text) => setDraft((d) => ({ ...d, accountNumber: text }))}
              placeholder="0123456789"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={20}
            />
          </View>
        </Card>

        {/* Address */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>

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
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
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
  identityAccountType: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  kycBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  kycBadgeApproved: {
    backgroundColor: "#DCFCE7",
  },
  kycBadgePending: {
    backgroundColor: "#FEF3C7",
  },
  kycBadgeUnverified: {
    backgroundColor: colors.surfaceMuted,
  },
  kycBadgeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  kycTextApproved: {
    color: "#166534",
  },
  kycTextPending: {
    color: "#92400E",
  },
  kycTextUnverified: {
    color: colors.brandDark,
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
  picturePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  largeAvatarImage: {
    width: "100%",
    height: "100%",
  },
  largeAvatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  largeAvatarFallbackText: {
    ...typography.heading,
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  picturePickerActions: {
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
    backgroundColor: "#F3F4F6",
    color: colors.textMuted,
  },
  readOnlyLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readOnlyBadge: {
    fontSize: 10,
    color: colors.textMuted,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
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
