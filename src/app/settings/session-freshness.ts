import { APIError } from "better-auth/api";

// Better Auth refuses to list sessions when the current one is too old.
export const isSessionNotFresh = (error: unknown): boolean =>
  error instanceof APIError && error.body?.code === "SESSION_NOT_FRESH";
