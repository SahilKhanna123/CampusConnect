import { describe, it, expect } from "vitest";
import { isLookingForValue, lookingForLabel, LOOKING_FOR_OPTIONS } from "./lookingFor";

describe("isLookingForValue", () => {
  it("accepts every value actually listed in LOOKING_FOR_OPTIONS", () => {
    for (const option of LOOKING_FOR_OPTIONS) {
      expect(isLookingForValue(option.value)).toBe(true);
    }
  });

  it("rejects a value not in the list", () => {
    expect(isLookingForValue("not_a_real_option")).toBe(false);
    expect(isLookingForValue("")).toBe(false);
  });
});

describe("lookingForLabel", () => {
  it("returns the matching label for a known value", () => {
    expect(lookingForLabel("offer_ride")).toBe("Offer a Ride");
    expect(lookingForLabel("offer_package_space")).toBe("Offer Package Space");
  });

  it("falls back to echoing the raw value when it isn't recognized", () => {
    expect(lookingForLabel("something_unrecognized")).toBe("something_unrecognized");
  });
});
