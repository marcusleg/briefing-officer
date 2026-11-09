import { describeDevice } from "@/app/settings/device";
import { describe, expect, it } from "vitest";

const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

describe("describeDevice", () => {
  it.each([
    [FIREFOX_LINUX, "Firefox on Linux", false],
    [IPHONE, "Safari on iOS", true],
    [IPAD, "Safari on iOS", true],
    [CHROME_WINDOWS, "Chrome on Windows", false],
    ["Mozilla/5.0 (X11; Linux x86_64)", "Linux", false],
    ["okhttp/4.12.0", "Unknown device", false],
    ["", "Unknown device", false],
    [null, "Unknown device", false],
    [undefined, "Unknown device", false],
  ])("describes %s", (userAgent, label, isMobile) => {
    expect(describeDevice(userAgent)).toEqual({ label, isMobile });
  });
});
