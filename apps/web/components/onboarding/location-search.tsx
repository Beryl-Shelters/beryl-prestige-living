"use client";

import { MapPin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

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
  const matches = useMemo(
    () =>
      query.trim()
        ? LOCATIONS.filter(
            (location) =>
              location.toLowerCase().includes(query.trim().toLowerCase()) &&
              !selected.includes(location),
          )
        : [],
    [query, selected],
  );
  const add = (location: string) => {
    if (!selected.includes(location)) onChange([...selected, location]);
    setQuery("");
  };
  return (
    <div className="field-wrap">
      <label className="field-label" htmlFor="location-search">
        Select your preferred location
      </label>
      <div className="relative">
        {query.length === 0 ? (
          <Search
            className="location-search-icon text-brand-muted"
            size={18}
            aria-hidden
            data-testid="location-search-icon"
          />
        ) : null}
        <input
          id="location-search"
          className={query.length === 0 ? "form-control location-search-input" : "form-control"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a city or area you prefer"
          autoComplete="off"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="location-results"
        />
        {matches.length ? (
          <ul
            id="location-results"
            className="search-results absolute z-10 w-full"
          >
            {matches.map((location) => (
              <li key={location}>
                <button type="button" onClick={() => add(location)}>
                  <MapPin className="mr-2 inline text-brand-brown" size={15} />
                  {location}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {selected.length ? (
        <div className="chip-list" aria-label="Selected locations">
          {selected.map((location) => (
            <span className="chip" key={location}>
              {location}
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  onChange(selected.filter((value) => value !== location))
                }
                aria-label={`Remove ${location}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-brand-muted">
        You can choose any of these popular areas too
      </p>
      <div className="chip-list">
        {LOCATIONS.slice(3)
          .filter((location) => !selected.includes(location))
          .map((location) => (
            <button
              key={location}
              type="button"
              className="popular-chip"
              onClick={() => add(location)}
            >
              <Plus className="mr-1 inline" size={13} />
              {location}
            </button>
          ))}
      </div>
    </div>
  );
}
