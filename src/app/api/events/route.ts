import { auth } from "@/lib/auth";
import { subscribe } from "@/lib/events/userEvents";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 20_000;

/**
 * Server-Sent Events stream. One connection per open tab; each event tells the
 * page that something it shows has changed. The heartbeat keeps proxies from
 * closing an idle connection.
 */
export const GET = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const unsubscribe = subscribe(userId, () => send("data: changed\n\n"));
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      send(": connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx buffers event streams by default, which would hold every event
      // back until the next heartbeat. This header turns that off per response.
      "X-Accel-Buffering": "no",
    },
  });
};
