import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
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
import {
  supportApi,
  supportQuestions,
  type AgentReportInput,
  type PropertyReportInput,
} from "@/lib/support-api";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { status } = useAuth();
  const [faqSearch, setFaqSearch] = useState("");
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // Report Form State
  const [reportType, setReportType] = useState<"" | "PROPERTY" | "AGENT">("");
  const [propertyCode, setPropertyCode] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");

  const filteredFaqs = supportQuestions.filter(
    (item) =>
      item.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.answer.toLowerCase().includes(faqSearch.toLowerCase())
  );

  async function handleSubmitReport() {
    setReportError("");
    setReportSuccess("");

    if (!reportType) {
      setReportError("Please select what you are reporting (Property or Agent).");
      return;
    }
    if (reportType === "PROPERTY" && !propertyCode.trim()) {
      setReportError("Property Code is required.");
      return;
    }
    if (reportType === "AGENT" && !agentId.trim()) {
      setReportError("Agent ID is required.");
      return;
    }
    if (!reason.trim()) {
      setReportError("Please describe the reason for your report.");
      return;
    }

    setSubmitting(true);
    try {
      if (reportType === "PROPERTY") {
        const payload: PropertyReportInput = {
          reportType: "PROPERTY",
          propertyCode: propertyCode.trim(),
          propertyName: propertyName.trim(),
          reason: reason.trim(),
        };
        await supportApi.submitReport(payload);
      } else {
        const payload: AgentReportInput = {
          reportType: "AGENT",
          agentId: agentId.trim(),
          agentName: agentName.trim(),
          reason: reason.trim(),
        };
        await supportApi.submitReport(payload);
      }

      setReportSuccess("Your report was submitted successfully.");
      setReportType("");
      setPropertyCode("");
      setPropertyName("");
      setAgentId("");
      setAgentName("");
      setReason("");
    } catch (err) {
      setReportError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenEmail() {
    Linking.openURL("mailto:info@berylshelter.com").catch(() => {});
  }

  function handleOpenPhone() {
    Linking.openURL("tel:+2347042055678").catch(() => {});
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
          title="Support"
          description="Find answers to common questions, get in touch with our team, or report an issue."
        />

        {/* Authenticated Messages Shortcut */}
        {status === "signedIn" && (
          <Card style={styles.ticketCard}>
            <View style={styles.ticketCardHeader}>
              <AppIcon name="chatbubble-ellipses-outline" size={24} color={colors.brandGold} />
              <View style={styles.ticketCardMeta}>
                <Text style={styles.ticketCardTitle}>Have an ongoing inquiry?</Text>
                <Text style={styles.ticketCardDesc}>
                  Open or manage your direct support tickets in Messages.
                </Text>
              </View>
            </View>
            <Button
              label="Open Support Tickets"
              onPress={() => router.push("/dashboard/messages" as never)}
            />
          </Card>
        )}

        {/* FAQs Section */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
          <View style={styles.searchRow}>
            <AppIcon name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search FAQs..."
              placeholderTextColor={colors.textMuted}
              value={faqSearch}
              onChangeText={setFaqSearch}
            />
          </View>

          <View style={styles.faqList}>
            {filteredFaqs.length === 0 ? (
              <Text style={styles.noFaqText}>No matching questions found.</Text>
            ) : (
              filteredFaqs.map((faq, index) => {
                const isExpanded = expandedFaqIndex === index;
                return (
                  <View key={faq.question} style={styles.faqItem}>
                    <Pressable
                      style={styles.faqQuestionRow}
                      onPress={() => setExpandedFaqIndex(isExpanded ? null : index)}
                    >
                      <Text style={styles.faqQuestionText}>{faq.question}</Text>
                      <AppIcon
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {isExpanded && (
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </Card>

        {/* Contact Channels */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Contact Support</Text>
          <Text style={styles.cardSubtitle}>
            Our team is available to assist you with any inquiries or concerns.
          </Text>

          <View style={styles.contactList}>
            <Pressable
              style={styles.contactItem}
              onPress={handleOpenEmail}
              accessibilityRole="button"
              accessibilityLabel="Send email to info@berylshelter.com"
            >
              <View style={styles.contactIcon}>
                <AppIcon name="mail-outline" size={20} color={colors.brandDark} />
              </View>
              <View style={styles.contactMeta}>
                <Text style={styles.contactLabel}>Email Us</Text>
                <Text style={styles.contactValue}>info@berylshelter.com</Text>
              </View>
              <AppIcon name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              style={styles.contactItem}
              onPress={handleOpenPhone}
              accessibilityRole="button"
              accessibilityLabel="Call +234 704 205 5678"
            >
              <View style={styles.contactIcon}>
                <AppIcon name="call-outline" size={20} color={colors.brandDark} />
              </View>
              <View style={styles.contactMeta}>
                <Text style={styles.contactLabel}>Call Us</Text>
                <Text style={styles.contactValue}>+234 704 205 5678</Text>
              </View>
              <AppIcon name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <AppIcon name="location-outline" size={20} color={colors.brandDark} />
              </View>
              <View style={styles.contactMeta}>
                <Text style={styles.contactLabel}>Office Address</Text>
                <Text style={styles.contactValue}>
                  Plot 2, Cornerstone Estate Drive, Ikate-Elegshi, Lekki, Lagos
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Report an Issue */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>What are you reporting?</Text>
          <Text style={styles.cardSubtitle}>
            Help us maintain a safe community by reporting suspicious properties or agents.
          </Text>

          {reportSuccess ? (
            <View style={styles.successBanner}>
              <AppIcon name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.successText}>{reportSuccess}</Text>
            </View>
          ) : null}

          {reportError ? (
            <View style={styles.errorBanner}>
              <AppIcon name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{reportError}</Text>
            </View>
          ) : null}

          {/* Type Selector */}
          <View style={styles.reportTypeRow}>
            <Pressable
              onPress={() => {
                setReportType("PROPERTY");
                setReportError("");
              }}
              style={[
                styles.reportTypeButton,
                reportType === "PROPERTY" && styles.reportTypeButtonActive,
              ]}
            >
              <AppIcon
                name="home-outline"
                size={18}
                color={reportType === "PROPERTY" ? colors.brandDark : colors.textMuted}
              />
              <Text
                style={[
                  styles.reportTypeText,
                  reportType === "PROPERTY" && styles.reportTypeTextActive,
                ]}
              >
                Property
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setReportType("AGENT");
                setReportError("");
              }}
              style={[
                styles.reportTypeButton,
                reportType === "AGENT" && styles.reportTypeButtonActive,
              ]}
            >
              <AppIcon
                name="person-outline"
                size={18}
                color={reportType === "AGENT" ? colors.brandDark : colors.textMuted}
              />
              <Text
                style={[
                  styles.reportTypeText,
                  reportType === "AGENT" && styles.reportTypeTextActive,
                ]}
              >
                Agent
              </Text>
            </Pressable>
          </View>

          {/* Property Fields */}
          {reportType === "PROPERTY" && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Property Code *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. PROP-1234"
                  placeholderTextColor={colors.textMuted}
                  value={propertyCode}
                  onChangeText={setPropertyCode}
                  maxLength={80}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Property Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Property title"
                  placeholderTextColor={colors.textMuted}
                  value={propertyName}
                  onChangeText={setPropertyName}
                  maxLength={120}
                />
              </View>
            </>
          )}

          {/* Agent Fields */}
          {reportType === "AGENT" && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Agent ID *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. AGT-1234"
                  placeholderTextColor={colors.textMuted}
                  value={agentId}
                  onChangeText={setAgentId}
                  maxLength={80}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Agent Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Agent full name"
                  placeholderTextColor={colors.textMuted}
                  value={agentName}
                  onChangeText={setAgentName}
                  maxLength={120}
                />
              </View>
            </>
          )}

          {/* Reason */}
          {Boolean(reportType) && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Report *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe what happened..."
                placeholderTextColor={colors.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={3000}
              />
            </View>
          )}

          <Button
            label={submitting ? "Submitting..." : "Submit Report"}
            disabled={!reportType || submitting}
            onPress={() => void handleSubmitReport()}
            loading={submitting}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
  ticketCard: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brandGold,
    gap: spacing.sm,
  },
  ticketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ticketCardMeta: {
    flex: 1,
    gap: 2,
  },
  ticketCardTitle: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.brandDark,
  },
  ticketCardDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  faqList: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  faqQuestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  faqQuestionText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
    flex: 1,
  },
  faqAnswerText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  noFaqText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  contactList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  contactMeta: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-Bold",
    color: colors.text,
  },
  contactValue: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 16,
  },
  reportTypeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  reportTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportTypeButtonActive: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brandGold,
  },
  reportTypeText: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.textMuted,
  },
  reportTypeTextActive: {
    color: colors.brandDark,
    fontFamily: "PlusJakartaSans-Bold",
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...typography.caption,
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  successText: {
    ...typography.caption,
    color: colors.success,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  });
}
