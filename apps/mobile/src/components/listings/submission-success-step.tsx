import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../app-icon";
import { Button, Card } from "../ui";
import type { CustomerListing } from "@/lib/listings-api";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type SubmissionSuccessStepProps = {
  listing: CustomerListing;
  onReset: () => void;
};

export function SubmissionSuccessStep({ listing, onReset }: SubmissionSuccessStepProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const submittedTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const submittedDate = new Date().toLocaleDateString("en-GB");

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <AppIcon name="checkmark" size={36} color="#FFF" />
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        Your listing has been submitted to our team
      </Text>

      <Text style={styles.subtext}>
        We&apos;ll check the details and let you know within 2 working days. Thank you for listing with Beryl.
      </Text>

      <Card style={styles.timelineCard}>
        <Text style={styles.timelineHeader}>What Happens Next?</Text>

        <View style={styles.stepRow}>
          <View style={styles.stepIndicatorCol}>
            <View style={[styles.stepDot, styles.stepDotActive]}>
              <AppIcon name="checkmark" size={12} color="#FFF" />
            </View>
            <View style={styles.stepLine} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Submitted</Text>
            <Text style={styles.stepDesc}>
              Submitted today at {submittedTime} ({submittedDate})
            </Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepIndicatorCol}>
            <View style={[styles.stepDot, styles.stepDotPending]}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <View style={styles.stepLine} />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>We review your listing</Text>
            <Text style={styles.stepDesc}>Takes 1–2 working days</Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepIndicatorCol}>
            <View style={[styles.stepDot, styles.stepDotPending]}>
              <Text style={styles.stepNum}>3</Text>
            </View>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>It goes live</Text>
            <Text style={styles.stepDesc}>Visible to prospective buyers across Nigeria</Text>
          </View>
        </View>
      </Card>

      <View style={styles.listingSummary}>
        <Text style={styles.listingSummaryCode}>Listing Code: {listing.listing_code || "PENDING"}</Text>
        <Text style={styles.listingSummaryTitle}>{listing.title}</Text>
      </View>

      <View style={styles.actionButtons}>
        <Button
          label="View my listings"
          onPress={() => router.push("/dashboard/listings")}
        />
        <Button
          label="Create another listing"
          variant="secondary"
          onPress={onReset}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { gap: spacing.lg, alignItems: "center", paddingVertical: spacing.lg },
    iconCircle: {
      width: 68,
      height: 68,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { ...typography.title, color: colors.text, textAlign: "center" },
    subtext: { ...typography.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md },
    timelineCard: { width: "100%", gap: spacing.md },
    timelineHeader: { ...typography.heading, color: colors.brandDark },
    stepRow: { flexDirection: "row", gap: spacing.md },
    stepIndicatorCol: { alignItems: "center", width: 24 },
    stepDot: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    stepDotActive: { backgroundColor: colors.success },
    stepDotPending: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    stepNum: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    stepLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border, marginVertical: 2 },
    stepContent: { flex: 1, gap: 2, paddingBottom: spacing.sm },
    stepTitle: { ...typography.label, color: colors.text },
    stepDesc: { ...typography.caption, color: colors.textMuted },
    listingSummary: {
      width: "100%",
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      borderRadius: radius.md,
      gap: 2,
    },
    listingSummaryCode: { ...typography.caption, color: colors.brandDark, fontWeight: "700" },
    listingSummaryTitle: { ...typography.label, color: colors.text },
    actionButtons: { width: "100%", gap: spacing.sm },
  });
}
