import { describe, it, expect } from "vitest";
import { escapeHtml } from "./email";

describe("escapeHtml", () => {
  it("escapes each special character individually", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("escapes a full malicious payload so it can't render as a link", () => {
    expect(escapeHtml('<a href="evil">Accept</a>')).toBe(
      "&lt;a href=&quot;evil&quot;&gt;Accept&lt;/a&gt;",
    );
  });

  it("leaves a plain string with no special characters unchanged", () => {
    expect(escapeHtml("Jordan Smith")).toBe("Jordan Smith");
  });

  it("handles an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes ampersands first so it never double-escapes its own output", () => {
    // e.g. a name containing a literal "&lt;" should become "&amp;lt;", not
    // "&lt;lt;" -- this only holds if `&` is replaced before `<`/`>`.
    expect(escapeHtml("&lt;script&gt;")).toBe("&amp;lt;script&amp;gt;");
  });
});
