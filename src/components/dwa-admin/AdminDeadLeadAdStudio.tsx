import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Trade = "Roofing" | "HVAC" | "Plumbing" | "Electrical" | "Solar" | "General Contractor";
type Geo = "Texas" | "Florida" | "Georgia" | "Arizona" | "Michigan" | "National";
type Pain = "Money left behind" | "Competitors stealing leads" | "Time waste";

type CampaignResult = {
  headlines: string[];
  bodies: { short: string; medium: string; long: string };
  instagram_caption: string;
  targeting_notes: string;
  roi_math: string;
  postcard_headline: string;
  email_subject: string;
  email_body: string;
  podcast_pitch: string;
  linkedin_post: string;
};

const TRADE_MATH: Record<Trade, { contacts: number; reply_rate: number; avg_job: number }> = {
  Roofing:           { contacts: 400, reply_rate: 0.05, avg_job: 12000 },
  HVAC:              { contacts: 350, reply_rate: 0.06, avg_job: 4500 },
  Plumbing:          { contacts: 300, reply_rate: 0.06, avg_job: 3800 },
  Electrical:        { contacts: 280, reply_rate: 0.05, avg_job: 5200 },
  Solar:             { contacts: 500, reply_rate: 0.04, avg_job: 28000 },
  "General Contractor": { contacts: 450, reply_rate: 0.05, avg_job: 18000 },
};

