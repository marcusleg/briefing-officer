import Bowser from "bowser";

const UNKNOWN_DEVICE = "Unknown device";

export function describeDevice(userAgent: string | null | undefined): {
  label: string;
  isMobile: boolean;
} {
  if (!userAgent) {
    return { label: UNKNOWN_DEVICE, isMobile: false };
  }

  const { browser, os, platform } = Bowser.parse(userAgent);

  // Bowser falls back to the first product token (e.g. "Mozilla") when it
  // does not recognise the browser.
  const browserName =
    browser.name && browser.name !== "Mozilla" ? browser.name : undefined;

  return {
    label:
      [browserName, os.name].filter(Boolean).join(" on ") || UNKNOWN_DEVICE,
    isMobile: platform.type === "mobile" || platform.type === "tablet",
  };
}
