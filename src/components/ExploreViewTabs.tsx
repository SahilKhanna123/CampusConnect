"use client";

import { useRouter } from "next/navigation";

export type ExploreView = "all" | "rides" | "packages";

// Explore's category switcher -- "packages" is the default (both the value
// this page falls back to when `view` is absent from the URL, and the tab
// this component never writes into the URL, matching the "only show what's
// non-default" convention `page` already uses). Deliberately a client
// component using router.replace(), the same fix already applied to
// ExploreFilters' own "Clear filters" button -- a plain <Link> here would
// hit the exact same confirmed-broken prefetch-cache bug (Next reusing a
// stale RSC payload for a URL that was prefetched while a filter was still
// active).
export function ExploreViewTabs({
  activeView,
  originCityId,
  destinationCityId,
  date,
}: {
  activeView: ExploreView;
  originCityId?: string;
  destinationCityId?: string;
  date?: string;
}) {
  const router = useRouter();

  // Preserves Origin/Destination/Date across a tab switch (those filters
  // apply equally to rides and packages), but deliberately drops `page` --
  // same "changing what you're browsing resets pagination" convention
  // filter changes already follow.
  function go(view: ExploreView) {
    const params = new URLSearchParams();
    if (originCityId) params.set("originCityId", originCityId);
    if (destinationCityId) params.set("destinationCityId", destinationCityId);
    if (date) params.set("date", date);
    if (view !== "packages") params.set("view", view);
    const query = params.toString();
    router.replace(query ? `/explore?${query}` : "/explore");
  }

  const tabs: { value: ExploreView; label: string }[] = [
    { value: "all", label: "All" },
    { value: "rides", label: "Rides" },
    { value: "packages", label: "Packages" },
  ];

  return (
    <div className="subtabs" role="tablist" aria-label="Explore category">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={activeView === tab.value}
          onClick={() => go(tab.value)}
          className={activeView === tab.value ? "subtab subtab-active" : "subtab"}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
