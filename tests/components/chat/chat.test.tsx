import Chat, {
  DECLINED_BY_REPLY,
  showsOnlyTextSummary,
  transport,
} from "@/components/chat/chat";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { getArticleSources } from "@/lib/repository/chatRepository";
import { useChat } from "@ai-sdk/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APICallError, type ChatInit } from "ai";
import { useRouter } from "next/navigation";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installServerSpeech } from "../../helpers/server-speech";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));
vi.mock("@/lib/repository/chatRepository", () => ({
  getArticlesForStatusChange: vi.fn(() => new Promise(() => {})),
  getArticleSources: vi.fn(() => new Promise(() => {})),
}));

const actions = {
  sendMessage: vi.fn(),
  stop: vi.fn(),
  regenerate: vi.fn(),
  setMessages: vi.fn(),
  clearError: vi.fn(),
  addToolApprovalResponse: vi.fn(),
};

const mockChat = (state: object = {}) =>
  vi.mocked(useChat).mockReturnValue({
    messages: [],
    status: "ready",
    error: undefined,
    ...actions,
    ...state,
  } as never);

const oneExchange = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }] },
  { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
];

const box = () =>
  screen.getByRole("textbox", { name: "Ask about your articles" });

// jsdom has no blob URLs; PromptInput creates one for every attached file.
const createObjectURL = vi.fn(() => "blob:test");

beforeEach(() => {
  vi.clearAllMocks();
  mockChat();
  URL.createObjectURL = createObjectURL;
});

afterEach(() => vi.unstubAllGlobals());

