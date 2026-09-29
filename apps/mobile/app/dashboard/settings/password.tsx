import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { Button, Card, SectionHeading } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import { validateNewPassword } from "@/lib/password-policy";
import { settingsApi } from "@/lib/settings-api";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function SettingsPasswordScreen() {
  const { logout } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleCancel() {
    setOldPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
    setSuccess("");
  }

  async function handleSavePassword() {
    setError("");
    setSuccess("");

    if (!oldPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      setError("Please enter your new password.");
      return;
    }
    if (oldPassword === newPassword) {
      setError("Choose a password different from your current password.");
      return;
    }

    try {
      validateNewPassword(newPassword, confirmNewPassword);
    } catch (validationErr) {
      setError(
        validationErr instanceof Error
          ? validationErr.message
          : "Invalid password format."
      );
      return;
    }

    setSaving(true);
    try {
      const result = await settingsApi.changePassword(
        oldPassword,
        newPassword,
        confirmNewPassword
      );

      // Secure cleanup: never keep passwords in memory
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      if (result?.reauthenticate) {
        await logout();
        router.replace("/(auth)/login");
      } else {
        setSuccess("Password changed successfully.");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <SectionHeading
          title="Change Password"
          description="Manage your password here for enhanced security."
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

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Password Security</Text>
          <Text style={styles.cardSubtitle}>
            Your password must be at least 8 characters long and contain uppercase, lowercase,
            a number, and a symbol.
          </Text>

          {/* Old Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Old Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showOld}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Current password"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!saving}
              />
              <Pressable
                onPress={() => setShowOld((v) => !v)}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showOld ? "Hide password" : "Show password"}
              >
                <AppIcon
                  name={showOld ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min 8 chars)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!saving}
              />
              <Pressable
                onPress={() => setShowNew((v) => !v)}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showNew ? "Hide password" : "Show password"}
              >
                <AppIcon
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showConfirm}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!saving}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showConfirm ? "Hide password" : "Show password"}
              >
                <AppIcon
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label={saving ? "Saving Changes..." : "Save Changes"}
            onPress={() => void handleSavePassword()}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    gap: spacing.sm,
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
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
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
