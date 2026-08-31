"use client";

import { MapPin, Plus, Search, X } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { marketplaceApi } from "@/lib/api/client";
import type { LocationSuggestion } from "@/lib/contracts";

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

type SearchStatus = "idle" | "loading" | "success" | "error";

export function LocationSearch({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (locations: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryKey, setRetryKey] = useState(0);
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setResults([]);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      setStatus("loading");
      setActiveIndex(-1);
      try {
        const response = await marketplaceApi.locations(normalizedQuery, controller.signal);
        setResults(response.data.locations);
        setStatus("success");
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus("error");
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [normalizedQuery, retryKey]);

  const matches = useMemo(
    () => results.filter((location) => !selected.includes(location.label)),
    [results, selected],
  );
  const showResults = normalizedQuery.length >= 2 && status !== "idle";

  const add = (location: string) => {
    if (!selected.includes(location)) onChange([...selected, location]);
    setQuery("");
  };

  const handleKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) {
      if (event.key === "Escape") setQuery("");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? matches.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      add(matches[activeIndex].label);
    } else if (event.key === "Escape") {
      setQuery("");
    }
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
          onKeyDown={handleKeys}
          placeholder="Search any Nigerian city, state, LGA or area"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls="location-results"
          aria-activedescendant={activeIndex >= 0 ? `location-result-${activeIndex}` : undefined}
        />
        {showResults ? (
          <div id="location-results" className="search-results absolute z-10 w-full" role="listbox">
            {status === "loading" ? (
              <p className="location-search-status" role="status">Searching Nigeria…</p>
            ) : null}
            {status === "error" ? (
              <div className="location-search-status" role="alert">
                <p>We could not load location suggestions.</p>
                <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Try again</button>
              </div>
            ) : null}
            {status === "success" && matches.length === 0 ? (
              <p className="location-search-status" role="status">No matching Nigerian locations found.</p>
            ) : null}
            {status === "success" && matches.length > 0 ? (
              <ul>
                {matches.map((location, index) => (
                  <li
                    id={`location-result-${index}`}
                    key={location.id}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button type="button" onClick={() => add(location.label)}>
                      <MapPin className="mr-2 inline text-brand-brown" size={15} />
                      <span>{location.label}</span>
                      <small>{location.type === "LGA" ? "Local government area" : location.type.toLocaleLowerCase("en")}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