describe("Chat", () => {
  it("shows only a heading and the prompt on an empty chat", () => {
    render(<Chat speechEngine="server" />);

    expect(
      screen.getByRole("heading", { name: "What would you like to know?" }),
    ).toBeInTheDocument();
    expect(box()).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /alphabet|presentations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New chat" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the same input when the first question moves it to the bottom", () => {
    const { rerender } = render(<Chat speechEngine="server" />);
    const before = box();

    mockChat({ messages: oneExchange });
    rerender(<Chat speechEngine="server" />);

    expect(box()).toBe(before);
    expect(
      screen.queryByRole("heading", { name: "What would you like to know?" }),
    ).not.toBeInTheDocument();
  });

  it("leaves pasting to the browser when the clipboard also holds an image", () => {
    render(<Chat speechEngine="server" />);
    const image = new File(["x"], "clip.png", { type: "image/png" });
    // Office apps put the copied text and a rendering of it on the clipboard.
    const clipboardData = {
      getData: (type: string) => (type === "text/plain" ? "Alphabet" : ""),
      files: [image],
      types: ["text/plain", "Files"],
      items: [
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "image/png", getAsFile: () => image },
      ],
    };

    const notPrevented = fireEvent.paste(box(), { clipboardData });

    expect(notPrevented).toBe(true);
    // An attachment would start with a blob URL for the file.
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("keeps a dropped file out of the tab but leaves text drops alone", () => {
    render(<Chat speechEngine="server" />);
    const dropped = new File(["x"], "notes.pdf", { type: "application/pdf" });
    const file = { dataTransfer: { types: ["Files"], files: [dropped] } };
    const text = { dataTransfer: { types: ["text/plain"], files: [] } };

    expect(fireEvent.dragOver(box(), file)).toBe(false);
    expect(fireEvent.drop(box(), file)).toBe(false);
    expect(fireEvent.dragOver(box(), text)).toBe(true);
    expect(fireEvent.drop(box(), text)).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("sends the typed question on Enter and clears the box", async () => {
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.type(box(), "Alphabet news?{Enter}");

    expect(actions.sendMessage).toHaveBeenCalledWith({
      text: "Alphabet news?",
    });
    expect(box()).toHaveValue("");
  });

  it("does not send on Shift+Enter or when empty", async () => {
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.type(box(), "a{Shift>}{Enter}{/Shift}b");
    await user.clear(box());
    await user.type(box(), "{Enter}");

    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it("stops the stream from the submit button while answering", async () => {
    mockChat({ status: "streaming", messages: oneExchange });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.click(screen.getByRole("button", { name: /stop/i }));

    expect(actions.stop).toHaveBeenCalled();
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it("shows an error with Retry", async () => {
    mockChat({
      status: "error",
      error: new Error("boom"),
      messages: oneExchange,
    });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The answer could not be generated.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(actions.regenerate).toHaveBeenCalled();
  });

  it("keeps the submit button as Send after an error", async () => {
    mockChat({
      status: "error",
      error: new Error("boom"),
      messages: oneExchange,
    });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send" }).querySelector(".lucide-x"),
    ).toBeNull();
    await user.type(box(), "Try again{Enter}");

    expect(actions.sendMessage).toHaveBeenCalledWith({ text: "Try again" });
  });

  it("asks to sign in again when the session has expired", () => {
    mockChat({
      status: "error",
      error: new APICallError({
        message: "Sign in to chat.",
        url: "/api/chat",
        requestBodyValues: undefined,
        statusCode: 401,
        responseBody: "Sign in to chat.",
      }),
      messages: oneExchange,
    });
    render(<Chat speechEngine="server" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your session has expired. Sign in again.",
    );
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("asks for a new chat when the conversation is too long", () => {
    mockChat({
      status: "error",
      error: new APICallError({
        message: "Chat request too large.",
        url: "/api/chat",
        requestBodyValues: undefined,
        statusCode: 413,
        responseBody: "Chat request too large.",
      }),
      messages: oneExchange,
    });
    render(<Chat speechEngine="server" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This conversation is too long. Start a new chat.",
    );
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("starts over with New chat", async () => {
    mockChat({ messages: oneExchange });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(actions.stop).toHaveBeenCalled();
    expect(actions.clearError).toHaveBeenCalled();
    expect(actions.setMessages).toHaveBeenCalledWith([]);
  });

  const twoExchanges = [
    ...oneExchange,
    { id: "u2", role: "user", parts: [{ type: "text", text: "More?" }] },
    {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "Goodbye." }],
    },
  ];

  it("reads one answer at a time", async () => {
    const speech = installServerSpeech();
    mockChat({ messages: twoExchanges });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    const [first, second] = screen.getAllByRole("button", {
      name: "Read aloud",
    });
    await user.click(first);
    expect(speech.requested()).toEqual(["Hello"]);

    await user.click(second);

    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(speech.requested()).toEqual(["Hello", "Goodbye."]);
    expect(
      screen.getAllByRole("button", { name: "Stop reading" }),
    ).toHaveLength(1);
  });

  it("stops reading on New chat", async () => {
    const speech = installServerSpeech();
    mockChat({ messages: oneExchange });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Stop reading" }),
    ).not.toBeInTheDocument();
  });

  it("stops reading on Retry", async () => {
    const speech = installServerSpeech();
    mockChat({
      status: "error",
      error: new Error("boom"),
      messages: oneExchange,
    });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(actions.regenerate).toHaveBeenCalled();
    expect(speech.requests[0].signal.aborted).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Stop reading" }),
    ).not.toBeInTheDocument();
  });

  it("offers no read aloud or copy while the answer is being written", () => {
    mockChat({ messages: oneExchange, status: "streaming" });
    render(<Chat speechEngine="server" />);

    expect(
      screen.queryByRole("button", { name: "Read aloud" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("copies an answer", async () => {
    mockChat({ messages: oneExchange });
    const user = userEvent.setup();
    render(<Chat speechEngine="server" />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe("Hello");
  });
});

describe("transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends earlier articles as references only, keeping the request fields", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const article = {
      id: 2,
      title: "Alphabet beats",
      path: "/feed/1/article/2/text-summary",
    };
    const messages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Alphabet?" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-getArticle",
            toolCallId: "call-1",
            state: "output-available",
            input: { id: 2 },
            output: { ...article, text: "x".repeat(60_000), truncated: false },
          },
          { type: "text", text: "It beat estimates." },
        ],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: "And Meta?" }] },
    ] as unknown as ChatUIMessage[];

    await expect(
      transport.sendMessages({
        chatId: "chat-1",
        messages,
        trigger: "submit-message",
        messageId: undefined,
        abortSignal: undefined,
      }),
    ).rejects.toThrow();

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chat");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ id: "chat-1", trigger: "submit-message" });
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1].parts[0].output).toEqual(article);
    expect(body.messages[1].parts[1]).toEqual({
      type: "text",
      text: "It beat estimates.",
    });
  });
});

/** The options the component passed to `useChat`. */
const chatOptions = () =>
  vi.mocked(useChat).mock.calls[0][0] as ChatInit<ChatUIMessage>;

const pendingChange = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "Mark them read" }] },
  {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "tool-setArticleStatus",
        toolCallId: "call-1",
        state: "approval-requested",
        input: { ids: [1], status: "DISMISSED" },
        approval: { id: "approval-1" },
      },
    ],
  },
];

