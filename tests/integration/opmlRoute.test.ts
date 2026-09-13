import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/repository/opmlRepository", () => ({
  exportOpml: vi.fn(),
}));

import { GET } from "@/app/api/opml/route";
import { auth } from "@/lib/auth";
import { exportOpml } from "@/lib/repository/opmlRepository";

describe("GET /api/opml", () => {
  it("returns 401 without a session and exports nothing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(exportOpml).not.toHaveBeenCalled();
  });

  it("returns the OPML document as a download", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    vi.mocked(exportOpml).mockResolvedValue('<opml version="2.0"/>');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/x-opml; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="briefing-officer.opml"',
    );
    expect(await response.text()).toBe('<opml version="2.0"/>');
  });
});
