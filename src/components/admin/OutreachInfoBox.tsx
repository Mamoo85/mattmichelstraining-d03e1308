import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, Mail, Phone, MapPin, Lock, Star, AlertTriangle, Info } from "lucide-react";

const LS_KEY = "dwa_outreach_infobox_collapsed_v1";

export default function OutreachInfoBox() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="bg-card border border-cyan-700/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-background/30"
      >
        <div className="flex items-center gap-2">
          <Info size={14} className="text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            What this tab means · How outreach works
          </span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border px-4 py-4 space-y-4 text-[12px] leading-relaxed text-muted-foreground">

          <Section icon={<ShieldCheck size={13} className="text-emerald-400" />} title="Are these verified real contacts?">
            <p>
              Each prospect goes through a 6-stage email verification waterfall. The badge on every row tells you the truth:
            </p>
            <ul className="mt-2 space-y-1 ml-4 list-disc">
              <li><b className="text-emerald-300">Verified ✓</b> — email confirmed by Snov, Apollo, Hunter, or pattern verification (SMTP-checked).</li>
              <li><b className="text-amber-300">Guess</b> — pattern-generated (e.g. <code>info@domain.com</code>); deliverable but unverified.</li>
              <li><b className="text-red-300">No email</b> — enrichment hasn't found one. Click <b>Enrich</b> to retry the waterfall.</li>
            </ul>
          </Section>

          <Section icon={<Mail size={13} className="text-cyan-400" />} title="How we enrich emails (6-stage waterfall)">
            <ol className="mt-1 ml-4 list-decimal space-y-0.5">
              <li><b>site_scrape</b> — pull contact emails directly from the company website.</li>
              <li><b>snov</b> — Snov.io domain lookup.</li>
              <li><b>apollo</b> — Apollo.io company match.</li>
              <li><b>pattern_verify</b> — guess <code>first.last@domain</code>, SMTP-verify before saving.</li>
              <li><b>hunter</b> — Hunter.io role-priority (owner/CEO/manager).</li>
              <li><b>pdl</b> — People Data Labs by company + city, then name-only fallback for healthcare records.</li>
            </ol>
            <p className="mt-2">Click <b>Audit</b> on any row to see the exact trace and which stage hit.</p>
          </Section>

          <Section icon={<Phone size={13} className="text-emerald-400" />} title="Cold email vs cold SMS — different rules">
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li><b className="text-emerald-300">Email</b>: B2B legitimate-interest is allowed under CAN-SPAM. Every send includes a one-click unsubscribe footer; clicks are logged with IP + timestamp to the audit log.</li>
              <li><b className="text-amber-300">SMS</b>: TCPA-restricted. We <b>never</b> cold-text. The <b>SMS column</b> shows consent status — only prospects with <b>🟢 Consented</b> can receive an SMS, and only between 8am-9pm local. Consent expires automatically after 18 months (TCPA EBR).</li>
            </ul>
          </Section>

          <Section icon={<Star size={13} className="text-amber-400" />} title="Lead quality score (0–100)">
            <p>The score above each row is computed from three signals:</p>
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li><b>Email validity</b> (40 pts) — verified=40, guess=20, none=0.</li>
              <li><b>Enrichment confidence</b> (30 pts) — best stage's confidence × 30.</li>
              <li><b>Territory match</b> (30 pts) — primary=30, secondary=20, opportunistic=10.</li>
            </ul>
            <p className="mt-2">Use the <b>Min quality</b> slider in the global settings to auto-hide demo / low-confidence leads. The send pipeline also respects this — anything below the threshold is skipped and logged.</p>
          </Section>

          <Section icon={<MapPin size={13} className="text-cyan-400" />} title="Territory priority">
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li><b>1 — Primary</b>: your home metro (Detroit / Wayne / Oakland / Macomb).</li>
              <li><b>2 — Secondary</b>: outer Michigan markets you'll serve but don't lead with.</li>
              <li><b>3 — Opportunistic</b>: out-of-territory; only contact if no closer match exists.</li>
            </ul>
          </Section>

          <Section icon={<Lock size={13} className="text-amber-400" />} title="Why are some leads locked?">
            <p>
              When a contractor claims a lead in the <b>Marketplace</b>, the lead is soft-locked to that company for the access TTL (default 30 days).
              The <b>FB ID</b> field on a lead is the Facebook lead-ad ID it came from — used for de-duplication and Meta Ads attribution.
              To unlock or reassign a locked lead, open the <b>Marketplace tab → Lead detail → Override</b>. To request access for a different contractor, expire the lock first.
            </p>
          </Section>

          <Section icon={<AlertTriangle size={13} className="text-red-400" />} title="What you should do here">
            <ol className="mt-1 ml-4 list-decimal space-y-0.5">
              <li>Use the <b>Scrape</b> panel to pull more contractors by trade + city.</li>
              <li>Click <b>Enrich</b> on any prospect missing an email.</li>
              <li>For SMS: <b>only</b> mark consent after a real reply / verbal yes / written form. This is your TCPA paper trail.</li>
              <li>Use the <b>Auto-Blast</b> button on real unclaimed leads — the system handles suppression, daily caps, and audit logging.</li>
              <li>Click <b>Audit</b> on any prospect (or open the global <b>Outreach Audit Log</b>) to see every send / open / click / unsubscribe with timestamps.</li>
            </ol>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground mb-1.5">
        {icon} {title}
      </h4>
      <div>{children}</div>
    </div>
  );
}
