import { useMemo, useState } from "react";

/**
 * In-admin onboarding playbook for website-hosting clients.
 * Step status persists to localStorage per client so this doubles as a live
 * progress tracker — reusable for every future client, starting with D.J. Conley.
 */

type Step = {
  id: string;
  title: string;
  who: "You" | "Client" | "Auto";
  detail: string;
  copy?: { label: string; value: string };
};

const SANDBOX_STEPS: Step[] = [
  {
    id: "sb-1",
    title: "Verify the cloned site is pixel-exact",
    who: "You",
    detail: "Open the sandbox and click every nav page. Confirm it matches the live djconley.com (navy/red, real logo, all images load, no 404s).",
    copy: { label: "Preview URL", value: "/sandbox/djconley" },
  },
  {
    id: "sb-2",
    title: "Add sandbox.djconley.com to Vercel",
    who: "You",
    detail: "Vercel project → Settings → Domains → Add → sandbox.djconley.com. Vercel will show the CNAME to give the client and auto-issue SSL once it resolves.",
  },
  {
    id: "sb-3",
    title: "Send the client ONE DNS record",
    who: "Client",
    detail: "Email their IT/registrar contact the single CNAME below. Reassure them: their live site and email are completely untouched — this only creates a new subdomain.",
    copy: { label: "DNS record", value: "Type: CNAME   Host: sandbox   Value: cname.vercel-dns.com   TTL: Automatic" },
  },
  {
    id: "sb-4",
    title: "Confirm DNS resolved + HTTPS valid",
    who: "Auto",
    detail: "Once they add the record (minutes to a few hours), load https://sandbox.djconley.com — confirm the padlock (valid SSL) and that every page returns 200.",
    copy: { label: "Live sandbox", value: "https://sandbox.djconley.com" },
  },
  {
    id: "sb-5",
    title: "Provision their tenant + verify each radar",
    who: "You",
    detail: "Create the D.J. Conley tenant (industry = industrial_boiler) and confirm each radar produces a live row: SiteRadar, Missed-Call, FieldDesk, TechAlert, Trade Radar, Outreach, Reviews. A radar is 'ready' only when a freshly-triggered scan writes a real row that shows in the Command Center.",
  },
  {
    id: "sb-6",
    title: "Send Pat his Command Center login",
    who: "Client",
    detail: "Send Pat the admin link below. He enters his email and gets a one-click secure login link — no password to share.",
    copy: { label: "Command Center", value: "https://sandbox.djconley.com/sandbox/djconley/admin" },
  },
  {
    id: "sb-7",
    title: "Review exactly what Pat sees",
    who: "You",
    detail: "Use the 'View as Pat' buttons above to open the public site and the Command Center yourself before he does. Fix anything that looks off.",
  },
];

const GOLIVE_STEPS: Step[] = [
  {
    id: "gl-1",
    title: "Lower apex + www DNS TTL to 300s",
    who: "Client",
    detail: "24–48h before cutover, drop the TTL on the djconley.com and www records to 300 seconds so the switch propagates fast and rollback is instant.",
  },
  {
    id: "gl-2",
    title: "Snapshot their full DNS zone (protect email!)",
    who: "You",
    detail: "Export every existing record. NEVER change MX, SPF, DKIM, or DMARC — those run their email. We only touch the web (A / www CNAME) records.",
  },
  {
    id: "gl-3",
    title: "Add djconley.com + www to Vercel",
    who: "You",
    detail: "Add both apex and www as domains in the Vercel project.",
  },
  {
    id: "gl-4",
    title: "Cut over the web records",
    who: "Client",
    detail: "Point the apex A record and www CNAME to Vercel (values below). Use an ALIAS/ANAME at the apex if the registrar supports it.",
    copy: { label: "Records", value: "apex djconley.com → A 76.76.21.21    |    www → CNAME cname.vercel-dns.com" },
  },
  {
    id: "gl-5",
    title: "Verify everything post-cutover",
    who: "You",
    detail: "All pages 200, SSL valid, http→https + non-www→www redirects correct, contact forms submit, and a test email to their domain still delivers.",
  },
  {
    id: "gl-6",
    title: "Restore TTL + start billing",
    who: "You",
    detail: "Raise TTL back to normal, switch them to the paid hosting plan, and flip the Command Center from trial to full real-data mode. Keep the sandbox subdomain as staging.",
  },
];

