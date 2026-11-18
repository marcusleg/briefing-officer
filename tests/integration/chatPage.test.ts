import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import ChatPage from "@/app/chat/page";
import { redirect } from "next/navigation";

describe("/chat", () => {
  it("sends a reader without a session to sign in", async () => {
    await ChatPage();

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
