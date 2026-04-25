import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

// Lightweight buyer email hashing for display (privacy in admin UI)
function maskEmail(e?: string | null) {
  if (!e) return "—";
  const [u, d] = e.split("@");
  if (!d) return "•••";
  return `${u.slice(0, 2)}•••@${d}`;
}
function fmt(d?: string | null) { return d ? new Date(d).toLocaleString() : "—"; }

export default function AdminMarketplaceAudit() {
  const { data: locks = [] } = useQuery({
    queryKey: ["mp_audit_locks"],
    queryFn: async () => (await supabase.from("marketplace_lead_locks" as any)
      .select("id, lead_id, product, buyer_email, status, locked_at, sold_at, access_expires_at, revoked_at, revoke_reason, email_sent_at, stripe_session_id, amount_cents")
      .order("created_at", { ascending: false }).limit(200)).data ?? [],
    refetchInterval: 30_000,
  });
  const { data: pdfs = [] } = useQuery({
    queryKey: ["mp_audit_pdfs"],
    queryFn: async () => (await supabase.from("marketplace_lead_pdfs" as any)
      .select("id, lead_id, product, buyer_email, storage_path, signed_url_expires_at, created_at")
      .order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: redeems = [] } = useQuery({
    queryKey: ["mp_audit_redeems"],
    queryFn: async () => (await supabase.from("marketplace_share_redeem_log" as any)
      .select("id, share_id, token_hash, ip_hash, outcome, reason, created_at")
      .order("created_at", { ascending: false }).limit(200)).data ?? [],
    refetchInterval: 30_000,
  });

  const sold = (locks as any[]).filter(l => l.status === "sold").length;
  const revoked = (locks as any[]).filter(l => !!l.revoked_at).length;
  const expired = (locks as any[]).filter(l => l.status === "expired").length;
  const blocked = (redeems as any[]).filter(r => r.outcome === "rate_limited").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Sold (last 200)" value={sold} />
        <Stat label="Revoked / refunded" value={revoked} tone="danger" />
        <Stat label="Expired (TTL)" value={expired} tone="warn" />
        <Stat label="Redeem rate-limited" value={blocked} tone="warn" />
      </div>

      <Section title="🛒 Marketplace Purchases & Atomic Claims">
        <Table headers={["When sold", "Lead", "Product", "Buyer (masked)", "Status", "Access expires", "Email sent", "$"]}>
          {(locks as any[]).map(l => (
            <tr key={l.id} className="border-t border-border/40">
              <Td>{fmt(l.sold_at || l.locked_at)}</Td>
              <Td mono>{String(l.lead_id).slice(0, 8)}</Td>
              <Td>{l.product}</Td>
              <Td>{maskEmail(l.buyer_email)}</Td>
              <Td>
                <Badge variant="outline" className={statusTone(l)}>
                  {l.revoked_at ? `revoked (${l.revoke_reason || "?"})` : l.status}
                </Badge>
              </Td>
              <Td>{fmt(l.access_expires_at)}</Td>
              <Td>{l.email_sent_at ? "✅" : "⏳"}</Td>
              <Td>{l.amount_cents ? `$${(l.amount_cents / 100).toFixed(2)}` : "—"}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="📄 PDF Generation">
        <Table headers={["Generated", "Lead", "Product", "Buyer", "Path", "Signed URL expires"]}>
          {(pdfs as any[]).map(p => (
            <tr key={p.id} className="border-t border-border/40">
              <Td>{fmt(p.created_at)}</Td>
              <Td mono>{String(p.lead_id).slice(0, 8)}</Td>
              <Td>{p.product}</Td>
              <Td>{maskEmail(p.buyer_email)}</Td>
              <Td mono className="truncate max-w-[200px]">{p.storage_path}</Td>
              <Td>{fmt(p.signed_url_expires_at)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="🔗 Share-Token Redemptions">
        <Table headers={["When", "Outcome", "Reason", "Token hash", "IP hash", "Share id"]}>
          {(redeems as any[]).map(r => (
            <tr key={r.id} className="border-t border-border/40">
              <Td>{fmt(r.created_at)}</Td>
              <Td>
                <Badge variant="outline" className={
                  r.outcome === "success" ? "border-emerald-500/40 text-emerald-300" :
                  r.outcome === "rate_limited" ? "border-amber-500/40 text-amber-300" :
                  "border-red-500/40 text-red-300"
                }>{r.outcome}</Badge>
              </Td>
              <Td>{r.reason || "—"}</Td>
              <Td mono className="truncate max-w-[140px]">{String(r.token_hash).slice(0, 12)}…</Td>
              <Td mono className="truncate max-w-[140px]">{String(r.ip_hash || "").slice(0, 12)}…</Td>
              <Td mono>{r.share_id ? String(r.share_id).slice(0, 8) : "—"}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}

function statusTone(l: any) {
  if (l.revoked_at) return "border-red-500/40 text-red-300";
  if (l.status === "expired") return "border-amber-500/40 text-amber-300";
  if (l.status === "sold") return "border-emerald-500/40 text-emerald-300";
  return "border-border text-muted-foreground";
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const toneClass = tone === "danger" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/20 text-muted-foreground">
        <tr>{headers.map(h => <th key={h} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, mono, className }: { children: React.ReactNode; mono?: boolean; className?: string }) {
  return <td className={`px-2 py-1.5 ${mono ? "font-mono" : ""} ${className || ""}`}>{children}</td>;
}
