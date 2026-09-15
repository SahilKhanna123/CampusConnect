"use client";

import { useRouter } from "next/navigation";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };

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
export function ExploreFilters({
  citiesByRegion,
  originCityId,
  destinationCityId,
  date,
  hasActiveFilter,
  view,
}: {
  citiesByRegion: CityGroup[];
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

  function handleChange(e: React.ChangeEvent<HTMLFormElement>) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget).entries()) {
      if (value) params.set(key, value.toString());
    }
    const query = params.toString();
    router.replace(query ? `/explore?${query}` : "/explore");
  }

  // Every field below is an uncontrolled input (defaultValue, not value) --
  // deliberately, so typing/selecting doesn't need controlled state for
  // four fields just to submit them via FormData on change. The tradeoff:
  // React only applies defaultValue on a field's *initial* mount, never on
  // a later re-render -- so when the URL's filters change from *outside*
  // this component's own onChange (e.g. "Clear filters" navigating to a
  // bare /explore, or the browser back/forward buttons), the already-
  // mounted <select>/<input> elements silently keep showing their old
  // selections even though the page's actual results correctly updated.
  // Confirmed live: clicking "Clear filters" removed the query string and
  // the button itself correctly disappeared, but the Origin dropdown kept
  // showing the old city. Keying the form on the current filter values
  // forces React to remount it (and every field inside) fresh whenever
  // they change for any reason, which is what actually resets the visible
  // selections back to the new defaultValue.
  const formKey = `${originCityId ?? ""}-${destinationCityId ?? ""}-${date ?? ""}-${view}`;

  return (
    <form key={formKey} method="get" className="explore-filters" onChange={handleChange}>
      {view !== "packages" && <input type="hidden" name="view" value={view} />}
      <div>
        <label htmlFor="originCityId">Origin</label>
        <select id="originCityId" name="originCityId" defaultValue={originCityId ?? ""}>
          <option value="">Any origin</option>
          {citiesByRegion.map((group) => (
            <optgroup key={group.regionName} label={group.regionName}>
              {group.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="destinationCityId">Destination</label>
        <select
          id="destinationCityId"
          name="destinationCityId"
          defaultValue={destinationCityId ?? ""}
        >
          <option value="">Any destination</option>
          {citiesByRegion.map((group) => (
            <optgroup key={group.regionName} label={group.regionName}>
              {group.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
