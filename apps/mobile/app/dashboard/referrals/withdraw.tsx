import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { Button, Card, LoadingState, ScreenState, SectionHeading } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import {
  calculateQuickPercentage,
  referralsApi,
  type WithdrawalItem,
  type WithdrawalPage,
} from "@/lib/referrals-api";
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

function formatAmountInput(value: string): string {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [whole = "", ...fraction] = cleaned.split(".");
  const integer = (whole.replace(/^0+(?=\d)/, "") || "0").slice(0, 13);
  const decimal = fraction.join("").slice(0, 2);
  const withCommas = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return cleaned.includes(".") ? `${withCommas}.${decimal}` : withCommas;
}

function parseAmountToMinor(value: string): number {
  const normalized = value.replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

function minorToInputString(minor: number): string {
  const whole = Math.floor(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${cents}`;
}

export default function WithdrawalScreen() {
  const [data, setData] = useState<WithdrawalPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    void referralsApi
      .withdrawals(page)
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
    setNotice("");
    try {
      const res = await referralsApi.withdrawals(page);
      setData(res);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  function handleQuickSelect(pct: number) {
    if (!data) return;
    const computed = calculateQuickPercentage(data.balance.availableMinor, pct);
    setAmountInput(minorToInputString(computed));
    setNotice("");
  }

  async function handleSubmitWithdrawal() {
    if (!data) return;
    const minor = parseAmountToMinor(amountInput);

    if (!data.bank.complete) {
      setError("Please register your bank account details in Settings before withdrawing.");
      return;
    }
    if (minor < data.balance.minimumMinor) {
      setError(`Minimum withdrawal is ${formatMoney(data.balance.minimumMinor)}.`);
      return;
    }
    if (minor > data.balance.availableMinor) {
      setError(`Amount exceeds your available balance of ${formatMoney(data.balance.availableMinor)}.`);
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const requestId = `mobile_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await referralsApi.requestWithdrawal(requestId, minor);
      setAmountInput("");
      setNotice("Withdrawal request submitted successfully.");
      const updated = await referralsApi.withdrawals(1);
      setData(updated);
      setPage(1);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelWithdrawal(id: string) {
    setCancellingId(id);
    setError("");
    setNotice("");
    try {
      await referralsApi.cancelWithdrawal(id);
      setNotice("Withdrawal request cancelled.");
      const updated = await referralsApi.withdrawals(page);
      setData(updated);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState label="Loading withdrawal balance..." />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.screen}>
        <Card style={styles.errorCard}>
          <ScreenState
            title="Withdrawals Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={() => void handleRefresh()} />}
          />
        </Card>
      </View>
    );
  }

  const balance = data?.balance;
  const bank = data?.bank;
  const items = data?.items ?? [];
  const minorAmount = parseAmountToMinor(amountInput);
  const isValidAmount =
    Boolean(bank?.complete) &&
    balance !== undefined &&
    minorAmount >= balance.minimumMinor &&
    minorAmount <= balance.availableMinor;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
      >
        <SectionHeading
          title="Withdraw Earnings"
          description="Request withdrawal of your referral commission to your registered bank account."
        />

        {notice ? (
          <View style={styles.noticeBanner}>
            <AppIcon name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <AppIcon name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Balance Card */}
        {balance ? (
          <Card style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <AppIcon name="wallet-outline" size={24} color={colors.brandGold} />
              <Text style={styles.balanceLabel}>Available Balance</Text>
            </View>
            <Text style={styles.balanceAmount}>{formatMoney(balance.availableMinor)}</Text>
            <Text style={styles.minimumNotice}>
              Minimum withdrawal: {formatMoney(balance.minimumMinor)}
            </Text>

            <View style={styles.balanceStatsRow}>
              <View style={styles.balanceStat}>
                <Text style={styles.statLabel}>Total Earned</Text>
                <Text style={styles.statValue}>{formatMoney(balance.totalEarnedMinor)}</Text>
              </View>
              <View style={styles.balanceStat}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={styles.statValue}>{formatMoney(balance.pendingMinor)}</Text>
              </View>
              <View style={styles.balanceStat}>
                <Text style={styles.statLabel}>Paid</Text>
                <Text style={styles.statValue}>{formatMoney(balance.totalPaidMinor)}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Bank Account Info Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Registered Bank Account</Text>
          {bank?.complete ? (
            <View style={styles.bankInfo}>
              <AppIcon name="card-outline" size={20} color={colors.brandDark} />
              <View style={styles.bankDetails}>
                <Text style={styles.bankName}>{bank.bankName}</Text>
                <Text style={styles.bankAccount}>{bank.accountName}</Text>
                <Text style={styles.bankNumber}>{bank.maskedAccountNumber}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.bankMissing}>
              <AppIcon name="alert-circle-outline" size={20} color={colors.warning} />
              <View style={styles.bankMissingTextContainer}>
                <Text style={styles.bankMissingTitle}>Bank details required</Text>
                <Text style={styles.bankMissingDesc}>
                  Add complete bank account details in Account Settings before requesting a withdrawal.
                </Text>
              </View>
              <Button
                label="Go to Settings"
                variant="secondary"
                onPress={() => router.push("/dashboard/settings/profile" as never)}
              />
            </View>
          )}
        </Card>

        {/* Withdrawal Form */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Enter Amount to Withdraw</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={amountInput}
              onChangeText={(val) => {
                setAmountInput(formatAmountInput(val));
                setError("");
              }}
              editable={!submitting}
            />
          </View>

          {/* Quick Select Buttons */}
          <View style={styles.quickSelectRow}>
            <Text style={styles.quickSelectLabel}>Quick Select:</Text>
            <View style={styles.quickButtons}>
              {[25, 50, 75, 100].map((pct) => (
                <Pressable
                  key={pct}
                  disabled={!balance || balance.availableMinor <= 0}
                  onPress={() => handleQuickSelect(pct)}
                  style={({ pressed }) => [
                    styles.quickButton,
                    (!balance || balance.availableMinor <= 0) && styles.quickButtonDisabled,
                    pressed && styles.quickButtonPressed,
                  ]}
                >
                  <Text style={styles.quickButtonText}>{pct}%</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.disclaimerText}>
            ⓘ Withdrawal requests are reviewed and processed by Beryl using your registered bank details.
            Submitting this request does not transfer money automatically.
          </Text>

          <Button
            label={submitting ? "Submitting..." : "Submit Withdrawal Request"}
            disabled={!isValidAmount || submitting}
            onPress={() => void handleSubmitWithdrawal()}
            loading={submitting}
          />
        </Card>

        {/* Recent Withdrawals History */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Recent Withdrawals</Text>
          {items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="receipt-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No withdrawal requests yet</Text>
              <Text style={styles.emptyBody}>
                Your real withdrawal requests will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {items.map((item: WithdrawalItem) => {
                const isPending = item.status === "PENDING";
                const isProcessing = item.status === "PROCESSING";
                const isPaid = item.status === "PAID";
                const isRejected = item.status === "REJECTED";
                const isCancelled = item.status === "CANCELLED";

                return (
                  <View key={item.id} style={styles.withdrawalItem}>
                    <View style={styles.withdrawalTop}>
                      <Text style={styles.withdrawalAmount}>
                        {formatMoney(item.amountMinor)}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isPaid && styles.statusBadgePaid,
                          isPending && styles.statusBadgePending,
                          isProcessing && styles.statusBadgeProcessing,
                          (isRejected || isCancelled) && styles.statusBadgeFailed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isPaid && styles.statusTextPaid,
                            isPending && styles.statusTextPending,
                            isProcessing && styles.statusTextProcessing,
                            (isRejected || isCancelled) && styles.statusTextFailed,
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.withdrawalRow}>
                      <Text style={styles.metaLabel}>Requested:</Text>
                      <Text style={styles.metaValue}>{formatDate(item.requestedAt)}</Text>
                    </View>

                    {item.paidAt && (
                      <View style={styles.withdrawalRow}>
                        <Text style={styles.metaLabel}>Paid:</Text>
                        <Text style={styles.metaValue}>{formatDate(item.paidAt)}</Text>
                      </View>
                    )}

                    {isProcessing && (
                      <Text style={styles.processingNote}>
                        Beryl is processing the external payment.
                      </Text>
                    )}

                    {item.rejectionReason && (
                      <Text style={styles.rejectionReason}>
                        Reason: {item.rejectionReason}
                      </Text>
                    )}

                    {/* ONLY PENDING CAN BE CANCELLED */}
                    {isPending && (
                      <View style={styles.cancelRow}>
                        <Button
                          label={cancellingId === item.id ? "Cancelling..." : "Cancel Request"}
                          variant="danger"
                          disabled={cancellingId === item.id}
                          onPress={() => void handleCancelWithdrawal(item.id)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}

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
                    Page {page} of {data.totalPages}
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
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  noticeText: {
    ...typography.caption,
    color: colors.success,
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
  balanceCard: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brandGold,
    gap: spacing.xs,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  balanceLabel: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  balanceAmount: {
    ...typography.heading,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.brandDark,
  },
  minimumNotice: {
    ...typography.caption,
    color: colors.textMuted,
  },
  balanceStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  balanceStat: {
    gap: 2,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  statValue: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  bankInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bankDetails: {
    flex: 1,
    gap: 2,
  },
  bankName: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.text,
  },
  bankAccount: {
    ...typography.caption,
    color: colors.text,
  },
  bankNumber: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bankMissing: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  bankMissingTextContainer: {
    gap: 2,
  },
  bankMissingTitle: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.warning,
  },
  bankMissingDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: {
    ...typography.heading,
    color: colors.brandDark,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    ...typography.heading,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  quickSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.xs,
  },
  quickSelectLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  quickButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  quickButton: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickButtonDisabled: {
    opacity: 0.4,
  },
  quickButtonPressed: {
    backgroundColor: colors.brandTint,
  },
  quickButtonText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginVertical: spacing.xs,
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
  },
  historyList: {
    gap: spacing.sm,
  },
  withdrawalItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  withdrawalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  withdrawalAmount: {
    ...typography.subheading,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.brandDark,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgePaid: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgePending: {
    backgroundColor: "#FEF3C7",
  },
  statusBadgeProcessing: {
    backgroundColor: "#DBEAFE",
  },
  statusBadgeFailed: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
  },
  statusTextPaid: {
    color: "#166534",
  },
  statusTextPending: {
    color: "#92400E",
  },
  statusTextProcessing: {
    color: "#1E40AF",
  },
  statusTextFailed: {
    color: "#991B1B",
  },
  withdrawalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  processingNote: {
    ...typography.caption,
    color: "#1E40AF",
    fontStyle: "italic",
    marginTop: 2,
  },
  rejectionReason: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 2,
  },
  cancelRow: {
    marginTop: spacing.xs,
    alignItems: "flex-end",
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
