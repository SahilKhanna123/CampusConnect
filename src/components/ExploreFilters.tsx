"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CityAutocomplete, type SelectedCity } from "./CityAutocomplete";

// Explore's filter bar -- auto-submits the moment any field changes instead
// of requiring an explicit "Apply filters" click, per product decision (the
// old two-step apply/clear flow felt dated). Uses router.replace() with a
// query string built from the form's own current values (via FormData, keyed
// off each field's existing name attribute) rather than a native GET form
// submit -- a native submit is a full browser navigation (page flash, full
// reload of every script), whereas router.replace() is Next's client-side
// transition: it re-fetches ExplorePage's server-rendered output for the new
// URL without reloading the page. replace() (not push()) so tweaking filters
// doesn't pile up a back-button entry per keystroke/selection. A single
// onChange on the <form> itself (not one per field) catches every field's
// change event via React's normal event bubbling, so this stays one small
// client-only island rather than needing per-field handlers or controlled
// state for every input.
//
// Origin/Destination are CityAutocomplete now (search-as-you-type over the
// full, no-longer-small city list -- see CityAutocomplete.tsx), which is a
// controlled component: selecting a city updates it via onChange, not a
// bubbling native "change" event the form-level handler above can read off
// FormData the same way it reads the plain <input type="date">. So those two
// fields get their own state + their own direct router.replace() on
// selection, built with the same param logic as everywhere else in this
// file (handleChange/"Clear filters"). Each still renders a hidden
// name="..." input (via CityAutocomplete's `name` prop) so the shared
// handleChange below keeps including the current city ids when some *other*
// field (date) changes.
export function ExploreFilters({
  initialOriginCity,
  initialDestinationCity,
  originCityId,
  destinationCityId,
  date,
  hasActiveFilter,
  view,
}: {
  initialOriginCity: SelectedCity;
  initialDestinationCity: SelectedCity;
  originCityId?: string;
  destinationCityId?: string;
  date?: string;
  hasActiveFilter: boolean;
  // "packages" is the default view (see ExploreViewTabs) and is never
  // written into the URL, so it's passed through as a hidden field only
  // when non-default -- otherwise a filter change here would silently drop
  // an explicit ?view=rides/all back to the default.
  view: "all" | "rides" | "packages";
}) {
  const router = useRouter();
  const [originCity, setOriginCity] = useState<SelectedCity>(initialOriginCity);
  const [destinationCity, setDestinationCity] = useState<SelectedCity>(initialDestinationCity);

  function handleChange(e: React.ChangeEvent<HTMLFormElement>) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget).entries()) {
      if (value) params.set(key, value.toString());
    }
    const query = params.toString();
    router.replace(query ? `/explore?${query}` : "/explore");
  }

  // Mirrors handleChange's param-building, but driven directly from state
  // (origin/destination) plus the current `date`/`view` props, since a
  // CityAutocomplete selection doesn't hand us a form to read FormData off.
  function navigateWithCities(nextOrigin: SelectedCity, nextDestination: SelectedCity) {
    const params = new URLSearchParams();
    if (nextOrigin) params.set("originCityId", nextOrigin.id);
    if (nextDestination) params.set("destinationCityId", nextDestination.id);
    if (date) params.set("date", date);
    if (view !== "packages") params.set("view", view);
    const query = params.toString();
    router.replace(query ? `/explore?${query}` : "/explore");
  }

  // The date field below is an uncontrolled input (defaultValue, not
  // value) -- deliberately, so typing doesn't need controlled state just to
  // submit it via FormData on change. The tradeoff: React only applies
  // defaultValue on a field's *initial* mount, never on a later re-render --
  // so when the URL's filters change from *outside* this component's own
  // onChange (e.g. "Clear filters" navigating to a bare /explore, or the
  // browser back/forward buttons), the already-mounted <input> would
  // silently keep showing its old value even though the page's actual
  // results correctly updated. Confirmed live: clicking "Clear filters"
  // removed the query string and the button itself correctly disappeared,
  // but the Origin dropdown (a <select> at the time) kept showing the old
  // city. Keying the form on the current filter values forces React to
  // remount it (and every field inside, origin/destination's controlled
  // state included -- their useState above only takes its initial value
  // from initialOriginCity/initialDestinationCity on mount) fresh whenever
  // they change for any reason, which is what actually resets the visible
  // selections back to the current filters.
  const formKey = `${originCityId ?? ""}-${destinationCityId ?? ""}-${date ?? ""}-${view}`;

  return (
    <form key={formKey} method="get" className="explore-filters" onChange={handleChange}>
      {view !== "packages" && <input type="hidden" name="view" value={view} />}
      <div>
        <label htmlFor="originCityId">Origin</label>
        <CityAutocomplete
          id="originCityId"
          name="originCityId"
          value={originCity}
          onChange={(city) => {
            setOriginCity(city);
            navigateWithCities(city, destinationCity);
          }}
          placeholder="Any origin"
        />
      </div>
      <div>
        <label htmlFor="destinationCityId">Destination</label>
        <CityAutocomplete
          id="destinationCityId"
          name="destinationCityId"
          value={destinationCity}
          onChange={(city) => {
            setDestinationCity(city);
            navigateWithCities(originCity, city);
          }}
          placeholder="Any destination"
        />
      </div>
      <div>
        <label htmlFor="date">Date</label>
        <input id="date" type="date" name="date" defaultValue={date ?? ""} />
      </div>
      {hasActiveFilter && (
        <div>
          {/* A plain <Link href="/explore"> here would let Next's
              viewport-prefetch cache the RSC payload for that URL while a
              filter was still active, then reuse that stale render on
              click instead of the correct, freshly-empty result set --
              confirmed live (URL changed, but the filter bar and results
              didn't). router.replace() -- the same call every other filter
              change in this component already uses -- always goes through
              a real navigation instead of a cached prefetch. Preserves the
              active view (clearing filters shouldn't also kick the viewer
              out of the section they're browsing).
          */}
          <button
            type="button"
            onClick={() =>
              router.replace(view === "packages" ? "/explore" : `/explore?view=${view}`)
            }
            className="btn-secondary"
          >
            Clear filters
          </button>
        </div>
      )}
    </form>
  );
}
