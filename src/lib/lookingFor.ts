// Shared between the profile edit form (client), the PATCH /api/profile
// validator, and the public profile display (both server) -- reuses the
// Post page's own category vocabulary (Offer a Ride / Offer Package Space).
// The "Need a Ride"/"Need Delivery" options were removed along with the
// rest of the "Need" posting flow (see Trip Categories & Package Carrying
// in CLAUDE.md) -- offer-only here too, for consistency.
export const LOOKING_FOR_OPTIONS = [
  { value: "offer_ride", label: "Offer a Ride" },
  { value: "offer_package_space", label: "Offer Package Space" },
] as const;

export type LookingForValue = (typeof LOOKING_FOR_OPTIONS)[number]["value"];

const VALID_VALUES = new Set<string>(
  LOOKING_FOR_OPTIONS.map((o) => o.value),
);

export function isLookingForValue(value: string): value is LookingForValue {
  return VALID_VALUES.has(value);
}

export function lookingForLabel(value: string): string {
  return LOOKING_FOR_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
