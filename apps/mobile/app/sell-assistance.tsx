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
import { MediaPicker } from "@/components/media-picker";
import { Button, Card, SectionHeading, TextField } from "@/components/ui";
import { assistanceApi } from "@/lib/assistance-api";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import { formatNairaInput, nairaToKobo } from "@/lib/money";
import { propertyFacilities } from "@/lib/property-taxonomy";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

const sellerTypeOptions = ["Personal Property", "Family Property", "Developer"] as const;
const propertyTypeOptions = ["Residential", "Commercial"] as const;
const lienStatusOptions = ["Yes", "No", "Not Sure"] as const;

export default function SellAssistanceRoute() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { customer } = useAuth();
  const defaultName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  const defaultEmail = customer?.email || "";

  const [contactName, setContactName] = useState(defaultName);
  const [preferredMethod, setPreferredMethod] = useState<"Phone" | "Email">("Phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [sellerType, setSellerType] = useState<string>("");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState<"Residential" | "Commercial">("Residential");
  const [landArea, setLandArea] = useState("");
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [units, setUnits] = useState("");
  const [titleDocument, setTitleDocument] = useState("");
  const [lienStatus, setLienStatus] = useState<string>("");
  const [askingPrice, setAskingPrice] = useState("");
  const [downPaymentPercent, setDownPaymentPercent] = useState("");
  const [saleAuthorized, setSaleAuthorized] = useState<"Yes" | "No" | "">("");
  const [giftings, setGiftings] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);

  const [images, setImages] = useState<PickedFile[]>([]);
  const [authDoc, setAuthDoc] = useState<{ file: PickedFile; title: string }[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

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
    if (!location.trim()) next.location = "Enter property location.";
    const priceKobo = nairaToKobo(askingPrice);
    if (!priceKobo || priceKobo <= 0) next.askingPrice = "Enter a positive asking price.";

    if (landArea.trim()) {
      const parsed = Number(landArea);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 1e9) {
        next.landArea = "Enter a valid land area.";
      }
    }
    if (parkingSpaces.trim()) {
      const parsed = Number(parkingSpaces);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        next.parkingSpaces = "Enter 0 to 100 parking spaces.";
      }
    }
    if (units.trim()) {
      const parsed = Number(units);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100000) {
        next.units = "Enter a whole number of units (1–100,000).";
      }
    }
    if (downPaymentPercent.trim()) {
      const parsed = Number(downPaymentPercent);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        next.downPaymentPercent = "Enter a percentage from 0 to 100.";
      }
    }

    if (saleAuthorized === "Yes" && authDoc.length === 0) {
      next.authDoc = "Upload the authorization document for an authorized sale.";
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
      ...(sellerType ? { sellerType } : {}),
      location: location.trim(),
      propertyType,
      ...(landArea.trim() ? { landArea: Number(landArea) } : {}),
      ...(parkingSpaces.trim() ? { parkingSpaces: Number(parkingSpaces) } : {}),
      facilities: selectedFacilities,
      ...(units.trim() ? { units: Number(units) } : {}),
      ...(titleDocument.trim() ? { titleDocument: titleDocument.trim() } : {}),
      ...(lienStatus ? { lienStatus } : {}),
      askingPrice: askingPrice.replace(/,/g, ""),
      ...(downPaymentPercent.trim() ? { minimumDownPaymentPercent: Number(downPaymentPercent) } : {}),
      ...(saleAuthorized ? { saleAuthorized: saleAuthorized === "Yes" } : {}),
      ...(giftings.trim() ? { likelyTransferableGiftings: giftings.trim() } : {}),
    };

    try {
      await assistanceApi.submitSellAssistance(
        data,
        images,
        authDoc[0]?.file
      );
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
        <Text style={styles.topBarTitle}>Sell Assistance</Text>
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
                Assistance Request Received
              </Text>
              <Text style={styles.successText}>
                Thank you. Beryl Shelter will review your property information and contact you through
                your preferred method to help source prospective buyers.
              </Text>
              <Text style={styles.disclaimerText}>
                Sell Assistance does not create a live public listing or a purchase transaction.
                All sales agency arrangements are concluded offline.
              </Text>
              <Button label="Return to List Tab" onPress={() => router.replace("/(tabs)/list")} />
            </View>
          </Card>
        ) : (
          <View style={styles.formStack}>
            <SectionHeading
              title="Tell us about your property"
              description="Tell us about the property you want to sell and we'll help you find potential buyers."
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

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Seller Classification</Text>
                <View style={styles.chipRow}>
                  {sellerTypeOptions.map((type) => {
                    const active = sellerType === type;
                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="radio"
                        accessibilityLabel={type}
                        accessibilityState={{ selected: active }}
                        onPress={() => setSellerType(active ? "" : type)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Card>

            <Card>
              <Text style={styles.cardHeader}>2. Property Details</Text>

              <TextField
                label="Location *"
                placeholder="e.g. Lekki Phase 1, Lagos"
                value={location}
                onChangeText={setLocation}
                error={errors.location}
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Property Type *</Text>
                <View style={styles.chipRow}>
                  {propertyTypeOptions.map((type) => {
                    const active = propertyType === type;
                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="radio"
                        accessibilityLabel={type}
                        accessibilityState={{ selected: active }}
                        onPress={() => setPropertyType(type)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <TextField
                label="Land Area (Sq.Ft)"
                placeholder="e.g. 5000"
                value={landArea}
                onChangeText={setLandArea}
                error={errors.landArea}
                keyboardType="numeric"
              />

              <TextField
                label="Parking Spaces"
                placeholder="e.g. 4"
                value={parkingSpaces}
                onChangeText={setParkingSpaces}
                error={errors.parkingSpaces}
                keyboardType="numeric"
              />

              <TextField
                label="Number of Units"
                placeholder="e.g. 1"
                value={units}
                onChangeText={setUnits}
                error={errors.units}
                keyboardType="numeric"
              />

              <TextField
                label="Title Document"
                placeholder="e.g. C of O, Governor's Consent"
                value={titleDocument}
                onChangeText={setTitleDocument}
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Does this property have a lien?</Text>
                <View style={styles.chipRow}>
                  {lienStatusOptions.map((opt) => {
                    const active = lienStatus === opt;
                    return (
                      <Pressable
                        key={opt}
                        accessibilityRole="radio"
                        accessibilityLabel={opt}
                        accessibilityState={{ selected: active }}
                        onPress={() => setLienStatus(active ? "" : opt)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Card>

            <Card>
              <Text style={styles.cardHeader}>3. Financial & Authorization</Text>

              <TextField
                label="Asking Price (NGN) *"
                placeholder="e.g. 120,000,000"
                value={askingPrice}
                onChangeText={(val) => {
                  const formatted = formatNairaInput(val);
                  if (formatted !== null) setAskingPrice(formatted);
                }}
                error={errors.askingPrice}
                keyboardType="numeric"
              />

              <TextField
                label="Minimum Down Payment (%)"
                placeholder="e.g. 30"
                value={downPaymentPercent}
                onChangeText={setDownPaymentPercent}
                error={errors.downPaymentPercent}
                keyboardType="numeric"
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Have you authorized this sale?</Text>
                <View style={styles.chipRow}>
                  {(["Yes", "No"] as const).map((opt) => {
                    const active = saleAuthorized === opt;
                    return (
                      <Pressable
                        key={opt}
                        accessibilityRole="radio"
                        accessibilityLabel={opt}
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setSaleAuthorized(active ? "" : opt);
                          if (opt !== "Yes") setAuthDoc([]);
                        }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {saleAuthorized === "Yes" && (
                <DocumentPickerComponent
                  label="Upload Authorization Document *"
                  helper="Power of attorney, authorization letter, or deed (PDF, JPG or PNG up to 10 MB)"
                  maxCount={1}
                  multiple={false}
                  files={authDoc}
                  onFilesChange={setAuthDoc}
                  error={errors.authDoc}
                />
              )}

              <TextField
                label="Likely Transferable Giftings"
                placeholder="Any appliances, furnishings, or fixtures included in the sale"
                value={giftings}
                onChangeText={setGiftings}
                multiline
                numberOfLines={3}
              />
            </Card>

            <Card>
              <Text style={styles.cardHeader}>4. Facilities & Media</Text>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Property Facilities</Text>
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
              </View>

              <MediaPicker
                label="Upload Pictures of the Property"
                helper="Add up to 6 JPG, PNG or WEBP photos (max 5 MB each)"
                maxCount={6}
                files={images}
                onFilesChange={setImages}
              />
            </Card>

            {submitError ? (
              <Text accessibilityRole="alert" style={styles.errorAlert}>{submitError}</Text>
            ) : null}

            <Button
              label={submitting ? "Submitting Assistance Request…" : "Submit Request"}
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
    chipActive: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    chipText: { ...typography.caption, color: colors.text },
    chipTextActive: { color: colors.actionText, fontWeight: "600" },
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
