import { notifyUser } from "@/lib/events/userEvents";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { GET } from "@/app/api/events/route";
import { auth } from "@/lib/auth";

const readChunk = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  const { value, done } = await reader.read();
  expect(done).toBe(false);
  return new TextDecoder().decode(value);
};

describe("GET /api/events", () => {
  it("rejects requests without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await GET(new Request("http://localhost/api/events"));

    expect(response.status).toBe(401);
  });

  it("streams a change event for the signed-in user only", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "alice" },
    } as never);
    const controller = new AbortController();
    const response = await GET(
      new Request("http://localhost/api/events", {
        signal: controller.signal,
      }),
    );

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    expect(await readChunk(reader)).toBe(": connected\n\n");

    notifyUser("bob");
    notifyUser("alice");

    expect(await readChunk(reader)).toBe("data: changed\n\n");

    controller.abort();
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});
