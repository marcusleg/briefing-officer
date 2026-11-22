import AudioBriefingButton from "@/components/article/audio-briefing-button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AudioBriefingButton", () => {
  it("links to the audio briefing page for the article", () => {
    render(<AudioBriefingButton feedId={7} articleId={42} />);

    const link = screen.getByRole("link", { name: /audio briefing/i });
    expect(link).toHaveAttribute("href", "/feed/7/article/42/audio-briefing");
  });
});
