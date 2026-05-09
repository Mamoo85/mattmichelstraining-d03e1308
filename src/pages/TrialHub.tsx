import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";

const SUPABASE_URL = "https://eauvubfpanpeuxsrqesu.supabase.co";

type Tile = {
  key: string;
  label: string;
  tagline: string;
  accent: string;
  href: string;
  count: number | null;
};

type HubData = {
  bundle: { company_name: string; display_name: string; expires_at: string | null; created_at: string };
  products: Tile[];
};

export default function TrialHub() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_URL}/functions/v1/hub-summary?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j as HubData);
        else setError(j.error || "not_found");
      })
      .catch(() => setError("network"));
  }, [token]);

  const daysLeft = data?.bundle?.expires_at
    ? Math.max(0, Math.ceil((new Date(data.bundle.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <Helmet>
        <title>{data ? `${data.bundle.company_name} — Trial Hub` : "Trial Hub"} · Detroit Web Agency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="border-b border-white/10 bg-[#061021]">
        <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#00d4ff]/80">Detroit Web Agency</div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">
              {data?.bundle?.display_name || "Your Trial Hub"}
            </h1>
            {daysLeft !== null && (
              <div className="text-xs text-white/60 mt-1">
                {daysLeft > 0 ? `${daysLeft} days left in trial` : "Trial expired — let's talk"}
              </div>
            )}
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] underline underline-offset-4">
            (313) 992-1219
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            We couldn't load this hub. Double-check the link or text Matt at (313) 992-1219.
          </div>
        )}

        {!data && !error && (
          <div className="text-white/60 text-sm">Loading your dashboards…</div>
        )}

        {data && (
          <>
            <p className="text-white/70 text-base sm:text-lg leading-relaxed">
              All your active trials in one place. Click any tile to open the full dashboard for that tool.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {data.products.map((p) => (
                <a
                  key={p.key}
                  href={p.href}
                  className="group block rounded-xl border border-white/10 bg-[#0f1f35] p-5 hover:border-[#00d4ff]/60 transition-colors"
                >
                  <div
                    className="text-[11px] uppercase tracking-widest font-semibold mb-2"
                    style={{ color: p.accent }}
                  >
                    Trial · Active
                  </div>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-lg sm:text-xl font-bold">{p.label}</h2>
                    {typeof p.count === "number" && (
                      <span
                        className="text-2xl font-extrabold tabular-nums"
                        style={{ color: p.accent }}
                      >
                        {p.count}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white/80 mt-1">{p.tagline}</div>
                  {typeof p.count === "number" && (
                    <div className="text-xs text-white/40 mt-1">
                      {p.count === 0 ? "no new items in last 7 days" : `new in last 7 days`}
                    </div>
                  )}
                  <div
                    className="text-sm font-semibold mt-4 group-hover:underline"
                    style={{ color: p.accent }}
                  >
                    Open full dashboard →
                  </div>
                </a>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0f1f35] p-5 mt-8">
              <div className="text-sm text-white/70">
                Each dashboard above is the full tool — same one you'd see if you logged in directly.
                Counts refresh every time you reload this page.
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <a href="tel:+13139921219" className="text-sm font-semibold text-[#00d4ff]">
                  📞 (313) 992-1219
                </a>
                <a href="mailto:matt@detroitwebagent.com" className="text-sm font-semibold text-[#00d4ff]">
                  ✉️ matt@detroitwebagent.com
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