describe("status changes", () => {
  it("continues the conversation once every approval is answered", () => {
    render(<Chat speechEngine="server" />);
    const { sendAutomaticallyWhen } = chatOptions();

    const answered = [
      pendingChange[0],
      {
        ...pendingChange[1],
        parts: [
          {
            ...pendingChange[1].parts[0],
            state: "approval-responded",
            approval: { id: "approval-1", approved: true },
          },
        ],
      },
    ];

    expect(sendAutomaticallyWhen?.({ messages: answered as never })).toBe(true);
    expect(sendAutomaticallyWhen?.({ messages: pendingChange as never })).toBe(
      false,
    );
  });

  it("declines a pending change before sending a typed reply, in one request", async () => {
    const user = userEvent.setup();
    mockChat({ messages: pendingChange });
    let autoSendDuringDecline: unknown;
    actions.addToolApprovalResponse.mockImplementation(async () => {
      const { sendAutomaticallyWhen } = chatOptions();
      autoSendDuringDecline = sendAutomaticallyWhen?.({
        messages: [
          pendingChange[0],
          {
            ...pendingChange[1],
            parts: [
              {
                ...pendingChange[1].parts[0],
                state: "approval-responded",
                approval: { id: "approval-1", approved: false },
              },
            ],
          },
        ] as never,
      });
    });
    render(<Chat speechEngine="server" />);

    await user.type(box(), "Only the first one{Enter}");

    await vi.waitFor(() =>
      expect(actions.sendMessage).toHaveBeenCalledWith({
        text: "Only the first one",
      }),
    );
    expect(actions.addToolApprovalResponse).toHaveBeenCalledWith({
      id: "approval-1",
      approved: false,
      reason: DECLINED_BY_REPLY,
    });
    expect(autoSendDuringDecline).toBe(false);
    expect(
      actions.addToolApprovalResponse.mock.invocationCallOrder[0],
    ).toBeLessThan(actions.sendMessage.mock.invocationCallOrder[0]);
  });

  const twoPending = [
    pendingChange[0],
    {
      ...pendingChange[1],
      parts: [
        pendingChange[1].parts[0],
        {
          ...pendingChange[1].parts[0],
          toolCallId: "call-2",
          approval: { id: "approval-2" },
        },
      ],
    },
  ];

  it("declines every pending change before sending a typed reply", async () => {
    const user = userEvent.setup();
    mockChat({ messages: twoPending });
    render(<Chat speechEngine="server" />);

    await user.type(box(), "Only the first one{Enter}");

    await vi.waitFor(() =>
      expect(actions.sendMessage).toHaveBeenCalledWith({
        text: "Only the first one",
      }),
    );
    expect(actions.sendMessage).toHaveBeenCalledTimes(1);
    expect(actions.addToolApprovalResponse.mock.calls).toEqual([
      [{ id: "approval-1", approved: false, reason: DECLINED_BY_REPLY }],
      [{ id: "approval-2", approved: false, reason: DECLINED_BY_REPLY }],
    ]);
    expect(
      actions.addToolApprovalResponse.mock.invocationCallOrder[1],
    ).toBeLessThan(actions.sendMessage.mock.invocationCallOrder[0]);
  });

  it("still sends a typed reply when declining fails", async () => {
    const user = userEvent.setup();
    mockChat({ messages: pendingChange });
    actions.addToolApprovalResponse.mockRejectedValueOnce(new Error("busy"));
    render(<Chat speechEngine="server" />);

    await user.type(box(), "Only the first one{Enter}");

    await vi.waitFor(() =>
      expect(actions.sendMessage).toHaveBeenCalledWith({
        text: "Only the first one",
      }),
    );
  });

  it("reports an approved change in an earlier answer as not applied", async () => {
    mockChat({
      messages: [
        pendingChange[0],
        {
          ...pendingChange[1],
          parts: [
            {
              ...pendingChange[1].parts[0],
              state: "approval-responded",
              approval: { id: "approval-1", approved: true },
            },
          ],
        },
        { id: "u2", role: "user", parts: [{ type: "text", text: "Hm?" }] },
        {
          id: "a2",
          role: "assistant",
          parts: [{ type: "text", text: "Yes?" }],
        },
      ],
    });
    render(<Chat speechEngine="server" />);

    expect(
      await screen.findByText("Couldn't update the articles."),
    ).toBeInTheDocument();
  });

  it("passes Apply on the card to the chat", async () => {
    const user = userEvent.setup();
    mockChat({ messages: pendingChange });
    const { getArticlesForStatusChange } =
      await import("@/lib/repository/chatRepository");
    vi.mocked(getArticlesForStatusChange).mockResolvedValue({
      articles: [
        {
          id: 1,
          title: "Article 1",
          feed: "Feed",
          published: "2026-11-20",
          status: "UNREAD",
        },
      ],
      notFound: 0,
    } as never);
    render(<Chat speechEngine="server" />);

    await screen.findByText("Dismiss 1 article?");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(actions.addToolApprovalResponse).toHaveBeenCalledWith({
      id: "approval-1",
      approved: true,
    });
  });

  it("refreshes the page once after an applied change", () => {
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh } as never);
    const applied = [
      pendingChange[0],
      {
        ...pendingChange[1],
        parts: [
          {
            ...pendingChange[1].parts[0],
            state: "output-available",
            approval: { id: "approval-1", approved: true },
            output: {
              status: "DISMISSED",
              changed: 1,
              alreadyInStatus: 0,
              notFound: 0,
            },
          },
        ],
      },
    ];
    mockChat({ messages: applied });

    const { rerender } = render(<Chat speechEngine="server" />);
    rerender(<Chat speechEngine="server" />);

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("opened on an article", () => {
  const article = { id: 7 };

  it("asks for the text summary once, in fixed words", async () => {
    render(<Chat speechEngine="server" article={article} />);

    await waitFor(() =>
      expect(actions.sendMessage).toHaveBeenCalledWith({
        text: "Summarize this article.",
      }),
    );
    expect(actions.sendMessage).toHaveBeenCalledOnce();
  });

  it("asks once under Strict Mode's trial unmount and remount", async () => {
    render(
      <StrictMode>
        <Chat speechEngine="server" article={article} />
      </StrictMode>,
    );

    await waitFor(() => expect(actions.sendMessage).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(actions.sendMessage).toHaveBeenCalledOnce();
  });

  it("does not ask again once the conversation has started", async () => {
    mockChat({ messages: oneExchange });
    render(<Chat speechEngine="server" article={article} />);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it("sends the article's id with every request", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    render(<Chat speechEngine="server" article={article} />);

    await expect(
      chatOptions().transport!.sendMessages({
        chatId: "chat-1",
        messages: oneExchange as ChatUIMessage[],
        trigger: "submit-message",
        messageId: undefined,
        abortSignal: undefined,
      }),
    ).rejects.toThrow();

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ articleId: 7 });
  });

  it("shows the article's heading and leaves for the chat page on New chat", () => {
    mockChat({ messages: oneExchange });
    render(
      <Chat
        speechEngine="server"
        article={article}
        header={<h2>Alphabet beats</h2>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Alphabet beats" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New chat" })).toHaveAttribute(
      "href",
      "/chat",
    );
    expect(
      screen.getByRole("textbox", { name: "Ask about this article" }),
    ).toBeInTheDocument();
  });
});

describe("showsOnlyTextSummary", () => {
  const ask = (id: string) => ({
    id,
    role: "user",
    parts: [{ type: "text", text: "?" }],
  });
  const answer = (id: string) => ({
    id,
    role: "assistant",
    parts: [{ type: "text", text: "." }],
  });

  it("holds until the reader asks their own first question", () => {
    const opening = [ask("u1"), answer("a1")] as ChatUIMessage[];
    const asked = [...opening, ask("u2")] as ChatUIMessage[];

    expect(showsOnlyTextSummary([])).toBe(true);
    expect(showsOnlyTextSummary(opening)).toBe(true);
    expect(showsOnlyTextSummary(asked)).toBe(false);
  });
});

describe("citations", () => {
  const later = [
    { id: "u2", role: "user", parts: [{ type: "text", text: "And Meta?" }] },
    {
      id: "a2",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Meta fell ([Meta](/feed/3/article/4/text-summary)).",
        },
      ],
    },
  ];
  const cited = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Alphabet?" }] },
    {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "It beat estimates ([report](/feed/1/article/2/text-summary)).",
        },
      ],
    },
  ];

  it("links a cited article to its source once the answer is complete", async () => {
    vi.mocked(getArticleSources).mockResolvedValue({
      2: "https://news.example/alphabet",
    });
    mockChat({ messages: cited });
    render(<Chat speechEngine="server" />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "report" })).toHaveAttribute(
        "href",
        "https://news.example/alphabet",
      ),
    );
    expect(screen.getByRole("link", { name: "report" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(getArticleSources).toHaveBeenCalledWith([2]);
  });

  it("opens a citation in the app, in a new tab, until its source is known", async () => {
    vi.mocked(getArticleSources).mockReturnValue(new Promise(() => {}));
    mockChat({ messages: cited });
    render(<Chat speechEngine="server" />);

    const link = await screen.findByRole("link", { name: "report" });
    expect(link).toHaveAttribute("href", "/feed/1/article/2/text-summary");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("looks sources up only once the answer is complete", async () => {
    mockChat({ messages: cited, status: "streaming" });
    render(<Chat speechEngine="server" />);

    await screen.findByRole("link", { name: "report" });
    expect(getArticleSources).not.toHaveBeenCalled();
  });

  it("looks up a failed lookup again once the next answer is complete", async () => {
    vi.mocked(getArticleSources)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ 2: "https://news.example/alphabet" });
    mockChat({ messages: cited });
    const { rerender } = render(<Chat speechEngine="server" />);
    await waitFor(() => expect(getArticleSources).toHaveBeenCalledOnce());

    mockChat({ messages: [...cited, ...later] });
    rerender(<Chat speechEngine="server" />);

    await waitFor(() =>
      expect(getArticleSources).toHaveBeenLastCalledWith([2, 4]),
    );
  });

  it("looks up only the articles a new answer adds", async () => {
    vi.mocked(getArticleSources).mockResolvedValue({});
    mockChat({ messages: cited });
    const { rerender } = render(<Chat speechEngine="server" />);
    await waitFor(() => expect(getArticleSources).toHaveBeenCalledWith([2]));

    mockChat({ messages: [...cited, ...later] });
    rerender(<Chat speechEngine="server" />);

    await waitFor(() =>
      expect(getArticleSources).toHaveBeenLastCalledWith([4]),
    );
  });

  it("shows links the model writes to other sites as text", async () => {
    mockChat({
      messages: [
        cited[0],
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "See [the full report](https://evil.example/?d=secret).",
            },
          ],
        },
      ],
    });
    render(<Chat speechEngine="server" />);

    await screen.findByText("the full report");
    expect(
      screen.queryByRole("link", { name: "the full report" }),
    ).not.toBeInTheDocument();
  });

  it("opens other paths in the app in a new tab", async () => {
    mockChat({
      messages: [
        cited[0],
        {
          id: "a1",
          role: "assistant",
          parts: [{ type: "text", text: "See [your feeds](/feed)." }],
        },
      ],
    });
    render(<Chat speechEngine="server" />);

    const link = await screen.findByRole("link", { name: "your feeds" });
    expect(link).toHaveAttribute("href", "/feed");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
