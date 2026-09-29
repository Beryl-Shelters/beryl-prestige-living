import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppIcon } from "../app-icon";
import { DocumentPickerComponent, type ExistingDocument } from "../document-picker";
import { SignaturePad, type SignaturePadRef } from "../signature-pad";
import { Button, Card, SectionHeading, TextField } from "../ui";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import {
  listingsApi,
  type CustomerListing,
  type MandateContent,
  type MandatePayload,
  type SalesMandate,
} from "@/lib/listings-api";
import { formatNaira } from "@/lib/money";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type SalesMandateStepProps = {
  listing: CustomerListing;
  onBack: () => void;
  onSubmitSuccess: (submittedListing: CustomerListing) => void;
};

export function SalesMandateStep({
  listing,
  onBack,
  onSubmitSuccess,
}: SalesMandateStepProps) {
  const { customer } = useAuth();
  const signatureRef = useRef<SignaturePadRef>(null);

  const [loading, setLoading] = useState(true);
  const [existingMandate, setExistingMandate] = useState<SalesMandate | null>(null);

  // Vendor / Signer fields
  const [sellerTitle, setSellerTitle] = useState("Mr.");
  const [surname, setSurname] = useState(customer?.last_name || "");
  const [firstNames, setFirstNames] = useState(customer?.first_name || "");
  const [gender, setGender] = useState("Male");
  const [email, setEmail] = useState(customer?.email || "");
  const [telephone, setTelephone] = useState(
    customer?.phone_number_normalized || ""
  );
  const [dateOfBirth, setDateOfBirth] = useState("1990-01-01");
  const [nationality, setNationality] = useState("Nigerian");
  const [postCode, setPostCode] = useState("100001");
  const [address, setAddress] = useState(listing.location || "");
  const [developmentName, setDevelopmentName] = useState(listing.title);
  const [documentTitle, setDocumentTitle] = useState(
    listing.registered_title_document || "Certificate of Occupancy"
  );

  const [signerName, setSignerName] = useState(
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || ""
  );
  const [signerAddress, setSignerAddress] = useState(listing.location || "");
  const [signerEmail, setSignerEmail] = useState(customer?.email || "");
  const [mandateDate, setMandateDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [agreedToMandate, setAgreedToMandate] = useState(false);

  // Documents
  const [existingDocs, setExistingDocs] = useState<ExistingDocument[]>([]);
  const [newDocs, setNewDocs] = useState<{ file: PickedFile; title: string }[]>([]);

  // State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [actionKind, setActionKind] = useState<"draft" | "submit">("submit");
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void listingsApi
      .getMandate(listing.id)
      .then((mandate) => {
        if (!active || !mandate) return;
        setExistingMandate(mandate);
        setSellerTitle(mandate.seller_title);
        setSurname(mandate.surname);
        setFirstNames(mandate.first_names);
        setGender(mandate.gender);
        setEmail(mandate.email);
        setTelephone(mandate.telephone);
        setDateOfBirth(mandate.date_of_birth);
        setNationality(mandate.nationality);
        setPostCode(mandate.post_code);
        setAddress(mandate.address);
        setDevelopmentName(mandate.property_development_name);
        setDocumentTitle(mandate.document_title);
        setSignerName(mandate.signer_name);
        setSignerAddress(mandate.signer_address);
        setSignerEmail(mandate.signer_email);
        setMandateDate(mandate.mandate_date);
        setAgreedToMandate(mandate.agreed_to_mandate);
        setExistingDocs(mandate.documents);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [listing.id]);

  function handleNameSync(first: string, last: string) {
    setFirstNames(first);
    setSurname(last);
    const full = [first, last].filter(Boolean).join(" ");
    setSignerName(full);
  }

  function handleAddressSync(addr: string) {
    setAddress(addr);
    setSignerAddress(addr);
  }

  function validate(forSubmit = true): boolean {
    const next: Record<string, string> = {};
    if (surname.trim().length < 1) next.surname = "Enter surname.";
    if (firstNames.trim().length < 1) next.firstNames = "Enter first name(s).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email.";
    }
    if (telephone.trim().length < 5) next.telephone = "Enter a valid telephone number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      next.dateOfBirth = "Use YYYY-MM-DD format.";
    }
    if (address.trim().length < 2) next.address = "Enter vendor address.";
    if (documentTitle.trim().length < 2) next.documentTitle = "Enter document title.";

    if (forSubmit) {
      if (existingDocs.length + newDocs.length < 1) {
        next.documents = "Upload at least 1 legal title document.";
      }
      if (!agreedToMandate) {
        next.consent = "You must acknowledge and agree to the mandate terms (Clause 10).";
      }
      const hasSig = signatureRef.current?.hasSignature();
      if (!hasSig) {
        next.signature = "Please provide your signature before submitting.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(isFinalSubmission = false) {
    if (!validate(isFinalSubmission) || submitting) return;
    setSubmitting(true);
    setActionKind(isFinalSubmission ? "submit" : "draft");
    setServerError("");
    setNotice("");

    try {
      // 1. Upload any newly attached documents
      let uploadedDocHandles: { upload_id: string; title: string }[] = [];
      if (newDocs.length > 0) {
        const docUploads = await listingsApi.uploadMandateDocuments(listing.id, newDocs);
        uploadedDocHandles = docUploads.map((d) => ({
          upload_id: d.upload_id,
          title: d.title,
        }));
      }

      // 2. Handle signature upload
      let signaturePayload: MandatePayload["signature"] = { kind: "existing" };
      const newSigFile = signatureRef.current?.exportPngFile();
      if (newSigFile) {
        const sigUpload = await listingsApi.uploadMandateSignature(listing.id, newSigFile);
        signaturePayload = { kind: "upload", upload_id: sigUpload.upload_id };
      } else if (!existingMandate?.has_signature) {
        signaturePayload = { kind: "existing" };
      }

      // 3. Assemble documents payload
      const documentsPayload: MandatePayload["documents"] = [
        ...existingDocs.map((d) => ({ kind: "existing" as const, id: d.id })),
        ...uploadedDocHandles.map((d) => ({
          kind: "upload" as const,
          upload_id: d.upload_id,
          title: d.title,
        })),
      ];

      const content: MandateContent = {
        seller_title: sellerTitle,
        surname: surname.trim(),
        first_names: firstNames.trim(),
        gender,
        email: email.trim().toLowerCase(),
        telephone: telephone.trim(),
        date_of_birth: dateOfBirth.trim(),
        nationality: nationality.trim(),
        post_code: postCode.trim(),
        address: address.trim(),
        property_development_name: developmentName.trim() || listing.title,
        document_title: documentTitle.trim() || "Certificate of Occupancy",
        signer_name: signerName.trim() || [firstNames, surname].filter(Boolean).join(" "),
        signer_address: signerAddress.trim() || address.trim(),
        signer_email: signerEmail.trim().toLowerCase() || email.trim().toLowerCase(),
        mandate_date: mandateDate,
        agreed_to_mandate: agreedToMandate,
      };

      const payload: MandatePayload = {
        content,
        signature: signaturePayload,
        documents: documentsPayload,
      };

      const savedMandate = await listingsApi.saveMandate(listing.id, payload);
      setExistingMandate(savedMandate);
      setExistingDocs(savedMandate.documents);
      setNewDocs([]);

      if (isFinalSubmission) {
        const submitted = await listingsApi.submit(listing.id);
        onSubmitSuccess(submitted);
      } else {
        setNotice("Sales mandate draft saved successfully.");
      }
    } catch (err: unknown) {
      setServerError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Loading mandate details…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SectionHeading
        title="Step 2: Sales Mandate"
        description="Review legal sales agency terms and authorize Beryl Shelter to represent the property."
      />

      {notice ? (
        <View style={styles.noticeBox}>
          <AppIcon name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Part 1: Vendor & Property Details</Text>

        <View style={styles.row}>
          <View style={{ width: 90 }}>
            <TextField
              label="Title"
              placeholder="Mr."
              value={sellerTitle}
              onChangeText={setSellerTitle}
            />
          </View>
          <View style={styles.flexHalf}>
            <TextField
              label="First Name(s) *"
              placeholder="Ada"
              value={firstNames}
              onChangeText={(val) => handleNameSync(val, surname)}
              error={errors.firstNames}
            />
          </View>
        </View>

        <TextField
          label="Surname *"
          placeholder="Vendor"
          value={surname}
          onChangeText={(val) => handleNameSync(firstNames, val)}
          error={errors.surname}
        />

        <View style={styles.row}>
          <View style={styles.flexHalf}>
            <TextField
              label="Gender"
              placeholder="Male / Female"
              value={gender}
              onChangeText={setGender}
            />
          </View>
          <View style={styles.flexHalf}>
            <TextField
              label="Date of Birth *"
              placeholder="1990-01-01"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              error={errors.dateOfBirth}
            />
          </View>
        </View>

        <TextField
          label="Email Address *"
          placeholder="vendor@example.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextField
          label="Telephone Number *"
          placeholder="+234 801 234 5678"
          value={telephone}
          onChangeText={setTelephone}
          error={errors.telephone}
          keyboardType="phone-pad"
        />

        <TextField
          label="Vendor Legal Address *"
          placeholder="Physical residential or business address"
          value={address}
          onChangeText={handleAddressSync}
          error={errors.address}
        />

        <View style={styles.row}>
          <View style={styles.flexHalf}>
            <TextField
              label="Nationality"
              placeholder="Nigerian"
              value={nationality}
              onChangeText={setNationality}
            />
          </View>
          <View style={styles.flexHalf}>
            <TextField
              label="Postal Code"
              placeholder="100001"
              value={postCode}
              onChangeText={setPostCode}
            />
          </View>
        </View>

        <TextField
          label="Property / Development Name"
          value={developmentName}
          onChangeText={setDevelopmentName}
        />

        <TextField
          label="Registered Title Document Name *"
          placeholder="e.g. Certificate of Occupancy"
          value={documentTitle}
          onChangeText={setDocumentTitle}
          error={errors.documentTitle}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Mandate Terms Summary</Text>
        <View style={styles.termsGrid}>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Agreed Asking Price:</Text>
            <Text style={styles.termValue}>{formatNaira(listing.property_cost_minor)}</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Agency Commission:</Text>
            <Text style={styles.termValue}>5.00% of final sales price</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Mandate Validity Period:</Text>
            <Text style={styles.termValue}>180 days from signing</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Legal Title Documents *</Text>
        <DocumentPickerComponent
          label="Upload Title Documents (Up to 10 files)"
          helper="C of O, Deed of Assignment, Governor's Consent, or Survey Plan (PDF, PNG or JPG up to 10 MB)"
          maxCount={10}
          multiple
          files={newDocs}
          existingDocs={existingDocs}
          onFilesChange={setNewDocs}
          onRemoveExisting={(id) => setExistingDocs((prev) => prev.filter((d) => d.id !== id))}
          error={errors.documents}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Part 2: Legal Clauses</Text>
        <View style={styles.clauseList}>
          <ClauseItem
            num={1}
            title="Appointment & Authority"
            text="The Vendor appoints Beryl Prestige Living as an authorized marketing representative to source prospective purchasers for the Property."
          />
          <ClauseItem
            num={2}
            title="Mandate Validity"
            text="This Mandate remains valid for 180 days from the Date of Signing ('Validity Period'), unless extended or revoked in writing by mutual consent."
          />
          <ClauseItem
            num={3}
            title="Marketing & Inspections"
            text="Beryl is authorized to advertise, present, and conduct physical/virtual inspections of the Property with pre-qualified prospective buyers."
          />
          <ClauseItem
            num={4}
            title="Commission & Fee Structure"
            text="Upon successful conclusion of a sale, the Vendor agrees to pay Beryl a professional commission of 5% of the final agreed selling price, payable upon receipt of consideration."
          />
          <ClauseItem
            num={5}
            title="Non-Circumvention"
            text="The Vendor undertakes not to bypass any buyer introduced by Beryl during the Validity Period and for 12 months thereafter."
          />
          <ClauseItem
            num={6}
            title="Title & Legal Representation"
            text="The Vendor confirms they are the legal and beneficial owner or duly authorized representative, and the property is free of undisclosed encumbrances."
          />
          <ClauseItem
            num={7}
            title="Governing Law & Disputes"
            text="Governed by the laws of Nigeria. Disputes unresolved within 30 days shall be referred to arbitration in Lagos State."
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Execution & Digital Signature</Text>

        <TextField
          label="Signer Full Legal Name"
          value={signerName}
          onChangeText={setSignerName}
        />

        <TextField
          label="Signer Address"
          value={signerAddress}
          onChangeText={setSignerAddress}
        />

        <TextField
          label="Date of Signing"
          value={mandateDate}
          editable={false}
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Clause 10 Consent"
          accessibilityState={{ checked: agreedToMandate }}
          onPress={() => setAgreedToMandate((prev) => !prev)}
          style={styles.consentRow}
        >
          <View style={[styles.checkbox, agreedToMandate && styles.checkboxChecked]}>
            {agreedToMandate && <AppIcon name="checkmark" size={14} color="#FFF" />}
          </View>
          <Text style={styles.consentText}>
            <Text style={{ fontWeight: "700" }}>Clause 10 Acceptance: </Text>
            By providing your digital signature below, you confirm that you have read, understood, and
            agreed to all the terms and conditions outlined in this Sales Mandate. You warrant that all
            information provided is true, complete, and accurate.
          </Text>
        </Pressable>
        {errors.consent ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{errors.consent}</Text>
        ) : null}

        <SignaturePad
          ref={signatureRef}
          initialSignatureSaved={Boolean(existingMandate?.has_signature)}
        />
        {errors.signature ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{errors.signature}</Text>
        ) : null}
      </Card>

      {serverError ? (
        <Text accessibilityRole="alert" style={styles.serverErrorText}>{serverError}</Text>
      ) : null}

      <View style={styles.buttonStack}>
        <Button
          label={submitting && actionKind === "submit" ? "Submitting for Review…" : "Submit for Review"}
          loading={submitting && actionKind === "submit"}
          disabled={submitting}
          onPress={() => void handleSave(true)}
        />
        <Button
          label={submitting && actionKind === "draft" ? "Saving Draft…" : "Save Mandate Draft"}
          variant="secondary"
          loading={submitting && actionKind === "draft"}
          disabled={submitting}
          onPress={() => void handleSave(false)}
        />
        <Button
          label="Back to Property Data"
          variant="secondary"
          disabled={submitting}
          onPress={onBack}
        />
      </View>
    </ScrollView>
  );
}

function ClauseItem({ num, title, text }: { num: number; title: string; text: string }) {
  return (
    <View style={styles.clauseItem}>
      <Text style={styles.clauseTitle}>{num}. {title}</Text>
      <Text style={styles.clauseBody}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg, paddingBottom: spacing.xxl },
  cardTitle: { ...typography.heading, color: colors.brandDark, marginBottom: spacing.xs },
  loadingBox: { padding: spacing.xxl, alignItems: "center" },
  loadingText: { ...typography.body, color: colors.textMuted },
  row: { flexDirection: "row", gap: spacing.md },
  flexHalf: { flex: 1 },
  termsGrid: { gap: spacing.sm, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.md },
  termRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  termLabel: { ...typography.caption, color: colors.textMuted },
  termValue: { ...typography.label, color: colors.text },
  clauseList: { gap: spacing.md },
  clauseItem: { gap: 2 },
  clauseTitle: { ...typography.label, color: colors.text },
  clauseBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  consentRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingVertical: spacing.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  consentText: { ...typography.caption, color: colors.text, flex: 1, lineHeight: 18 },
  errorText: { ...typography.caption, color: colors.danger },
  serverErrorText: { ...typography.caption, color: colors.danger, paddingVertical: spacing.xs },
  buttonStack: { gap: spacing.sm, marginTop: spacing.md },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#E7F5ED",
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { ...typography.caption, color: colors.success, fontWeight: "600" },
});
