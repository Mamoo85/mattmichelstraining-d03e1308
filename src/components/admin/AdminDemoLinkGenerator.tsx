import { useState } from "react";
import { Copy, ExternalLink, Check, Link2, MessageSquare, Mail, Linkedin, ChevronDown, ChevronUp, Smartphone } from "lucide-react";

/* ─────────────────────────────────────────────
   Demo catalog
───────────────────────────────────────────── */
interface DemoEntry {
  key: string;
  label: string;
  path: string;
  industry: string;
  style: string;
  plan: string;
  priceRange: string;
}

const DEMO_GROUPS: { category: string; demos: DemoEntry[] }[] = [
  {
    category: "🏭 Manufacturing & Industrial",
    demos: [
      { key: "youngblood", label: "Industrial Automation — Dark/Blue", path: "/demo-youngblood", industry: "industrial automation distributor", style: "Dark industrial, high-tech", plan: "Business", priceRange: "$3,499 + $199/mo" },
      { key: "youngblood-alt1", label: "Industrial Automation — Steel & Fire", path: "/demo-youngblood-alt1", industry: "industrial automation company", style: "Bold white/black/red, editorial", plan: "Business", priceRange: "$3,499 + $199/mo" },
      { key: "youngblood-alt2", label: "Industrial Automation — Precision Grid", path: "/demo-youngblood-alt2", industry: "industrial automation company", style: "Cyber/defense dark cyan", plan: "Business", priceRange: "$3,499 + $199/mo" },
    ],
  },
  {
    category: "🦷 Dental & Healthcare",
    demos: [
      { key: "dental", label: "Dental Practice — Teal/White", path: "/demo-dental", industry: "dental practice", style: "Clean teal, clinical", plan: "Pro", priceRange: "$2,499 + $149/mo" },
      { key: "dental-alt1", label: "Dental Practice — Prestige (Navy/Gold)", path: "/demo-dental-alt1", industry: "dental/prosthodontic practice", style: "Luxury dark navy & gold", plan: "Pro", priceRange: "$2,499 + $149/mo" },
      { key: "dental-alt2", label: "Dental Practice — Nordic Wellness", path: "/demo-dental-alt2", industry: "dental practice", style: "Warm ivory/sage, minimal", plan: "Pro", priceRange: "$2,499 + $149/mo" },
      { key: "clinic", label: "Medical Clinic", path: "/demo-clinic", industry: "medical clinic", style: "Modern medical", plan: "Pro", priceRange: "$2,499 + $149/mo" },
    ],
  },
  {
    category: "🏠 Contractors & Trades",
    demos: [
      { key: "roofing", label: "Roofing Company", path: "/demo-roofing", industry: "roofing company", style: "Bold dark with orange", plan: "Professional", priceRange: "$1,499 + $99/mo" },
      { key: "hvac", label: "HVAC Company", path: "/demo-hvac", industry: "HVAC company", style: "Clean blue/white", plan: "Professional", priceRange: "$1,499 + $99/mo" },
      { key: "plumber", label: "Plumbing Company", path: "/demo-plumber", industry: "plumbing company", style: "Blue & white, trustworthy", plan: "Professional", priceRange: "$1,499 + $99/mo" },
      { key: "electrician", label: "Electrician", path: "/demo-electrician", industry: "electrical contractor", style: "Dark with yellow accent", plan: "Professional", priceRange: "$1,499 + $99/mo" },
    ],
  },
  {
    category: "🍽️ Restaurants & Hospitality",
    demos: [
      { key: "restaurant", label: "Restaurant / Bar", path: "/demo-restaurant", industry: "restaurant", style: "Warm, food-forward", plan: "Standard", priceRange: "$799 + $79/mo" },
    ],
  },
  {
    category: "⚖️ Legal & Professional",
    demos: [
      { key: "lawyer", label: "Law Firm", path: "/demo-lawyer", industry: "law firm", style: "Dark authoritative", plan: "Pro", priceRange: "$2,499 + $149/mo" },
    ],
  },
  {
    category: "🏡 Home Services",
    demos: [
      { key: "landscape", label: "Landscaping Company", path: "/demo-landscape", industry: "landscaping company", style: "Green/earth tones", plan: "Standard", priceRange: "$999 + $79/mo" },
      { key: "auto-repair", label: "Auto Repair Shop", path: "/demo-auto-repair", industry: "auto repair shop", style: "Dark mechanic style", plan: "Professional", priceRange: "$1,499 + $99/mo" },
      { key: "cleaning", label: "Cleaning Service", path: "/demo-cleaning", industry: "cleaning service", style: "Fresh blue/white", plan: "Standard", priceRange: "$999 + $79/mo" },
      { key: "salon", label: "Salon / Spa", path: "/demo-salon", industry: "salon or spa", style: "Elegant minimal", plan: "Standard", priceRange: "$999 + $79/mo" },
    ],
  },
  {
    category: "🏢 Real Estate",
    demos: [
      { key: "real-estate", label: "Real Estate Agent / Broker", path: "/demo-real-estate", industry: "real estate agent", style: "Clean, listing-focused", plan: "Agent/Broker", priceRange: "$1,499 + $99/mo" },
    ],
  },
];

/* ─────────────────────────────────────────────
   Copy utility
───────────────────────────────────────────── */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ─────────────────────────────────────────────
   Pitch generators — sounds like Matt
───────────────────────────────────────────── */
function genText(demo: DemoEntry, name: string, bizName: string, baseUrl: string): string {
  const who = name ? name.split(" ")[0] : "Hey";
  const biz = bizName || `your ${demo.industry}`;
  const url = `${baseUrl}${demo.path}`;
  return `${name ? `${who} —` : "Hey —"} I put together a quick website mockup for a ${demo.industry} like ${biz}. Worth a 30-second look: ${url} — Matt (313) 806-4952`;
}

