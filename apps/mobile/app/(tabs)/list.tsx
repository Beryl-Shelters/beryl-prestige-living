import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { PropertyDataStep } from "@/components/listings/property-data-step";
import { SalesMandateStep } from "@/components/listings/sales-mandate-step";
import { SubmissionSuccessStep } from "@/components/listings/submission-success-step";
import { Button, Card, LoadingState, Screen, ScreenState, SectionHeading } from "@/components/ui";
import {
  listingsApi,
  type CustomerListing,
  type ListingOptions,
} from "@/lib/listings-api";
import { nigerianStates } from "@/lib/property-taxonomy";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const defaultOptions: ListingOptions = {
  occupancy_type: ["Residential", "Commercial"],
  ownership_type: ["Personal", "Family"],
  property_type: ["Residential", "Commercial"],
  property_subtype: [
    "Bungalow",
    "Semi-Detached House",
    "Block of flats",
    "Terraced Duplexes",
    "Terraced Bungalows",
    "Semi-Detached Bungalows",
    "Detached Bungalows",
    "Detached Duplexes",
  ],
  facilities: [
    "Swimming Pool",
    "Balcony/Terrace",
    "Children Play Area",
    "Tennis Court",
    "Basketball Court",
    "Gym/Fitness Center",
    "CCTV",
    "Air Conditioning",
    "Laundry",
    "Garden",
    "Wi-Fi",
    "Housekeeping Services",
    "Car Park",
    "24Hrs Security",
  ],
  document_type: ["Ownership", "Survey", "Other"],
  state: nigerianStates,
};

export default function ListScreen() {
  const { status } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [activeListing, setActiveListing] = useState<CustomerListing | null>(null);
  const [options, setOptions] = useState<ListingOptions>(defaultOptions);

  useEffect(() => {
    let active = true;
    void listingsApi
      .options()
      .then((opts) => {
        if (active && opts) setOptions(opts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function handleReset() {
    setActiveListing(null);
    setCurrentStep(1);
  }

  if (status === "loading") {
    return (
      <Screen edges={["top", "left", "right"]}>
        <LoadingState label="Checking your account" />
      </Screen>
    );
  }

  if (status !== "signedIn") {
    return (
      <Screen edges={["top", "left", "right"]}>
        <SectionHeading
          title="List a property"
          description="Create and submit a property listing through the canonical Beryl sales flow."
        />
        <Card>
          <ScreenState
            title="Sign in to list a property"
            message="A verified customer account is required before you can create a listing, sign the sales mandate, and track submission progress."
            action={
              <View style={styles.authButtons}>
                <Button
                  label="Log in"
                  onPress={() =>
                    router.push({
                      pathname: "/(auth)/login",
                      params: { next: "/(tabs)/list" },
                    })
                  }
                />
                <Button
                  label="Create free account"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/(auth)/register",
                      params: { next: "/(tabs)/list" },
                    })
                  }
                />
              </View>
            }
          />
        </Card>

        <Card style={styles.assistancePromo}>
          <View style={styles.assistancePromoHeader}>
            <AppIcon name="help-buoy-outline" size={24} color={colors.brandDark} />
            <Text style={styles.assistancePromoTitle}>Need help selling your property?</Text>
          </View>
          <Text style={styles.assistancePromoText}>
            Our advisory team can assist you in finding qualified buyers without creating a listing
            yourself.
          </Text>
          <Button
            label="Request Sell Assistance"
            variant="secondary"
            onPress={() => router.push("/sell-assistance")}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "left", "right"]} keyboard scroll={false}>
      {/* Step Indicator Header */}
      <View style={styles.stepIndicator}>
        <View style={styles.stepBadgeGroup}>
          <StepBadge num={1} label="Property Data" active={currentStep === 1} completed={currentStep > 1} styles={styles} />
          <View style={[styles.stepDivider, currentStep > 1 && styles.stepDividerActive]} />
          <StepBadge num={2} label="Sales Mandate" active={currentStep === 2} completed={currentStep > 2} styles={styles} />
          <View style={[styles.stepDivider, currentStep > 2 && styles.stepDividerActive]} />
          <StepBadge num={3} label="Submitted" active={currentStep === 3} completed={false} styles={styles} />
        </View>
      </View>

      {currentStep === 1 && (
        <PropertyDataStep
          options={options}
          existingListing={activeListing}
          onNext={(saved) => {
            setActiveListing(saved);
            setCurrentStep(2);
          }}
          onDraftSaved={(saved) => {
            setActiveListing(saved);
          }}
        />
      )}

      {currentStep === 2 && activeListing && (
        <SalesMandateStep
          listing={activeListing}
          onBack={() => setCurrentStep(1)}
          onSubmitSuccess={(submitted) => {
            setActiveListing(submitted);
            setCurrentStep(3);
          }}
        />
      )}

      {currentStep === 3 && activeListing && (
        <SubmissionSuccessStep
          listing={activeListing}
          onReset={handleReset}
        />
      )}

      {currentStep === 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request Sell Assistance"
          onPress={() => router.push("/sell-assistance")}
          style={styles.bottomAssistanceLink}
        >
          <AppIcon name="information-circle-outline" size={16} color={colors.brandDark} />
          <Text style={styles.bottomAssistanceText}>
            Prefer Beryl to find buyers for you? Request Sell Assistance
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

function StepBadge({
  num,
  label,
  active,
  completed,
  styles,
}: {
  num: number;
  label: string;
  active: boolean;
  completed: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stepBadgeContainer}>
      <View
        style={[
          styles.stepCircle,
          active && styles.stepCircleActive,
          completed && styles.stepCircleCompleted,
        ]}
      >
        {completed ? (
          <AppIcon name="checkmark" size={12} color="#FFF" />
        ) : (
          <Text
            style={[
              styles.stepNumber,
              active && styles.stepNumberActive,
            ]}
          >
            {num}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          (active || completed) && styles.stepLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    authButtons: { width: "100%", gap: spacing.sm, marginTop: spacing.md },
    stepIndicator: {
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    stepBadgeGroup: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stepBadgeContainer: { alignItems: "center", gap: 4 },
    stepCircle: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepCircleActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    stepCircleCompleted: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    stepNumber: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    stepNumberActive: { color: "#FFF" },
    stepLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
    stepLabelActive: { color: colors.text, fontWeight: "700" },
    stepDivider: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: spacing.xs, marginBottom: 14 },
    stepDividerActive: { backgroundColor: colors.success },
    assistancePromo: { gap: spacing.md, marginTop: spacing.lg },
    assistancePromoHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    assistancePromoTitle: { ...typography.heading, color: colors.text },
    assistancePromoText: { ...typography.body, color: colors.textMuted },
    bottomAssistanceLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    bottomAssistanceText: { ...typography.caption, color: colors.brandDark, fontWeight: "600" },
  });
}
