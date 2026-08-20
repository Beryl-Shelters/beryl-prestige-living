import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SellerDraft } from "@/lib/contracts";
import { PropertyInformationStep } from "./seller-draft-editor";

function Harness({ onSave = vi.fn(), onContinue = vi.fn() }: { onSave?: () => void; onContinue?: () => void }) {
  const [draft, setDraft] = useState<Partial<SellerDraft>>({ propertyCategory: "RESIDENTIAL", negotiable: false, amenities: [], initialDepositValue: null });
  const [custom, setCustom] = useState("");
  const change = (key: keyof SellerDraft, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const add = () => {
    const value = custom.trim();
    if (!value || draft.amenities?.some((amenity) => amenity.toLowerCase() === value.toLowerCase())) return;
    change("amenities", [...(draft.amenities ?? []), value]);
    setCustom("");
  };
  return <PropertyInformationStep draft={draft} customAmenity={custom} pending={false} onChange={change} onCustomAmenityChange={setCustom} onAddAmenity={add} onSave={onSave} onBack={vi.fn()} onContinue={onContinue} />;
}

describe("Seller Property Information design controls", () => {
  it("maps category and authoritative property-type controls", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /^Residential/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /^Commercial/ }));
    expect(screen.getByRole("radio", { name: /^Commercial/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Residential/ })).not.toBeChecked();
    const propertyType = screen.getByLabelText("Property Type");
    expect(within(propertyType).getByRole("option", { name: "Duplex" })).toHaveValue("DUPLEX");
    fireEvent.change(propertyType, { target: { value: "SEMI_DETACHED_HOUSE" } });
    expect(propertyType).toHaveValue("SEMI_DETACHED_HOUSE");
  });

  it("maps ownership, condition, and furnishing choices", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText(/Personal/));
    expect(screen.getByLabelText(/Personal/)).toHaveAttribute("value", "PERSONAL");
    expect(screen.getByLabelText(/Personal/)).toBeChecked();
    fireEvent.click(screen.getByLabelText(/Third party/));
    expect(screen.getByLabelText(/Third party/)).toHaveAttribute("value", "THIRD_PARTY");
    fireEvent.click(screen.getByLabelText("Under Construction"));
    expect(screen.getByLabelText("Under Construction")).toHaveAttribute("value", "UNDER_CONSTRUCTION");
    fireEvent.click(screen.getByLabelText("Semi Furnished"));
    expect(screen.getByLabelText("Semi Furnished")).toHaveAttribute("value", "SEMI_FURNISHED");
  });

  it("increments and decrements every residential counter without going below zero", () => {
    render(<Harness />);
    for (const label of ["bedrooms", "bathrooms", "toilets", "parking spaces"]) {
      const decrease = screen.getByRole("button", { name: `Decrease ${label}` });
      const increase = screen.getByRole("button", { name: `Increase ${label}` });
      expect(decrease).toBeDisabled();
      fireEvent.click(increase);
      expect(decrease).toBeEnabled();
      fireEvent.click(decrease);
      expect(decrease).toBeDisabled();
    }
  });

  it("switches to commercial counters and hides residential-only controls", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: /^Commercial/ }));
    expect(screen.getByRole("button", { name: "Increase number of floors" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Increase parking capacity" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Increase bedrooms" })).not.toBeInTheDocument();
  });

  it("shows the correct deposit field and clears it when None is chosen", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Amount"));
    const amount = screen.getByLabelText("Deposit amount");
    fireEvent.change(amount, { target: { value: "500000" } });
    expect(amount).toHaveValue(500000);
    fireEvent.click(screen.getByLabelText("Percentage"));
    expect(screen.getByLabelText("Deposit percentage")).toHaveAttribute("max", "100");
    fireEvent.click(screen.getByLabelText("None"));
    expect(screen.queryByLabelText("Deposit amount")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Deposit percentage")).not.toBeInTheDocument();
  });

  it("adds, de-duplicates, and removes styled amenity chips without a raw list", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Security/ }));
    expect(screen.getByRole("button", { name: "Remove Security" })).toBeVisible();
    const custom = screen.getByLabelText("Custom amenity");
    fireEvent.change(custom, { target: { value: "Rooftop" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Remove Rooftop" })).toBeVisible();
    fireEvent.change(custom, { target: { value: " rooftop " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByRole("button", { name: "Remove Rooftop" })).toHaveLength(1);
    expect(screen.queryByText("Security, Rooftop")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Security" }));
    expect(screen.queryByRole("button", { name: "Remove Security" })).not.toBeInTheDocument();
  });

  it("collapses sections without removing entered state", () => {
    render(<Harness />);
    const title = screen.getByLabelText("Property Title");
    fireEvent.change(title, { target: { value: "Waterfront duplex" } });
    const toggle = screen.getByRole("button", { name: "Tell us about the property" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Property Title")).toHaveValue("Waterfront duplex");
  });

  it("keeps real Save and Continue callbacks wired", () => {
    const onSave = vi.fn();
    const onContinue = vi.fn();
    render(<Harness onSave={onSave} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
