import "@testing-library/jest-dom";
import { vi } from "vitest";

/**
 * Radix UI measures tooltip triggers with ResizeObserver, which jsdom does not
 * implement. The layout effect only throws once a tooltip actually mounts, so
 * the failure surfaces on some test interleavings and not others — a test file
 * can pass alone and fail in the full suite.
 *
 * Assigned directly rather than via `vi.stubGlobal`, because test files that
 * call `vi.unstubAllGlobals()` in their own teardown would otherwise strip this
 * out from under the remaining tests in the file.
 */
class ResizeObserverStub implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverStub;

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
