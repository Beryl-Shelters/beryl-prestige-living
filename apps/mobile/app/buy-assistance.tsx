import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { DocumentPickerComponent } from "@/components/document-picker";
import { Button, Card, SectionHeading, TextField } from "@/components/ui";
import { assistanceApi } from "@/lib/assistance-api";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import { formatNairaInput, nairaToKobo } from "@/lib/money";
import {
  nigerianStates,
  propertyFacilities,
  propertySubtypes,
} from "@/lib/property-taxonomy";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const countOptions = ["1", "2", "3", "4", "5", "6", "7+"] as const;
const timingOptions = [
  "Immediately",
  "Within 1 Month",
  "Within 3 Months",
  "Within 6 Months",
  "Within 12 Months",
  "Flexible",
] as const;
const paymentIntentOptions = ["Outright Cash Purchase", "Mortgage"] as const;

export default function BuyAssistanceRoute() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { customer } = useAuth();
  const defaultName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  const defaultEmail = customer?.email || "";

  const [contactName, setContactName] = useState(defaultName);
  const [preferredMethod, setPreferredMethod] = useState<"Phone" | "Email">("Phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [propertyType, setPropertyType] = useState<"Residential" | "Commercial">("Residential");
  const [propertySubtype, setPropertySubtype] = useState<string>("");
  const [bedrooms, setBedrooms] = useState<string>("");
  const [bathrooms, setBathrooms] = useState<string>("");
  const [locality, setLocality] = useState("");
  const [selectedState, setSelectedState] = useState<string>("Lagos");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentIntent, setPaymentIntent] = useState<string>("");
  const [timing, setTiming] = useState<string>("");
  const [giftings, setGiftings] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [mandateDocs, setMandateDocs] = useState<{ file: PickedFile; title: string }[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const isResidential = propertyType === "Residential";

  function toggleFacility(name: string) {
    setSelectedFacilities((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (contactName.trim().length < 2) next.contactName = "Enter the contact person's full name.";
    if (preferredMethod === "Phone" && !/^\+?[0-9 ()-]{7,25}$/.test(phone.trim())) {
      next.phone = "Enter a valid contact phone number.";
    }
    if (preferredMethod === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid contact email.";
    }
    if (isResidential && !propertySubtype) {
      next.propertySubtype = "Select a residential property subtype.";
    }
    if (!selectedState) {
      next.state = "Select a Nigerian state.";
    }
    const budgetKobo = nairaToKobo(budget);
    if (!budgetKobo || budgetKobo <= 0) {
      next.budget = "Enter a positive budget.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setSubmitError("");

    const data: Record<string, unknown> = {
      contactName: contactName.trim(),
      preferredContactMethod: preferredMethod,
      ...(preferredMethod === "Phone" ? { contactPhone: phone.trim() } : { contactEmail: email.trim().toLowerCase() }),
      propertyType,
      ...(isResidential && propertySubtype ? { propertySubtype } : {}),
      ...(isResidential && bedrooms ? { bedrooms } : {}),
      ...(isResidential && bathrooms ? { bathrooms } : {}),
      ...(locality.trim() ? { locality: locality.trim() } : {}),
      state: selectedState,
      ...(city.trim() ? { city: city.trim() } : {}),
      facilities: selectedFacilities,
      budget: budget.replace(/,/g, ""),
      ...(paymentIntent ? { paymentIntent } : {}),
      ...(timing ? { timing } : {}),
      ...(giftings.trim() ? { likelyTransferableGiftings: giftings.trim() } : {}),
    };

    try {
      await assistanceApi.submitBuyAssistance(data, mandateDocs[0]?.file);
      setSuccess(true);
    } catch (err: unknown) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <AppIcon name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Buy Assistance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {success ? (
          <Card>
            <View style={styles.successState}>
              <View style={styles.successBadge}>
                <AppIcon name="checkmark" size={32} color="#FFF" />
              </View>
              <Text accessibilityRole="header" style={styles.successTitle}>
                Buying Assistance Request Received
              </Text>
              <Text style={styles.successText}>
                Thank you. Beryl Shelter will review your requirements and contact you through your
                preferred method to help source properties that match your budget and criteria.
              </Text>
              <Text style={styles.disclaimerText}>
                Buy Assistance is a customer search advisory service, not an online payment or property
                purchase. No financial transaction or mortgage approval occurs in this app.
              </Text>
              <Button label="Browse Properties" onPress={() => router.replace("/(tabs)/properties")} />
            </View>
          </Card>
        ) : (
          <View style={styles.formStack}>
            <SectionHeading
              title="What are your buy requirements?"
              description="Tell us about the property you want to buy and we'll help find matching properties."
            />

            <Card>
              <Text style={styles.cardHeader}>1. Contact Information</Text>

              <TextField
                label="Contact Name *"
                placeholder="Full name of contact person"
                value={contactName}
                onChangeText={setContactName}
                error={errors.contactName}
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Preferred Contact Method *</Text>
                <View style={styles.chipRow}>
                  {(["Phone", "Email"] as const).map((method) => {
                    const active = preferredMethod === method;
                    return (
                      <Pressable
                        key={method}
                        accessibilityRole="radio"
                        accessibilityLabel={method}
                        accessibilityState={{ selected: active }}
                        onPress={() => setPreferredMethod(method)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{method}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {preferredMethod === "Phone" ? (
                <TextField
                  label="Contact Phone *"
                  placeholder="+234 801 234 5678"
                  value={phone}
                  onChangeText={setPhone}
                  error={errors.phone}
                  keyboardType="phone-pad"
                />
              ) : (
                <TextField
                  label="Contact Email *"
                  placeholder="contact@example.com"
                  value={email}
                  onChangeText={setEmail}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            </Card>

            <Card>
              <Text style={styles.cardHeader}>2. Property Preferences</Text>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Property Type *</Text>
                <View style={styles.chipRow}>
                  {(["Residential", "Commercial"] as const).map((type) => {
                    const active = propertyType === type;
                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="radio"
                        accessibilityLabel={type}
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setPropertyType(type);
                          if (type === "Commercial") {
                            setPropertySubtype("");
                            setBedrooms("");
                            setBathrooms("");
                          }
                        }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {isResidential && (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>Property Subtype *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {propertySubtypes.map((sub) => {
                        const active = propertySubtype === sub;
                        return (
                          <Pressable
                            key={sub}
                            accessibilityRole="radio"
                            accessibilityLabel={sub}
                            accessibilityState={{ selected: active }}
                            onPress={() => setPropertySubtype(sub)}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{sub}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {errors.propertySubtype ? (
                      <Text accessibilityRole="alert" style={styles.errorText}>{errors.propertySubtype}</Text>
                    ) : null}
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>Bedrooms</Text>
                    <View style={styles.chipRow}>
                      {countOptions.map((cnt) => {
                        const active = bedrooms === cnt;
                        return (
                          <Pressable
                            key={cnt}
                            accessibilityRole="radio"
                            accessibilityLabel={`${cnt} bedrooms`}
                            accessibilityState={{ selected: active }}
                            onPress={() => setBedrooms(active ? "" : cnt)}
                            style={[styles.chipSmall, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{cnt}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>Bathrooms</Text>
                    <View style={styles.chipRow}>
                      {countOptions.map((cnt) => {
                        const active = bathrooms === cnt;
                        return (
                          <Pressable
                            key={cnt}
                            accessibilityRole="radio"
                            accessibilityLabel={`${cnt} bathrooms`}
                            accessibilityState={{ selected: active }}
                            onPress={() => setBathrooms(active ? "" : cnt)}
                            style={[styles.chipSmall, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{cnt}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              <TextField
                label="Locality"
                placeholder="e.g. Ikoyi, Victoria Island"
                value={locality}
                onChangeText={setLocality}
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>State *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {nigerianStates.map((st) => {
                    const active = selectedState === st;
                    return (
                      <Pressable
                        key={st}
                        accessibilityRole="radio"
                        accessibilityLabel={st}
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelectedState(st)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{st}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <TextField
                label="City"
                placeholder="e.g. Lagos, Abuja"
                value={city}
                onChangeText={setCity}
              />
            </Card>

            <Card>
              <Text style={styles.cardHeader}>3. Budget & Timeline</Text>

              <TextField
                label="Planned Budget (NGN) *"
                placeholder="e.g. 85,000,000"
                value={budget}
                onChangeText={(val) => {
                  const formatted = formatNairaInput(val);
                  if (formatted !== null) setBudget(formatted);
                }}
                error={errors.budget}
                keyboardType="numeric"
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Payment Intent</Text>
                <View style={styles.chipRow}>
                  {paymentIntentOptions.map((opt) => {
                    const active = paymentIntent === opt;
                    return (
                      <Pressable
                        key={opt}
                        accessibilityRole="radio"
                        accessibilityLabel={opt}
                        accessibilityState={{ selected: active }}
                        onPress={() => setPaymentIntent(active ? "" : opt)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>How soon do you need this property?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {timingOptions.map((opt) => {
                    const active = timing === opt;
                    return (
                      <Pressable
                        key={opt}
                        accessibilityRole="radio"
                        accessibilityLabel={opt}
                        accessibilityState={{ selected: active }}
                        onPress={() => setTiming(active ? "" : opt)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <DocumentPickerComponent
                label="Buy Mandate (Optional)"
                helper="Upload client brief or buy mandate document (PDF up to 10 MB)"
                maxCount={1}
                multiple={false}
                allowedTypes={["application/pdf"]}
                files={mandateDocs}
                onFilesChange={setMandateDocs}
              />

              <TextField
                label="Likely Transferable Giftings"
                placeholder="Desired appliances or fixtures"
                value={giftings}
                onChangeText={setGiftings}
                multiline
                numberOfLines={3}
              />
            </Card>

            <Card>
              <Text style={styles.cardHeader}>4. Desired Facilities</Text>
              <View style={styles.facilitiesGrid}>
                {propertyFacilities.map((facility) => {
                  const checked = selectedFacilities.includes(facility);
                  return (
                    <Pressable
                      key={facility}
                      accessibilityRole="checkbox"
                      accessibilityLabel={facility}
                      accessibilityState={{ checked }}
                      onPress={() => toggleFacility(facility)}
                      style={[styles.facilityItem, checked && styles.facilityItemChecked]}
                    >
                      <AppIcon
                        name={checked ? "checkbox" : "square-outline"}
                        size={18}
                        color={checked ? colors.brandDark : colors.textMuted}
                      />
                      <Text style={[styles.facilityText, checked && styles.facilityTextChecked]}>
                        {facility}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {submitError ? (
              <Text accessibilityRole="alert" style={styles.errorAlert}>{submitError}</Text>
            ) : null}

            <Button
              label={submitting ? "Submitting Requirements…" : "Submit Buy Request"}
              loading={submitting}
              disabled={submitting}
              onPress={handleSubmit}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topBar: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backBtn: { padding: spacing.xs },
    topBarTitle: { ...typography.heading, color: colors.text },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    formStack: { gap: spacing.lg },
    cardHeader: { ...typography.heading, color: colors.brandDark, marginBottom: spacing.xs },
    fieldBlock: { gap: spacing.xs },
    label: { ...typography.label, color: colors.text },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSmall: {
      width: 44,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    chipText: { ...typography.caption, color: colors.text },
    chipTextActive: { color: colors.actionText, fontWeight: "600" },
    errorText: { ...typography.caption, color: colors.danger },
    facilitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    facilityItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    facilityItemChecked: {
      backgroundColor: colors.brandTint,
      borderColor: colors.brand,
    },
    facilityText: { ...typography.caption, color: colors.text },
    facilityTextChecked: { color: colors.brandDark, fontWeight: "600" },
    errorAlert: { ...typography.caption, color: colors.danger, paddingVertical: spacing.xs },
    successState: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
    successBadge: {
      width: 60,
      height: 60,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    successTitle: { ...typography.title, color: colors.text, textAlign: "center" },
    successText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
    disclaimerText: { ...typography.caption, color: colors.textMuted, textAlign: "center", backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.md },
  });
}
