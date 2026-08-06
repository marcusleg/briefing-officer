import { languageDisplayName, normalizeLanguage } from "@/lib/language";
import { describe, expect, it } from "vitest";

describe("normalizeLanguage", () => {
  it("accepts a two-letter ISO 639-1 code", () => {
    expect(normalizeLanguage("de")).toBe("de");
    expect(normalizeLanguage("en")).toBe("en");
  });

  it("reduces a regional tag to its primary subtag", () => {
    // Engines and models disagree on the separator.
    expect(normalizeLanguage("de-DE")).toBe("de");
    expect(normalizeLanguage("de_DE")).toBe("de");
    expect(normalizeLanguage("pt-BR")).toBe("pt");
  });

  it("lowercases and trims", () => {
    expect(normalizeLanguage("DE")).toBe("de");
    expect(normalizeLanguage("  de  ")).toBe("de");
  });

  it("rejects the undetermined sentinel", () => {
    // Load-bearing: Intl.DisplayNames.of("und") returns "root", so the
    // recognition check does NOT catch it. Only the two-letter rule does.
    expect(normalizeLanguage("und")).toBeNull();
  });

  it("rejects ISO 639-2 codes", () => {
    // Load-bearing for the same reason: .of("deu") returns "German".
    expect(normalizeLanguage("deu")).toBeNull();
    expect(normalizeLanguage("ger")).toBeNull();
  });

  it("rejects language names and unrecognised codes", () => {
    expect(normalizeLanguage("German")).toBeNull();
    expect(normalizeLanguage("xx")).toBeNull();
    expect(normalizeLanguage("un")).toBeNull();
  });

  it("rejects empty and missing values without throwing", () => {
    // Intl.DisplayNames.of("") throws a RangeError, so the shape check has to
    // run first.
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage("   ")).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });
});

describe("languageDisplayName", () => {
  it("names a language in English", () => {
    expect(languageDisplayName("de")).toBe("German");
    expect(languageDisplayName("fr")).toBe("French");
  });

  it("falls back to English when no language was established", () => {
    expect(languageDisplayName(null)).toBe("English");
  });
});
