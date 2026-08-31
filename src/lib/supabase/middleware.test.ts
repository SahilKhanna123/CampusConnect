import { describe, it, expect } from "vitest";
import { shouldRedirectToParentLinkGate } from "./middleware";

const base = {
  isAuthenticated: true,
  isSignedUpAsParent: true,
  hasLinkedStudentFlag: false,
  isApiRoute: false,
  pathname: "/",
};

describe("shouldRedirectToParentLinkGate", () => {
  it("redirects an authenticated, not-yet-linked parent on an ordinary page", () => {
    expect(shouldRedirectToParentLinkGate(base)).toBe(true);
  });

  it("does not redirect an unauthenticated visitor", () => {
    expect(
      shouldRedirectToParentLinkGate({ ...base, isAuthenticated: false }),
    ).toBe(false);
  });

  it("does not redirect a non-parent (student/alumni/traveler) account", () => {
    expect(
      shouldRedirectToParentLinkGate({ ...base, isSignedUpAsParent: false }),
    ).toBe(false);
  });

  it("does not redirect a parent who has already linked a student", () => {
    expect(
      shouldRedirectToParentLinkGate({ ...base, hasLinkedStudentFlag: true }),
    ).toBe(false);
  });

  it("does not redirect API routes -- they have their own auth checks and return JSON", () => {
    expect(shouldRedirectToParentLinkGate({ ...base, isApiRoute: true })).toBe(
      false,
    );
  });

  it("does not redirect the connect-student wizard itself", () => {
    expect(
      shouldRedirectToParentLinkGate({
        ...base,
        pathname: "/family/connect-student",
      }),
    ).toBe(false);
  });

  it("does not redirect the invite-accept page", () => {
    expect(
      shouldRedirectToParentLinkGate({
        ...base,
        pathname: "/family/invite/accept",
      }),
    ).toBe(false);
  });
});
