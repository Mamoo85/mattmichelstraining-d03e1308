import { lazy } from "react";

const LAZY_IMPORT_RETRY_PATTERN =
  /loading chunk|failed to fetch|dynamically imported module|import|loading css chunk|load failed|typeerror.*module/i;

export const retryLazyImport = async (
  importFn: () => Promise<any>,
  retries: number,
): Promise<any> => {
  try {
    const module = await importFn();
    if (!module?.default) {
      throw new Error("Lazy import resolved without a default export");
    }
    return module;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (retries > 0 && LAZY_IMPORT_RETRY_PATTERN.test(err.message)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return retryLazyImport(importFn, retries - 1);
    }
    throw err;
  }
};

/** Retry wrapper for lazy imports — retries up to 3 times on chunk load failure */
export function lazyRetry(
  importFn: () => Promise<any>,
  retries = 3,
): ReturnType<typeof lazy> {
  return lazy(() => retryLazyImport(importFn, retries));
}
