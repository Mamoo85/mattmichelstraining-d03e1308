// Shared admin JWT gate for admin-only edge functions.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface AdminCheck {
  ok: boolean;
  status: number;
  error?: string;
  user_id?: string;
}

/** Returns { ok: true, user_id } if caller's JWT belongs to a user with the 'admin' role. */
export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return { ok: false, status: 401, error: "Unauthorized" };

    const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return { ok: false, status: 403, error: "Forbidden" };

    return { ok: true, status: 200, user_id: user.id };
  } catch (e) {
    return { ok: false, status: 401, error: (e as Error).message };
  }
}

export function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeHttpsUrl(u: unknown): string {
  if (!u) return "#";
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return escapeHtml(s);
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(s)) return escapeHtml("https://" + s);
  return "#";
}
