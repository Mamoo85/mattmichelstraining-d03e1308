// Cross-product cold email dedup — single source of truth.
// Call wasRecentlyEmailed() BEFORE any cold send to prevent the same inbox
// receiving multiple DWA product pitches within the dedup window.
// Queries email_send_log which all dwaColdEmail() calls write to.

/**
 * Returns true if this email address received ANY cold send in the last `windowDays` days.
 * Fails open on DB error — never blocks a send due to DB issues.
 */
export async function wasRecentlyEmailed(
  sb: { from: (t: string) => any },
  email: string,
  windowDays = 5,
): Promise<boolean> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { count } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .ilike("recipient_email", email.trim().toLowerCase())
      .in("status", ["sent", "queued", "pending"])
      .gte("created_at", since);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Returns the template names sent to this email in the last N days.
 * Use to determine which drip steps have already fired.
 */
export async function recentTemplatesSent(
  sb: { from: (t: string) => any },
  email: string,
  windowDays = 30,
): Promise<Set<string>> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await sb
      .from("email_send_log")
      .select("template_name")
      .ilike("recipient_email", email.trim().toLowerCase())
      .in("status", ["sent", "queued", "pending"])
      .gte("created_at", since);
    return new Set((data || []).map((r: any) => r.template_name).filter(Boolean));
  } catch {
    return new Set();
  }
}
