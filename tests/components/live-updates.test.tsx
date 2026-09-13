import LiveUpdates, {
  useLiveUpdates,
  USER_REFRESH_WINDOW_MS,
} from "@/components/live-updates";
import { act, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  emit() {
    this.onmessage?.(new MessageEvent("message", { data: "changed" }));
  }
}

const refresh = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.mocked(useRouter).mockReturnValue({ refresh } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const Probe = () => {
  const { userRefreshActive, noteUserRefresh } = useLiveUpdates();
  return (
    <button onClick={noteUserRefresh}>
      {userRefreshActive ? "active" : "idle"}
    </button>
  );
};

describe("LiveUpdates", () => {
  it("opens one stream to /api/events and closes it on unmount", () => {
    const { unmount } = render(<LiveUpdates>x</LiveUpdates>);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/events");

    unmount();
    expect(FakeEventSource.instances[0].close).toHaveBeenCalledOnce();
  });

  it("refreshes the router on a message, throttled with a trailing call", () => {
    render(<LiveUpdates>x</LiveUpdates>);
    const [source] = FakeEventSource.instances;

    act(() => source.emit());
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(500);
      source.emit();
      source.emit();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("reports a user refresh as active for a while, then idle", () => {
    render(
      <LiveUpdates>
        <Probe />
      </LiveUpdates>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("idle");

    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByRole("button")).toHaveTextContent("active");

    act(() => {
      vi.advanceTimersByTime(USER_REFRESH_WINDOW_MS);
    });
    expect(screen.getByRole("button")).toHaveTextContent("idle");
  });

  it("is inert outside a provider", () => {
    render(<Probe />);
    expect(screen.getByRole("button")).toHaveTextContent("idle");
    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByRole("button")).toHaveTextContent("idle");
  });
});
