import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { AppIcon } from "@/components/app-icon";
import { Button, Card, LoadingState, ScreenState } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import {
  messagesApi,
  type TicketSummary,
} from "@/lib/messages-api";
import type { PickedFile } from "@/lib/file-upload-helper";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type TicketFilter = "ALL" | "UNREAD" | "RESOLVED";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function MessagesListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [filter, setFilter] = useState<TicketFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // New Ticket Modal state
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    void messagesApi
      .list(debouncedQuery)
      .then((data) => {
        if (!active) return;
        setTickets(data.items);
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
  }, [debouncedQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const data = await messagesApi.list(debouncedQuery);
      setTickets(data.items);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRefreshing(false);
    }
  }

  function handleRetry() {
    setLoading(true);
    setError("");
    void messagesApi
      .list(debouncedQuery)
      .then((data) => setTickets(data.items))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  async function handlePickAttachment() {
    setCreateError("");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        if (asset.size && asset.size > 10 * 1024 * 1024) {
          setCreateError("Attachment must be 10 MB or smaller.");
          return;
        }
        setAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
          size: asset.size,
        });
      }
    } catch {
      setCreateError("Could not pick attachment.");
    }
  }

  async function handleCreateTicket() {
    if (!subject.trim()) {
      setCreateError("Please enter a subject.");
      return;
    }
    if (!message.trim() && !attachment) {
      setCreateError("Please enter a message.");
      return;
    }

    setSending(true);
    setCreateError("");
    try {
      const created = await messagesApi.create(
        subject.trim(),
        message.trim(),
        attachment ?? undefined
      );
      setNewTicketModal(false);
      setSubject("");
      setMessage("");
      setAttachment(null);
      void handleRefresh();
      router.push(`/dashboard/messages/${created.id}` as never);
    } catch (err) {
      setCreateError(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (filter === "UNREAD") return t.unread;
    if (filter === "RESOLVED") return t.status === "RESOLVED";
    return true;
  });

  const counts = {
    ALL: tickets.length,
    UNREAD: tickets.filter((t) => t.unread).length,
    RESOLVED: tickets.filter((t) => t.status === "RESOLVED").length,
  };

  function renderTicketItem({ item }: { item: TicketSummary }) {
    const isResolved = item.status === "RESOLVED";

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ticket ${item.ticketNumber}: ${item.subject}`}
        onPress={() => router.push(`/dashboard/messages/${item.id}` as never)}
        style={({ pressed }) => [styles.ticketCard, pressed && styles.ticketCardPressed]}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.ticketNumber}>#{item.ticketNumber}</Text>
          <View
            style={[
              styles.statusPill,
              isResolved ? styles.statusPillResolved : styles.statusPillOpen,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                isResolved ? styles.statusPillTextResolved : styles.statusPillTextOpen,
              ]}
            >
              {isResolved ? "Resolved" : "Open"}
            </Text>
          </View>
        </View>

        <View style={styles.subjectRow}>
          <Text numberOfLines={1} style={styles.subjectText}>
            {item.subject}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.lastActivityAt)}</Text>
        </View>

        <View style={styles.previewRow}>
          <Text numberOfLines={2} style={styles.previewText}>
            {item.latestMessagePreview || "No messages yet"}
          </Text>
          {item.unread && (
            <View
              style={styles.unreadDot}
              accessibilityLabel="Unread support reply"
            />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          My Tickets
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create new ticket"
          onPress={() => {
            setCreateError("");
            setSubject("");
            setMessage("");
            setAttachment(null);
            setNewTicketModal(true);
          }}
          style={styles.newTicketBtn}
        >
          <AppIcon name="add" size={16} color="#FFF" />
          <Text style={styles.newTicketBtnText}>New Ticket</Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <AppIcon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search conversations"
          placeholder="Search conversations"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          maxLength={100}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch("")}
          >
            <AppIcon name="close-circle-outline" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filters Bar */}
      <View style={styles.filtersBar}>
        {(["ALL", "UNREAD", "RESOLVED"] as const).map((key) => {
          const isSelected = filter === key;
          const label = key === "ALL" ? "All" : key === "UNREAD" ? "Unread" : "Resolved";
          const count = counts[key];

          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={`${label} tickets, ${count}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setFilter(key)}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  isSelected && styles.countBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    isSelected && styles.countBadgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Content Area */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <LoadingState label="Loading tickets…" />
        </View>
      ) : error && tickets.length === 0 ? (
        <View style={styles.centered}>
          <ScreenState
            title="Messages Unavailable"
            message={error}
            action={<Button label="Try Again" onPress={handleRetry} />}
          />
        </View>
      ) : counts.ALL === 0 && !debouncedQuery ? (
        <View style={styles.centered}>
          <Card style={styles.emptyCard}>
            <AppIcon name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              No messages yet
            </Text>
            <Text style={styles.emptySubtext}>
              Have questions or need assistance? Open a support ticket to reach our customer support team.
            </Text>
            <Button
              label="+ Create a new ticket"
              onPress={() => {
                setCreateError("");
                setSubject("");
                setMessage("");
                setAttachment(null);
                setNewTicketModal(true);
              }}
            />
          </Card>
        </View>
      ) : filteredTickets.length === 0 ? (
        <View style={styles.centered}>
          <Card style={styles.emptyCard}>
            <AppIcon name="search-outline" size={48} color={colors.textMuted} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              No tickets found
            </Text>
            <Text style={styles.emptySubtext}>
              Try another search term or switch filters.
            </Text>
            <Button
              label="Clear filters"
              variant="secondary"
              onPress={() => {
                setSearch("");
                setFilter("ALL");
              }}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicketItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.brandDark]}
              tintColor={colors.brandDark}
            />
          }
        />
      )}

      {/* New Ticket Modal */}
      <Modal
        visible={newTicketModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sending) setNewTicketModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <Text accessibilityRole="header" style={styles.modalTitle}>
                New Ticket
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={sending}
                onPress={() => setNewTicketModal(false)}
              >
                <AppIcon name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtext}>
              Send a message to our support team.
            </Text>

            {createError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{createError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Subject *</Text>
            <TextInput
              accessibilityLabel="Ticket subject"
              placeholder="Enter subject of the message"
              placeholderTextColor={colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              maxLength={160}
              editable={!sending}
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Message *</Text>
            <TextInput
              accessibilityLabel="Ticket message"
              placeholder="Enter message you want to send"
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              maxLength={3000}
              multiline
              numberOfLines={4}
              editable={!sending}
              style={[styles.modalInput, styles.modalTextarea]}
            />

            {/* Attachment preview / picker */}
            {attachment ? (
              <View style={styles.selectedFileRow}>
                <AppIcon name="document-attach-outline" size={18} color={colors.brandDark} />
                <Text numberOfLines={1} style={styles.selectedFileName}>
                  {attachment.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                  disabled={sending}
                  onPress={() => setAttachment(null)}
                >
                  <AppIcon name="close-circle" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Attach file"
                disabled={sending}
                onPress={handlePickAttachment}
                style={styles.attachBtn}
              >
                <AppIcon name="attach-outline" size={18} color={colors.brandDark} />
                <Text style={styles.attachBtnText}>Attach File (PDF, PNG, JPG up to 10 MB)</Text>
              </Pressable>
            )}

            <View style={styles.modalBtnRow}>
              <Button
                label="Cancel"
                variant="secondary"
                disabled={sending}
                onPress={() => setNewTicketModal(false)}
              />
              <Button
                label={sending ? "Sending…" : "Send Message"}
                disabled={sending}
                loading={sending}
                onPress={handleCreateTicket}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    headerBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    pageTitle: {
      ...typography.heading,
      fontSize: 20,
      color: colors.text,
    },
    newTicketBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.brandDark,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.md,
    },
    newTicketBtnText: {
      ...typography.label,
      color: "#FFF",
      fontSize: 13,
    },
    searchWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      height: 44,
      gap: spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      paddingVertical: 0,
    },
    filtersBar: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      borderColor: colors.brandDark,
      backgroundColor: colors.brandTint,
    },
    filterChipText: {
      ...typography.caption,
      fontSize: 13,
      color: colors.text,
    },
    filterChipTextActive: {
      fontWeight: "700",
      color: colors.brandDark,
    },
    countBadge: {
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
    },
    countBadgeActive: {
      backgroundColor: colors.brandDark,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
    },
    countBadgeTextActive: {
      color: "#FFF",
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    ticketCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    ticketCardPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    ticketNumber: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.textMuted,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: "transparent",
    },
    statusPillOpen: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.warning,
    },
    statusPillResolved: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.success,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    statusPillTextOpen: {
      color: colors.warning,
    },
    statusPillTextResolved: {
      color: colors.success,
    },
    subjectRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
    },
    subjectText: {
      ...typography.body,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    dateText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textMuted,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    previewText: {
      ...typography.caption,
      color: colors.textMuted,
      flex: 1,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.brandDark,
      marginLeft: spacing.sm,
    },
    emptyCard: {
      alignItems: "center",
      padding: spacing.xl,
      gap: spacing.sm,
      width: "100%",
    },
    emptyTitle: {
      ...typography.heading,
      fontSize: 18,
      color: colors.text,
      textAlign: "center",
    },
    emptySubtext: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    modalDialog: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      width: "100%",
      maxWidth: 420,
      gap: spacing.sm,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    modalTitle: {
      ...typography.heading,
      fontSize: 18,
      color: colors.text,
    },
    modalSubtext: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    inputLabel: {
      ...typography.caption,
      fontWeight: "600",
      color: colors.text,
      marginTop: spacing.xs,
    },
    modalInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
      color: colors.text,
    },
    modalTextarea: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    attachBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    attachBtnText: {
      ...typography.caption,
      color: colors.brandDark,
      fontWeight: "600",
    },
    selectedFileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.sm,
      borderRadius: radius.md,
    },
    selectedFileName: {
      ...typography.caption,
      color: colors.text,
      flex: 1,
    },
    errorBanner: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: spacing.sm,
      borderRadius: radius.md,
    },
    errorBannerText: {
      ...typography.caption,
      color: colors.danger,
      fontWeight: "600",
    },
    modalBtnRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
      marginTop: spacing.md,
    },
  });
}
