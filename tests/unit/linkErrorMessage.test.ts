import { linkErrorMessage } from "@/app/settings/link-error";
import { describe, expect, it } from "vitest";

describe("linkErrorMessage", () => {
  it("returns undefined without an error", () => {
    expect(linkErrorMessage(undefined, "ignored", "Authentik")).toBeUndefined();
  });

  it("explains an email mismatch", () => {
    expect(
      linkErrorMessage("email_does_not_match", undefined, "Authentik"),
    ).toBe(
      "Your Authentik account uses a different email address than this account.",
    );
  });

  it("explains an account linked to another user", () => {
    expect(
      linkErrorMessage(
        "account_already_linked_to_different_user",
        undefined,
        "Authentik",
      ),
    ).toBe("That Authentik account is already connected to a different user.");
  });

  it("falls back to the description for unknown codes", () => {
    expect(linkErrorMessage("boom", "Something broke", "Authentik")).toBe(
      "Could not connect your Authentik account: Something broke",
    );
  });

  it("falls back to the code without a description", () => {
    expect(linkErrorMessage("boom", undefined, "Authentik")).toBe(
      "Could not connect your Authentik account: boom",
    );
  });
});
