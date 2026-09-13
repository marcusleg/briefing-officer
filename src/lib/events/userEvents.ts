import { EventEmitter } from "events";

/**
 * Next.js compiles instrumentation, route handlers, and server actions into
 * separate module graphs, so a module-level singleton would not be the same
 * object in the worker and in the SSE route. The emitter is kept on
 * `globalThis` instead, which every graph in the process shares.
 */
const GLOBAL_KEY = "__briefingOfficerUserEvents";

type GlobalWithEmitter = typeof globalThis & {
  [GLOBAL_KEY]?: EventEmitter;
};

const emitter = () => {
  const global = globalThis as GlobalWithEmitter;
  if (!global[GLOBAL_KEY]) {
    const created = new EventEmitter();
    // One listener per open browser tab; the default cap of 10 would warn.
    created.setMaxListeners(0);
    global[GLOBAL_KEY] = created;
  }
  return global[GLOBAL_KEY];
};

/** Tell every open page of this user that something they see has changed. */
export const notifyUser = (userId: string) => {
  emitter().emit(userId);
};

/** Returns the function that unsubscribes. */
export const subscribe = (userId: string, listener: () => void) => {
  emitter().on(userId, listener);
  return () => {
    emitter().off(userId, listener);
  };
};
