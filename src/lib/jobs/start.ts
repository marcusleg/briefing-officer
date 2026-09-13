import { handlers } from "@/lib/jobs/handlers";
import { createScheduler } from "@/lib/jobs/scheduler";
import { createWorker, setGlobalWorker, Worker } from "@/lib/jobs/worker";
import logger from "@/lib/logger";

interface BackgroundWork {
  worker: Worker;
  scheduler: ReturnType<typeof createScheduler>;
}

const GLOBAL_KEY = "__briefingOfficerBackgroundWork";

type GlobalWithBackgroundWork = typeof globalThis & {
  [GLOBAL_KEY]?: BackgroundWork;
};

/**
 * Starts the worker and the scheduler. In development the instrumentation
 * hook can run again after a reload, so any previous pair is stopped first.
 * Failures are logged, not thrown: a missing AI provider must not stop the
 * server from serving pages.
 */
export const startBackgroundWork = async () => {
  const global = globalThis as GlobalWithBackgroundWork;

  try {
    global[GLOBAL_KEY]?.scheduler.stop();
    global[GLOBAL_KEY]?.worker.stop();

    const worker = createWorker(handlers);
    setGlobalWorker(worker);
    await worker.start();

    const scheduler = createScheduler({ wake: worker.wake });
    scheduler.start();

    global[GLOBAL_KEY] = { worker, scheduler };
    logger.info("Background worker started.");
  } catch (error) {
    logger.error({ err: error }, "Failed to start background worker.");
  }
};
