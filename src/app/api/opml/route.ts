import { auth } from "@/lib/auth";
import { exportOpml } from "@/lib/repository/opmlRepository";
import { headers } from "next/headers";

// The session is checked here rather than relying on exportOpml's getUserId
// throwing, so that a missing session is a 401 and a database failure stays
// a 500 instead of both collapsing into one.
export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("", { status: 401 });
  }

  const opml = await exportOpml();

  return new Response(opml, {
    status: 200,
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="briefing-officer.opml"',
    },
  });
};
