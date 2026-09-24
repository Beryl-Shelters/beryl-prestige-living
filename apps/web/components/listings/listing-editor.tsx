"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import {
  commaInput,
  formatMoney,
  listingsRequest,
  moneyInput,
  type Listing,
  type ListingOptions,
} from "../../lib/listings-api";
import { BrandLoader } from "../auth/brand-loader";
import { useDashboard } from "../dashboard/dashboard-provider";
import { useListingError, useListingRequest } from "./use-listing-request";
import { SalesMandateStep } from "./sales-mandate-step";
import { SubmissionSuccessStep } from "./submission-success-step";


type Values = {
  title: string;
  registered_title_document: string;
  description: string;
  occupancy_type: string;
  ownership_type: string;
  property_type: string;
  property_subtype: string;
  has_lien: string;
  bedrooms: string;
  bathrooms: string;
  parking_spaces: string;
  units: string;
  land_area: string;
  year_built: string;
  property_cost: string;
  minimum_down_payment: string;
  location: string;
  state: string;
  city: string;
  longitude: string;
  latitude: string;
  additional_information: string;
};

const numericFields: (keyof Values)[] = [
  "bedrooms",
  "bathrooms",
  "parking_spaces",
  "units",
  "land_area",
  "year_built",
  "longitude",
  "latitude",
];

const optionalFields: (keyof Values)[] = [
  "units",
  "land_area",
  "year_built",
  "longitude",
  "latitude",
];

const defaultValues: Values = {
  title: "",
  registered_title_document: "",
  description: "",
  occupancy_type: "",
  ownership_type: "",
  property_type: "",
  property_subtype: "",
  has_lien: "",
  bedrooms: "",
  bathrooms: "",
  parking_spaces: "",
  units: "",
  land_area: "",
  year_built: "",
  property_cost: "",
  minimum_down_payment: "",
  location: "",
  state: "",
  city: "",
  longitude: "",
  latitude: "",
  additional_information: "",
};

function initialValues(listing?: Listing): Values {
  if (!listing) return defaultValues;
  return {
    title: listing.title ?? "",
    registered_title_document: listing.registered_title_document ?? "",
    description: listing.description ?? "",
    occupancy_type: listing.occupancy_type ?? "",
    ownership_type: listing.ownership_type ?? "",
    property_type: listing.property_type ?? "",
    property_subtype: listing.property_subtype ?? "",
    has_lien: typeof listing.has_lien === "boolean" ? String(listing.has_lien) : "",
    bedrooms:
      listing.bedrooms !== null && listing.bedrooms !== undefined
        ? String(listing.bedrooms)
        : "",
    bathrooms:
      listing.bathrooms !== null && listing.bathrooms !== undefined
        ? String(listing.bathrooms)
        : "",
    parking_spaces:
      listing.parking_spaces !== null && listing.parking_spaces !== undefined
        ? String(listing.parking_spaces)
        : "",
    units:
      listing.units !== null && listing.units !== undefined
        ? String(listing.units)
        : "",
    land_area:
      listing.land_area !== null && listing.land_area !== undefined
        ? String(listing.land_area)
        : "",
    year_built:
      listing.year_built !== null && listing.year_built !== undefined
        ? String(listing.year_built)
        : "",
    property_cost: listing.property_cost_minor
      ? moneyInput(listing.property_cost_minor)
      : "",
    minimum_down_payment:
      listing.minimum_down_payment_minor !== undefined &&
      listing.minimum_down_payment_minor !== null
        ? moneyInput(listing.minimum_down_payment_minor)
        : "",
    location: listing.location ?? "",
    state: listing.state ?? "",
    city: listing.city ?? "",
    longitude:
      listing.longitude !== null && listing.longitude !== undefined
        ? String(listing.longitude)
        : "",
    latitude:
      listing.latitude !== null && listing.latitude !== undefined
        ? String(listing.latitude)
        : "",
    additional_information: listing.additional_information ?? "",
  };
}

function previewAmount(value: string): number {
  if (!/^\d{1,13}(\.\d{0,2})?$/.test(value)) return 0;
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}