function genEmail(demo: DemoEntry, name: string, bizName: string, baseUrl: string): { subject: string; body: string } {
  const first = name ? name.split(" ")[0] : null;
  const biz = bizName || `your ${demo.industry}`;
  const url = `${baseUrl}${demo.path}`;
  const subject = `Quick question about ${bizName || "your website"}`;
  const body = `${first ? `${first},` : "Hi,"}

I built out a website mockup for a ${demo.industry} and it made me think of ${biz}. Wanted to show you before I send it to anyone else in your area.

Take a look: ${url}

Not a pitch — if it's not the right fit, I've got other styles too. But I figured you'd rather see this than not.

${demo.priceRange} to get started, includes everything.

Matt
(313) 806-4952
matt@mattmichelstraining.com`;
  return { subject, body };
}

function genLinkedIn(demo: DemoEntry, name: string, bizName: string, baseUrl: string): string {
  const first = name ? name.split(" ")[0] : null;
  const biz = bizName || `your ${demo.industry}`;
  const url = `${baseUrl}${demo.path}`;
  return `${first ? `${first} —` : ""} I built a website concept for a ${demo.industry} and it reminded me of ${biz}. Takes 30 seconds to look and I think you'll see the difference immediately: ${url}

Worth a quick call if you like it. — Matt`;
}

/* ─────────────────────────────────────────────
   CopyBlock sub-component
───────────────────────────────────────────── */
function CopyBlock({ label, text, icon: Icon, copyKey, copied, onCopy }: {
  label: string; text: string; icon: any; copyKey: string;
  copied: string | null; onCopy: (t: string, k: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none bg-muted/40 hover:bg-muted/70 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
          <Icon size={13} className="text-primary" /> {label}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onCopy(text, copyKey); }}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            {copied === copyKey ? <Check size={11} /> : <Copy size={11} />}
            {copied === copyKey ? "Copied!" : "Copy"}
          </button>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <pre className="px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans bg-background">
          {text}
        </pre>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export default function AdminDemoLinkGenerator() {
  const [selectedKey, setSelectedKey] = useState<string>("dental");
  const [prospectName, setProspectName] = useState("");
  const [bizName, setBizName] = useState("");
  const { copied, copy } = useCopy();

  const baseUrl = "https://www.mattmichelstraining.com";

  const allDemos = DEMO_GROUPS.flatMap(g => g.demos);
  const demo = allDemos.find(d => d.key === selectedKey) ?? allDemos[0];

  const demoUrl = `${baseUrl}${demo.path}`;
  const textPitch = genText(demo, prospectName, bizName, baseUrl);
  const emailPitch = genEmail(demo, prospectName, bizName, baseUrl);
  const liPitch = genLinkedIn(demo, prospectName, bizName, baseUrl);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">Demo Link Generator</h2>
        <p className="text-sm text-muted-foreground">Pick a demo, add the prospect's name (optional), and grab a ready-to-send pitch. Open the link first to make sure it loads.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── LEFT: Config ── */}
        <div className="space-y-5">
          {/* Demo picker grouped by category */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Select Demo</label>
            <select
              value={selectedKey}
              onChange={e => setSelectedKey(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DEMO_GROUPS.map(group => (
                <optgroup key={group.category} label={group.category}>
                  {group.demos.map(d => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Prospect Name</label>
              <input
                placeholder="John Smith (optional)"
                value={prospectName}
                onChange={e => setProspectName(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Business Name</label>
              <input
                placeholder="Their business (optional)"
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Demo info card */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">{demo.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{demo.style}</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">{demo.plan} — {demo.priceRange}</span>
            </div>

            <div className="flex items-center gap-2 bg-muted/40 rounded px-3 py-2 text-xs font-mono break-all text-muted-foreground">
              <Link2 size={12} className="shrink-0 text-primary" />
              <span className="flex-1 truncate">{demoUrl}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copy(demoUrl, "url")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                {copied === "url" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "url" ? "Copied!" : "Copy URL"}
              </button>
              <a
                href={demo.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink size={12} /> Open Demo
              </a>
            </div>
          </div>

          {/* Quick tip */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded px-4 py-3 leading-relaxed border border-border">
            <span className="font-bold text-foreground">Pro tip:</span> Open the demo link yourself first so you can speak to it when they call back. Lead with the text — it gets the highest response rate. Follow up with the email if no reply in 2–3 days.
          </div>
        </div>

        {/* ── RIGHT: Pitches ── */}
        <div className="space-y-3">
          <CopyBlock
            label="Text Message"
            text={textPitch}
            icon={Smartphone}
            copyKey="text"
            copied={copied}
            onCopy={copy}
          />
          <CopyBlock
            label="Email"
            text={`Subject: ${emailPitch.subject}\n\n${emailPitch.body}`}
            icon={Mail}
            copyKey="email"
            copied={copied}
            onCopy={copy}
          />
          <CopyBlock
            label="LinkedIn DM"
            text={liPitch}
            icon={Linkedin}
            copyKey="linkedin"
            copied={copied}
            onCopy={copy}
          />
          <CopyBlock
            label="Follow-Up Text (No Reply)"
            text={`${prospectName ? prospectName.split(" ")[0] + " —" : "Hey —"} just circling back on the website mockup I sent. Still live if you want to check it out: ${demoUrl} — no rush. Matt`}
            icon={MessageSquare}
            copyKey="followup"
            copied={copied}
            onCopy={copy}
          />
        </div>
      </div>
    </div>
  );
}
