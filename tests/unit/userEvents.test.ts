import { notifyUser, subscribe } from "@/lib/events/userEvents";
import { describe, expect, it, vi } from "vitest";

describe("userEvents", () => {
  it("delivers a notification to that user's subscribers only", () => {
    const alice = vi.fn();
    const bob = vi.fn();
    const stopAlice = subscribe("alice", alice);
    const stopBob = subscribe("bob", bob);

    notifyUser("alice");

    expect(alice).toHaveBeenCalledOnce();
    expect(bob).not.toHaveBeenCalled();
    stopAlice();
    stopBob();
  });

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn();
    const stop = subscribe("carol", listener);

    stop();
    notifyUser("carol");

    expect(listener).not.toHaveBeenCalled();
  });

  it("is a no-op for a user with no subscribers", () => {
    expect(() => notifyUser("nobody")).not.toThrow();
  });
});
