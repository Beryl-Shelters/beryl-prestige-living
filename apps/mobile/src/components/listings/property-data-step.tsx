import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppIcon } from "../app-icon";
import { MediaPicker } from "../media-picker";
import { OptionSelect } from "../option-select";
import { Button, Card, SectionHeading, TextField } from "../ui";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import {
  listingsApi,
  type CustomerListing,
  type ListingOptions,
} from "@/lib/listings-api";
import { formatNairaInput, nairaToKobo } from "@/lib/money";
import { useTheme } from "@/providers/theme-provider";
import { radius, spacing, typography, type ColorTokens } from "@/theme/tokens";

type PropertyDataStepProps = {
  options: ListingOptions;
  existingListing: CustomerListing | null;
  onNext: (listing: CustomerListing) => void;
  onDraftSaved?: (listing: CustomerListing) => void;
};

export function PropertyDataStep({
  options,
  existingListing,
  onNext,
  onDraftSaved,
}: PropertyDataStepProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState(existingListing?.title || "");
  const [registeredTitle, setRegisteredTitle] = useState(
    existingListing?.registered_title_document || ""
  );
  const [description, setDescription] = useState(existingListing?.description || "");
  const [occupancyType, setOccupancyType] = useState<string>(
    existingListing?.occupancy_type || options.occupancy_type[0] || "Residential"
  );
  const [ownershipType, setOwnershipType] = useState<string>(
    existingListing?.ownership_type || options.ownership_type[0] || "Personal"
  );
  const [propertyType, setPropertyType] = useState<string>(
    existingListing?.property_type || options.property_type[0] || "Residential"
  );
  const [propertySubtype, setPropertySubtype] = useState<string>(
    existingListing?.property_subtype || options.property_subtype[0] || "Bungalow"
  );
  const [hasLien, setHasLien] = useState<boolean>(existingListing?.has_lien ?? false);
  const [location, setLocation] = useState(existingListing?.location || "");
  const [selectedState, setSelectedState] = useState<string>(
    existingListing?.state || "Lagos"
  );
  const [city, setCity] = useState(existingListing?.city || "");

  const [bedrooms, setBedrooms] = useState(String(existingListing?.bedrooms ?? 3));
  const [bathrooms, setBathrooms] = useState(String(existingListing?.bathrooms ?? 3));
  const [parkingSpaces, setParkingSpaces] = useState(String(existingListing?.parking_spaces ?? 2));
  const [units, setUnits] = useState(existingListing?.units ? String(existingListing.units) : "");
  const [landArea, setLandArea] = useState(
    existingListing?.land_area ? String(existingListing.land_area) : ""
  );
  const [yearBuilt, setYearBuilt] = useState(
    existingListing?.year_built ? String(existingListing.year_built) : ""
  );
  const [facilities, setFacilities] = useState<string[]>(existingListing?.facilities || []);

  const [propertyCost, setPropertyCost] = useState(
    existingListing
      ? (existingListing.property_cost_minor / 100).toLocaleString()
      : ""
  );
  const [downPayment, setDownPayment] = useState(
    existingListing
      ? (existingListing.minimum_down_payment_minor / 100).toLocaleString()
      : "0"
  );
  const [additionalInfo, setAdditionalInfo] = useState(
    existingListing?.additional_information || ""
  );

  const [retainedImages, setRetainedImages] = useState<{ id: string; url: string }[]>(
    existingListing?.images.map((img) => ({ id: img.id, url: img.url })) || []
  );
  const [newImages, setNewImages] = useState<PickedFile[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<"draft" | "next">("next");
  const [serverError, setServerError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");

  function toggleFacility(name: string) {
    setFacilities((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  }

  function validate(fullCheck = true): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 2) next.title = "Enter a property title (max 160 characters).";
    if (fullCheck && description.trim().length < 10) {
      next.description = "Provide a property description of at least 10 characters.";
    }
    if (fullCheck && !location.trim()) next.location = "Enter property location / address.";
    if (fullCheck && !city.trim()) next.city = "Enter city.";

    const costKobo = nairaToKobo(propertyCost);
    if (fullCheck && (!costKobo || costKobo <= 0)) {
      next.propertyCost = "Enter a valid positive property cost.";
    }

    const downKobo = downPayment.trim() ? nairaToKobo(downPayment) : 0;
    if (costKobo && downKobo && downKobo > costKobo) {
      next.downPayment = "Minimum down payment cannot exceed total property cost.";
    }

    const totalImages = retainedImages.length + newImages.length;
    if (totalImages < 1) {
      next.images = "At least 1 property photograph is required.";
    } else if (totalImages > 24) {
      next.images = "A maximum of 24 photos is permitted.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(proceedToMandate = false) {
    if (!validate(proceedToMandate) || saving) return;
    setSaving(true);
    setSaveAction(proceedToMandate ? "next" : "draft");
    setServerError("");
    setDraftNotice("");

    const costMinor = nairaToKobo(propertyCost) || 0;
    const downMinor = downPayment.trim() ? nairaToKobo(downPayment) || 0 : 0;

    const content: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || title.trim(),
      occupancy_type: occupancyType,
      ownership_type: ownershipType,
      property_type: propertyType,
      property_subtype: propertySubtype,
      has_lien: hasLien,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      parking_spaces: Number(parkingSpaces) || 0,
      units: units.trim() ? Number(units) : null,
      land_area: landArea.trim() ? Number(landArea) : null,
      year_built: yearBuilt.trim() ? Number(yearBuilt) : null,
      facilities,
      property_cost: (costMinor / 100).toFixed(2),
      minimum_down_payment: (downMinor / 100).toFixed(2),
      location: location.trim() || "Nigeria",
      state: selectedState,
      city: city.trim() || "Lagos",
      longitude: null,
      latitude: null,
      registered_title_document: registeredTitle.trim() || null,
      additional_information: additionalInfo.trim() || null,
    };

    try {
      let savedListing: CustomerListing;
      if (existingListing) {
        savedListing = await listingsApi.updateDraft(
          existingListing.id,
          existingListing.version,
          content,
          retainedImages.map((img) => img.id),
          newImages
        );
      } else {
        savedListing = await listingsApi.createDraft(content, newImages);
      }

      setNewImages([]);
      setRetainedImages(savedListing.images.map((img) => ({ id: img.id, url: img.url })));
      onDraftSaved?.(savedListing);

      if (proceedToMandate) {
        onNext(savedListing);
      } else {
        setDraftNotice("Listing draft saved successfully (UNLISTED).");
      }
    } catch (err: unknown) {
      setServerError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SectionHeading
        title="Step 1: Property Data"
        description="Fill in the property details and upload high quality photos."
      />

      {draftNotice ? (
        <View style={styles.noticeBox}>
          <AppIcon name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.noticeText}>{draftNotice}</Text>
        </View>
      ) : null}

      {existingListing?.listing_status === "REJECTED" && (
        <View style={styles.rejectedBanner}>
          <AppIcon name="alert-circle" size={20} color={colors.danger} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rejectedTitle}>Listing Requires Correction</Text>
            <Text style={styles.rejectedBody}>
              {existingListing.rejection_reason || "Please update the required property details and resubmit for review."}
            </Text>
          </View>
        </View>
      )}

      <Card>
        <Text style={styles.cardTitle}>1. Basic Information</Text>

        <TextField
          label="Public Property Title *"
          placeholder="e.g. 4 Bedroom Detached Duplex in Lekki"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={160}
        />

        <TextField
          label="Registered Title Document Name"
          placeholder="e.g. Certificate of Occupancy, Deed of Conveyance"
          value={registeredTitle}
          onChangeText={setRegisteredTitle}
          maxLength={200}
        />

        <TextField
          label="Property Description *"
          placeholder="Detailed description of features, finishes, and neighbourhood..."
          value={description}
          onChangeText={setDescription}
          error={errors.description}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          maxLength={10000}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>2. Classification & Type</Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Property Classification</Text>
          <View style={styles.chipRow}>
            {options.occupancy_type.map((opt) => {
              const active = occupancyType === opt;
              return (
                <Pressable
                  key={opt}
                  accessibilityRole="radio"
                  accessibilityLabel={opt}
                  accessibilityState={{ selected: active }}
                  onPress={() => setOccupancyType(opt)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Ownership Classification</Text>
          <View style={styles.chipRow}>
            {options.ownership_type.map((opt) => {
              const active = ownershipType === opt;
              return (
                <Pressable
                  key={opt}
                  accessibilityRole="radio"
                  accessibilityLabel={opt}
                  accessibilityState={{ selected: active }}
                  onPress={() => setOwnershipType(opt)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Property Type</Text>
          <View style={styles.chipRow}>
            {options.property_type.map((opt) => {
              const active = propertyType === opt;
              return (
                <Pressable
                  key={opt}
                  accessibilityRole="radio"
                  accessibilityLabel={opt}
                  accessibilityState={{ selected: active }}
                  onPress={() => setPropertyType(opt)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Property Subtype</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {options.property_subtype.map((opt) => {
              const active = propertySubtype === opt;
              return (
                <Pressable
                  key={opt}
                  accessibilityRole="radio"
                  accessibilityLabel={opt}
                  accessibilityState={{ selected: active }}
                  onPress={() => setPropertySubtype(opt)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Has Lien / Used to borrow from bank?</Text>
          <View style={styles.chipRow}>
            {[false, true].map((val) => {
              const active = hasLien === val;
              return (
                <Pressable
                  key={String(val)}
                  accessibilityRole="radio"
                  accessibilityLabel={val ? "Yes, has lien" : "No lien"}
                  accessibilityState={{ selected: active }}
                  onPress={() => setHasLien(val)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {val ? "Yes, has lien" : "No lien"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>3. Location</Text>

        <TextField
          label="Property Address / Location *"
          placeholder="e.g. Plot 14, Admiralty Way, Lekki Phase 1"
          value={location}
          onChangeText={setLocation}
          error={errors.location}
          maxLength={300}
        />

        <OptionSelect label="State *" value={selectedState} options={options.state} onChange={setSelectedState} />

        <TextField
          label="City / Locality *"
          placeholder="e.g. Lekki, Ikeja, Abuja"
          value={city}
          onChangeText={setCity}
          error={errors.city}
          maxLength={100}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>4. Specifications & Pricing</Text>

        <View style={styles.row}>
          <View style={styles.flexHalf}>
            <TextField
              label="Bedrooms"
              placeholder="3"
              value={bedrooms}
              onChangeText={setBedrooms}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flexHalf}>
            <TextField
              label="Bathrooms"
              placeholder="3"
              value={bathrooms}
              onChangeText={setBathrooms}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flexHalf}>
            <TextField
              label="Parking Spaces"
              placeholder="2"
              value={parkingSpaces}
              onChangeText={setParkingSpaces}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flexHalf}>
            <TextField
              label="Number of Units"
              placeholder="1"
              value={units}
              onChangeText={setUnits}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flexHalf}>
            <TextField
              label="Land Area (Sq.Ft)"
              placeholder="5000"
              value={landArea}
              onChangeText={setLandArea}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flexHalf}>
            <TextField
              label="Year Built"
              placeholder="2024"
              value={yearBuilt}
              onChangeText={setYearBuilt}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TextField
          label="Selling Price (NGN) *"
          placeholder="e.g. 150,000,000"
          value={propertyCost}
          onChangeText={(val) => {
            const formatted = formatNairaInput(val);
            if (formatted !== null) setPropertyCost(formatted);
          }}
          error={errors.propertyCost}
          keyboardType="numeric"
        />

        <TextField
          label="Minimum Down Payment (NGN)"
          placeholder="e.g. 45,000,000 (0 for full payment)"
          value={downPayment}
          onChangeText={(val) => {
            const formatted = formatNairaInput(val);
            if (formatted !== null) setDownPayment(formatted);
          }}
          error={errors.downPayment}
          keyboardType="numeric"
        />

        <TextField
          label="Additional Information"
          placeholder="Any other terms or details about this property..."
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          multiline
          numberOfLines={3}
          maxLength={5000}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>5. Facilities & Features</Text>
        <View style={styles.facilitiesGrid}>
          {options.facilities.map((facility) => {
            const checked = facilities.includes(facility);
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

      <Card>
        <Text style={styles.cardTitle}>6. Property Photographs</Text>
        <MediaPicker
          label="Photographs (1 to 24 photos) *"
          helper="Upload high quality images (max 5 MB each, JPG/PNG/WEBP)"
          maxCount={24}
          files={newImages}
          existingUrls={retainedImages}
          onFilesChange={setNewImages}
          onRemoveExisting={(id) => setRetainedImages((prev) => prev.filter((img) => img.id !== id))}
          error={errors.images}
        />
      </Card>

      {serverError ? (
        <Text accessibilityRole="alert" style={styles.serverErrorText}>{serverError}</Text>
      ) : null}

      <View style={styles.actionButtons}>
        <Button
          label={saving && saveAction === "next" ? "Saving & Proceeding…" : "Next: Sales Mandate"}
          loading={saving && saveAction === "next"}
          disabled={saving}
          onPress={() => void handleSave(true)}
        />
        <Button
          label={saving && saveAction === "draft" ? "Saving Draft…" : "Save Incomplete Draft"}
          variant="secondary"
          loading={saving && saveAction === "draft"}
          disabled={saving}
          onPress={() => void handleSave(false)}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { gap: spacing.lg, paddingBottom: spacing.xxl },
    cardTitle: { ...typography.heading, color: colors.brandDark, marginBottom: spacing.xs },
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
    row: { flexDirection: "row", gap: spacing.md },
    flexHalf: { flex: 1 },
    textArea: { minHeight: 90, textAlignVertical: "top", paddingTop: spacing.sm },
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
    actionButtons: { gap: spacing.sm, marginTop: spacing.md },
    serverErrorText: { ...typography.caption, color: colors.danger, paddingVertical: spacing.xs },
    noticeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.brandTint,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    noticeText: { ...typography.caption, color: colors.success, fontWeight: "600" },
    rejectedBanner: {
      flexDirection: "row",
      gap: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    rejectedTitle: { ...typography.label, color: colors.danger },
    rejectedBody: { ...typography.caption, color: colors.text },
  });
}
