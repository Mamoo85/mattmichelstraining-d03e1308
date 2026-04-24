// Shared validator for tech_session_token. Used by tech-jobs-* functions.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TechSession {
  tech_id: string;
  client_id: string;
  tech_name: string | null;
  token: string;
}

export async function validateTechSession(
  sb: SupabaseClient,
  token: string | undefined | null,
): Promise<TechSession | null> {
  if (!token || typeof token !== "string" || token.length < 32) return null;

  const { data, error } = await sb
    .from("tech_sessions")
    .select("token, tech_id, client_id, tech_name, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[validateTechSession] lookup error:", error);
    return null;
  }
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  // Touch last_used_at — best-effort, don't block
  sb.from("tech_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {}, () => {});

  return {
    token: data.token,
    tech_id: data.tech_id,
    client_id: data.client_id,
    tech_name: data.tech_name,
  };
}

export function makeServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}
