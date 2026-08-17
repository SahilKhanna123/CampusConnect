// Shared between the profile edit form (client), the PATCH /api/profile
// validator, and the public profile display (both server) -- reuses the
// Post page's own category vocabulary (Offer a Ride / Need a Ride / Offer
// Package Space / Need Delivery) rather than inventing new ones.
export const LOOKING_FOR_OPTIONS = [
  { value: "offer_ride", label: "Offer a Ride" },
  { value: "need_ride", label: "Need a Ride" },
  { value: "offer_package_space", label: "Offer Package Space" },
  { value: "need_delivery", label: "Need Delivery" },
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
