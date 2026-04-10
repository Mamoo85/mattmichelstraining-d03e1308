const QUEUE_KEY = "dwa_offline_queue";
const JOBS_CACHE_KEY_PREFIX = "dwa_tech_jobs_";

export interface QueuedUpdate {
  jobId: string;
  status: string;
  timestamp: string;
}

export function getOfflineQueue(): QueuedUpdate[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addToOfflineQueue(update: QueuedUpdate): void {
  const q = getOfflineQueue();
  q.push(update);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function cacheJobs(techId: string, jobs: unknown[]): void {
  localStorage.setItem(`${JOBS_CACHE_KEY_PREFIX}${techId}`, JSON.stringify(jobs));
}

export function getCachedJobs(techId: string): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(`${JOBS_CACHE_KEY_PREFIX}${techId}`) || "[]");
  } catch {
    return [];
  }
}
