"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { NigeriaLocationCombobox } from "@/components/location/nigeria-location-combobox";

export const LOCATIONS = [
  "Lekki, Lagos",
  "Lekki Phase 1, Lagos",
  "Lekki Peninsula Scheme II, Lagos",
  "Victoria Island, Lagos",
  "Ikoyi, Lagos",
  "Ikeja, Lagos",
  "Ajah, Lagos",
  "Abuja",
];

export function LocationSearch({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (locations: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const add = (location: string) => {
    if (!selected.includes(location)) onChange([...selected, location]);
    setQuery("");
  };

  return (
    <div className="field-wrap">
      <NigeriaLocationCombobox
        id="location-search"
        label="Select your preferred location"
        value={query}
        onValueChange={setQuery}
        onSelect={(location) => add(location.label)}
        excludedLabels={selected}
        rootClassName=""
        inputClassName={
          query.length === 0
            ? "form-control location-search-input"
            : "form-control"
        }
        showSearchIcon
        clearValueOnEscape
      />
      {selected.length ? (
        <div className="chip-list" aria-label="Selected locations">
          {selected.map((location) => (
            <span className="chip" key={location}>
              {location}
              <button
                type="button"
                className="icon-button"
                onClick={() => onChange(selected.filter((value) => value !== location))}
                aria-label={`Remove ${location}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-brand-muted">You can choose any of these popular areas too</p>
      <div className="chip-list">
        {LOCATIONS.slice(3)
          .filter((location) => !selected.includes(location))
          .map((location) => (
            <button key={location} type="button" className="popular-chip" onClick={() => add(location)}>
              <Plus className="mr-1 inline" size={13} />
              {location}
            </button>
          ))}
      </div>
      <p className="mt-2 text-xs text-brand-muted">
        Location suggestions by{" "}
        <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>.
      </p>
    </div>
  );
}
