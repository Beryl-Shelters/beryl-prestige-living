import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "./app-icon";
import { Button, TextField } from "./ui";
import { friendlyError } from "@/lib/api-error";
import { formatNaira } from "@/lib/money";
import { publicServicesApi } from "@/lib/public-services-api";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type ViewingModalProps = {
  visible: boolean;
  propertyCode: string;
  propertyTitle: string;
  propertyPriceMinor: number;
  propertyImage?: string;
  initialUser?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  onClose: () => void;
};

export function ViewingModal({
  visible,
  propertyCode,
  propertyTitle,
  propertyPriceMinor,
  propertyImage,
  initialUser,
  onClose,
}: ViewingModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [firstName, setFirstName] = useState(initialUser?.firstName || "");
  const [lastName, setLastName] = useState(initialUser?.lastName || "");
  const [email, setEmail] = useState(initialUser?.email || "");
  const [phone, setPhone] = useState(initialUser?.phone || "");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setFirstName(initialUser?.firstName || "");
    setLastName(initialUser?.lastName || "");
    setEmail(initialUser?.email || "");
    setPhone(initialUser?.phone || "");
    setPreferredDate("");
    setPreferredTime("");
    setFlexibleDates(false);
    setErrors({});
    setSubmitError("");
    setSuccess(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (firstName.trim().length < 2) next.firstName = "Enter your first name (min 2 characters).";
    if (lastName.trim().length < 2) next.lastName = "Enter your last name (min 2 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!/^\+?[0-9 ()-]{7,25}$/.test(phone.trim())) {
      next.phone = "Enter a valid phone number (7–25 digits).";
    }
    if (!flexibleDates) {
      if (!preferredDate.trim()) {
        next.preferredDate = "Enter a preferred date (YYYY-MM-DD).";
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate.trim())) {
        next.preferredDate = "Use YYYY-MM-DD format.";
      } else if (preferredDate < new Date().toISOString().slice(0, 10)) {
        next.preferredDate = "Preferred date cannot be in the past.";
      }
      if (!preferredTime.trim()) {
        next.preferredTime = "Enter a preferred time (e.g. 10:00 or 14:30).";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await publicServicesApi.submitPropertyViewing({
        propertyCode,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        preferredDate: flexibleDates ? null : preferredDate.trim(),
        preferredTime: flexibleDates ? null : preferredTime.trim(),
        flexibleDates,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Schedule Property Viewing</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close viewing form"
            onPress={handleClose}
            style={styles.closeBtn}
          >
            <AppIcon name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {success ? (
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <AppIcon name="checkmark" size={32} color="#FFF" />
              </View>
              <Text accessibilityRole="header" style={styles.successTitle}>
                Viewing Scheduled Successfully
              </Text>
              <Text style={styles.successBody}>
                Your viewing has been scheduled. We will contact you through your email or phone
                number within 24 hours to confirm the details.
              </Text>

              <View style={styles.propertySummary}>
                {propertyImage ? (
                  <Image source={{ uri: propertyImage }} style={styles.propertyImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.propertyImg, styles.propertyPlaceholder]}>
                    <AppIcon name="image-outline" size={24} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.propertyMeta}>
                  <Text numberOfLines={2} style={styles.propertyTitleText}>{propertyTitle}</Text>
                  <Text style={styles.propertyPriceText}>{formatNaira(propertyPriceMinor)}</Text>
                  <Text style={styles.propertyCodeText}>Code: {propertyCode}</Text>
                </View>
              </View>

              <Button label="Got it" onPress={handleClose} />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.infoBanner}>
                <AppIcon name="information-circle-outline" size={20} color={colors.brandDark} />
                <Text style={styles.infoText}>
                  Request an in-person or physical inspection of this property. Viewing requests
                  are free and do not require any payment.
                </Text>
              </View>

              <TextField
                label="First Name *"
                placeholder="Ada"
                value={firstName}
                onChangeText={setFirstName}
                error={errors.firstName}
                autoCapitalize="words"
              />

              <TextField
                label="Last Name *"
                placeholder="Buyer"
                value={lastName}
                onChangeText={setLastName}
                error={errors.lastName}
                autoCapitalize="words"
              />

              <TextField
                label="Email Address *"
                placeholder="ada@example.com"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextField
                label="Phone Number *"
                placeholder="+234 801 234 5678"
                value={phone}
                onChangeText={setPhone}
                error={errors.phone}
                keyboardType="phone-pad"
              />

              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="My dates are flexible"
                accessibilityState={{ checked: flexibleDates }}
                onPress={() => setFlexibleDates((prev) => !prev)}
                style={styles.checkboxRow}
              >
                <View style={[styles.checkbox, flexibleDates && styles.checkboxActive]}>
                  {flexibleDates && <AppIcon name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={styles.checkboxLabel}>My dates are flexible</Text>
              </Pressable>

              {!flexibleDates && (
                <>
                  <TextField
                    label="Preferred Date (YYYY-MM-DD) *"
                    placeholder="2026-10-15"
                    value={preferredDate}
                    onChangeText={setPreferredDate}
                    error={errors.preferredDate}
                    keyboardType="numbers-and-punctuation"
                  />

                  <TextField
                    label="Preferred Time *"
                    placeholder="e.g. 10:00 or 14:30"
                    value={preferredTime}
                    onChangeText={setPreferredTime}
                    error={errors.preferredTime}
                  />
                </>
              )}

              {submitError ? (
                <Text accessibilityRole="alert" style={styles.errorBanner}>{submitError}</Text>
              ) : null}

              <Button
                label={submitting ? "Submitting Request…" : "Submit Viewing Request"}
                loading={submitting}
                disabled={submitting}
                onPress={handleSubmit}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  topBarTitle: { ...typography.heading, color: colors.text },
  closeBtn: { padding: spacing.xs },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
  infoBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandGold,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "flex-start",
  },
  infoText: { ...typography.caption, color: colors.text, flex: 1 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkboxLabel: { ...typography.body, color: colors.text },
  errorBanner: { ...typography.caption, color: colors.danger, paddingVertical: spacing.xs },
  successBox: { alignItems: "center", gap: spacing.lg, paddingVertical: spacing.xl },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { ...typography.title, color: colors.text, textAlign: "center" },
  successBody: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  propertySummary: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: "100%",
    alignItems: "center",
  },
  propertyImg: { width: 80, height: 70, borderRadius: radius.md },
  propertyPlaceholder: { backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  propertyMeta: { flex: 1, gap: 2 },
  propertyTitleText: { ...typography.label, color: colors.text },
  propertyPriceText: { ...typography.label, color: colors.brandDark },
  propertyCodeText: { ...typography.caption, color: colors.textMuted },
  });
}
