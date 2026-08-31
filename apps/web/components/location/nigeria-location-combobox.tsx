"use client";

import { MapPin, Search } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { marketplaceApi } from "@/lib/api/client";
import type { LocationSuggestion } from "@/lib/contracts";

type SearchStatus = "idle" | "loading" | "success" | "error";

export function NigeriaLocationCombobox({
  id,
  label,
  value,
  onValueChange,
  onSelect,
  excludedLabels = [],
  placeholder = "Search any Nigerian city, state, LGA or area",
  rootClassName = "field-wrap",
  labelClassName = "field-label",
  inputClassName = "form-control",
  showSearchIcon = false,
  clearValueOnEscape = false,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (location: LocationSuggestion) => void;
  excludedLabels?: string[];
  placeholder?: string;
  rootClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  showSearchIcon?: boolean;
  clearValueOnEscape?: boolean;
}) {
  const generatedId = useId().replaceAll(":", "");
  const resultsId = `${id}-${generatedId}-results`;
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryKey, setRetryKey] = useState(0);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const normalizedQuery = value.trim();

  useEffect(() => {
    if (!searchEnabled || normalizedQuery.length < 2) {
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
        const response = await marketplaceApi.locations(
          normalizedQuery,
          controller.signal,
        );
        if (controller.signal.aborted) return;
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
  }, [normalizedQuery, retryKey, searchEnabled]);

  const matches = useMemo(
    () => results.filter((location) => !excludedLabels.includes(location.label)),
    [excludedLabels, results],
  );
  const showResults =
    open && normalizedQuery.length >= 2 && status !== "idle";

  const choose = (location: LocationSuggestion) => {
    setOpen(false);
    setSearchEnabled(false);
    setActiveIndex(-1);
    onSelect(location);
  };

  const handleKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setSearchEnabled(false);
      setActiveIndex(-1);
      if (clearValueOnEscape) onValueChange("");
      return;
    }
    if (!matches.length || !showResults) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? matches.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(matches[activeIndex]);
    }
  };

  return (
    <div className={rootClassName}>
      <label className={labelClassName || undefined} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        {showSearchIcon && value.length === 0 ? (
          <Search
            className="location-search-icon text-brand-muted"
            size={18}
            aria-hidden
            data-testid="location-search-icon"
          />
        ) : null}
        <input
          id={id}
          className={inputClassName}
          value={value}
          onChange={(event) => {
            setSearchEnabled(true);
            setOpen(true);
            setActiveIndex(-1);
            onValueChange(event.target.value);
          }}
          onKeyDown={handleKeys}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={resultsId}
          aria-activedescendant={
            activeIndex >= 0 ? `${resultsId}-option-${activeIndex}` : undefined
          }
        />
        {showResults ? (
          <div
            id={resultsId}
            className="search-results absolute z-10 w-full"
            role="listbox"
          >
            {status === "loading" ? (
              <p className="location-search-status" role="status">
                Searching Nigeria…
              </p>
            ) : null}
            {status === "error" ? (
              <div className="location-search-status" role="alert">
                <p>We could not load location suggestions.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchEnabled(true);
                    setOpen(true);
                    setRetryKey((current) => current + 1);
                  }}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {status === "success" && matches.length === 0 ? (
              <p className="location-search-status" role="status">
                No matching Nigerian locations found.
              </p>
            ) : null}
            {status === "success" && matches.length > 0 ? (
              <ul>
                {matches.map((location, index) => (
                  <li
                    id={`${resultsId}-option-${index}`}
                    key={location.id}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button type="button" onClick={() => choose(location)}>
                      <MapPin
                        className="mr-2 inline text-brand-brown"
                        size={15}
                        aria-hidden="true"
                      />
                      <span>{location.label}</span>
                      <small>
                        {location.type === "LGA"
                          ? "Local government area"
                          : location.type.toLocaleLowerCase("en")}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
