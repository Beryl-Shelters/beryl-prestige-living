import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDraft } from "@/lib/contracts";
import { PropertyInformationStep } from "./seller-draft-editor";

const mocks = vi.hoisted(() => ({ locations: vi.fn() }));

vi.mock("@/lib/api/client", () => ({
  customerApi: {},
  marketplaceApi: { locations: mocks.locations },
}));

const location = (
  id: string,
  label: string,
  state: string,
  type: "STATE" | "CITY" | "LGA" | "AREA" = "CITY",
) => ({ id, label, state, type });

function Harness({ initialLocation = "" }: { initialLocation?: string }) {
  const [draft, setDraft] = useState<Partial<SellerDraft>>({
    propertyCategory: "RESIDENTIAL",
    negotiable: false,
    amenities: [],
    publicLocation: initialLocation,
  });
  const [custom, setCustom] = useState("");
  const change = (key: keyof SellerDraft, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PropertyInformationStep
        draft={draft}
        customAmenity={custom}
        pending={false}
        onChange={change}
        onCustomAmenityChange={setCustom}
        onAddAmenity={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
      <output data-testid="stored-location">{draft.publicLocation}</output>
    </>
  );
}

describe("Seller property location suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locations.mockResolvedValue({
      success: true,
      data: { locations: [] },
    });
  });

  it("does not search below two trimmed characters", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("combobox", { name: "Location" }), " I");
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(mocks.locations).not.toHaveBeenCalled();
  });

  it("shows local loading and writes a clicked suggestion into publicLocation", async () => {
    let resolveSearch!: (value: unknown) => void;
    mocks.locations.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSearch = resolve; }),
    );
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Location" });

    await userEvent.type(input, "  Ike");
    expect(await screen.findByText("Searching Nigeria…")).toBeInTheDocument();
    expect(mocks.locations).toHaveBeenCalledWith("Ike", expect.any(AbortSignal));
    resolveSearch({
      success: true,
      data: { locations: [location("1", "Ikeja, Lagos", "Lagos")] },
    });
    await userEvent.click(await screen.findByRole("button", { name: /Ikeja, Lagos/i }));

    expect(input).toHaveValue("Ikeja, Lagos");
    expect(screen.getByTestId("stored-location")).toHaveTextContent("Ikeja, Lagos");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("supports ArrowDown, Enter, and Escape without erasing entered text", async () => {
    mocks.locations.mockResolvedValue({
      success: true,
      data: { locations: [location("2", "Ilesa, Osun", "Osun")] },
    });
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Location" });

    await userEvent.type(input, "Ile");
    const option = await screen.findByRole("option", { name: /Ilesa, Osun/i });
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("Ile");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await userEvent.type(input, "s");
    await screen.findByRole("option", { name: /Ilesa, Osun/i });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("Ilesa, Osun");
  });

  it("shows no-results and recoverable provider failure states", async () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Location" });

    await userEvent.type(input, "Zzz");
    expect(await screen.findByText("No matching Nigerian locations found.")).toBeInTheDocument();

    mocks.locations.mockRejectedValueOnce(new Error("private provider details"));
    await userEvent.clear(input);
    await userEvent.type(input, "Kaduna");
    expect(await screen.findByText("We could not load location suggestions.")).toBeInTheDocument();
    expect(screen.queryByText("private provider details")).not.toBeInTheDocument();

    mocks.locations.mockResolvedValueOnce({
      success: true,
      data: { locations: [location("3", "Kaduna, Kaduna", "Kaduna")] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("option", { name: /Kaduna, Kaduna/i })).toBeInTheDocument();
  });

  it("ignores an aborted stale response", async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    mocks.locations
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Location" });

    await userEvent.type(input, "Ab");
    await waitFor(() => expect(mocks.locations).toHaveBeenCalledTimes(1));
    const firstSignal = mocks.locations.mock.calls[0][1] as AbortSignal;
    await userEvent.clear(input);
    await userEvent.type(input, "Ike");
    await waitFor(() => expect(mocks.locations).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);

    resolveSecond({
      success: true,
      data: { locations: [location("4", "Ikeja, Lagos", "Lagos")] },
    });
    expect(await screen.findByRole("option", { name: /Ikeja, Lagos/i })).toBeInTheDocument();
    resolveFirst({
      success: true,
      data: { locations: [location("5", "Aba, Abia", "Abia")] },
    });
    await waitFor(() => expect(screen.queryByText("Aba, Abia")).not.toBeInTheDocument());
  });

  it("displays a saved free-text location without resolving it and permits replacement", async () => {
    mocks.locations.mockResolvedValueOnce({
      success: true,
      data: { locations: [location("6", "Aba, Abia", "Abia")] },
    });
    render(<Harness initialLocation="Custom Estate, Lagos" />);
    const input = screen.getByRole("combobox", { name: "Location" });

    expect(input).toHaveValue("Custom Estate, Lagos");
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(mocks.locations).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "Aba");
    await userEvent.click(await screen.findByRole("button", { name: /Aba, Abia/i }));
    expect(input).toHaveValue("Aba, Abia");
    expect(screen.getByTestId("stored-location")).toHaveTextContent("Aba, Abia");
  });
});