const WHO_STYLE: Record<Step["who"], string> = {
  You: "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/30",
  Client: "bg-amber-400/20 text-amber-300 border-amber-400/30",
  Auto: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
};

function useChecklist(clientKey: string) {
  const storeKey = `onboarding:${clientKey}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { return {}; }
  });
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  return { done, toggle };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-2 shrink-0 rounded border border-white/15 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function Checklist({ title, steps, clientKey }: { title: string; steps: Step[]; clientKey: string }) {
  const { done, toggle } = useChecklist(clientKey);
  const completed = steps.filter((s) => done[s.id]).length;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1b30] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <span className="text-xs text-white/50">{completed}/{steps.length} done</span>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.id} className={`rounded-lg border p-3 transition ${done[s.id] ? "border-emerald-400/30 bg-emerald-400/5" : "border-white/10 bg-white/5"}`}>
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggle(s.id)}
                aria-label="Toggle step"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${done[s.id] ? "border-emerald-400 bg-emerald-400 text-[#0a1628]" : "border-white/30 text-transparent hover:border-white/60"}`}
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">{i + 1}.</span>
                  <span className={`text-sm font-semibold ${done[s.id] ? "text-white/60 line-through" : "text-white"}`}>{s.title}</span>
                  <span className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${WHO_STYLE[s.who]}`}>{s.who}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/60">{s.detail}</p>
                {s.copy && (
                  <div className="mt-2 flex items-center rounded bg-[#0a1628] px-2 py-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-white/40">{s.copy.label}:</span>
                    <code className="ml-2 truncate text-[11px] text-[#00d4ff]">{s.copy.value}</code>
                    <CopyButton value={s.copy.value} />
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ClientOnboardingGuide() {
  // Single client for now; structured so additional clients drop in later.
  const clientKey = "djconley";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/sandbox/djconley`;
  const adminUrl = `${origin}/sandbox/djconley/admin`;
  const liveSandbox = "https://sandbox.djconley.com";

  const links = useMemo(
    () => [
      { label: "👁 View public site as Pat", href: publicUrl, hint: "Exact clone of djconley.com" },
      { label: "🔐 Open Command Center", href: adminUrl, hint: "Magic-link admin (Pat's backend)" },
    ],
    [publicUrl, adminUrl],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#00d4ff]/30 bg-gradient-to-r from-[#00d4ff]/10 to-transparent p-5">
        <h2 className="text-lg font-bold text-white">Client Onboarding — D.J. Conley Associates</h2>
        <p className="mt-1 text-sm text-white/60">
          First website hosting client. Follow the sandbox checklist to prove our hosting on their domain risk-free,
          then the go-live checklist after they sign. Progress saves automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
              className="group rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">
              {l.label}
              <span className="block text-[11px] text-white/40 group-hover:text-white/60">{l.hint}</span>
            </a>
          ))}
        </div>
        <div className="mt-3 flex items-center rounded bg-[#0a1628] px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-white/40">Live trial URL (after DNS):</span>
          <code className="ml-2 truncate text-[11px] text-[#00d4ff]">{liveSandbox}</code>
          <CopyButton value={liveSandbox} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Checklist title="① Sandbox onboarding (free trial)" steps={SANDBOX_STEPS} clientKey={`${clientKey}:sandbox`} />
        <Checklist title="② Official go-live (after they sign)" steps={GOLIVE_STEPS} clientKey={`${clientKey}:golive`} />
      </div>
    </div>
  );
}
