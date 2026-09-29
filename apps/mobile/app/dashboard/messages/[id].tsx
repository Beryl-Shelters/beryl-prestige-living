import { useEffect, useRef, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { AppIcon } from "@/components/app-icon";
import { Button, Card, LoadingState, Screen, ScreenState } from "@/components/ui";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import {
  messagesApi,
  type TicketAttachment,
  type TicketDetail,
  type TicketMessage,
} from "@/lib/messages-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} ${d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function TicketConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  const acknowledgedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    void messagesApi
      .detail(id)
      .then((data) => {
        if (!active) return;
        setTicket(data);

        // Watermark acknowledgement if unread support messages exist
        const hasUnreadSupport = data.messages.some(
          (m) => m.senderType === "SUPPORT" && !m.readByCustomerAt
        );
        if (hasUnreadSupport && !acknowledgedRef.current && data.messages.length > 0) {
          acknowledgedRef.current = true;
          const lastMsg = data.messages[data.messages.length - 1];
          if (lastMsg) {
            messagesApi.acknowledge(data.id, lastMsg.id).catch(() => {});
          }
        }
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
  }, [id]);

  const messageCount = ticket?.messages.length ?? 0;
  useEffect(() => {
    if (messageCount > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messageCount]);

  async function handlePickAttachment() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/jpg",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset) {
          if (asset.size && asset.size > 10 * 1024 * 1024) {
            setSendError("Attachment must be 10MB or smaller.");
            return;
          }
          setAttachment({
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || "application/octet-stream",
            size: asset.size,
          });
          setSendError("");
        }
      }
    } catch {
      setSendError("Could not pick attachment.");
    }
  }

  async function handleSendReply() {
    if (!ticket) return;
    if (!replyText.trim() && !attachment) {
      setSendError("Please enter a reply or attach a document.");
      return;
    }

    setSending(true);
    setSendError("");

    try {
      const updated = await messagesApi.reply(
        ticket.id,
        replyText.trim(),
        attachment ?? undefined
      );
      setTicket(updated);
      setReplyText("");
      setAttachment(null);
    } catch (err) {
      setSendError(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading conversation..." />
      </Screen>
    );
  }

  if (error || !ticket) {
    return (
      <Screen>
        <Card>
          <ScreenState
            title="Conversation Unavailable"
            message={error || "Ticket not found."}
            action={
              <Button
                label="Back to Messages"
                variant="secondary"
                onPress={() => router.back()}
              />
            }
          />
        </Card>
      </Screen>
    );
  }

  const isResolved = ticket.status === "RESOLVED";

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Ticket Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.badgeRow}>
              <Text style={styles.ticketNumber}>Ticket #{ticket.ticketNumber}</Text>
              <View
                style={[
                  styles.statusBadge,
                  isResolved ? styles.statusBadgeResolved : styles.statusBadgeOpen,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isResolved ? styles.statusBadgeTextResolved : styles.statusBadgeTextOpen,
                  ]}
                >
                  {isResolved ? "Resolved" : "Open"}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.ticketSubject}>{ticket.subject}</Text>
          <Text style={styles.ticketMeta}>
            Last activity: {formatDateTime(ticket.lastActivityAt)}
          </Text>
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
        >
          <View style={styles.openedBadge}>
            <Text style={styles.openedBadgeText}>
              Ticket opened {formatDateTime(ticket.createdAt)}
            </Text>
          </View>

          {ticket.messages.map((item: TicketMessage) => {
            const isCustomer = item.senderType === "CUSTOMER";
            return (
              <View
                key={item.id}
                style={[
                  styles.messageRow,
                  isCustomer ? styles.messageRowCustomer : styles.messageRowSupport,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isCustomer ? styles.bubbleCustomer : styles.bubbleSupport,
                  ]}
                >
                  {!isCustomer && (
                    <Text style={styles.senderLabel}>Beryl Support</Text>
                  )}
                  {Boolean(item.body) && (
                    <Text
                      style={[
                        styles.messageText,
                        isCustomer ? styles.messageTextCustomer : styles.messageTextSupport,
                      ]}
                    >
                      {item.body}
                    </Text>
                  )}

                  {item.attachments && item.attachments.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      {item.attachments.map((att: TicketAttachment) => (
                        <View key={att.id} style={styles.attachmentChip}>
                          <AppIcon name="attach-outline" size={16} color={colors.brandDark} />
                          <View style={styles.attachmentMeta}>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {att.filename}
                            </Text>
                            <Text style={styles.attachmentSize}>
                              {(att.sizeBytes / 1024).toFixed(1)} KB
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.messageFooter}>
                    <Text
                      style={[
                        styles.timestamp,
                        isCustomer ? styles.timestampCustomer : styles.timestampSupport,
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                    {isCustomer && (
                      <Text style={styles.sentCheckmark}>✓</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer / Reply Composer OR Resolved Banner */}
        {isResolved ? (
          <View style={styles.resolvedBanner}>
            <AppIcon name="checkmark-circle-outline" size={24} color={colors.textMuted} />
            <Text style={styles.resolvedTitle}>
              Ticket resolved on {formatDateTime(ticket.resolvedAt)}
            </Text>
            <Text style={styles.resolvedNotice}>
              {"You can't send or receive messages for this ticket anymore."}
            </Text>
            <Button
              label="Create a new ticket instead"
              variant="secondary"
              onPress={() => router.replace("/dashboard/messages")}
            />
          </View>
        ) : (
          <View style={styles.composerContainer}>
            {sendError ? (
              <View style={styles.errorNotice}>
                <AppIcon name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorNoticeText}>{sendError}</Text>
              </View>
            ) : null}

            {attachment ? (
              <View style={styles.selectedFileChip}>
                <AppIcon name="document-text-outline" size={16} color={colors.brandDark} />
                <Text style={styles.selectedFileName} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Pressable
                  onPress={() => setAttachment(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                  hitSlop={8}
                >
                  <AppIcon name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.composerRow}>
              <Pressable
                onPress={() => void handlePickAttachment()}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Attach document"
                style={({ pressed }) => [
                  styles.attachButton,
                  pressed && styles.attachButtonPressed,
                ]}
              >
                <AppIcon name="attach-outline" size={22} color={colors.brandDark} />
              </Pressable>

              <TextInput
                style={styles.composerInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={3000}
                value={replyText}
                onChangeText={setReplyText}
                editable={!sending}
              />

              <Pressable
                onPress={() => void handleSendReply()}
                disabled={sending || (!replyText.trim() && !attachment)}
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                style={({ pressed }) => [
                  styles.sendButton,
                  (!replyText.trim() && !attachment) && styles.sendButtonDisabled,
                  pressed && styles.sendButtonPressed,
                ]}
              >
                <AppIcon
                  name="send"
                  size={18}
                  color={
                    !replyText.trim() && !attachment ? colors.textMuted : colors.surface
                  }
                />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  headerCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ticketNumber: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeOpen: {
    backgroundColor: colors.brandTint,
  },
  statusBadgeResolved: {
    backgroundColor: colors.surfaceMuted,
  },
  statusBadgeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  statusBadgeTextOpen: {
    color: colors.brandDark,
  },
  statusBadgeTextResolved: {
    color: colors.textMuted,
  },
  ticketSubject: {
    ...typography.subheading,
    color: colors.text,
  },
  ticketMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  openedBadge: {
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  openedBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 2,
  },
  messageRowCustomer: {
    justifyContent: "flex-end",
  },
  messageRowSupport: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "82%",
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  bubbleCustomer: {
    backgroundColor: colors.brandDark,
    borderBottomRightRadius: radius.xs,
  },
  bubbleSupport: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.xs,
  },
  senderLabel: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.brandGold,
    marginBottom: 2,
  },
  messageText: {
    ...typography.body,
    lineHeight: 20,
  },
  messageTextCustomer: {
    color: colors.surface,
  },
  messageTextSupport: {
    color: colors.text,
  },
  attachmentsContainer: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  attachmentMeta: {
    flex: 1,
  },
  attachmentName: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  attachmentSize: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
  },
  timestampCustomer: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  timestampSupport: {
    color: colors.textMuted,
  },
  sentCheckmark: {
    fontSize: 11,
    color: colors.brandGold,
  },
  resolvedBanner: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    gap: spacing.xs,
  },
  resolvedTitle: {
    ...typography.subheading,
    color: colors.text,
    textAlign: "center",
  },
  resolvedNotice: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  composerContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },
  errorNoticeText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  selectedFileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  selectedFileName: {
    ...typography.caption,
    color: colors.brandDark,
    maxWidth: 220,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  attachButton: {
    padding: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  attachButtonPressed: {
    opacity: 0.6,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...typography.body,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDark,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
});
