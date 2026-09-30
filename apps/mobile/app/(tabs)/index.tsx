import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, LoadingState, Screen, ScreenState, SectionHeading } from "@/components/ui";
import { PropertyCard } from "@/components/property-card";
import { AppIcon } from "@/components/app-icon";
import { BrandLogo } from "@/components/brand-logo";
import { friendlyError } from "@/lib/api-error";
import { propertiesApi, propertyQuery } from "@/lib/properties-api";
import { emptyPropertyFilters, type PublicProperty } from "@/lib/property-types";
import { useAuth } from "@/providers/auth-provider";
import { usePropertyState } from "@/providers/property-state-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type SearchMode = "buy" | "sell" | "refer";
const heroImage = require("../../../web/public/landing/landingpagehero_desktop.png");

export default function HomeScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const referralCode = typeof params.ref === "string" ? params.ref : undefined;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { status } = useAuth();
  const { savedCodes, refreshSaved, setSaved } = usePropertyState();
  const [searchMode, setSearchMode] = useState<SearchMode>("refer");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState("");

  useEffect(() => {
    let active = true;
    void propertiesApi.list(propertyQuery("", emptyPropertyFilters, 1, 6))
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch((failure) => {
        if (active) setError(friendlyError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (status === "signedIn" && items.length) {
      queueMicrotask(() =>
        void refreshSaved(items.map((item) => item.code)).catch(() => {})
      );
    }
  }, [status, items, refreshSaved]);

  function submit() {
    const value = search.trim();
    void propertiesApi.recordSearch().catch(() => {});

    if (searchMode === "sell") {
      router.push("/(tabs)/list");
      return;
    }
    if (searchMode === "refer") {
      router.push(status === "signedIn" ? "/dashboard/referrals" : "/(auth)/login?next=/dashboard/referrals");
      return;
    }

    router.push({
      pathname: "/properties",
      params: {
        ...(value ? { q: value } : {}),
        ...(referralCode ? { ref: referralCode } : {}),
      },
    });
  }

  async function toggleSaved(property: PublicProperty) {
    if (status !== "signedIn") {
      router.push({
        pathname: "/(auth)/login",
        params: { next: `/properties/${encodeURIComponent(property.code)}` },
      });
      return;
    }
    if (saving) return;
    setSaving(property.code);
    try {
      if (savedCodes.has(property.code)) {
        await propertiesApi.unsave(property.code);
        setSaved(property.code, false);
      } else {
        await propertiesApi.save(property.code);
        setSaved(property.code, true);
      }
    } catch (failure) {
      setError(friendlyError(failure));
    } finally {
      setSaving("");
    }
  }

  return (
    <Screen edges={["top", "left", "right"]}>
      {/* Brand Header Bar */}
      <View style={styles.topBrandBar}>
        <BrandLogo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customer Support"
          onPress={() => router.push("/support")}
          hitSlop={8}
          style={styles.supportQuickButton}
        >
          <AppIcon name="help-circle-outline" size={22} color={colors.brandDark} />
        </Pressable>
      </View>

      {/* Mobile adaptation of the current Web hero using its exact desktop artwork. */}
      <View style={styles.heroCard}>
        <View style={styles.heroCopyBlock}>
          <Text accessibilityRole="header" style={styles.heroHeadline}>
            <Text style={styles.heroEmphasis}>Earn Rich</Text> when you refer{"\n"}to us someone who wants to{"\n"}
            Buy or Sell a property!
          </Text>
          <Text style={styles.heroCopy}>Each successful transaction greatly{"\n"}maximizes your income!</Text>
        </View>

        <Image
          accessibilityLabel="Customer receiving a Beryl Shelter referral notification"
          source={heroImage}
          resizeMode="contain"
          style={styles.heroImage}
        />

        <View style={styles.searchCard}>
          <View style={styles.searchTopRow}>
            <View style={styles.searchTabs} role="tablist" accessibilityLabel="Property search mode">
            {(["refer", "buy", "sell"] as const).map((mode) => {
              const isSelected = searchMode === mode;
              const modeLabel = mode === "buy" ? "Buy" : mode === "sell" ? "Sell" : "Refer";
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityLabel={`${modeLabel} mode`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSearchMode(mode)}
                  style={[styles.searchTab, isSelected && styles.searchTabActive]}
                >
                  <Text style={[styles.searchTabText, isSelected && styles.searchTabTextActive]}>
                    {modeLabel}
                  </Text>
                </Pressable>
              );
            })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={status === "signedIn" ? "My Dashboard" : "Create an account"}
              onPress={() => router.push(status === "signedIn" ? "/dashboard" : "/(auth)/register")}
              style={styles.accountButton}
            >
              <Text style={styles.accountButtonText}>{status === "signedIn" ? "My Dashboard" : "Create Account"}</Text>
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <AppIcon name="search" size={20} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Search properties from Home"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={submit}
              returnKeyType="search"
              placeholder={
                searchMode === "buy"
                  ? "Title, code, state or city"
                  : searchMode === "sell"
                  ? "Describe property to list"
                  : "Search referrals program"
              }
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search listed properties"
              onPress={submit}
              style={styles.searchActionButton}
            >
              <AppIcon name="arrow-forward" size={20} color={colors.actionText} />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse all properties"
          onPress={() => router.push(referralCode ? { pathname: "/properties", params: { ref: referralCode } } : "/properties")}
          style={styles.browseLink}
        >
          <Text style={styles.browseLinkText}>Browse all properties</Text>
          <AppIcon name="arrow-forward" size={17} color={colors.brandDark} />
        </Pressable>
      </View>

      {/* Offline Transaction Policy Notice */}
      <View style={styles.policyCard}>
        <AppIcon name="information-circle-outline" size={24} color={colors.brandDark} />
        <View style={styles.policyTextWrap}>
          <Text style={styles.policyTitle}>Verified Offline Transactions</Text>
          <Text style={styles.policyBody}>
            Information only. Property transactions are completed offline directly with Beryl Shelter. There is no online checkout or in-app payment.
          </Text>
        </View>
      </View>

      {/* How Referral Works (3 Steps) */}
      <Card style={styles.howCard}>
        <SectionHeading
          title="Refer and Get Rich!"
          description="Our 2% referral program is simple, transparent, and rewarding."
        />
        <View style={styles.stepsList}>
          <View style={styles.stepItem}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Register an account</Text>
              <Text style={styles.stepDesc}>Create a verified account on Beryl Shelter in minutes.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Refer Buyer or Seller</Text>
              <Text style={styles.stepDesc}>Generate a referral code and connect property clients to us.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Earn 2% Commission</Text>
              <Text style={styles.stepDesc}>Receive 2% commission upon verified offline sale completion.</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Latest Listings Section */}
      <SectionHeading
        title="Latest listings"
        description="The newest properties currently available to the public."
      />

      {loading ? (
        <LoadingState label="Loading latest properties" />
      ) : error ? (
        <ScreenState
          title="Latest listings unavailable"
          message={error}
          action={
            <Button
              label="Try again"
              onPress={() => {
                setLoading(true);
                setError("");
                setRetry((value) => value + 1);
              }}
            />
          }
        />
      ) : items.length ? (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <View style={styles.propertyCardWrap}>
              <PropertyCard
                property={item}
                referralCode={referralCode}
                saved={savedCodes.has(item.code)}
                saving={saving === item.code}
                onToggleSaved={() => void toggleSaved(item)}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      ) : (
        <ScreenState
          title="No listed properties yet"
          message="New public listings will appear here when they become available."
        />
      )}
    </Screen>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    topBrandBar: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingVertical: spacing.xs,
    },
    supportQuickButton: {
      padding: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    heroCard: {
      backgroundColor: colors.brandTint,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    heroCopyBlock: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      gap: spacing.sm,
    },
    heroImage: { width: "100%", height: 190 },
    heroHeadline: {
      ...typography.heading,
      color: "#FFFFFF",
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    heroEmphasis: {
      color: colors.brand,
      fontStyle: "italic",
    },
    heroCopy: {
      ...typography.body,
      color: "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
    },
    searchCard: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.md,
      marginTop: -spacing.lg,
      marginBottom: spacing.md,
      borderRadius: radius.sm,
      padding: spacing.sm,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 3,
    },
    searchTopRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.xs,
    },
    searchTabs: {
      flexDirection: "row",
      flex: 1,
    },
    searchTab: {
      flex: 1,
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.xs,
    },
    searchTabActive: {
      backgroundColor: colors.action,
    },
    searchTabText: {
      ...typography.label,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    searchTabTextActive: {
      color: colors.actionText,
    },
    accountButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      borderRadius: radius.xs,
      borderWidth: 1,
      borderColor: colors.brand,
      backgroundColor: colors.surface,
    },
    accountButtonText: {
      ...typography.caption,
      color: colors.brandDark,
      fontWeight: "700",
      fontSize: 10,
    },
    searchBar: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingLeft: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    searchInput: {
      ...typography.body,
      color: colors.text,
      flex: 1,
      minWidth: 0,
      fontSize: 14,
    },
    searchActionButton: {
      width: 44,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.action,
    },
    browseLink: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    browseLinkText: {
      ...typography.label,
      color: colors.brandDark,
      fontWeight: "700",
    },
    policyCard: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.brandTint,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "flex-start",
    },
    policyTextWrap: {
      flex: 1,
      gap: 2,
    },
    policyTitle: {
      ...typography.label,
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    policyBody: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    howCard: {
      gap: spacing.md,
    },
    stepsList: {
      gap: spacing.sm,
    },
    stepItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.brandTint,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    stepBadgeText: {
      ...typography.label,
      color: colors.brandDark,
      fontWeight: "800",
      fontSize: 13,
    },
    stepContent: {
      flex: 1,
      gap: 2,
    },
    stepTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: "600",
      fontSize: 14,
    },
    stepDesc: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
    },
    propertyCardWrap: {
      width: 290,
    },
    horizontalList: {
      gap: spacing.md,
      paddingRight: spacing.lg,
    },
  });
}
