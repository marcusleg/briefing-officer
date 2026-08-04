import ReadAloudButton from "@/components/article/read-aloud-button";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeUtterance,
  installSpeechEngine,
} from "../../helpers/speech-synthesis";

afterEach(() => vi.unstubAllGlobals());

describe("ReadAloudButton", () => {
  it("speaks the title followed by the lead", async () => {
    const speechSynthesis = installSpeechEngine();
    render(
      <ReadAloudButton
        title="Kernel 7.2 removes strncpy"
        text="It landed after 362 patches."
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /read aloud/i }),
    );

    expect(speechSynthesis.speak).toHaveBeenCalledOnce();
    const utterance = speechSynthesis.speak.mock
      .calls[0][0] as unknown as FakeUtterance;
    expect(utterance.text).toBe(
      "Kernel 7.2 removes strncpy. It landed after 362 patches.",
    );
  });

  it("stops playback when clicked a second time", async () => {
    const speechSynthesis = installSpeechEngine();
    render(<ReadAloudButton title="A title" text="A lead." />);

    await userEvent.click(
      await screen.findByRole("button", { name: /read aloud/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /stop reading/i }),
    );

    // speak() cancels once to clear the queue; stopping cancels again.
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /read aloud/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing when the browser has no speech engine", () => {
    const { container } = render(
      <ReadAloudButton title="A title" text="A lead." />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no voices are installed", async () => {
    installSpeechEngine([]);
    const { container } = render(
      <ReadAloudButton title="A title" text="A lead." />,
    );

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
