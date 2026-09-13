/**
 * Called once per server start. The worker only makes sense in the Node
 * runtime of a running server: not on the edge runtime, not while `next build`
 * prerenders, and not in test runs that seed real feed URLs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  if (process.env.BACKGROUND_WORKER_DISABLED === "true") {
    return;
  }

  const { startBackgroundWork } = await import("@/lib/jobs/start");
  await startBackgroundWork();
}
