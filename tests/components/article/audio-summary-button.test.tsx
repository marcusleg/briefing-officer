import AudioSummaryButton from "@/components/article/audio-summary-button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AudioSummaryButton", () => {
  it("links to the audio summary page for the article", () => {
    render(<AudioSummaryButton feedId={7} articleId={42} />);

    const link = screen.getByRole("link", { name: /audio summary/i });
    expect(link).toHaveAttribute("href", "/feed/7/article/42/audio-summary");
  });
});
