"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { streamAudioScript } from "@/lib/ai/services/audioScriptService";
import { buildOpeningLine, splitIntoSentences } from "@/lib/audio-script";
import { readStreamableValue } from "@ai-sdk/rsc";
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const maxDuration = 30;

const RATE_STORAGE_KEY = "briefing-officer:speech-rate";
const MIN_RATE = 0.5;
const MAX_RATE = 2;

interface AudioSummaryPlayerProps {
  articleId: number;
  author: string | null | undefined;
  feedTitle: string;
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
  } = useSpeechSynthesis();
  // The hook keeps its own copy of the sentences for playback, but that copy is
  // a ref and cannot drive rendering. This one is for display.
  const [sentences, setSentences] = useState<string[]>([]);
  const [generationFailed, setGenerationFailed] = useState(false);
  const initialized = useRef(false);
  // Strict Mode double-invokes mount effects in development. setRate() calls
  // playFrom() when playback is already under way, so a second invocation of
  // this effect while the streaming effect's playFrom(0) is in flight would
  // cancel and re-speak the whole queue from the top. Guard with its own ref,
  // separate from `initialized`, so each effect's guard stays readable on its
  // own.
  const restoredRate = useRef(false);

  // Read the saved rate in an effect rather than during render, so the server
  // and the first client render agree on the 1.0x default.
  useEffect(() => {
    if (restoredRate.current) return;
    restoredRate.current = true;

    const stored = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
    if (stored >= MIN_RATE && stored <= MAX_RATE) {
      setRate(stored);
    }
  }, [setRate]);

  useEffect(() => {
    if (initialized.current) return; // Prevent multiple streams
    initialized.current = true;

    const append = (sentence: string) => {
      setSentences((current) => [...current, sentence]);
      enqueue(sentence);
    };

    // The opening needs no generation, so playback starts before the model has
    // returned anything — which also buys it a head start over the voice.
    append(buildOpeningLine(props.title, props.author, props.feedTitle));
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

        // A stream often ends without terminal punctuation, so whatever is left
        // is spoken as a final sentence.
        if (buffer.trim()) {
          append(buffer.trim());
        }
      } catch {
        // Whatever already streamed keeps playing — only the rest of the
        // script failed to arrive. Surface that without touching playback.
        setGenerationFailed(true);
      }
    };

    void streamScript();
    // Guarded by initialized.current above, so this effect behaves as a
    // mount-only effect despite the honest dependency array.
  }, [
    props.articleId,
    props.title,
    props.author,
    props.feedTitle,
    enqueue,
    playFrom,
  ]);

  const togglePlayback = () => {
    if (paused) return resume();
    if (speaking) return pause();
    playFrom(0);
  };

  const changeRate = ([next]: number[]) => {
    setRate(next);
    window.localStorage.setItem(RATE_STORAGE_KEY, String(next));
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

      {generationFailed && (
        <Alert>
          <AlertTitle>Briefing incomplete</AlertTitle>
          <AlertDescription>
            The rest of this summary could not be generated. What was written is
            shown below.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-lg leading-relaxed text-pretty">
        {sentences.map((sentence, index) => (
          <span
            key={index}
            data-active={index === activeIndex}
            className="data-[active=true]:bg-primary/15 rounded transition-colors"
          >
            {sentence}{" "}
          </span>
        ))}
      </p>

      <div className="flex flex-wrap items-center gap-4 border-t pt-4">
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

        <div className="flex flex-1 items-center gap-3">
          <Label
            htmlFor="speech-rate"
            className="text-muted-foreground text-sm"
          >
            Speed
          </Label>
          <Slider
            id="speech-rate"
            className="max-w-40"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.1}
            value={[rate]}
            onValueChange={changeRate}
            disabled={!supported}
          />
          <span className="text-muted-foreground text-sm tabular-nums">
            {rate.toFixed(1)}×
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioSummaryPlayer;
