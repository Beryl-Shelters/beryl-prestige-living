import { useState } from "react";
import {
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
import { inquiryTypes, publicServicesApi } from "@/lib/public-services-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type InquiryModalProps = {
  visible: boolean;
  sourcePage?: string;
  initialUser?: {
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  onClose: () => void;
};

export function InquiryModal({
  visible,
  sourcePage = "property_detail",
  initialUser,
  onClose,
}: InquiryModalProps) {
  const [inquiryType, setInquiryType] = useState<string>("Property Inquiry");
  const [name, setName] = useState(initialUser?.name || "");
  const [phone, setPhone] = useState(initialUser?.phone || "");
  const [email, setEmail] = useState(initialUser?.email || "");
  const [message, setMessage] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setInquiryType("Property Inquiry");
    setName(initialUser?.name || "");
    setPhone(initialUser?.phone || "");
    setEmail(initialUser?.email || "");
    setMessage("");
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
    if (!inquiryTypes.includes(inquiryType as typeof inquiryTypes[number])) {
      next.inquiryType = "Select an Inquiry Type.";
    }
    if (name.trim().length < 2) next.name = "Enter your full name.";
    if (!/^\+?[0-9 ()-]{7,25}$/.test(phone.trim())) {
      next.phone = "Enter a valid contact number.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (message.trim().length < 2) {
      next.message = "Describe what you need help with.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await publicServicesApi.submitPublicInquiry({
        inquiryType,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        sourcePage,
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
          <Text style={styles.topBarTitle}>Real Estate Inquiry</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close inquiry form"
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
              <Text accessibilityRole="header" style={styles.successTitle}>Inquiry Received</Text>
              <Text style={styles.successBody}>
                Thank you. A Beryl Shelter representative will follow up using the contact details
                provided.
              </Text>
              <Button label="Close" onPress={handleClose} />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.banner}>
                <AppIcon name="call-outline" size={20} color={colors.brandDark} />
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>Speak with a Real Estate Expert</Text>
                  <Text style={styles.bannerSubtitle}>Call: 0704 205 5678</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Inquiry Type *</Text>
                <View style={styles.typeChips}>
                  {inquiryTypes.map((type) => {
                    const isSelected = type === inquiryType;
                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="radio"
                        accessibilityLabel={type}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setInquiryType(type)}
                        style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                      >
                        <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.inquiryType ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>{errors.inquiryType}</Text>
                ) : null}
              </View>

              <TextField
                label="Your Name *"
                placeholder="Ada Buyer"
                value={name}
                onChangeText={setName}
                error={errors.name}
                autoCapitalize="words"
              />

              <TextField
                label="Contact Number *"
                placeholder="+234 801 234 5678"
                value={phone}
                onChangeText={setPhone}
                error={errors.phone}
                keyboardType="phone-pad"
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
                label="What do you need help with? *"
                placeholder="Describe your inquiry"
                value={message}
                onChangeText={setMessage}
                error={errors.message}
                multiline
                numberOfLines={4}
                style={styles.textArea}
              />

              {submitError ? (
                <Text accessibilityRole="alert" style={styles.errorBanner}>{submitError}</Text>
              ) : null}

              <Button
                label={submitting ? "Submitting Inquiry…" : "Submit Inquiry"}
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

const styles = StyleSheet.create({
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerContent: { flex: 1 },
  bannerTitle: { ...typography.label, color: colors.brandDark },
  bannerSubtitle: { ...typography.caption, color: colors.text, fontWeight: "700" },
  fieldBlock: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipSelected: {
    backgroundColor: colors.action,
    borderColor: colors.action,
  },
  typeChipText: { ...typography.caption, color: colors.text },
  typeChipTextSelected: { color: colors.actionText, fontWeight: "600" },
  textArea: { minHeight: 90, textAlignVertical: "top", paddingTop: spacing.sm },
  errorText: { ...typography.caption, color: colors.danger },
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
});
