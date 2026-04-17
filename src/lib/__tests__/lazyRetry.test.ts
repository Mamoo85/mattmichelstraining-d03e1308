import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryLazyImport, lazyRetry } from "../lazyRetry";

describe("retryLazyImport", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves immediately when import succeeds on first attempt", async () => {
    const mockModule = { default: () => null };
    const importFn = vi.fn().mockResolvedValue(mockModule);

    const result = await retryLazyImport(importFn, 3);

    expect(result).toBe(mockModule);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it("retries once on 'loading chunk' error then succeeds", async () => {
    const mockModule = { default: () => null };
    const importFn = vi.fn()
      .mockRejectedValueOnce(new Error("loading chunk 42 failed"))
      .mockResolvedValue(mockModule);

    const promise = retryLazyImport(importFn, 3);
    await vi.advanceTimersByTimeAsync(1100);
    const result = await promise;

    expect(result).toBe(mockModule);
    expect(importFn).toHaveBeenCalledTimes(2);
  });

  it("retries on 'Failed to fetch' error", async () => {
    const mockModule = { default: () => null };
    const importFn = vi.fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValue(mockModule);

    const promise = retryLazyImport(importFn, 3);
    await vi.advanceTimersByTimeAsync(1100);
    await promise;

    expect(importFn).toHaveBeenCalledTimes(2);
  });

  it("retries on 'dynamically imported module' error", async () => {
    const mockModule = { default: () => null };
    const importFn = vi.fn()
      .mockRejectedValueOnce(new Error("error loading dynamically imported module"))
      .mockResolvedValue(mockModule);

    const promise = retryLazyImport(importFn, 3);
    await vi.advanceTimersByTimeAsync(1100);
    await promise;

    expect(importFn).toHaveBeenCalledTimes(2);
  });

  it("retries on 'load failed' error (Safari)", async () => {
    const mockModule = { default: () => null };
    const importFn = vi.fn()
      .mockRejectedValueOnce(new Error("Load failed"))
      .mockResolvedValue(mockModule);

    const promise = retryLazyImport(importFn, 3);
    await vi.advanceTimersByTimeAsync(1100);
    await promise;

    expect(importFn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on unrelated errors", async () => {
    const importFn = vi.fn().mockRejectedValue(new Error("SyntaxError: unexpected token"));

    await expect(retryLazyImport(importFn, 3)).rejects.toThrow("SyntaxError");
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries before throwing", async () => {
    const importFn = vi.fn().mockRejectedValue(new Error("loading chunk 1 failed"));

    const promise = retryLazyImport(importFn, 2);
    // Attach rejection handler BEFORE advancing timers to prevent unhandled rejection warning
    const rejectAssertion = expect(promise).rejects.toThrow("loading chunk 1 failed");
    // 2 retries × 1000ms each
    await vi.advanceTimersByTimeAsync(2200);
    await rejectAssertion;
    // 1 initial + 2 retries = 3 total calls
    expect(importFn).toHaveBeenCalledTimes(3);
  });

  it("throws when module resolves without a default export", async () => {
    const importFn = vi.fn().mockResolvedValue({ namedExport: true });

    await expect(retryLazyImport(importFn, 0)).rejects.toThrow(
      "without a default export"
    );
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error rejection by wrapping in Error", async () => {
    const importFn = vi.fn().mockRejectedValue("some string error");

    await expect(retryLazyImport(importFn, 0)).rejects.toThrow("some string error");
  });

  it("respects retries=0: does not retry at all", async () => {
    const importFn = vi.fn().mockRejectedValue(new Error("loading chunk 99 failed"));

    await expect(retryLazyImport(importFn, 0)).rejects.toThrow();
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});

describe("lazyRetry", () => {
  it("returns a React lazy component wrapper", () => {
    const importFn = vi.fn().mockResolvedValue({ default: () => null });
    const LazyComp = lazyRetry(importFn);
    // React.lazy returns an object with $$typeof symbol
    expect((LazyComp as any).$$typeof).toBeDefined();
  });

  it("does not immediately invoke the import function", () => {
    const importFn = vi.fn().mockResolvedValue({ default: () => null });
    lazyRetry(importFn);
    expect(importFn).not.toHaveBeenCalled();
  });

  it("accepts a custom retry count", () => {
    const importFn = vi.fn().mockResolvedValue({ default: () => null });
    const LazyComp = lazyRetry(importFn, 5);
    expect((LazyComp as any).$$typeof).toBeDefined();
  });
});
