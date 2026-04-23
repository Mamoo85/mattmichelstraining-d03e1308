import { useState } from "react";
import { Copy, ExternalLink, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import TerritoryLinkGenerator from "./TerritoryLinkGenerator";

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

type Product = "contractor-leads" | "techalert" | "demand-radar" | "missed-call" | "fielddesk";

const PRODUCTS: { id: Product; label: string; emoji: string; price: string; buyer: string }[] = [
  { id: "contractor-leads", label: "Contractor Leads", emoji: "🏠", price: "$399/mo", buyer: "HVAC/plumbing/electrical/roofing contractor" },
  { id: "techalert",        label: "TechAlert",        emoji: "📡", price: "$99/mo",  buyer: "Contractor who needs to hire licensed techs" },
  { id: "demand-radar",     label: "Demand Radar",     emoji: "📊", price: "$199/mo", buyer: "Plumbing/HVAC/electrical wholesale distributor" },
  { id: "missed-call",      label: "Missed Call",      emoji: "📱", price: "$99/mo",  buyer: "Any local service business missing calls" },
  { id: "fielddesk",        label: "FieldDesk",        emoji: "🔧", price: "$199/mo", buyer: "Field service company (HVAC, plumbing, electrical) 3–15 techs" },
];

const SCRIPTS: Record<Product, { cold: string; warmReply: string; link: string; linkNote: string; objections: { q: string; a: string }[] }> = {
  "contractor-leads": {
    cold: `Hey [Name] — I generate exclusive homeowner leads for [trade] contractors in Metro Detroit. You'd be the ONLY [trade] company I work with in [city]. I had [X] leads last month with no contractor to send them to. $399/mo, cancel anytime. Want me to hold [city] for you?`,
    warmReply: `Hey [Name] — thanks for getting back to me. Quick version: I send you exclusive leads from homeowners who already filled out a form requesting [trade] service. You're the only contractor who gets each lead — no competing bids. First lead usually lands within 48 hours of signup. Here's the direct link with [city] + [trade] already selected so you can lock it in:\n\n[LINK]\n\nAny questions, just text me back. — Matt (313) 992-1219`,
    link: "https://detroitwebagent.com/contractor-leads",
    linkNote: "Use the Territory Link Generator below to create a pre-filled link with trade + city selected. This is the link that lost the last prospect — use the generator, not the generic page.",
    objections: [
      { q: "How do you get the leads?", a: "Google Ads, local SEO, and landing pages targeting homeowners in your city searching for [trade] service. They fill out a form, I send it to you within minutes." },
      { q: "How many leads per month?", a: "Depends on the territory. Metro Detroit averages 8–15/mo for HVAC. I don't promise a minimum — I promise exclusivity. You're the only one who gets them." },
      { q: "What if the leads are bad?", a: "30-day money-back if I deliver zero leads. Bad lead = credit. I'm not Angi — I don't make money selling bad data." },
      { q: "I already use Angi / HomeAdvisor", a: "That's why I built this. Angi sells the same lead to 4-8 contractors. You're competing on price before the customer even picks up. Mine are exclusive — you're always first." },
    ],
  },
  "techalert": {
    cold: `Hey [Name] — I run a service that watches Michigan's MIOSHA license database and job boards for licensed [trade] techs becoming available. When someone gets a new license or posts that they're looking, you get an SMS within hours. $99/mo. Worth a quick call?`,
    warmReply: `Hey [Name] — so the way TechAlert works: Michigan publishes every licensed [trade] tech in the state. When someone gets a new license, that usually means they just finished training and are actively looking for work. I monitor that database daily plus job boards, score the candidates, and text you the best ones. You get their name, license number, and contact info while they're still actively looking. $99/mo, cancel anytime. Want me to set up a free trial?\n\n[LINK]`,
    link: "https://detroitwebagent.com/hire-alert",
    linkNote: "Direct link to the TechAlert product page with self-serve checkout.",
    objections: [
      { q: "How is this better than Indeed?", a: "Indeed shows you people who applied. TechAlert shows you people who just got licensed — they haven't applied anywhere yet. You get there first." },
      { q: "What trades do you cover?", a: "HVAC, plumbing, electrical, boiler/mechanical. Healthcare coming soon (CNA, RN, LPN for nursing homes)." },
      { q: "What if I don't need to hire right now?", a: "That's fine — when you do need someone, you'll have a pipeline ready instead of scrambling on Indeed. $99/mo is less than one hour of a recruiter's time." },
    ],
  },
  "demand-radar": {
    cold: `Hey [Name] — I built a tool that monitors Metro Detroit permit filings, new company registrations, and hiring patterns to identify contractors who are growing and will need more [supply type] supplies soon. Built for distributors like yours. $199/mo. Interested in a demo?`,
    warmReply: `Hey [Name] — quick overview: Demand Radar scans Detroit-area permit filings, H-2B visa applications, and new contractor registrations daily. When a plumbing contractor pulls 5+ permits in a month or posts 3 new hiring ads, that's a signal they're expanding — and they'll need more pipe, fittings, and fixtures. You get their name and contact before they call your competitors. Signals filtered to your vertical only. $199/mo. Here's the signup:\n\n[LINK]\n\nI can also do a quick Zoom to show you what signals look like. — Matt`,
    link: "https://detroitwebagent.com/industry-pulse",
    linkNote: "Direct link to Demand Radar product page. Prospect will select their supply vertical (plumbing/hvac/electrical/etc.) at signup.",
    objections: [
      { q: "We already have a sales team doing this", a: "Your reps find accounts after they're already buying from someone. This surfaces accounts 2–4 weeks before the buying decision — while they're still open to a new supplier." },
      { q: "How accurate are the signals?", a: "Permit data is straight from Detroit's BSEED database — 100% real. Hiring signals from Indeed/ZipRecruiter. Cross-referenced signals (same company in 3 sources) have the highest confidence." },
    ],
  },
  "missed-call": {
    cold: `Hey [Name] — quick question: what happens when a customer calls your business and no one picks up? I built a service that automatically texts them back within 60 seconds. Most of them book the job because you were the first to respond. $99/mo. Want to see how it works?`,
    warmReply: `Hey [Name] — here's exactly how it works: your business phone forwards missed calls to our system. We immediately text the customer: "Hey, this is [Business Name] — sorry we missed you! What can we help with?" They text back, you get notified, and you close the job. Most businesses lose 30–40% of new customer calls to voicemail. This captures them before they call your competitor. $99/mo, cancel anytime:\n\n[LINK]`,
    link: "https://detroitwebagent.com/missed-call-catch",
    linkNote: "Direct link to Missed Call Catch product page.",
    objections: [
      { q: "We have a voicemail", a: "Voicemail response rate is under 20%. Text-back response rate is over 80%. The customer is already on their phone — they text back in seconds." },
      { q: "What if we're busy?", a: "That's exactly when this matters most. You don't have to reply to every text immediately — the system already re-engaged them. Reply when you're free and the job is still there." },
    ],
  },
  "fielddesk": {
    cold: `Hey [Name] — I built a field service app designed for HVAC/plumbing companies that replaces eWay CRM (the Outlook plugin). Dispatch board, GPS tech map, mobile tech app — works from a boiler room, not just a computer. $199/mo. Could I show you a 5-min demo?`,
    warmReply: `Hey [Name] — FieldDesk is a web-based dispatch + CRM built specifically for field service companies your size (3–15 techs). Here's what it does that eWay can't: real-time GPS of all your techs on a live map, mobile app that works anywhere (techs update job status from their phone), automated customer SMS when a tech is on the way. No Outlook required. $199/mo vs. eWay at $300–400/mo. Here's a live demo:\n\nhttps://detroitwebagent.com/demo-djconley-2\n\n5-min call to walk through it? — Matt (313) 992-1219`,
    link: "https://detroitwebagent.com/demo-djconley-2",
    linkNote: "Send the demo link first, then follow up with the product page for signup.",
    objections: [
      { q: "We already use eWay / Jobber / ServiceTitan", a: "eWay requires Outlook — your techs in the field can't use it. Jobber and ServiceTitan are $100–300/user/mo. FieldDesk is flat $199/mo for your whole team." },
      { q: "Is this mobile-friendly?", a: "Techs log in with a 4-digit PIN — no email login, no app store download required. Works on any phone browser from a job site." },
      { q: "Can I try it?", a: "Yes — here's a live demo with real data: [link]. No signup required." },
    ],
  },
};

export default function ProductSalesHub() {
  const [product, setProduct] = useState<Product>("contractor-leads");
  const [openObjIdx, setOpenObjIdx] = useState<number | null>(null);

  const meta = PRODUCTS.find(p => p.id === product)!;
  const script = SCRIPTS[product];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground mb-1">Product Sales Hub</h2>
        <p className="text-xs text-muted-foreground">Someone responded to your outreach. Pick the product they're interested in, copy the script, send the right link.</p>
      </div>

      {/* Product selector */}
      <div className="flex flex-wrap gap-2">
        {PRODUCTS.map(p => (
          <button
            key={p.id}
            onClick={() => { setProduct(p.id); setOpenObjIdx(null); }}
            className={`px-3 py-1.5 text-xs font-bold border transition-colors rounded ${product === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary"}`}
          >
            {p.emoji} {p.label} <span className="opacity-60 font-normal">{p.price}</span>
          </button>
        ))}
      </div>

      {/* Buyer target */}
      <div className="bg-primary/5 border border-primary/20 rounded px-3 py-2 text-xs">
        <span className="font-bold text-primary uppercase tracking-widest mr-2">Target buyer:</span>
        <span className="text-foreground">{meta.buyer}</span>
      </div>

      {/* Cold pitch */}
      <div className="bg-card border border-border rounded p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cold Pitch (text / first email)</label>
          <button onClick={() => copy(script.cold, "Cold pitch")} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90">
            <Copy size={10} /> Copy
          </button>
        </div>
        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{script.cold}</pre>
      </div>

      {/* Warm reply */}
      <div className="bg-card border border-border rounded p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><MessageSquare size={11} /> Warm Reply (they responded — send this)</label>
          <button onClick={() => copy(script.warmReply, "Warm reply")} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90">
            <Copy size={10} /> Copy
          </button>
        </div>
        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{script.warmReply}</pre>
      </div>

      {/* Link to send */}
      <div className="bg-card border border-border rounded p-4 space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Link to Send</label>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{script.linkNote}</p>
        <div className="flex gap-2">
          <input readOnly value={script.link} className="flex-1 bg-background border border-border px-2 py-1.5 text-xs font-mono text-foreground rounded focus:outline-none" onClick={e => (e.target as HTMLInputElement).select()} />
          <button onClick={() => copy(script.link, "Link")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90">
            <Copy size={11} /> Copy
          </button>
          <a href={script.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded border border-border bg-background hover:bg-accent">
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Objection handlers */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Objection Handlers</label>
        {script.objections.map((o, i) => (
          <div key={i} className="bg-card border border-border rounded overflow-hidden">
            <button
              onClick={() => setOpenObjIdx(openObjIdx === i ? null : i)}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent/50 flex items-center justify-between gap-2"
            >
              <span>"{o.q}"</span>
              <span className="text-muted-foreground text-[10px]">{openObjIdx === i ? "▲" : "▼"}</span>
            </button>
            {openObjIdx === i && (
              <div className="px-4 pb-3 space-y-2">
                <p className="text-xs text-foreground leading-relaxed">{o.a}</p>
                <button onClick={() => copy(o.a, "Response")} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90">
                  <Copy size={10} /> Copy Response
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Phone CTA */}
      <div className="bg-[#0a1628] text-white rounded p-4 flex items-center gap-4">
        <Phone size={20} className="text-[#00d4ff] shrink-0" />
        <div>
          <p className="text-xs font-bold text-white">Always offer a call</p>
          <p className="text-[11px] text-white/60 mt-0.5">Text is for warm-up. Close on the phone. Your number: (313) 992-1219</p>
        </div>
        <button onClick={() => copy("(313) 992-1219", "Phone number")} className="ml-auto text-[11px] font-bold px-2 py-1 rounded border border-white/20 text-white/70 hover:text-white hover:border-white/50">
          Copy #
        </button>
      </div>

      {/* Territory link generator — only for Contractor Leads */}
      {product === "contractor-leads" && (
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Generate Pre-Filled Territory Link</p>
          <TerritoryLinkGenerator />
        </div>
      )}
    </div>
  );
}
