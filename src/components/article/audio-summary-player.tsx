"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { streamAudioScript } from "@/lib/ai/services/audioScriptService";
import { splitIntoSentences, spokenTitle } from "@/lib/audio-script";
import { languageDisplayName } from "@/lib/language";
import { readStreamableValue } from "@ai-sdk/rsc";
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

const RATE_STORAGE_KEY = "briefing-officer:speech-rate";
const SPEECH_RATES = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 2];

// The menu identifies its options by string, and localStorage stores one too,
// so both go through the same formatting the label uses. 1 and 2 become "1.0"
// and "2.0" rather than "1" and "2", which keeps the selected option matching.
const formatRate = (value: number) => value.toFixed(1);

interface AudioSummaryPlayerProps {
  articleId: number;
  language: string | null;
  title: string;
}

const AudioSummaryPlayer = (props: AudioSummaryPlayerProps) => {
  const {
    activeIndex,
    enqueue,
    pause,
    paused,
    playFrom,
    rate,
    resume,
    setRate,
    speaking,
    supported,
    voiceAvailable,
  } = useSpeechSynthesis(props.language);
  // The hook keeps its own copy of the sentences for playback, but that copy is
  // a ref and cannot drive rendering. This one is for display.
  const [sentences, setSentences] = useState<string[]>([]);
  const [generationFailed, setGenerationFailed] = useState(false);
  const initialized = useRef(false);
  // Set by the streaming effect's cleanup so the in-flight `for await` loop
  // stops feeding the speech engine once this instance is torn down. See the
  // comment where it is reset, inside the effect.
  const cancelled = useRef(false);

  // Read the saved rate in an effect rather than during render, so the server
  // and the first client render agree on the 1.0x default.
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
    // Only a value the menu can still represent is restored. A rate saved by
    // the old slider, which allowed anything from 0.5 to 2.0 in steps of 0.1,
    // is dropped in favour of the 1.0x default rather than showing up as a
    // speed with no matching option.
    if (SPEECH_RATES.includes(stored)) {
      setRate(stored);
    }
  }, [setRate]);

  useEffect(() => {
    // Guards the `for await` loop below: once the effect is torn down
    // (real unmount, or Strict Mode's cleanup-then-resetup cycle), the loop
    // itself keeps running to completion — a for-await over an async
    // generator has no way to know its caller went away. Without this flag,
    // append() would keep pushing into the shared speechSynthesis singleton
    // after the component that owns it is gone, including into whatever
    // article's player mounts next.
    //
    // Reset on every run of the effect body, not just at declaration: Strict
    // Mode re-runs this effect after its cleanup fires, and a latched flag
    // would permanently disable append() for the remounted instance, silencing
    // every streamed sentence for good.
    cancelled.current = false;

    if (initialized.current) {
      // Strict Mode double-invokes mount effects in development, and the
      // cleanup between the two runs cancels playback through the hook's
      // unmount effect — which calls speechSynthesis.cancel() directly,
      // leaving the engine's paused flag latched. playFrom() is what clears
      // it, via its explicit resume(); without this replay every later
      // utterance would be handed to an engine that stays silent. Every
      // sentence is still retained by the hook, so replaying costs nothing
      // and generates nothing.
      playFrom(0);
      return () => {
        cancelled.current = true;
      }; // Prevent multiple streams
    }
    initialized.current = true;

    const append = (sentence: string) => {
      if (cancelled.current) return;
      setSentences((current) => [...current, sentence]);
      enqueue(sentence);
    };

    // The title needs no generation, so playback starts the moment the page
    // opens rather than waiting on the model's first token — and the headline
    // is spoken exactly as written instead of however the model paraphrased
    // it. Enqueued directly rather than through append(): the transcript
    // covers the generated briefing only, since the page heading right above
    // already shows the title. That offset is undone where sentences render.
    enqueue(spokenTitle(props.title));
    playFrom(0);

    const streamScript = async () => {
      try {
        const { output } = await streamAudioScript(props.articleId);

        let buffer = "";
        for await (const delta of readStreamableValue(output)) {
          buffer += delta ?? "";
          const { sentences: complete, remainder } = splitIntoSentences(buffer);
          buffer = remainder;
          complete.forEach(append);
        }

        // A stream often ends without a trailing newline, so whatever is left
        // is spoken as a final sentence.
        if (buffer.trim()) {
          append(buffer.trim());
        }
      } catch {
        // Whatever already streamed keeps playing — only the rest of the
        // script failed to arrive. Surface that without touching playback.
        //
        // Known cosmetic gap: if this throws before any sentence has
        // arrived, nothing was ever queued, so the hook's handleDone never
        // runs and `speaking` stays true — the button reads "Pause" forever
        // beside the "Briefing incomplete" alert. Not worth an unconditional
        // cancel() here, since that would also cut off sentences that did
        // stream successfully before the failure.
        setGenerationFailed(true);
      }
    };

    void streamScript();

    return () => {
      cancelled.current = true;
    };
    // Guarded by initialized.current above, so this effect behaves as a
    // mount-only effect despite the honest dependency array.
  }, [props.articleId, props.title, enqueue, playFrom]);

  const togglePlayback = () => {
    if (paused) return resume();
    if (speaking) return pause();
    playFrom(0);
  };

  const changeRate = (value: string) => {
    const next = Number(value);
    setRate(next);
    window.localStorage.setItem(RATE_STORAGE_KEY, value);
  };

  const playing = speaking && !paused;

  return (
    <div className="flex flex-col gap-6">
      {!supported && (
        <Alert>
          <AlertTitle>Playback unavailable</AlertTitle>
          <AlertDescription>
            This browser has no speech voices installed, so the briefing cannot
            be read aloud. The transcript below is still generated.
          </AlertDescription>
        </Alert>
      )}

      {supported && !voiceAvailable && (
        <Alert>
          <AlertTitle>Voice unavailable</AlertTitle>
          <AlertDescription>
            No {languageDisplayName(props.language)} voice is installed in this
            browser, so the briefing will be read with the default voice and
            pronounced incorrectly. The transcript below is unaffected.
          </AlertDescription>
        </Alert>
      )}

      {generationFailed && (
        <Alert>
          <AlertTitle>Briefing incomplete</AlertTitle>
          <AlertDescription>
            The rest of this summary could not be generated. What was written is
            shown below.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-4 border-b pb-4">
        <Button
          variant="secondary"
          size="icon"
          className="cursor-pointer"
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlayback}
          disabled={!supported}
        >
          {playing ? (
            <PauseIcon className="size-4 fill-current" />
          ) : (
            <PlayIcon className="size-4 fill-current" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          aria-label="Restart"
          onClick={() => playFrom(0)}
          disabled={!supported}
        >
          <RotateCcwIcon className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="cursor-pointer tabular-nums"
              // Deliberately not "Playback speed": the accessible name would
              // then start with the same word as the Play button beside it,
              // leaving two adjacent controls a screen reader announces
              // near-identically. The menu it opens is headed "Playback Speed".
              aria-label={`Speed: ${formatRate(rate)}×`}
              disabled={!supported}
            >
              {formatRate(rate)}×
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={formatRate(rate)}
              onValueChange={changeRate}
            >
              {SPEECH_RATES.map((option) => (
                <DropdownMenuRadioItem
                  key={option}
                  value={formatRate(option)}
                  className="cursor-pointer tabular-nums"
                >
                  {formatRate(option)}×
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* One block per sentence, so the line structure the model emits
          survives to the page instead of being reflowed into a paragraph. */}
      <div className="leading-loose text-pretty">
        {sentences.map((sentence, index) => (
          <p
            key={index}
            // The hook also retains the spoken title at playback index 0,
            // which the transcript omits, so display index i is playback
            // index i + 1.
            data-active={index + 1 === activeIndex}
            className="data-[active=true]:bg-primary/15 rounded transition-colors"
          >
            {sentence}
          </p>
        ))}
      </div>
    </div>
  );
};

export default AudioSummaryPlayer;