const TRADE_INTERESTS: Record<Trade, string[]> = {
  Roofing:           ["National Roofing Contractors Association", "Roofing Contractor magazine", "Owens Corning", "GAF Roofing"],
  HVAC:              ["Air Conditioning Contractors of America", "HVAC-R News", "Carrier", "Trane Technologies"],
  Plumbing:          ["Plumbing-Heating-Cooling Contractors", "Plumbing Engineer", "Ferguson Enterprises"],
  Electrical:        ["National Electrical Contractors Association", "Electrical Contractor magazine", "Eaton Corporation"],
  Solar:             ["Solar Energy Industries Association", "SolarEdge", "Enphase Energy"],
  "General Contractor": ["Associated General Contractors of America", "Constructor magazine", "Procore"],
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs px-2 py-1 rounded bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 transition-colors"
    >
      {copied ? "✓ Copied" : `📋 ${label || "Copy"}`}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
      <p className="text-[#00d4ff] text-xs font-bold uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

export default function AdminDeadLeadAdStudio() {
  const [tab, setTab] = useState<"brief" | "creative" | "targeting" | "checklist">("brief");
  const [trade, setTrade] = useState<Trade>("Roofing");
  const [geo, setGeo] = useState<Geo>("Texas");
  const [pain, setPain] = useState<Pain>("Money left behind");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [checklist, setChecklist] = useState({
    landing: false, pilot: false, pixel: false, campaign: false, postcards: false, copy_match: false,
  });

  const math = TRADE_MATH[trade];
  const replies = Math.round(math.contacts * math.reply_rate);
  const potential = replies * math.avg_job;
  const cost = replies * 50;
  const roi = Math.round(potential / cost);

  async function generate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dead-lead-campaign", {
        body: { trade, geography: geo, pain_angle: pain },
      });
      if (error) throw error;
      setResult(data as CampaignResult);
      setTab("creative");
      toast.success("Campaign generated — review the creative");
    } catch (e: any) {
      toast.error(`Generation failed: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: "brief", label: "📋 Campaign Brief" },
    { id: "creative", label: "✍️ Ad Creative" },
    { id: "targeting", label: "🎯 Targeting Specs" },
    { id: "checklist", label: "✅ Launch Checklist" },
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Dead Lead Ad Studio</h2>
        <p className="text-white/50 text-sm mt-1">Generate HBS-level ad campaigns for Dead Lead Reactivation in any market.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg transition-colors ${
              tab === t.id ? "bg-[#00d4ff] text-[#0a1628]" : "text-white/50 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Brief tab */}
      {tab === "brief" && (
        <div className="space-y-6">
          {/* ROI preview */}
          <Card title="Live ROI Math — Updates as You Select">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Avg contacts in database", value: math.contacts.toLocaleString() },
                { label: "Expected replies (5-6%)", value: replies.toString() },
                { label: "Revenue potential", value: `$${potential.toLocaleString()}` },
                { label: "Cost (@ $50/reply)", value: `$${cost.toLocaleString()} → ${roi}x ROI` },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/40 text-xs">{s.label}</p>
                  <p className="text-white font-bold text-lg mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Trade</label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value as Trade)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                {(Object.keys(TRADE_MATH) as Trade[]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Geography</label>
              <select
                value={geo}
                onChange={(e) => setGeo(e.target.value as Geo)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                {(["Texas", "Florida", "Georgia", "Arizona", "Michigan", "National"] as Geo[]).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">Primary Pain Angle</label>
              <select
                value={pain}
                onChange={(e) => setPain(e.target.value as Pain)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                {(["Money left behind", "Competitors stealing leads", "Time waste"] as Pain[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-[#00d4ff] text-[#0a1628] font-bold py-3 rounded-xl text-sm hover:bg-[#00d4ff]/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Generating with Opus AI…" : "🚀 Generate Full Campaign Package"}
          </button>
        </div>
      )}

      {/* Creative tab */}
      {tab === "creative" && !result && (
        <div className="text-center py-12 text-white/40">
          <p>Generate a campaign first in the Brief tab.</p>
        </div>
      )}
      {tab === "creative" && result && (
        <div className="space-y-5">
          <Card title="Facebook / Instagram Headlines (A/B Test All 5)">
            <div className="space-y-2">
              {result.headlines.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-4 py-2">
                  <p className="text-white text-sm flex-1">{h}</p>
                  <CopyButton text={h} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ad Body — Short (50 words) — Mobile Feed">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.bodies.short}</p>
            <CopyButton text={result.bodies.short} label="Copy Short" />
          </Card>

          <Card title="Ad Body — Medium (150 words) — Facebook Feed">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.bodies.medium}</p>
            <CopyButton text={result.bodies.medium} label="Copy Medium" />
          </Card>

          <Card title="Ad Body — Long (300 words) — Facebook Detailed">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.bodies.long}</p>
            <CopyButton text={result.bodies.long} label="Copy Long" />
          </Card>

          <Card title="Instagram Caption">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.instagram_caption}</p>
            <CopyButton text={result.instagram_caption} label="Copy Caption" />
          </Card>

          <Card title="Lob Postcard Headline">
            <p className="text-white/80 text-sm">{result.postcard_headline}</p>
            <CopyButton text={result.postcard_headline} label="Copy Postcard" />
          </Card>

          <Card title="Follow-Up Email">
            <p className="text-[#00d4ff] text-xs mb-1">Subject: {result.email_subject}</p>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.email_body}</p>
            <CopyButton text={`Subject: ${result.email_subject}\n\n${result.email_body}`} label="Copy Email" />
          </Card>

          <Card title="Podcast Guest Pitch">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.podcast_pitch}</p>
            <CopyButton text={result.podcast_pitch} label="Copy Pitch" />
          </Card>

          <Card title="LinkedIn Post">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.linkedin_post}</p>
            <CopyButton text={result.linkedin_post} label="Copy Post" />
          </Card>

          <div className="flex gap-3">
            <a
              href="https://ads.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center bg-[#1877F2] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#1877F2]/90 transition-colors"
            >
              🔗 Open Meta Ads Manager
            </a>
            <button
              onClick={() => setTab("targeting")}
              className="flex-1 bg-white/10 text-white font-semibold py-3 rounded-xl text-sm hover:bg-white/15 transition-colors"
            >
              View Targeting Specs →
            </button>
          </div>
        </div>
      )}

      {/* Targeting tab */}
      {tab === "targeting" && (
        <div className="space-y-5">
          <Card title="Meta Audience Settings">
            <div className="space-y-3 text-sm">
              {[
                { label: "Age", value: "35–60" },
                { label: "Locations", value: `${geo} — All cities, towns, 50mi radius around major metros` },
                { label: "Interests", value: TRADE_INTERESTS[trade].join(", ") },
                { label: "Behaviors", value: "Small business owners, Business page admins, HomeAdvisor users" },
                { label: "Placements", value: "Facebook Feed + Instagram Feed only — exclude Audience Network and Messenger" },
                { label: "Bid strategy", value: "Cost per result goal: $35–50. Start with Advantage+ audience." },
                { label: "Daily budget", value: "$30/day to start. Scale to $60 once CPL drops below $40." },
                { label: "Creative format", value: "Single image or short video (15–30 sec). No carousels for cold traffic." },
                { label: "Landing page", value: geo === "Texas" && trade === "Roofing" ? "detroitwebagent.com/dead-leads-roofing-texas" : geo === "Florida" && trade === "HVAC" ? "detroitwebagent.com/dead-leads-hvac-florida" : geo === "Florida" && trade === "Roofing" ? "detroitwebagent.com/dead-leads-roofing-florida" : "detroitwebagent.com/dead-lead-intake" },
              ].map((row) => (
                <div key={row.label} className="flex gap-3">
                  <span className="text-white/40 w-32 flex-shrink-0">{row.label}</span>
                  <span className="text-white/80">{row.value}</span>
                </div>
              ))}
            </div>
            {result && <CopyButton text={result.targeting_notes} label="Copy All Targeting Notes" />}
          </Card>

          <Card title="ROI Benchmark — When to Scale">
            <div className="space-y-2 text-sm text-white/70">
              <p>• <strong className="text-white">CPL &lt; $30:</strong> Double budget weekly</p>
              <p>• <strong className="text-white">CPL $30–50:</strong> Hold budget, test new headline variants</p>
              <p>• <strong className="text-white">CPL &gt; $60:</strong> Pause and swap creative. Don't increase budget.</p>
              <p>• <strong className="text-white">First conversion:</strong> Request a testimonial immediately. One video testimonial drops CPL by ~30%.</p>
            </div>
          </Card>
        </div>
      )}

      {/* Checklist tab */}
      {tab === "checklist" && (
        <div className="space-y-4">
          <Card title="Pre-Launch Checklist">
            <div className="space-y-3">
              {([
                { key: "landing", label: "Landing page live and tested (headline matches ad headline 1:1)" },
                { key: "pilot", label: "$1 pilot Stripe price active in dead-lead-billing-setup" },
                { key: "pixel", label: "Meta Pixel installed on landing page and firing on CTA click" },
                { key: "campaign", label: "Facebook campaign created in PAUSED state in Ads Manager" },
                { key: "postcards", label: "Lob postcards queued (500 to TX/FL roofers) — requires LOB_API_KEY" },
                { key: "copy_match", label: "Postcard headline matches ad headline (same hook, different medium)" },
              ] as { key: keyof typeof checklist; label: string }[]).map((item) => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={(e) => setChecklist((c) => ({ ...c, [item.key]: e.target.checked }))}
                    className="mt-0.5 accent-[#00d4ff]"
                  />
                  <span className={`text-sm ${checklist[item.key] ? "text-white/40 line-through" : "text-white/80"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
            {Object.values(checklist).every(Boolean) && (
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <p className="text-green-400 font-bold">✅ All clear — activate the campaign in Ads Manager</p>
              </div>
            )}
          </Card>

          <Card title="What Happens After a $1 Pilot Converts">
            <div className="space-y-2 text-sm text-white/70">
              <p>1. Contractor pays $1 → Stripe fires <code className="text-[#00d4ff]">dead_lead_pilot</code> webhook</p>
              <p>2. System marks contractor as <code className="text-[#00d4ff]">pilot_active = true</code></p>
              <p>3. First 50 contacts are texted automatically within 2 hours</p>
              <p>4. Matt gets SMS: "🎯 $1 pilot started — watch for replies"</p>
              <p>5. Each reply → $50 charge to contractor's card on file</p>
              <p>6. After 3+ replies → ask for a 60-sec video testimonial (feeds TechAlert ads)</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
