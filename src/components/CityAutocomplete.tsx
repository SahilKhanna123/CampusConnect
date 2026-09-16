"use client";

import { useEffect, useRef, useState } from "react";

export type SelectedCity = { id: string; name: string; regionName: string } | null;

type CityResult = { id: string; name: string; regionName: string };

const DEBOUNCE_MS = 275;
const MIN_QUERY_LENGTH = 2;

// Search-as-you-type replacement for every plain <select> that used to be
// populated by getCitiesByRegion() -- once the seeded city list grew past
// a handful of rows, a flat/grouped <select> became unusably long. Always
// resolves to a real City row (never accepts unmatched free text as a
// valid selection) -- per direct product decision, this is a *search*
// tool, not a free-text field.
//
// `name` renders a hidden <input> carrying the real value, so uncontrolled
// native-GET forms (Home's hero search bar) and FormData-reading forms
// (ExploreFilters) keep working with zero other JS wiring.
export function CityAutocomplete({
  id,
  name,
  value,
  onChange,
  placeholder = "Search for a city",
  required = false,
  disabled = false,
}: {
  id: string;
  name?: string;
  value: SelectedCity;
  // Optional -- a Server Component (e.g. Home's hero search bar, an
  // uncontrolled native-GET <form>) can't pass a function prop across the
  // RSC boundary at all, so this needs a default rather than being
  // required; every client-side caller still passes a real handler.
  onChange?: (city: SelectedCity) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  // Tracks the selected city's id independently of the `value` prop, so the
  // hidden <input> below still submits the right id for an *uncontrolled*
  // caller (no onChange, e.g. Home's hero search bar -- a Server Component
  // can't hand this a state setter to update `value` with). A controlled
  // caller's `value` prop still drives the visible text via the effect
  // below; this just also has to drive the hidden input for the
  // uncontrolled case.
  const [selectedId, setSelectedId] = useState(value?.id ?? "");
  const [results, setResults] = useState<CityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps the visible text in sync when `value` changes from OUTSIDE this
  // component (e.g. an edit page's initial city arriving after an async
  // fetch, or a parent clearing the field).
  useEffect(() => {
    setQuery(value?.name ?? "");
    setSelectedId(value?.id ?? "");
  }, [value?.id, value?.name]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Skip fetching when the query still matches the currently-selected
    // city's name -- otherwise selecting a result (which sets query via
    // the effect above) would immediately refire a search and reopen the
    // dropdown right after picking something.
    if (query.trim().length < MIN_QUERY_LENGTH || query === value?.name) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/cities/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => (res.ok ? res.json() : { cities: [] }))
        .then((body: { cities: CityResult[] }) => {
          setResults(body.cities);
          setOpen(true);
          setHighlightedIndex(-1);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectCity(city: CityResult) {
    onChange?.(city);
    setQuery(city.name);
    setSelectedId(city.id);
    setOpen(false);
    setResults([]);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    // Typing invalidates any prior selection right away, so a form can
    // never submit a stale city id alongside text that no longer matches.
    if (selectedId) {
      setSelectedId("");
      onChange?.(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        selectCity(results[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="city-autocomplete" ref={containerRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {name && <input type="hidden" name={name} value={selectedId} />}
      {open && (
        <ul id={`${id}-listbox`} role="listbox" className="city-autocomplete-menu">
          {loading && <li className="city-autocomplete-empty">Searching…</li>}
          {!loading && results.length === 0 && (
            <li className="city-autocomplete-empty">No matching cities</li>
          )}
          {results.map((city, i) => (
            <li
              key={city.id}
              role="option"
              aria-selected={i === highlightedIndex}
              className={
                i === highlightedIndex
                  ? "city-autocomplete-option city-autocomplete-option-active"
                  : "city-autocomplete-option"
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectCity(city)}
            >
              {city.name} <span className="city-autocomplete-region">{city.regionName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
