import { notifyUser } from "@/lib/events/userEvents";
import { enqueue } from "@/lib/jobs/jobRepository";
import { createWorker, setGlobalWorker, wakeWorker } from "@/lib/jobs/worker";
import prisma from "@/lib/prismaClient";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events/userEvents", () => ({
  notifyUser: vi.fn(),
}));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const idle = { pollIntervalMs: 60 * 60_000 };
let worker: ReturnType<typeof createWorker> | undefined;

afterEach(() => {
  worker?.stop();
  worker = undefined;
  setGlobalWorker(undefined);
});

describe("worker", () => {
  it("runs a due job, deletes it, and notifies the owner", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await enqueue("REFRESH_FEED", 1);

    await worker.start();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(handler).toHaveBeenCalledWith(1);
    expect(notifyUser).toHaveBeenCalledWith("user-1");
  });

  it("does not notify when the handler reports no owner", async () => {
    const handler = vi.fn(async () => null);
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await enqueue("REFRESH_FEED", 1);

    await worker.start();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("caps concurrency per kind and drains the rest afterwards", async () => {
    const gate = deferred();
    let started = 0;
    const handler = vi.fn(async () => {
      started += 1;
      await gate.promise;
      return "user-1";
    });
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      { ...idle, concurrency: { REFRESH_FEED: 1, PROCESS_ARTICLE: 2 } },
    );
    for (const id of [1, 2, 3]) {
      await enqueue("PROCESS_ARTICLE", id);
    }

    await worker.start();
    await vi.waitFor(() => expect(started).toBe(2));
    await worker.tick();
    expect(started).toBe(2);

    gate.resolve();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(started).toBe(3);
  });

  it("retries a failing job with backoff", async () => {
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await enqueue("REFRESH_FEED", 1);

    await worker.start();

    await vi.waitFor(async () => {
      const [job] = await prisma.job.findMany();
      expect(job.status).toBe("PENDING");
      expect(job.attempts).toBe(1);
      expect(job.lastError).toBe("boom");
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("resets running jobs at start", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await prisma.job.create({
      data: { kind: "REFRESH_FEED", targetId: 1, status: "RUNNING" },
    });

    await worker.start();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
    expect(handler).toHaveBeenCalledWith(1);
  });

  it("runs a job enqueued after start when woken", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );
    await worker.start();
    setGlobalWorker(worker);

    await enqueue("REFRESH_FEED", 1);
    wakeWorker();

    await vi.waitFor(async () => {
      expect(await prisma.job.count()).toBe(0);
    });
  });

  it("ignores wake when no worker is registered", () => {
    setGlobalWorker(undefined);
    expect(() => wakeWorker()).not.toThrow();
  });

  it("does nothing unless started", async () => {
    const handler = vi.fn(async () => "user-1");
    worker = createWorker(
      { REFRESH_FEED: handler, PROCESS_ARTICLE: handler },
      idle,
    );

    await enqueue("REFRESH_FEED", 1);
    worker.wake();
    await worker.tick();

    expect(handler).not.toHaveBeenCalled();
    expect(await prisma.job.count()).toBe(1);
  });
});