function WizardStepper({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick?: (step: number) => void;
}) {
  const steps = [
    { number: 1, title: "Property Data" },
    { number: 2, title: "Sales Mandate" },
    { number: 3, title: "Submission" },
  ];
  return (
    <nav className="wizard-stepper" aria-label="Listing wizard steps">
      <ol className="wizard-steps-list">
        {steps.map((step) => {
          const isCurrent = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          return (
            <li
              key={step.number}
              className={`wizard-step-item ${isCurrent ? "current" : isCompleted ? "completed" : "upcoming"}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <button
                type="button"
                className="wizard-step-button"
                disabled={!isCompleted && !isCurrent}
                onClick={() => isCompleted && onStepClick?.(step.number)}
              >
                <span className="wizard-step-badge" aria-hidden="true">
                  {isCompleted ? "✓" : step.number}
                </span>
                <span className="wizard-step-label">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ListingWizard({
  listing,
  options,
}: {
  listing?: Listing;
  options: ListingOptions;
}) {
  const { refreshOverview } = useDashboard();
  const error = useListingError();
  const [step, setStep] = useState<1 | 2 | 3>(() =>
    listing?.listing_status === "PENDING" ? 3 : 1
  );
  const [savedListing, setSavedListing] = useState<Listing | null>(listing ?? null);

  const [values, setValues] = useState<Values>(() => initialValues(listing));
  const [facilities, setFacilities] = useState<string[]>(listing?.facilities ?? []);
  const [pending, setPending] = useState(false);
  const [images, setImages] = useState<{ id: string; url: string; file?: File }[]>(
    listing?.images ?? []
  );
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const list = urls.current;
    return () => {
      list.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const set = (key: keyof Values, value: string) =>
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      if (
        key === "occupancy_type" &&
        (!previous.property_type || previous.property_type === previous.occupancy_type)
      ) {
        next.property_type = value;
      }
      return next;
    });

  const cost = previewAmount(values.property_cost ?? "");
  const minimum = previewAmount(values.minimum_down_payment ?? "");
  const percent = cost
    ? `${Number((BigInt(minimum) * 10000n) / BigInt(cost)) / 100} %`
    : "0.00 %";

  function addImages(files: FileList | null) {
    if (!files) return;
    const additions = Array.from(files);
    if (
      images.length + additions.length > 24 ||
      additions.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5242880 ||
          !file.size
      )
    ) {
      error(new Error("Choose up to 24 JPG, PNG or WebP images, no larger than 5 MB each."));
      return;
    }
    setImages((previous) => [
      ...previous,
      ...additions.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.push(url);
        return { id: crypto.randomUUID(), url, file };
      }),
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!images.length) {
      error(new Error("Property Image is required."));
      return;
    }
    if (cost <= 0 || minimum > cost) {
      error(new Error("Check Property Cost and Minimum Down Payment."));
      return;
    }

    const content: Record<string, unknown> = {
      ...values,
      facilities,
      has_lien: values.has_lien === "true",
      registered_title_document: values.registered_title_document.trim() || null,
      additional_information: values.additional_information.trim() || null,
    };

    for (const name of numericFields) {
      content[name] =
        optionalFields.includes(name) && values[name] === ""
          ? null
          : Number(values[name]);
    }

    const activeListing = savedListing || listing;
    const data = new FormData();
    data.set(
      "data",
      JSON.stringify({
        content,
        ...(activeListing
          ? {
              version: activeListing.version,
              retained_images: images
                .filter((image) => !image.file)
                .map((image) => image.id),
            }
          : {}),
      })
    );
    images.forEach((image) => {
      if (image.file) data.append("images", image.file);
    });

    setPending(true);
    try {
      const persisted = await listingsRequest<Listing>(
        activeListing ? `/${activeListing.id}` : "",
        {
          method: activeListing ? "PATCH" : "POST",
          body: data,
        }
      );
      setSavedListing(persisted);
      if (persisted.images?.length) {
        setImages(persisted.images);
      }
      refreshOverview();
      toast.success(activeListing ? "Listing updated" : "Listing created");
      setStep(2);
    } catch (failure) {
      error(failure);
    } finally {
      setPending(false);
    }
  }

  function input(
    key: keyof Values,
    label: string,
    required = false,
    numeric = false,
    placeholder = ""
  ) {
    const money = ["property_cost", "minimum_down_payment"].includes(key);
    const signed = ["latitude", "longitude"].includes(key);
    return (
      <label key={key}>
        {label}
        {required && <> <b>*</b></>}
        <div className="listing-input-wrap">
          <input
            name={key}
            required={required}
            inputMode={numeric ? "decimal" : "text"}
            placeholder={placeholder}
            value={money ? commaInput(values[key] ?? "") : values[key] ?? ""}
            maxLength={
              key === "title"
                ? 160
                : key === "registered_title_document"
                  ? 200
                  : key === "location"
                    ? 300
                    : numeric
                      ? 20
                      : 100
            }
            onChange={(event) => {
              const next = event.target.value.replace(money ? /,/g : /$^/g, "");
              if (
                numeric &&
                !new RegExp(signed ? "^-?\\d*(\\.\\d*)?$" : "^\\d*(\\.\\d{0,2})?$").test(next)
              )
                return;
              set(key, next);
            }}
          />
          {key === "minimum_down_payment" && (
            <span className="down-payment-percent">{percent}</span>
          )}
        </div>
      </label>
    );
  }

  function select(
    key: keyof Values,
    label: string,
    choices: string[],
    contextNote = ""
  ) {
    return (
      <label key={key}>
        {label} <b>*</b>
        {contextNote && <small className="field-context-note">{contextNote}</small>}
        <select
          name={key}
          required
          value={values[key]}
          onChange={(event) => set(key, event.target.value)}
        >
          <option value="" disabled>
            Select an Option
          </option>
          {choices.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="listing-wizard-container">
      <WizardStepper currentStep={step} onStepClick={(s) => setStep(s as 1 | 2 | 3)} />

      {step === 3 ? (
        <SubmissionSuccessStep listing={savedListing || listing} />
      ) : step === 2 && (savedListing || listing) ? (
        <SalesMandateStep
          listing={(savedListing || listing)!}
          onBack={() => setStep(1)}
          onSubmitted={(submitted) => {
            setSavedListing(submitted);
            refreshOverview();
            setStep(3);
          }}
        />
      ) : (
        <form
          className="listing-form listing-editor"
          onSubmit={(event) => void submit(event)}
          aria-busy={pending}
        >
          <div className="listings-title">
            <h1>{savedListing || listing ? "Edit Listing" : "List a Property"}</h1>
          </div>

          <div className="listing-editor-columns">
            <fieldset disabled={pending} className="listing-editor-fields">
              <section>
                <h2>Property Information</h2>
                {input(
                  "registered_title_document",
                  "Registered Title Document",
                  false,
                  false,
                  "e.g. Certificate of Occupancy, Deed of Assignment"
                )}
                {input("title", "Property Title (Public Marketing Title)", true)}
                <label>
                  Property Image <b>*</b>
                </label>
                <div className="listing-image-strip">
                  {images.map((img, index) => (
                    <div key={img.id} className="listing-image-thumbnail">
                      <img src={img.url} alt={`Property image ${index + 1}`} />
                      {index === 0 ? (
                        <span className="image-cover-tag">Cover</span>
                      ) : (
                        <button
                          type="button"
                          className="image-make-cover-btn"
                          aria-label={`Set image ${index + 1} as cover`}
                          onClick={() =>
                            setImages((previous) => {
                              const target = previous.find((i) => i.id === img.id);
                              if (!target) return previous;
                              return [target, ...previous.filter((i) => i.id !== img.id)];
                            })
                          }
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove image ${index + 1}`}
                        onClick={() =>
                          setImages((previous) =>
                            previous.filter((value) => value.id !== img.id)
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Property Image"
                    onChange={(event) => {
                      addImages(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>
                <label>
                  Property Description <b>*</b>
                  <textarea
                    name="description"
                    required
                    maxLength={10000}
                    value={values.description}
                    onChange={(event) => set("description", event.target.value)}
                  />
                </label>
                <div className="listing-two-fields">
                  {select(
                    "occupancy_type",
                    "Residential or Commercial Property?",
                    options.occupancy_type
                  )}
                  {select(
                    "ownership_type",
                    "Personal or Family Property?",
                    options.ownership_type
                  )}
                  {select("property_type", "Property Type", options.property_type)}
                  {select(
                    "property_subtype",
                    "Property Subtype",
                    options.property_subtype
                  )}
                  <label>
                    Does this property have a lien on it? <b>*</b>
                    <small className="field-context-note">
                      Has it been used to borrow money from the bank?
                    </small>
                    <select
                      name="has_lien"
                      required
                      value={values.has_lien}
                      onChange={(event) => set("has_lien", event.target.value)}
                    >
                      <option value="" disabled>
                        Select an Option
                      </option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h2>Property facilities</h2>
                <div className="listing-six-fields">
                  {[
                    ["bedrooms", "No. of Bed"],
                    ["bathrooms", "No. of Baths"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label} <b>*</b>
                      <select
                        name={key}
                        required
                        value={values[key as keyof Values]}
                        onChange={(event) =>
                          set(key as keyof Values, event.target.value)
                        }
                      >
                        <option value="" disabled>
                          -
                        </option>
                        {Array.from(
                          new Set([
                            ...Array.from({ length: 101 }, (_, index) => index),
                            Number(values[key as keyof Values] || 0),
                          ])
                        )
                          .sort((a, b) => a - b)
                          .map((val) => (
                            <option key={val}>{val}</option>
                          ))}
                      </select>
                    </label>
                  ))}
                  {input("parking_spaces", "Parking Space", true, true)}
                  {input("units", "No. of units", false, true)}
                  {input("land_area", "Land area (Sq.Ft.)", false, true)}
                  {input("year_built", "Year Built", false, true)}
                </div>
                <h3>Additional facilities</h3>
                <div className="listing-facilities">
                  {options.facilities.map((facility) => (
                    <label key={facility}>
                      <input
                        type="checkbox"
                        checked={facilities.includes(facility)}
                        onChange={(event) =>
                          setFacilities((previous) =>
                            event.target.checked
                              ? [...previous, facility]
                              : previous.filter((val) => val !== facility)
                          )
                        }
                      />
                      {facility}
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h2>Price</h2>
                <div className="listing-two-fields">
                  {input("property_cost", "Selling Price", true, true)}
                  {input(
                    "minimum_down_payment",
                    "Minimum Down Payment",
                    true,
                    true
                  )}
                </div>
              </section>

              <section>
                <h2>Location & Other Information</h2>
                {input("location", "Location", true)}
                <div className="listing-two-fields">
                  <label>
                    State <b>*</b>
                    <input
                      name="state"
                      required
                      maxLength={80}
                      list="listing-state-options"
                      value={values.state}
                      onChange={(event) => set("state", event.target.value)}
                    />
                    <datalist id="listing-state-options">
                      {options.state.map((st) => (
                        <option key={st}>{st}</option>
                      ))}
                    </datalist>
                  </label>
                  {input("city", "City", true)}
                </div>
                <h3>Map Location</h3>
                <div className="listing-two-fields">
                  {input("longitude", "Longitude", false, true)}
                  {input("latitude", "Latitude", false, true)}
                </div>
                <h3>Other Information</h3>
                <label>
                  <small className="field-helper-text">
                    Any additional details or notes about the property (up to 5,000 characters)
                  </small>
                  <textarea
                    name="additional_information"
                    maxLength={5000}
                    placeholder="Enter any other relevant property information..."
                    value={values.additional_information}
                    onChange={(event) =>
                      set("additional_information", event.target.value)
                    }
                  />
                </label>

                <div className="listing-form-actions">
                  <button
                    className="listing-primary"
                    disabled={pending}
                    type="submit"
                  >
                    {pending ? "Saving..." : "Save & Continue"}
                  </button>
                </div>
              </section>
            </fieldset>

            <aside className="listing-quick-preview">
              <h2>Quick Preview</h2>
              <div className="quick-preview-card">
                <div className="quick-preview-image">
                  {images[0] && (
                    <img src={images[0].url} alt="Property preview" />
                  )}
                  <span aria-hidden="true">♡</span>
                  {images[0] && <span className="preview-cover-badge">Cover</span>}
                </div>
                <div className="quick-preview-body">
                  <h3>{values.title || "-"}</h3>
                  <p>
                    {values.bedrooms || 0} Bedroom · {values.bathrooms || 0} Bathroom
                    {values.land_area ? ` · ${values.land_area} Sq.Ft.` : ""}
                  </p>
                  <p className="quick-preview-location">
                    {values.city
                      ? values.state
                        ? `${values.city}, ${values.state}`
                        : values.city
                      : values.location || "Location"}
                  </p>
                  <div>
                    <strong>{formatMoney(cost)}</strong>
                    <span>View More →</span>
                  </div>
                </div>
              </div>
              <p className="quick-preview-note">
                ⓘ A quick preview of when your property is published
              </p>
            </aside>
          </div>
        </form>
      )}
    </div>
  );
}

function ExistingEditor({
  id,
  options,
}: {
  id: string;
  options: ListingOptions;
}) {
  const { data, loading, reload } = useListingRequest<Listing>(`/${id}`);
  if (loading) return <BrandLoader />;
  if (!data) return <button onClick={reload}>Try again</button>;
  if (!["UNLISTED", "REJECTED"].includes(data.listing_status)) {
    return <p>Unlist this property before editing it.</p>;
  }
  return <ListingWizard listing={data} options={options} />;
}

export function ListingEditorScreen({ id }: { id?: string }) {
  const { data: options, loading, reload } =
    useListingRequest<ListingOptions>("/options");
  if (loading) return <BrandLoader />;
  if (!options) return <button onClick={reload}>Try again</button>;
  return id ? (
    <ExistingEditor id={id} options={options} />
  ) : (
    <ListingWizard options={options} />
  );
}
