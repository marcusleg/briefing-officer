import Chat, { transport } from "@/components/chat/chat";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { useChat } from "@ai-sdk/react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installServerSpeech } from "../../helpers/server-speech";

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));

const actions = {
  sendMessage: vi.fn(),
  stop: vi.fn(),
  regenerate: vi.fn(),
  setMessages: vi.fn(),
  clearError: vi.fn(),
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

  it("offers no read aloud while the answer is being written", () => {
    mockChat({ messages: oneExchange, status: "streaming" });
    render(<Chat speechEngine="server" />);

    expect(
      screen.queryByRole("button", { name: "Read aloud" }),
    ).not.toBeInTheDocument();
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
