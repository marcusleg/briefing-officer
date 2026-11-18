import TextSummaryStream from "@/components/article/text-summary-stream";
import { readStreamableValue } from "@ai-sdk/rsc";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/services/summaryService", () => ({
  streamTextSummary: vi.fn().mockResolvedValue({ output: "streamable" }),
}));

vi.mock("@ai-sdk/rsc", () => ({
  readStreamableValue: vi.fn(),
}));

type Step = { delta: string } | { done: true };

/**
 * A summary stream the test drives: each `push` hands the component one
 * delta and `end` closes it.
 */
const controlledStream = () => {
  const steps: Step[] = [];
  let wake: (() => void) | undefined;
  const send = (step: Step) => {
    steps.push(step);
    wake?.();
  };

  vi.mocked(readStreamableValue).mockReturnValue({
    async *[Symbol.asyncIterator]() {
      for (;;) {
        while (steps.length === 0) {
          await new Promise<void>((resolve) => (wake = resolve));
        }
        const step = steps.shift()!;
        if ("done" in step) {
          return;
        }
        yield step.delta;
      }
    },
  } as ReturnType<typeof readStreamableValue>);

  return {
    push: (delta: string) => send({ delta }),
    end: () => send({ done: true }),
  };
};

/** Streams `deltas` in one go, then ends or fails the stream. */
const streamOf = (deltas: string[], { fail = false } = {}) => {
  vi.mocked(readStreamableValue).mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield* deltas;
      if (fail) {
        throw new Error("stream failed");
      }
    },
  } as ReturnType<typeof readStreamableValue>);
};

afterEach(() => {
  vi.mocked(readStreamableValue).mockReset();
});

describe("TextSummaryStream", () => {
  it("shows a spinner until the first token arrives", async () => {
    const stream = controlledStream();

    render(<TextSummaryStream articleId={1} />);

    expect(
      await screen.findByRole("status", { name: "Writing summary" }),
    ).toBeInTheDocument();

    stream.push("The first sentence.");

    expect(await screen.findByText("The first sentence.")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Writing summary" }),
    ).not.toBeInTheDocument();
    stream.end();
  });

  it("does not show half-written emphasis as literal asterisks", async () => {
    const stream = controlledStream();

    const { container } = render(<TextSummaryStream articleId={1} />);
    stream.push("Shares **rose sharp");

    await screen.findByText(/rose sharp/);
    expect(container.textContent).not.toContain("*");

    stream.push("ly** today.");
    stream.end();

    await screen.findByText(/today\./);
    expect(container.textContent).not.toContain("*");
  });

  it("renders the finished summary as Markdown with the summary typography", async () => {
    streamOf([
      "# Kernel 7.2\n\n",
      "## What changed\n\n",
      "The kernel **removes strncpy**.\n\n",
      "- First point\n- Second point\n\n",
      "1. Step one\n2. Step two",
    ]);

    const { container } = render(<TextSummaryStream articleId={1} />);

    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Kernel 7.2");
    expect(h1).toHaveClass("text-[1.44rem]", "font-bold");
    expect(h1).not.toHaveClass("mt-6");
    expect(h1).not.toHaveClass("text-3xl");
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "text-[1.2rem]",
    );

    const paragraph = screen.getByText(/The kernel/);
    expect(paragraph.tagName).toBe("P");
    expect(paragraph).toHaveClass("text-prose", "text-justify", "hyphens-auto");
    const bold = screen.getByText("removes strncpy");
    expect(bold.tagName).toBe("STRONG");
    expect(bold).toHaveClass("font-bold");
    expect(container.textContent).not.toContain("*");

    const [unordered, ordered] = screen.getAllByRole("list");
    expect(unordered.tagName).toBe("UL");
    expect(unordered).toHaveClass("ml-6", "list-disc", "text-prose");
    expect(unordered).not.toHaveClass("list-inside");
    expect(ordered.tagName).toBe("OL");
    expect(ordered).toHaveClass("ml-6", "list-decimal");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);

    const root = h1.parentElement;
    expect(root).toHaveClass("flex", "flex-col", "gap-4");
    expect(root).not.toHaveClass("space-y-4");
  });

  it("drops the spinner when the stream fails before any text", async () => {
    streamOf([], { fail: true });

    render(<TextSummaryStream articleId={1} />);

    expect(await screen.findByText("Summary incomplete")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Writing summary" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the partial summary on screen when the stream fails", async () => {
    streamOf(["The first half arrived."], { fail: true });

    render(<TextSummaryStream articleId={1} />);

    expect(await screen.findByText("Summary incomplete")).toBeInTheDocument();
    expect(screen.getByText("The first half arrived.")).toBeInTheDocument();
  });

  it("renders neither raw HTML nor images from the summary", async () => {
    streamOf([
      '<img src="https://evil.example/raw.png">\n\n',
      "<script>alert(1)</script>\n\n",
      "![chart](https://evil.example/p.png?q=secret)\n\n",
      "Done.",
    ]);

    const { container } = render(<TextSummaryStream articleId={1} />);

    await screen.findByText(/Done\./);
    expect(container.querySelector("img, picture, script, iframe")).toBeNull();
    // A blocked image shows only its alt text.
    expect(container.textContent).toContain("chart");
    const attributes = [...container.querySelectorAll("*")].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value),
    );
    expect(attributes.join(" ")).not.toContain("evil.example");
  });
});
