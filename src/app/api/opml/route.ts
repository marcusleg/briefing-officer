import { auth } from "@/lib/auth";
import { exportOpml } from "@/lib/repository/opmlRepository";
import { headers } from "next/headers";

// The session is checked here rather than relying on exportOpml's getUserId
// throwing, so that a missing session is a 401 and a database failure stays
// a 500 instead of both collapsing into one.
export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // The sidebar anchor has `download`, so the browser saves whatever comes
    // back — a one-line explanation instead of an empty file.
    return new Response("Sign in to export your feeds.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const opml = await exportOpml();

  return new Response(opml, {
    status: 200,
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="briefing-officer.opml"',
      "Cache-Control": "private, no-store",
    },
  });
};
