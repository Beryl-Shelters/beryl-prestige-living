"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { toast } from "react-toastify";
import {
  getMandate,
  saveMandate,
  submitListing,
  uploadMandateDocuments,
  uploadMandateSignature,
  type Listing,
  type MandateDocument,
  type MandateDocumentUpload,
  type SalesMandate,
} from "../../lib/listings-api";
import { fetchSettingsProfile } from "../../lib/settings-api";
import { useListingError } from "./use-listing-request";
import { SignatureCanvas, type SignatureCanvasHandle } from "./signature-canvas";

type DocumentItem = {
  id: string;
  title: string;
  size_bytes: number;
  mime_type: string;
  file?: File;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SalesMandateStep({
  listing,
  onBack,
  onSubmitted,
}: {
  listing: Listing;
  onBack: () => void;
  onSubmitted: (submittedListing: Listing) => void;
}) {
  const error = useListingError();
  const signatureRef = useRef<SignatureCanvasHandle | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Existing saved mandate
  const [existingMandate, setExistingMandate] = useState<SalesMandate | null>(null);
  const [initialSignatureUrl, setInitialSignatureUrl] = useState<string | null>(null);
  const [hasValidSignature, setHasValidSignature] = useState(false);

  // Form Fields
  const [mandateDate, setMandateDate] = useState<string>(
    () => new Date().toISOString().split("T")[0] ?? ""
  );
  const [sellerTitle, setSellerTitle] = useState("");
  const [surname, setSurname] = useState("");
  const [firstNames, setFirstNames] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("Nigerian");
  const [postCode, setPostCode] = useState("");
  const [address, setAddress] = useState("");
  const [propertyDevelopmentName, setPropertyDevelopmentName] = useState(listing.title || "");
  const [documentTitle, setDocumentTitle] = useState(
    listing.registered_title_document || "Certificate of Occupancy"
  );

  // Documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Clause 10 consent
  const [agreedToMandate, setAgreedToMandate] = useState(false);

  // Signature card signer contact fields
  const [signerName, setSignerName] = useState("");
  const [signerAddress, setSignerAddress] = useState("");
  const [signerTelephone, setSignerTelephone] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  // Initial Load: Check for existing mandate or prefill from profile
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadData() {
      try {
        const saved = await getMandate(listing.id);
        if (!active) return;

        if (saved) {
          setExistingMandate(saved);
          setMandateDate(saved.mandate_date || (new Date().toISOString().split("T")[0] ?? ""));
          setSellerTitle(saved.seller_title || "");
          setSurname(saved.surname || "");
          setFirstNames(saved.first_names || "");
          setGender(saved.gender || "");
          setEmail(saved.email || "");
          setDateOfBirth(saved.date_of_birth || "");
          setNationality(saved.nationality || "Nigerian");
          setPostCode(saved.post_code || "");
          setAddress(saved.address || "");
          setPropertyDevelopmentName(saved.property_development_name || listing.title || "");
          setDocumentTitle(
            saved.document_title || listing.registered_title_document || "Certificate of Occupancy"
          );
          setAgreedToMandate(saved.agreed_to_mandate || false);

          setSignerName(saved.signer_name || "");
          setSignerAddress(saved.signer_address || "");
          setSignerEmail(saved.signer_email || "");
          setSignerTelephone(saved.telephone || "");

          if (saved.documents && saved.documents.length > 0) {
            setDocuments(
              saved.documents.map((d: MandateDocument) => ({
                id: d.id,
                title: d.title,
                size_bytes: d.size_bytes,
                mime_type: d.mime_type,
              }))
            );
          }

          if (saved.has_signature) {
            const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
            setInitialSignatureUrl(`${apiBase}/api/v1/listings/${listing.id}/mandate/signature`);
            setHasValidSignature(true);
          }
        } else {
          // No saved mandate: fetch user profile for prefill
          try {
            const profile = await fetchSettingsProfile(controller.signal);
            if (!active) return;
            if (profile) {
              setFirstNames(profile.firstName || "");
              setSurname(profile.lastName || "");
              setEmail(profile.email || "");
              setPostCode(profile.zipCode || "");
              const fullAddr = [profile.streetAddress, profile.city, profile.state]
                .filter(Boolean)
                .join(", ");
              setAddress(fullAddr || "");
              setNationality(profile.country || "Nigerian");
              setSignerTelephone(profile.phoneNumber || "");

              setSignerName(`${profile.firstName || ""} ${profile.lastName || ""}`.trim());
              setSignerAddress(fullAddr || "");
              setSignerEmail(profile.email || "");
            }
          } catch {
            // Profile fetch optional prefill fallback
          }
        }
      } catch (err) {
        if (active) error(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [listing.id, listing.title, listing.registered_title_document, error]);

  // Seller and signer fields are independently persisted. They receive the
  // same profile defaults for convenience but edits must not overwrite one another.
  function handleFirstNameChange(val: string) {
    setFirstNames(val);
  }

  function handleSurnameChange(val: string) {
    setSurname(val);
  }

  function handleAddressChange(val: string) {
    setAddress(val);
  }

  function handleEmailChange(val: string) {
    setEmail(val);
  }

  function handleSignerNameChange(val: string) {
    setSignerName(val);
  }

  function handleSignerAddressChange(val: string) {
    setSignerAddress(val);
  }

  function handleSignerEmailChange(val: string) {
    setSignerEmail(val);
  }

  // Document addition
  function handleAddFiles(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    if (documents.length + files.length > 10) {
      error(new Error("You can attach between 1 and 10 documents in total."));
      e.target.value = "";
      return;
    }

    const validTypes = ["application/pdf", "image/png", "image/jpeg"];
    const invalidFile = files.find(
      (f) => !validTypes.includes(f.type) || f.size > 10 * 1024 * 1024 || f.size === 0
    );

    if (invalidFile) {
      error(
        new Error(
          "Documents must be PDF, PNG, or JPEG files and cannot exceed 10 MB each."
        )
      );
      e.target.value = "";
      return;
    }

    const newItems: DocumentItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      title: file.name,
      size_bytes: file.size,
      mime_type: file.type,
      file,
    }));

    setDocuments((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }

  function handleRemoveDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  // Reset Handlers
  function handleResetPart1() {
    setMandateDate(new Date().toISOString().split("T")[0] ?? "");
    setSellerTitle("");
    setSurname("");
    setFirstNames("");
    setGender("");
    setEmail("");
    setDateOfBirth("");
    setNationality("Nigerian");
    setPostCode("");
    setAddress("");
    setPropertyDevelopmentName(listing.title || "");
    setDocumentTitle(listing.registered_title_document || "Certificate of Occupancy");
    setDocuments([]);
  }

  function handleResetPart2() {
    setAgreedToMandate(false);
  }

  function handleResetSignature() {
    signatureRef.current?.clear();
    setSignerName("");
    setSignerAddress("");
    setSignerTelephone("");
    setSignerEmail("");
    setHasValidSignature(false);
  }

  // Validate form
  function validateForm(): boolean {
    if (!mandateDate || !/^\d{4}-\d{2}-\d{2}$/.test(mandateDate)) {
      error(new Error("Provide a valid Mandate Date (YYYY-MM-DD)."));
      return false;
    }
    if (!sellerTitle.trim()) {
      error(new Error("Title is required."));
      return false;
    }
    if (!surname.trim()) {
      error(new Error("Surname is required."));
      return false;
    }
    if (!firstNames.trim()) {
      error(new Error("First Name(s) are required."));
      return false;
    }
    if (!gender) {
      error(new Error("Please select your gender."));
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      error(new Error("Provide a valid email address."));
      return false;
    }
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      error(new Error("Provide a valid Date of Birth (YYYY-MM-DD)."));
      return false;
    }
    if (!nationality.trim()) {
      error(new Error("Nationality is required."));
      return false;
    }
    if (!postCode.trim()) {
      error(new Error("Post Code is required."));
      return false;
    }
    if (!address.trim()) {
      error(new Error("Address of Seller/Client is required."));
      return false;
    }
    if (!signerTelephone.trim()) {
      error(new Error("Telephone number is required."));
      return false;
    }
    if (!signerName.trim()) {
      error(new Error("Signer name is required."));
      return false;
    }
    if (!signerAddress.trim()) {
      error(new Error("Signer address is required."));
      return false;
    }
    if (!signerEmail.trim() || !signerEmail.includes("@")) {
      error(new Error("Provide a valid signer email address."));
      return false;
    }
    if (!propertyDevelopmentName.trim()) {
      error(new Error("Property/Development is required."));
      return false;
    }
    if (!documentTitle.trim()) {
      error(new Error("Document Title is required."));
      return false;
    }
    if (documents.length < 1 || documents.length > 10) {
      error(new Error("Attach between 1 and 10 title documents."));
      return false;
    }
    if (!agreedToMandate) {
      error(new Error("You must agree and consent to the mandate terms (Clause 10)."));
      return false;
    }
    if (!hasValidSignature && !signatureRef.current?.hasExisting()) {
      error(new Error("Signature of Vendor/Seller/Client is required."));
      return false;
    }
    return true;
  }

  // Save or Submit
  async function performSaveOrSubmit(isFinalSubmit: boolean) {
    if (isFinalSubmit && !validateForm()) return;

    if (isFinalSubmit) setSubmitting(true);
    else setSavingDraft(true);

    try {
      // 1. Upload any pending new document files
      const newFilesToUpload = documents.filter((d) => d.file !== undefined);
      let uploadedDocsMap: Record<string, MandateDocumentUpload> = {};

      if (newFilesToUpload.length > 0) {
        const files = newFilesToUpload.map((d) => d.file as File);
        const titles = newFilesToUpload.map((d) => d.title);
        const uploaded = await uploadMandateDocuments(listing.id, files, titles);
        uploadedDocsMap = uploaded.reduce((acc, doc, index) => {
          const originalId = newFilesToUpload[index]?.id;
          if (originalId) acc[originalId] = doc;
          return acc;
        }, {} as Record<string, MandateDocumentUpload>);
      }

      // Combine persisted documents
      const finalDocuments = documents.map((d) => {
        const u = d.file ? uploadedDocsMap[d.id] : undefined;
        if (u) {
          return {
            kind: "upload" as const,
            upload_id: u.upload_id,
            title: u.title,
          };
        }
        return { kind: "existing" as const, id: d.id };
      });

      // 2. Handle Signature
      let signature: { kind: "existing" } | { kind: "upload"; upload_id: string } | null =
        existingMandate?.has_signature ? { kind: "existing" } : null;

      const drawnBlob = await signatureRef.current?.getBlob();
      if (drawnBlob) {
        const sigUpload = await uploadMandateSignature(listing.id, drawnBlob);
        signature = { kind: "upload", upload_id: sigUpload.upload_id };
      }

      if (!signature) {
        throw new Error("A signature is required before submitting the mandate.");
      }

      // 3. Save mandate record
      const saved = await saveMandate(listing.id, {
        content: {
          mandate_date: mandateDate,
          seller_title: sellerTitle.trim(),
          surname: surname.trim(),
          first_names: firstNames.trim(),
          gender: gender.trim(),
          email: email.trim(),
          telephone: signerTelephone.trim(),
          date_of_birth: dateOfBirth,
          nationality: nationality.trim(),
          post_code: postCode.trim(),
          address: address.trim(),
          property_development_name: propertyDevelopmentName.trim() || listing.title || "Property",
          document_title:
            documentTitle.trim() || listing.registered_title_document || "Certificate of Occupancy",
          signer_name: signerName.trim(),
          signer_address: signerAddress.trim(),
          signer_email: signerEmail.trim(),
          agreed_to_mandate: agreedToMandate,
        },
        signature,
        documents: finalDocuments,
      });

      setExistingMandate(saved);
      setDocuments(saved.documents.map((document) => ({
        id: document.id,
        title: document.title,
        size_bytes: document.size_bytes,
        mime_type: document.mime_type,
      })));

      if (!isFinalSubmit) {
        toast.success("Mandate draft saved successfully");
        return;
      }

      // 4. Final Server-Authoritative Submit
      const submitted = await submitListing(listing.id);
      toast.success("Listing submitted to our team for review!");
      onSubmitted(submitted);
    } catch (failure) {
      error(failure);
    } finally {
      if (isFinalSubmit) setSubmitting(false);
      else setSavingDraft(false);
    }
  }

  if (loading) {
    return (
      <div className="mandate-step-shell loading">
        <p>Loading Sales Mandate details...</p>
      </div>
    );
  }

  return (
    <div className="mandate-step-shell sales-mandate-step">
      <div className="sales-mandate-card">
        <div className="mandate-shell-status-badge">
          Status: <strong>{listing.listing_status}</strong>
        </div>
        {/* Header */}
        <div className="mandate-header">
          <span className="mandate-header-brand">BERYL PRESTIGE LIVING</span>
          <h1 className="mandate-header-title">Exclusive Sales Mandate (Sellers)</h1>
        </div>

        {/* Part 1 */}
        <section className="mandate-section mandate-part-1">
          <div className="mandate-section-header">
            <h2>Part 1</h2>
            <button
              type="button"
              className="mandate-reset-link"
              onClick={handleResetPart1}
              disabled={submitting}
            >
              Reset
            </button>
          </div>

          <div className="mandate-fields-grid">
            {/* Date */}
            <label className="mandate-field full-width">
              Date
              <input
                type="date"
                required
                value={mandateDate}
                onChange={(e) => setMandateDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                disabled={submitting}
              />
            </label>

            {/* Row 1: Title, Surname, First Name(s) */}
            <div className="mandate-three-fields">
              <label className="mandate-field">
                Title <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Title of the document"
                  value={sellerTitle}
                  onChange={(e) => setSellerTitle(e.target.value)}
                  maxLength={50}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Surname <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Your Surname"
                  value={surname}
                  onChange={(e) => handleSurnameChange(e.target.value)}
                  maxLength={100}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                First Name(s) <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Your Firstname"
                  value={firstNames}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                  maxLength={150}
                  disabled={submitting}
                />
              </label>
            </div>

            {/* Row 2: Gender, Email, DOB */}
            <div className="mandate-three-fields">
              <label className="mandate-field">
                Male or Female <b>*</b>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Select your gender
                  </option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>

              <label className="mandate-field">
                Your Email Address <b>*</b>
                <input
                  type="email"
                  required
                  placeholder="abc@example.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  maxLength={255}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Date of Birth <b>*</b>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  disabled={submitting}
                />
              </label>
            </div>

            {/* Row 3: Nationality, Post Code, Address */}
            <div className="mandate-three-fields">
              <label className="mandate-field">
                Nationality <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Your nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  maxLength={100}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Post Code <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Your Postcode..."
                  value={postCode}
                  onChange={(e) => setPostCode(e.target.value)}
                  maxLength={20}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Address of Seller/Client <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Your Address"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  maxLength={500}
                  disabled={submitting}
                />
              </label>
            </div>

            {/* Row 4: Property/Development, Document Title, Attach Documents */}
            <div className="mandate-three-fields align-start">
              <label className="mandate-field">
                Property/Development
                <input
                  type="text"
                  placeholder="Property..."
                  value={propertyDevelopmentName}
                  onChange={(e) => setPropertyDevelopmentName(e.target.value)}
                  maxLength={160}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Document Title
                <input
                  type="text"
                  placeholder="Document Title"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  maxLength={200}
                  disabled={submitting}
                />
              </label>

              <div className="mandate-field">
                <span className="mandate-field-label">
                  Attach copy of title documents <b>*</b>
                </span>

                {/* Document Pills */}
                {documents.length > 0 && (
                  <ul className="mandate-docs-list">
                    {documents.map((doc) => (
                      <li key={doc.id} className="mandate-doc-item">
                        <div className="mandate-doc-pdf-badge" aria-hidden="true">
                          {doc.mime_type.includes("image") ? "IMG" : "PDF"}
                        </div>
                        <div className="mandate-doc-info">
                          <span className="mandate-doc-title" title={doc.title}>
                            {doc.title}
                          </span>
                          <span className="mandate-doc-size">
                            {formatFileSize(doc.size_bytes)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="mandate-doc-remove-btn"
                          aria-label={`Remove document ${doc.title}`}
                          onClick={() => handleRemoveDocument(doc.id)}
                          disabled={submitting}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add Document button */}
                {documents.length < 10 && (
                  <label className="mandate-upload-btn-label">
                    <span className="mandate-upload-btn">
                      📎 {documents.length === 0 ? "Add Document(s)" : "Choose files"}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,image/png,image/jpeg,application/pdf"
                      className="mandate-upload-hidden-input"
                      onChange={handleAddFiles}
                      disabled={submitting}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Part 2: Terms and Conditions */}
        <section className="mandate-section mandate-part-2">
          <div className="mandate-section-header">
            <h2>Part 2: Exclusive Mandate Terms and Conditions</h2>
            <button
              type="button"
              className="mandate-reset-link"
              onClick={handleResetPart2}
              disabled={submitting}
            >
              Reset
            </button>
          </div>

          <div className="mandate-terms-body">
            <div className="mandate-clause">
              <strong>1. PROFESSIONAL/BROKERAGE FEE:</strong>
              <p>
                Beryl Prestige Living will charge a professional fee of 5% of the gross sale
                price.
              </p>
            </div>

            <div className="mandate-clause">
              <strong>2. INSTRUCTIONS:</strong>
              <ul>
                <li>
                  Beryl Prestige Living will only accept direct written instructions from
                  Vendor/Seller whether by letter, email or chat and will not accept oral
                  instructions whether by telephone or physical conversation and will not accept
                  instructions from agents or third parties.
                </li>
                <li>
                  This mandate is valid for 6 months renewable automatically for a further
                  mandate of 6 months unless terminated by the Client.
                </li>
              </ul>
            </div>

            <div className="mandate-clause">
              <strong>3. AUTHORITY:</strong>
              <p>
                Beryl Prestige Living is only a broking and marketing firm and does not have
                authority to transfer property. Beryl Prestige Living does not charge legal fees
                and Clients are advised to seek legal advice.
              </p>
            </div>

            <div className="mandate-clause">
              <strong>4. NEGOTIATION:</strong>
              <p>
                Beryl Prestige Living will quantify potential buyers and negotiate the sales
                transaction on behalf of the Seller/Vendor and will achieve a price within the
                range agreed with the Seller/Client or consistent with offer accepted by the
                Seller/Client.
              </p>
            </div>

            <div className="mandate-clause">
              <strong>5. MARKETING:</strong>
              <p>
                Beryl Prestige Living will market and advertise and present the property to target
                market, and the Seller/Client acknowledges that Beryl Prestige Living will invest in
                resources in this regard and will be remunerated for its effort from the
                professional fees in clause 1 above.
              </p>
            </div>

            <div className="mandate-clause">
              <strong>6.</strong>
              <p>
                Beryl Prestige Living shall manage the sales administration and relationship
                between the Seller/Client and the Buyer until the sale is closed.
              </p>
            </div>

            <div className="mandate-clause">
              <strong>7. PROFESSIONAL FEE CONDITIONS:</strong>
              <ul>
                <li>
                  Fees are earned upon written acceptance of any written offer and payable upon
                  payment of the purchase price.
                </li>
                <li>
                  A minimum of 1% of the gross sale price is payable if Seller/Client withdraws or
                  terminates instructions after 6 months.
                </li>
                <li>
                  When the Seller/Client accepts the 1st installment of payment from the Buyer,
                  Beryl Prestige Living shall deduct its full fees of 5% from 1st payments made.
                </li>
              </ul>
            </div>

            <div className="mandate-clause">
              <strong>8. ACCESS TO PROPERTY:</strong>
              <p>
                Consultants (Agents) and interested Buyers shall be permitted to view the property at
                reasonable times by appointment within 24 hours notice in the company of an
                accredited representative of Beryl Prestige Living.
              </p>
            </div>

            <div className="mandate-clause">
              <strong>9. SIGNAGE:</strong>
              <p>
                Beryl Prestige Living as the exclusive marketing / sales consultant will be
                authorized to place its signage on your property/development(s).
              </p>
            </div>

            {/* Clause 10 Consent */}
            <div className="mandate-clause consent-clause">
              <label className="mandate-consent-label">
                <input
                  type="checkbox"
                  required
                  checked={agreedToMandate}
                  onChange={(e) => setAgreedToMandate(e.target.checked)}
                  disabled={submitting}
                />
                <span className="mandate-consent-text">
                  <strong>10. I hereby consent to the above mandate:</strong>
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Sales Mandate (Signature Section) */}
        <section className="mandate-section mandate-signature-section">
          <div className="mandate-section-header">
            <h2>Sales Mandate</h2>
            <button
              type="button"
              className="mandate-reset-link"
              onClick={handleResetSignature}
              disabled={submitting}
            >
              Reset
            </button>
          </div>

          <div className="mandate-signature-fields">
            <div className="mandate-two-fields">
              <label className="mandate-field">
                Name <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Full legal name"
                  value={signerName}
                  onChange={(e) => handleSignerNameChange(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Address <b>*</b>
                <input
                  type="text"
                  required
                  placeholder="Your address"
                  value={signerAddress}
                  onChange={(e) => handleSignerAddressChange(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="mandate-two-fields">
              <label className="mandate-field">
                Telephone <b>*</b>
                <input
                  type="tel"
                  required
                  placeholder="Telephone number"
                  value={signerTelephone}
                  onChange={(e) => setSignerTelephone(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="mandate-field">
                Your Email Address <b>*</b>
                <input
                  type="email"
                  required
                  placeholder="abc@example.com"
                  value={signerEmail}
                  onChange={(e) => handleSignerEmailChange(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <SignatureCanvas
              ref={signatureRef}
              initialSignatureUrl={initialSignatureUrl}
              onSignatureChange={setHasValidSignature}
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="mandate-actions">
            <button
              type="button"
              className="button button-primary mandate-submit-btn"
              disabled={submitting || savingDraft}
              onClick={() => void performSaveOrSubmit(true)}
            >
              {submitting ? "Submitting Mandate..." : "Submit Mandate"}
            </button>

            <div className="mandate-secondary-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={onBack}
                disabled={submitting || savingDraft}
              >
                ← Back to Property Data
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={submitting || savingDraft}
                onClick={() => void performSaveOrSubmit(false)}
              >
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>
              <Link
                href="/dashboard/listings"
                className="button button-secondary mandate-dashboard-link"
              >
                View in Dashboard Listings
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
