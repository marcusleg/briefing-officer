import AudioSummaryPlayer from "@/components/article/audio-summary-player";
import { readStreamableValue } from "@ai-sdk/rsc";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSpeechEngine } from "../../helpers/speech-synthesis";

vi.mock("@/lib/ai/services/audioScriptService", () => ({
  streamAudioScript: vi.fn().mockResolvedValue({ output: "streamable" }),
}));

vi.mock("@ai-sdk/rsc", () => ({
  readStreamableValue: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield "It landed after 362 patches. ";
      yield "Maintainers had warned for years.";
    },
  })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const props = {
  articleId: 42,
  title: "Kernel 7.2 removes strncpy",
  author: "Jane Doe",
  feedTitle: "Hacker News",
};

describe("AudioSummaryPlayer", () => {
  it("speaks the constructed opening before any generated text arrives", () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    expect(engine.spoken()[0].text).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("speaks each generated sentence as it streams in", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() =>
      expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
        "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
        "It landed after 362 patches.",
        "Maintainers had warned for years.",
      ]),
    );
  });

  it("renders the transcript as it arrives", async () => {
    installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    expect(
      await screen.findByText(/It landed after 362 patches\./),
    ).toBeInTheDocument();
  });

  it("highlights the sentence the engine reports as started", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(3));

    engine.spoken()[1].onstart!();

    await waitFor(() =>
      expect(screen.getByText(/It landed after 362 patches\./)).toHaveAttribute(
        "data-active",
        "true",
      ),
    );
  });

  it("pauses and resumes playback", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(engine.pause).toHaveBeenCalledOnce();

    // playFrom() calls resume() defensively at mount, since cancel() leaves the
    // engine's paused flag latched. Clear it so this asserts the Play click
    // alone rather than counting playFrom's internals.
    engine.resume.mockClear();

    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(engine.resume).toHaveBeenCalledOnce();
  });

  it("restarts from the first sentence", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(3));

    await userEvent.click(screen.getByRole("button", { name: /restart/i }));

    const respoken = engine.spoken().slice(3);
    expect(respoken[0].text).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("restores a saved rate and applies it to speech", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "1.5");
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() => expect(screen.getByText("1.5×")).toBeInTheDocument());
    await waitFor(() => expect(engine.spoken().at(-1)!.rate).toBe(1.5));
  });

  it("ignores a stored rate outside the supported range", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "9");
    installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() => expect(screen.getByText("1.0×")).toBeInTheDocument());
  });

  it("tells the reader when the browser has no speech voices", async () => {
    installSpeechEngine([]);

    render(<AudioSummaryPlayer {...props} />);

    expect(await screen.findByText(/no speech voices/i)).toBeInTheDocument();
    // The transcript still streams, so reading remains possible.
    expect(
      await screen.findByText(/It landed after 362 patches\./),
    ).toBeInTheDocument();
  });

  it("keeps the spoken opening and explains itself when generation fails", async () => {
    const engine = installSpeechEngine();
    vi.mocked(readStreamableValue).mockImplementationOnce(
      () =>
        ({
          async *[Symbol.asyncIterator]() {
            throw new Error("model unavailable");
          },
        }) as never,
    );

    render(<AudioSummaryPlayer {...props} />);

    expect(await screen.findByText(/briefing incomplete/i)).toBeInTheDocument();
    // The locally-built opening needs no model, so it still plays.
    expect(engine.spoken()[0].text).toBe(
      "Kernel 7.2 removes strncpy. Written by Jane Doe, from Hacker News.",
    );
  });

  it("applies a stored rate only once, despite Strict Mode double-invoking effects", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "1.5");
    const engine = installSpeechEngine();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...props} />
      </React.StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("1.5×")).toBeInTheDocument());
    // Re-applying the rate while playing would cancel and re-speak the queue,
    // so the opening line would be heard twice.
    //
    // Count only utterances queued after the last cancel: the fake's cancel()
    // does not discard queued utterances the way a real engine does, so
    // spoken() also contains ones that were cancelled before making a sound —
    // including the opening that Strict Mode's cleanup cancelled.
    const lastCancel = Math.max(0, ...engine.cancel.mock.invocationCallOrder);
    const liveOpenings = engine.speak.mock.calls.filter(
      (call, index) =>
        (call[0] as unknown as { text: string }).text.startsWith(
          "Kernel 7.2",
        ) && engine.speak.mock.invocationCallOrder[index] > lastCancel,
    );
    expect(liveOpenings).toHaveLength(1);
  });

  it("still speaks the opening after Strict Mode's cleanup cancels playback", async () => {
    const engine = installSpeechEngine();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...props} />
      </React.StrictMode>,
    );

    // The cleanup between Strict Mode's two mount passes cancels playback via
    // the hook's unmount effect. Without a replay on remount the opening is
    // silenced for good, because the initialized guard stops it being enqueued
    // a second time — losing the whole point of building it locally.
    //
    // Asserting on ordering rather than on spoken() is deliberate: the fake's
    // cancel() does not discard queued utterances the way a real engine does,
    // so spoken() alone cannot tell a live utterance from a cancelled one.
    // What matters is that the opening reaches the engine after the last
    // cancel, and so survives in the live queue.
    await waitFor(() => expect(engine.cancel).toHaveBeenCalled());

    const lastCancel = Math.max(...engine.cancel.mock.invocationCallOrder);
    const openingSpokenAfterCancel = engine.speak.mock.calls.some(
      (call, index) =>
        (call[0] as unknown as { text: string }).text.startsWith(
          "Kernel 7.2 removes strncpy. Written by Jane Doe",
        ) && engine.speak.mock.invocationCallOrder[index] > lastCancel,
    );
    expect(openingSpokenAfterCancel).toBe(true);
  });

  it("stops feeding the speech engine once the page unmounts", async () => {
    const engine = installSpeechEngine();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(readStreamableValue).mockImplementationOnce(
      () =>
        ({
          async *[Symbol.asyncIterator]() {
            yield "First sentence here. ";
            await gate;
            yield "Late sentence arrives. ";
          },
        }) as never,
    );

    const { unmount } = render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(2));

    unmount();
    const spokenBeforeRelease = engine.spoken().length;
    release!();
    // Give the detached loop a chance to deliver the late sentence.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The global speech engine is shared, so a sentence arriving after unmount
    // would play over whatever page the reader moved on to.
    expect(engine.spoken()).toHaveLength(spokenBeforeRelease);
  });

  it("explains itself instead of crashing when the API is missing entirely", async () => {
    // No installSpeechEngine() call: jsdom has no speechSynthesis at all, which
    // is different from an engine that reports zero voices.
    render(<AudioSummaryPlayer {...props} />);

    expect(await screen.findByText(/no speech voices/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/It landed after 362 patches\./),
    ).toBeInTheDocument();
  });
});
