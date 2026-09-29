import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button, Card, LoadingState, ScreenState, SectionHeading } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import {
  referralsApi,
  type ReferralItem,
  type ReferralPage,
} from "@/lib/referrals-api";
import { shareCanonicalUrl } from "@/lib/share";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function formatMoney(minor: number): string {
  const naira = minor / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ReferralsScreen() {
  const [data, setData] = useState<ReferralPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState("");

  useEffect(() => {
    let active = true;

    void referralsApi
      .list(page)
      .then((res) => {
        if (!active) return;
        setData(res);
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
  }, [page]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    setShareSuccess("");
    try {
      const res = await referralsApi.list(page);
      setData(res);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReferSeller() {
    if (sharing) return;
    setSharing(true);
    setShareSuccess("");
    try {
      const created = await referralsApi.create({ type: "SELLER" });
      await shareCanonicalUrl(
        "Beryl Shelter Seller Referral",
        "List or sell your property with Beryl Shelter Nigeria Limited:",
        created.referralUrl
      );
      setShareSuccess("Seller referral link generated!");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState label="Loading referral program..." />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.screen}>
        <DashboardNav active="referrals" />
        <Card style={styles.errorCard}>
          <ScreenState
            title="Referrals Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={() => void handleRefresh()} />}
          />
        </Card>
      </View>
    );
  }

  const rate = data ? data.program.commissionRateBasisPoints / 100 : 2;
  const summary = data?.summary;
  const items = data?.items ?? [];
  const first = data ? (data.total === 0 ? 0 : (page - 1) * data.pageSize + 1) : 0;
  const last = data ? Math.min(page * data.pageSize, data.total) : 0;

  return (
    <View style={styles.screen}>
      <DashboardNav active="referrals" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
      >
        <SectionHeading
          title="Referrals"
          description="Earn 2% commission when your referral completes an offline property purchase verified by Beryl."
        />

        {/* Program Explainer */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <AppIcon name="gift-outline" size={22} color={colors.brandGold} />
            <Text style={styles.cardTitle}>Earn with Beryl Shelter</Text>
          </View>
          <Text style={styles.cardBody}>
            Invite your friends to Beryl Shelter and earn {rate}% when a referred
            property purchase is completed offline and verified by Beryl.
          </Text>

          <View style={styles.flowSteps}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Send Invitation</Text>
                <Text style={styles.stepDesc}>
                  Refer a property to friends and potential buyers or invite sellers.
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Registration and Purchase</Text>
                <Text style={styles.stepDesc}>
                  Your referral registers using your referral link; property purchase completes offline.
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Referral Reward</Text>
                <Text style={styles.stepDesc}>
                  After Beryl verifies the completed sale, you receive the {rate}% commission.
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Invite Friends & Actions */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Invite your friends</Text>
          <Text style={styles.cardBody}>
            Invite friends by referring properties they might want to purchase or encouraging
            them to list their properties for sale with us.
          </Text>

          {shareSuccess ? (
            <View style={styles.successBanner}>
              <AppIcon name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.successText}>{shareSuccess}</Text>
            </View>
          ) : null}

          <View style={styles.actionButtons}>
            <Button
              label="Refer a Friend to Sell"
              onPress={() => void handleReferSeller()}
              loading={sharing}
            />
            <Button
              label="Browse Properties to Refer"
              variant="secondary"
              onPress={() => router.push("/(tabs)/properties" as never)}
            />
          </View>

          <Text style={styles.disclaimerText}>
            ⓘ Commission applies strictly to completed offline property transactions verified
            by Beryl Shelter Nigeria Limited. Sharing a link does not generate earnings without a verified sale.
          </Text>
        </Card>

        {/* Summary KPIs */}
        {summary ? (
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, styles.kpiCardHighlight]}>
              <Text style={styles.kpiLabel}>Available Balance</Text>
              <Text style={styles.kpiValueLarge}>
                {formatMoney(summary.availableBalance)}
              </Text>
              {summary.availableBalance > 0 && (
                summary.bankComplete ? (
                  <Button
                    label="Withdraw Earnings"
                    onPress={() => router.push("/dashboard/referrals/withdraw" as never)}
                  />
                ) : (
                  <Button
                    label="Add bank details in Settings"
                    variant="secondary"
                    onPress={() => router.push("/dashboard/settings/profile" as never)}
                  />
                )
              )}
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Earnings</Text>
              <Text style={styles.kpiValue}>{formatMoney(summary.totalEarnings)}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Pending Withdrawals</Text>
              <Text style={styles.kpiValue}>{formatMoney(summary.pendingWithdrawals)}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Paid</Text>
              <Text style={styles.kpiValue}>{formatMoney(summary.paid)}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Referrals</Text>
              <Text style={styles.kpiValue}>{summary.referrals}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Properties Sold</Text>
              <Text style={styles.kpiValue}>{summary.propertiesSold}</Text>
            </View>
          </View>
        ) : null}

        {/* Referral History */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Referral History</Text>
          {items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="people-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptyBody}>
                Completed offline transactions attributed to your referrals will appear here after
                Beryl verifies them.
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {items.map((item: ReferralItem) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyTop}>
                    <View style={styles.badgeType}>
                      <Text style={styles.badgeTypeText}>
                        {item.referralType === "SELLER" ? "Seller Referral" : "Property"}
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>{formatDate(item.completedAt)}</Text>
                  </View>

                  <View style={styles.historyRow}>
                    <Text style={styles.historyLabel}>Property:</Text>
                    <Text style={styles.historyValue}>
                      {item.propertyCode || "—"}
                    </Text>
                  </View>

                  <View style={styles.historyRow}>
                    <Text style={styles.historyLabel}>Sale Amount:</Text>
                    <Text style={styles.historyValue}>
                      {formatMoney(item.saleAmount)}
                    </Text>
                  </View>

                  <View style={styles.historyRow}>
                    <Text style={styles.historyLabel}>Commission (2%):</Text>
                    <Text style={styles.earningsValue}>
                      {formatMoney(item.earnings)}
                    </Text>
                  </View>

                  <View style={styles.historyRow}>
                    <Text style={styles.historyLabel}>Payment:</Text>
                    <Text style={styles.paymentStateText}>
                      {item.paymentState === "PAID"
                        ? `Paid${item.paidAt ? ` (${formatDate(item.paidAt)})` : ""}`
                        : item.paymentState === "PARTIALLY_PAID"
                        ? `${formatMoney(item.paidMinor)} paid · Balance pending`
                        : "Outstanding"}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <View style={styles.paginationRow}>
                  <Pressable
                    disabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
                  >
                    <Text style={styles.pageButtonText}>‹ Previous</Text>
                  </Pressable>

                  <Text style={styles.pageIndicator}>
                    Showing {first}-{last} of {data.total}
                  </Text>

                  <Pressable
                    disabled={page >= data.totalPages}
                    onPress={() => setPage((p) => p + 1)}
                    style={[
                      styles.pageButton,
                      page >= data.totalPages && styles.pageButtonDisabled,
                    ]}
                  >
                    <Text style={styles.pageButtonText}>Next ›</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  cardBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  flowSteps: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepItem: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDark,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepNumberText: {
    color: colors.surface,
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Bold",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.text,
  },
  stepDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actionButtons: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  successText: {
    ...typography.caption,
    color: colors.success,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  kpiGrid: {
    gap: spacing.sm,
  },
  kpiCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  kpiCardHighlight: {
    borderColor: colors.brandGold,
    backgroundColor: colors.brandTint,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiValue: {
    ...typography.subheading,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.text,
  },
  kpiValueLarge: {
    ...typography.heading,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.brandDark,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  emptyBody: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  badgeType: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeTypeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  historyDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  historyValue: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  earningsValue: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.brandDark,
  },
  paymentStateText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  pageIndicator: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
