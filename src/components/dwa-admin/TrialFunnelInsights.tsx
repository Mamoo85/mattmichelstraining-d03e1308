import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type FunnelRow = { product: string | null; event_type: string; n: number };
type EmailRow = {
  template_name: string | null;
  sent: number;
  opened: number;
  clicked: number;
};

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
];

export default function TrialFunnelInsights() {
  const [hours, setHours] = useState(24 * 7);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

        // Funnel events — pull raw and bucket client-side (small volume).
        const { data: ev, error: e1 } = await supabase
          .from("trial_funnel_events" as any)
          .select("product,event_type,created_at")
          .gte("created_at", since)
          .limit(5000);
        if (e1) throw e1;

        const fmap = new Map<string, FunnelRow>();
        for (const r of (ev || []) as any[]) {
          const key = `${r.product || "(none)"}::${r.event_type}`;
          const cur = fmap.get(key) || {
            product: r.product || "(none)",
            event_type: r.event_type,
            n: 0,
          };
          cur.n += 1;
          fmap.set(key, cur);
        }

        // Email log — cold/trial campaigns. Bucket by template.
        const { data: em, error: e2 } = await supabase
          .from("email_send_log" as any)
          .select("template_name,status,opened_at,clicked_at,created_at")
          .gte("created_at", since)
          .limit(5000);
        if (e2) throw e2;

        const emap = new Map<string, EmailRow>();
        for (const r of (em || []) as any[]) {
          const key = r.template_name || "(none)";
          const cur = emap.get(key) || {
            template_name: key,
            sent: 0,
            opened: 0,
            clicked: 0,
          };
          if (r.status === "sent" || r.opened_at || r.clicked_at) cur.sent += 1;
          if (r.opened_at) cur.opened += 1;
          if (r.clicked_at) cur.clicked += 1;
          emap.set(key, cur);
        }

        if (cancelled) return;
        setFunnel(
          Array.from(fmap.values()).sort(
            (a, b) =>
              (a.product || "").localeCompare(b.product || "") ||
              a.event_type.localeCompare(b.event_type),
          ),
        );
        setEmails(
          Array.from(emap.values())
            .filter((r) => r.sent > 0)
            .sort((a, b) => b.clicked - a.clicked || b.opened - a.opened),
        );
      } catch (e: any) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hours]);

  // Pivot funnel rows to product → events
  const products = Array.from(
    new Set(funnel.map((r) => r.product || "(none)")),
  ).sort();
  const eventTypes = ["view", "form_focus", "form_submit", "checkout_redirect", "trial_success", "trial_error"];
  const get = (p: string, e: string) =>
    funnel.find((r) => (r.product || "(none)") === p && r.event_type === e)?.n || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Trial Funnel & Email Insights</h2>
          <p className="text-white/50 text-sm">
            Landing-page funnel events + cold email open/click rates.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setHours(r.hours)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded border ${
                hours === r.hours
                  ? "bg-[#00d4ff] text-[#0a1628] border-[#00d4ff]"
                  : "bg-white/5 text-white/70 border-white/10 hover:border-white/30"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <>
          <section className="bg-white/5 border border-white/10 rounded">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-widest">
                Trial Funnel by Product
              </h3>
              <span className="text-xs text-white/40">
                {products.length} products · {funnel.reduce((s, r) => s + r.n, 0)} events
              </span>
            </div>
            {products.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">
                No trial-funnel events yet in this range. Tracking is wired —
                data lands as visitors hit /start-trial pages.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-white/50 text-xs uppercase tracking-widest">
                    <tr>
                      <th className="text-left px-4 py-2">Product</th>
                      {eventTypes.map((e) => (
                        <th key={e} className="text-right px-3 py-2">{e}</th>
                      ))}
                      <th className="text-right px-4 py-2">CR%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const views = get(p, "view");
                      const success = get(p, "trial_success");
                      const cr = views > 0 ? ((success / views) * 100).toFixed(1) : "—";
                      return (
                        <tr key={p} className="border-t border-white/5">
                          <td className="px-4 py-2 font-mono text-white/90">{p}</td>
                          {eventTypes.map((e) => (
                            <td key={e} className="px-3 py-2 text-right text-white/80">
                              {get(p, e) || <span className="text-white/20">·</span>}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-bold text-[#00d4ff]">
                            {cr === "—" ? cr : `${cr}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-widest">
                Email Open/Click by Template
              </h3>
              <span className="text-xs text-white/40">
                Requires Resend webhook → resend-webhook fn
              </span>
            </div>
            {emails.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">
                No email sends with open/click data yet in this range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-white/50 text-xs uppercase tracking-widest">
                    <tr>
                      <th className="text-left px-4 py-2">Template</th>
                      <th className="text-right px-3 py-2">Sent</th>
                      <th className="text-right px-3 py-2">Opened</th>
                      <th className="text-right px-3 py-2">Clicked</th>
                      <th className="text-right px-3 py-2">Open%</th>
                      <th className="text-right px-4 py-2">Click%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((r) => {
                      const op = r.sent > 0 ? ((r.opened / r.sent) * 100).toFixed(1) : "—";
                      const cl = r.sent > 0 ? ((r.clicked / r.sent) * 100).toFixed(1) : "—";
                      return (
                        <tr key={r.template_name || ""} className="border-t border-white/5">
                          <td className="px-4 py-2 font-mono text-white/90">{r.template_name}</td>
                          <td className="px-3 py-2 text-right text-white/80">{r.sent}</td>
                          <td className="px-3 py-2 text-right text-white/80">{r.opened}</td>
                          <td className="px-3 py-2 text-right text-white/80">{r.clicked}</td>
                          <td className="px-3 py-2 text-right text-white/80">{op === "—" ? op : `${op}%`}</td>
                          <td className="px-4 py-2 text-right font-bold text-[#00d4ff]">
                            {cl === "—" ? cl : `${cl}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
