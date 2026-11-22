import StatusChangeCard, {
  type StatusChangePart,
} from "@/components/chat/status-change-card";
import { getArticlesForStatusChange } from "@/lib/repository/chatRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/chatRepository", () => ({
  getArticlesForStatusChange: vi.fn(),
}));

const article = (id: number, status = "UNREAD") => ({
  id,
  title: `Article ${id}`,
  feed: "Markets Daily",
  published: "2026-11-20",
  status,
});

const part = (overrides: Record<string, unknown> = {}) =>
  ({
    type: "tool-setArticleStatus",
    toolCallId: "call-1",
    state: "approval-requested",
    input: { ids: [1, 2], status: "READ" },
    approval: { id: "approval-1" },
    ...overrides,
  }) as unknown as StatusChangePart;

const onRespond = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getArticlesForStatusChange).mockResolvedValue({
    articles: [article(1), article(2)],
    notFound: 0,
  } as never);
});

describe("StatusChangeCard", () => {
  it("lists the articles from the server and asks for approval", async () => {
    render(<StatusChangeCard part={part()} onRespond={onRespond} />);

    expect(
      await screen.findByText("Mark 2 articles as read?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Article 1")).toBeInTheDocument();
    expect(screen.getAllByText("Markets Daily · 2026-11-20")).toHaveLength(2);
    expect(getArticlesForStatusChange).toHaveBeenCalledWith([1, 2]);
  });

  it("shows a loading line with disabled buttons until the articles arrive", () => {
    vi.mocked(getArticlesForStatusChange).mockReturnValue(
      new Promise(() => {}),
    );

    render(<StatusChangeCard part={part()} onRespond={onRespond} />);

    expect(screen.getByText("Loading the articles…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("sends Apply and Decline with the approval id", async () => {
    const user = userEvent.setup();
    render(<StatusChangeCard part={part()} onRespond={onRespond} />);

    await screen.findByText("Mark 2 articles as read?");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onRespond).toHaveBeenCalledWith({
      id: "approval-1",
      approved: true,
    });

    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(onRespond).toHaveBeenCalledWith({
      id: "approval-1",
      approved: false,
    });
  });

  it("uses the read-later wording", async () => {
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [article(1)],
      notFound: 0,
    } as never);

    render(
      <StatusChangeCard
        part={part({ input: { ids: [1], status: "READ_LATER" } })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Save 1 article for later?"),
    ).toBeInTheDocument();
  });

  it("shows ten articles and reveals the rest on demand", async () => {
    const user = userEvent.setup();
    const ids = Array.from({ length: 13 }, (_, index) => index + 1);
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: ids.map((id) => article(id)),
      notFound: 0,
    } as never);

    render(
      <StatusChangeCard
        part={part({ input: { ids, status: "READ" } })}
        onRespond={onRespond}
      />,
    );

    expect(await screen.findByText("Article 10")).toBeInTheDocument();
    expect(screen.queryByText("Article 11")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getByText("Article 13")).toBeInTheDocument();
  });

  it("counts articles not found and already in the target status", async () => {
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [article(1), article(2, "READ")],
      notFound: 2,
    } as never);

    render(
      <StatusChangeCard
        part={part({ input: { ids: [1, 2, 3, 4], status: "READ" } })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Mark 1 article as read?"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 already read")).toBeInTheDocument();
    expect(screen.getByText("2 articles not found")).toBeInTheDocument();
  });

  it("offers only Decline when nothing would change", async () => {
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [article(1, "READ")],
      notFound: 0,
    } as never);

    render(
      <StatusChangeCard
        part={part({ input: { ids: [1], status: "READ" } })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("These articles are already read"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
  });

  it("offers only Decline when none of the articles exist", async () => {
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [],
      notFound: 2,
    } as never);

    render(<StatusChangeCard part={part()} onRespond={onRespond} />);

    expect(
      await screen.findByText("None of these articles were found"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });

  it("offers only Decline when the articles cannot be loaded", async () => {
    vi.mocked(getArticlesForStatusChange).mockRejectedValue(new Error("x"));

    render(<StatusChangeCard part={part()} onRespond={onRespond} />);

    expect(
      await screen.findByText("Couldn't load these articles."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
  });

  it("shows progress while applying", async () => {
    render(
      <StatusChangeCard
        part={part({
          state: "approval-responded",
          approval: { id: "approval-1", approved: true },
        })}
        onRespond={onRespond}
      />,
    );

    expect(await screen.findByText("Applying…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });

  it("reports the applied change with the articles behind a toggle", async () => {
    const user = userEvent.setup();
    render(
      <StatusChangeCard
        part={part({
          state: "output-available",
          approval: { id: "approval-1", approved: true },
          output: {
            status: "READ",
            changed: 2,
            alreadyInStatus: 0,
            notFound: 0,
          },
        })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Marked 2 articles as read"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Article 1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show articles" }));
    expect(screen.getByText("Article 1")).toBeInTheDocument();
  });

  it.each([
    [
      "output-denied",
      { id: "approval-1", approved: false, reason: "The reader declined." },
    ],
    // A decline sent together with a typed reply never reaches output-denied.
    ["approval-responded", { id: "approval-1", approved: false }],
  ])("reports a decline in state %s", async (state, approval) => {
    render(
      <StatusChangeCard
        part={part({ state, approval })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("You declined: mark 2 articles as read"),
    ).toBeInTheDocument();
  });

  it("reports a failed update", async () => {
    render(
      <StatusChangeCard
        part={part({
          state: "output-available",
          approval: { id: "approval-1", approved: true },
          output: { error: "update failed" },
        })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Couldn't update the articles."),
    ).toBeInTheDocument();
  });

  const approved = {
    state: "approval-responded",
    approval: { id: "approval-1", approved: true },
  };

  it("lists only the articles that will change while applying", async () => {
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [article(1), article(2, "READ")],
      notFound: 0,
    } as never);

    render(<StatusChangeCard part={part(approved)} onRespond={onRespond} />);

    expect(await screen.findByText("Article 1")).toBeInTheDocument();
    expect(screen.getByText("Mark 1 article as read?")).toBeInTheDocument();
    expect(screen.queryByText("Article 2")).not.toBeInTheDocument();
  });

  it("reports an approved change that was interrupted as not applied", async () => {
    render(
      <StatusChangeCard
        part={part(approved)}
        interrupted
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Couldn't update the articles."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Applying…")).not.toBeInTheDocument();
  });

  it("waits for the other proposal before applying", async () => {
    render(
      <StatusChangeCard
        part={part(approved)}
        otherPending
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Applies once you answer the other proposal."),
    ).toBeInTheDocument();
    expect(screen.getByText("Mark 2 articles as read?")).toBeInTheDocument();
    expect(screen.queryByText("Applying…")).not.toBeInTheDocument();
  });

  it("reports a change that failed to run", async () => {
    render(
      <StatusChangeCard
        part={part({
          state: "output-error",
          approval: { id: "approval-1", approved: true },
          errorText: "boom",
        })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("Couldn't update the articles."),
    ).toBeInTheDocument();
  });

  it("keeps saying nothing would change after a decline", async () => {
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [article(1, "READ"), article(2, "READ")],
      notFound: 0,
    } as never);

    render(
      <StatusChangeCard
        part={part({
          state: "approval-responded",
          approval: { id: "approval-1", approved: false },
        })}
        onRespond={onRespond}
      />,
    );

    expect(
      await screen.findByText("These articles are already read"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You declined/)).not.toBeInTheDocument();
  });

  it("says it is preparing while the model is still writing the call", () => {
    render(
      <StatusChangeCard
        part={part({ state: "input-streaming", input: undefined })}
        onRespond={onRespond}
      />,
    );

    expect(screen.getByText("Preparing a change…")).toBeInTheDocument();
    expect(getArticlesForStatusChange).not.toHaveBeenCalled();
  });
});
