import { ReadAloud, type SpeechEngine } from "@/components/chat/read-aloud";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudio, installServerSpeech } from "../../helpers/server-speech";
import { installSpeechEngine } from "../../helpers/speech-synthesis";
import { installStreamSpeech } from "../../helpers/stream-speech";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const ANSWER = "Alphabet rose. Analysts expected less.";

/** Holds the reading state the way Chat does, for a single answer. */
const Harness = ({
  engine,
  text = ANSWER,
}: {
  engine: SpeechEngine;
  text?: string;
}) => {
  const [reading, setReading] = useState(false);
  return (
    <ReadAloud
      engine={engine}
      text={text}
      reading={reading}
      onRead={() => setReading(true)}
      onReadEnd={() => setReading(false)}
    />
  );
};

/** Lets the fetch → blob → object URL chain run to completion. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const readAloud = () => screen.getByRole("button", { name: "Read aloud" });
const stopReading = () => screen.getByRole("button", { name: "Stop reading" });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("ReadAloud with the speech service", () => {
  it("reads the answer and stops on a second click", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());

    expect(speech.requested()).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);
    expect(speech.requests[0]).not.toHaveProperty("articleId");
    expect(screen.getByRole("status")).toBeInTheDocument();

    speech.requests[0].respond();
    await settle();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(stopReading());

    expect(readAloud()).toBeInTheDocument();
    expect(speech.requests[1].signal.aborted).toBe(true);
  });

  it("returns to idle once the answer has been read", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    speech.requests[0].respond();
    speech.requests[1].respond();
    await settle();
    act(() => speech.audio().finish());
    await settle();
    expect(stopReading()).toBeInTheDocument();
    act(() => speech.audio().finish());
    await settle();

    expect(readAloud()).toBeInTheDocument();
  });

  it("queues the sentences once under Strict Mode", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Harness engine="server" />
      </StrictMode>,
    );

    await user.click(readAloud());
    const live = () => speech.requests.filter((r) => !r.signal.aborted);
    expect(live().map((r) => r.text)).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);

    for (const request of live()) request.respond();
    await settle();
    act(() => speech.audio().finish());
    await settle();
    act(() => speech.audio().finish());
    await settle();

    expect(readAloud()).toBeInTheDocument();
  });

  it("shows a toast and returns to idle when a clip fails", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    speech.requests[0].fail();
    await settle();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "This answer could not be read aloud.",
      expect.anything(),
    );
    expect(readAloud()).toBeInTheDocument();
  });

  it("shows a toast and returns to idle when the browser blocks playback", async () => {
    const speech = installServerSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    FakeAudio.rejectNextPlay = "NotAllowedError";
    speech.requests[0].respond();
    await settle();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "This answer could not be read aloud.",
      expect.anything(),
    );
    expect(readAloud()).toBeInTheDocument();
  });

  it("does not watch the browser's voices", () => {
    const engine = installSpeechEngine();
    installServerSpeech();
    render(<Harness engine="server" />);

    expect(engine.addEventListener).not.toHaveBeenCalledWith(
      "voiceschanged",
      expect.anything(),
    );
  });

  it("renders nothing when the answer has nothing to read", () => {
    installServerSpeech();
    render(<Harness engine="server" text={"```\ncode\n```"} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ReadAloud with streamed speech", () => {
  it("returns to idle once the stream has played to its end", async () => {
    const speech = installStreamSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    await act(async () => {
      for (const request of speech.requests) request.respond();
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(speech.appended()).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);
    expect(stopReading()).toBeInTheDocument();

    act(() => speech.audio().playToEnd());

    expect(readAloud()).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps reading through a pause from outside the page", async () => {
    const speech = installStreamSpeech();
    const user = userEvent.setup();
    render(<Harness engine="server" />);

    await user.click(readAloud());
    await act(async () => {
      for (const request of speech.requests) request.respond();
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });

    // A headset button or the media notification pauses the element.
    act(() => speech.audio().pause());
    expect(stopReading()).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    await act(() => speech.audio().play());
    act(() => speech.audio().playToEnd());

    expect(readAloud()).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("ReadAloud with the browser's voices", () => {
  it("renders nothing without speechSynthesis", () => {
    render(<Harness engine="browser" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads the answer, stops on a second click and ends with the last sentence", async () => {
    const engine = installSpeechEngine();
    const user = userEvent.setup();
    render(<Harness engine="browser" />);

    await user.click(readAloud());
    expect(engine.spoken().map((utterance) => utterance.text)).toEqual([
      "Alphabet rose.",
      "Analysts expected less.",
    ]);
    expect(engine.spoken()[0].lang).toBe("en");

    await user.click(stopReading());
    // cancel() empties the engine's queue; playFrom also cancels, so the call
    // alone would prove nothing.
    expect(engine.spoken()).toEqual([]);
    expect(readAloud()).toBeInTheDocument();

    await user.click(readAloud());
    act(() => engine.spoken().at(-1)!.onend!());
    expect(readAloud()).toBeInTheDocument();
  });

  it("reads with the English voice", async () => {
    const english = { name: "Test Voice", lang: "en-US" };
    const engine = installSpeechEngine([
      { name: "Stimme", lang: "de-DE" },
      english,
    ]);
    const user = userEvent.setup();
    render(<Harness engine="browser" />);

    await user.click(readAloud());

    expect(engine.spoken()[0].voice).toBe(english);
  });

  it("renders nothing in a browser with no voices", () => {
    installSpeechEngine([]);
    render(<Harness engine="browser" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the button once the browser's voices load", () => {
    const voices: unknown[] = [];
    const engine = installSpeechEngine(voices);
    render(<Harness engine="browser" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    voices.push({ name: "Test Voice", lang: "en-US" });
    const [, onVoicesChanged] = engine.addEventListener.mock.calls.find(
      ([type]) => type === "voiceschanged",
    )!;
    act(() => onVoicesChanged());

    expect(readAloud()).toBeInTheDocument();
  });
});
