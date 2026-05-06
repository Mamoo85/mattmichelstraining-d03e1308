/**
 * Turn any Supabase / unknown error into a readable string.
 * Avoids the dreaded "[object Object]" toast.
 */
export function formatSupabaseError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const anyE = e as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof anyE.message === "string" && anyE.message) parts.push(anyE.message);
  if (typeof anyE.details === "string" && anyE.details) parts.push(anyE.details);
  if (typeof anyE.hint === "string" && anyE.hint) parts.push(`(hint: ${anyE.hint})`);
  if (typeof anyE.code === "string" && anyE.code) parts.push(`[${anyE.code}]`);
  if (parts.length) return parts.join(" — ");
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
