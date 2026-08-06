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
      yield "Published at Hacker News, written by Jane Doe.\n";
      yield "It landed after 362 patches.\n";
      yield "Maintainers had warned for years.";
    },
  })),
}));

// The title is spoken from code, so it leads the playback queue while being
// absent from the transcript.
const SPOKEN_TITLE = "Kernel 7.2 removes strncpy.";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const props = {
  articleId: 42,
  language: "en",
  title: "Kernel 7.2 removes strncpy",
};

describe("AudioSummaryPlayer", () => {
  it("speaks the title at mount, before the model has returned anything", () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    // Synchronous with render: the title needs no generation, so audio starts
    // without waiting on the model's first token.
    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      SPOKEN_TITLE,
    ]);
  });

  it("terminates the spoken title so it does not run into the next sentence", () => {
    const engine = installSpeechEngine();

    render(
      <AudioSummaryPlayer title="Is Rust dead?" articleId={42} language="en" />,
    );

    expect(engine.spoken()[0].text).toBe("Is Rust dead?");
  });

  it("keeps the title out of the transcript", async () => {
    installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    // The page heading above the player already shows it.
    await screen.findByText(/It landed after 362 patches\./);
    expect(screen.queryByText(SPOKEN_TITLE)).not.toBeInTheDocument();
  });

  it("speaks each generated sentence as it streams in", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);

    await waitFor(() =>
      expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
        SPOKEN_TITLE,
        "Published at Hacker News, written by Jane Doe.",
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
    await waitFor(() => expect(engine.spoken()).toHaveLength(4));

    // Playback index 2 is transcript index 1: the spoken title occupies
    // playback index 0 and is not displayed.
    engine.spoken()[2].onstart!();

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

  it("restarts from the spoken title", async () => {
    const engine = installSpeechEngine();

    render(<AudioSummaryPlayer {...props} />);
    await waitFor(() => expect(engine.spoken()).toHaveLength(4));

    await userEvent.click(screen.getByRole("button", { name: /restart/i }));

    const respoken = engine.spoken().slice(4);
    expect(respoken[0].text).toBe(SPOKEN_TITLE);
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

  it("explains itself when generation fails", async () => {
    installSpeechEngine();
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
  });

  it("speaks each sentence exactly once under Strict Mode", async () => {
    window.localStorage.setItem("briefing-officer:speech-rate", "1.5");
    const engine = installSpeechEngine();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...props} />
      </React.StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("1.5×")).toBeInTheDocument());
    await waitFor(() =>
      expect(engine.spoken().length).toBeGreaterThanOrEqual(4),
    );

    // Count only utterances queued after the last cancel: the fake's cancel()
    // does not discard queued utterances the way a real engine does, so
    // spoken() also contains ones that were cancelled before making a sound.
    const lastCancel = Math.max(0, ...engine.cancel.mock.invocationCallOrder);
    const live = engine.speak.mock.calls
      .filter(
        (_, index) => engine.speak.mock.invocationCallOrder[index] > lastCancel,
      )
      .map((call) => (call[0] as unknown as { text: string }).text);

    expect(live).toEqual([
      SPOKEN_TITLE,
      "Published at Hacker News, written by Jane Doe.",
      "It landed after 362 patches.",
      "Maintainers had warned for years.",
    ]);
    expect(engine.spoken().at(-1)!.rate).toBe(1.5);
  });

  it("still speaks the briefing after Strict Mode's cleanup cancels playback", async () => {
    const engine = installSpeechEngine();

    render(
      <React.StrictMode>
        <AudioSummaryPlayer {...props} />
      </React.StrictMode>,
    );

    // The cleanup between Strict Mode's two mount passes cancels playback via
    // the hook's unmount effect. Without the remount branch's replay, playback
    // stays dead and nothing reaches the engine afterwards.
    //
    // Asserting on ordering rather than on spoken() is deliberate: the fake's
    // cancel() does not discard queued utterances the way a real engine does,
    // so spoken() alone cannot tell a live utterance from a cancelled one.
    await waitFor(() =>
      expect(engine.spoken().length).toBeGreaterThanOrEqual(4),
    );

    const lastCancel = Math.max(...engine.cancel.mock.invocationCallOrder);
    const spokenAfterCancel = engine.speak.mock.calls.some(
      (call, index) =>
        (call[0] as unknown as { text: string }).text.startsWith(
          "Kernel 7.2 removes strncpy",
        ) && engine.speak.mock.invocationCallOrder[index] > lastCancel,
    );
    expect(spokenAfterCancel).toBe(true);
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
            yield "First sentence here.\n";
            await gate;
            yield "Late sentence arrives.\n";
          },
        }) as never,
    );

    // Two: the spoken title, then the stream's first sentence.
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

  it("warns when no voice matches the article's language", async () => {
    installSpeechEngine([{ name: "Test Voice", lang: "en-US" }]);

    render(<AudioSummaryPlayer {...props} language="de" />);

    expect(await screen.findByText(/no German voice/i)).toBeInTheDocument();
    // The reader can still play it, knowing it will be mispronounced.
    expect(screen.getByRole("button", { name: /pause|play/i })).toBeEnabled();
  });
});
