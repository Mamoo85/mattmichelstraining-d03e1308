// Cross-product cold-email dedup.
// Prevents the same recipient from getting more than one cold pitch per
// rolling window across ALL templates/products. Drip follow-ups (D3/D7/D14)
// are separately scheduled by last_contact_date and bypass this.

export async function wasContactedRecently(
  sb: { from: (t: string) => any },
  email: string,
  days = 5,
): Promise<boolean> {
  if (!email) return false;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { count, error } = await sb
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .ilike("recipient_email", email.trim().toLowerCase())
    .in("status", ["sent", "queued", "pending"])
    .gte("created_at", since);
  if (error) {
    // Fail OPEN — don't block sends because the dedup query failed.
    console.warn("[cold-dedup] query failed, allowing send:", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}
