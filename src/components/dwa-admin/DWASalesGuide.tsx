// DWASalesGuide — step-by-step selling guide for DWA products
// Accessible from /dwa-admin → "Sales Guide" tab
// Covers: who to target, how to find them, pitch scripts, onboarding flow

import { useState } from "react";

interface Step {
  step: string;
  action: string;
  detail?: string;
  script?: string;
}

interface Section {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  target?: string;
  steps: Step[];
  objections?: { q: string; a: string }[];
}

const SECTIONS: Section[] = [
  {
    id: "dead-lead",
    emoji: "♻️",
    title: "Dead Lead Reactivation",
    subtitle: "$50/positive reply · No monthly fee · Zero risk for contractor",
    target: "Roofing, HVAC, plumbing, electricians — 2+ years in business, 20+ Google reviews. They HAVE dead quotes sitting in their CRM or spreadsheet. Every contractor does.",
    steps: [
      {
        step: "1",
        action: "Find contractors on Google Maps",
        detail: 'Search "roofing contractor [suburb]" on Google Maps. Open each listing. Look for: 20+ reviews (established), 3-4 stars (need leads, not too busy), no slick website (still DIY-ing their marketing). Work one suburb at a time: Dearborn → Livonia → Warren → Sterling Heights.',
      },
      {
        step: "2",
        action: "Send the first text",
        detail: "Text from your personal number (not Twilio — keeps it human). Keep it under 2 sentences.",
        script: 'Hey [Name] — Matt from Detroit Web Agency. Quick question: do you have old quotes that never converted sitting around? I have a way to text them for you and you only pay $50 when one says yes. Worth a 5 min call?',
      },
      {
        step: "3",
        action: "They reply interested — send the intake link",
        detail: "Don't explain the tech. Just send the link and let the page do the work.",
        script: "Perfect — here's the link to upload your list and I'll get it running for you today: detroitwebagent.com/dead-lead-intake",
      },
      {
        step: "4",
        action: "They complete the intake form",
        detail: "You get an SMS when they submit. Confirm receipt and tell them when the first texts go out (daily 10am ET).",
        script: "Got your list — 47 contacts loaded. First texts go out tomorrow morning. You'll hear from me same day if anyone replies yes.",
      },
      {
        step: "5",
        action: "First positive reply comes in",
        detail: "They get an instant SMS with the homeowner's name and number. You collect $50 automatically if they saved a card, or invoice manually.",
        script: 'Text the contractor: "🎉 [Name] from [City] just said YES to a quote — their number is [phone]. $50 charged to your card on file. Let me know when you close it!"',
      },
      {
        step: "6",
        action: "Send the stats link after week 1",
        detail: "Text them the /dead-lead-stats?token= link so they can see proof without you having to report manually.",
        script: "Here's your campaign stats link — bookmark it: [dead-lead-stats URL]. Shows texts sent, replies, and revenue recovered.",
      },
    ],
    objections: [
      { q: "How many leads do I need to upload?", a: "Minimum 20, but 50-100 is ideal. Old quote sheets, past customers who ghosted, anyone who said 'maybe later.'" },
      { q: "What if the texts feel spammy?", a: "They're white-labeled under your business name. The homeowner thinks you're following up personally. Conversion rates are 5-15%." },
      { q: "What if no one replies?", a: "Zero cost to you — you literally pay nothing until someone says yes. It's the lowest-risk marketing you'll ever do." },
      { q: "I don't have a list", a: "Do you have old estimates in QuickBooks, a spreadsheet, or even your phone contacts? That's your list. We format it." },
    ],
  },
  {
    id: "techalert",
    emoji: "⚡",
    title: "TechAlert",
    subtitle: "$99/mo (intro) · $149/mo standard · Monitors MIOSHA + Apollo + job boards daily",
    target: "HVAC/boiler/plumbing companies with 3-15 techs who are hiring or about to hire. Best target: company owner who personally handles hiring. Also: nursing home administrators (CNA/RN shortage is brutal).",
    steps: [
      {
        step: "1",
        action: "Find companies actively hiring",
        detail: 'Search Indeed/LinkedIn for "boiler operator Detroit" or "HVAC technician Michigan." Companies posting jobs are actively hiring = perfect prospect. Note the company name + get their number from Google.',
      },
      {
        step: "2",
        action: "Send the cold text",
        script: "Hey [Name] — Matt, Detroit Web Agency. Saw you're hiring a [role]. We monitor the Michigan MIOSHA license database daily and alert you the second a qualified [role] becomes available in your area — before they hit job boards. $99/mo, cancel anytime. Want me to send more info?",
      },
      {
        step: "3",
        action: "Send the link",
        script: "Here's the page: detroitwebagent.com/hire-alert — scroll to the bottom and sign up. Takes 2 minutes. You pick exactly which trades you want us to monitor.",
      },
      {
        step: "4",
        action: "Follow up after 48 hours if no response",
        script: "Hey [Name] — just following up on TechAlert. We had a boiler operator with a 1st class license show up in Dearborn this week. Thought it might be relevant for you.",
      },
      {
        step: "5",
        action: "Close with the LinkedIn comparison",
        detail: "LinkedIn Recruiter Lite = $170/mo and you do all the searching yourself. TechAlert = $99/mo and we push candidates to you before they're on LinkedIn.",
      },
    ],
    objections: [
      { q: "How is this different from Indeed?", a: "Indeed shows you who's applying. TechAlert shows you who's available — licensed people who may not be actively job hunting yet but are in transition. You contact them first." },
      { q: "What's the MIOSHA database?", a: "Michigan's public database of every licensed boiler operator, HVAC tech, plumber, and electrician. When someone gets a new license or renews, they appear — and TechAlert catches it immediately." },
      { q: "Can you prove it works?", a: "Go to your dashboard right now and look at the Scanner Activity table — it shows every daily run, how many candidates were found, and how many alerts were sent. It's running every morning at 7am." },
    ],
  },
  {
    id: "fielddesk",
    emoji: "🔧",
    title: "FieldDesk",
    subtitle: "$199/mo · Field service CRM replacing eWay/ServiceTitan for small shops",
    target: "HVAC/boiler/plumbing companies with 2-10 techs using spreadsheets, whiteboards, or a clunky Outlook plugin (eWay). Best signal: owner texting techs job details manually = they need dispatch software.",
    steps: [
      {
        step: "1",
        action: "Identify companies still using manual dispatch",
        detail: 'Ask: "How do your techs know where to go each morning?" If the answer is "I text them" or "we use a whiteboard" — that\'s your prospect. Also look for companies advertising that they\'re hiring dispatchers.',
      },
      {
        step: "2",
        action: "Book the demo call",
        script: "Hey [Name] — Matt from Detroit Web Agency. We built a dispatch platform specifically for boiler/HVAC shops your size — tech GPS map, job status updates, photo uploads from the field. Takes 15 minutes to see. Worth a quick demo call this week?",
      },
      {
        step: "3",
        action: "Run the DJ Conley demo",
        detail: "Show /demo-djconley-2 — the full dispatcher view with real boiler jobs and Metro Detroit tech pins. Then show the mobile tech app at /field-service/tech?demo=1 — let them tap through a job as if they're the tech.",
      },
      {
        step: "4",
        action: "Handle the eWay objection",
        script: "eWay is an Outlook plugin — it breaks when Outlook updates and your techs need a laptop in the field to use it. FieldDesk runs in any browser on any phone. Your guys can update jobs from the boiler room.",
      },
      {
        step: "5",
        action: "Close",
        script: "Setup takes one afternoon — I configure it around your team and job types. First month is $199. If it doesn't replace at least 10 hours of admin work by day 30, I'll refund it.",
      },
    ],
    objections: [
      { q: "We already use [X software]", a: "What does it cost per user per month? If it's more than $199/mo total, FieldDesk saves you money immediately. If it's a per-seat model like eWay, the savings compound as you add techs." },
      { q: "My techs aren't tech-savvy", a: "The tech app is PIN login + 3 buttons: En Route, On Site, Done. If they can send a text, they can use FieldDesk." },
      { q: "We're too small", a: "Perfect — you grow into it. We built this for 2-10 tech shops. ServiceTitan is built for companies with 50+ techs and costs $600+/mo." },
    ],
  },
  {
    id: "contractor-leads",
    emoji: "🏗",
    title: "Contractor Lead Gen",
    subtitle: "$399/mo · Exclusive homeowner leads in your territory",
    target: "Established contractors (3+ years, 50+ reviews) who have proven they can close leads. NOT startups. They need to be able to handle inbound volume — at least 2 techs on the road.",
    steps: [
      {
        step: "1",
        action: "Build proof first — do NOT pitch without it",
        detail: "Use the Quick Lead Entry form in AdminContractorLeads to manually add 3-5 real leads before your first pitch. Roofing leads in their city, HVAC jobs in their zip. When you pitch, you're showing them a sample, not promising future results.",
      },
      {
        step: "2",
        action: "Show the sample leads first",
        script: "Hey [Name] — Matt from Detroit Web Agency. I have 3 roofing leads that came in this week for [their city] that I haven't sent to anyone yet. Want to see them before I offer them to someone else?",
      },
      {
        step: "3",
        action: "If they bite — offer PPL first",
        detail: "Start them at $50/lead (pay per lead) before pitching the $399/mo territory lock. Let them buy 3-5 leads, close one, then present the territory option.",
        script: "Right now I'm doing $50/lead — you only pay when I send you one. Once you've seen the quality, I can lock your territory so no other [roofer/HVAC] in [city] gets these leads.",
      },
      {
        step: "4",
        action: "Territory lock pitch after first conversion",
        script: "You closed [lead name]'s job — nice. If you want to lock [their city] so you're the only [trade] getting these leads, it's $399/mo. I have two other [roofers] asking about this area.",
      },
    ],
    objections: [
      { q: "I tried lead services before — they sell the same lead to 5 companies", a: "Our leads are exclusive — one lead goes to one contractor. The moment I send it to you, no one else gets it." },
      { q: "What's the close rate?", a: "Depends on your follow-up speed. Contractors who call within 5 minutes close 40-60%. Same-day callbacks drop to 15%. The lead quality is there — the close is on you." },
    ],
  },
];

const DAILY_ROUTINE: { time: string; action: string }[] = [
  { time: "8:00am", action: "Check admin → Dead Leads tab. Any positive replies overnight? If yes, verify $50 charged." },
  { time: "8:30am", action: "Check TechAlert scanner — any new candidates? Hot ones (score 8+) need a manual push to matching clients." },
  { time: "9:00am", action: "Send 3-5 cold texts to new contractor prospects (dead lead or TechAlert pitch — never both in same text)." },
  { time: "2:00pm", action: "Follow up with any prospects who haven't replied in 48 hours. One follow-up only." },
  { time: "5:00pm", action: "Check DWA admin for dead lead daily notifier digest. Any INVOICE NOW flags? Handle them." },
];

export default function DWASalesGuide() {
  const [activeSection, setActiveSection] = useState<string>("dead-lead");
  const [expandedObjections, setExpandedObjections] = useState<Record<string, boolean>>({});

  const section = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a1628] to-[#0d1f2e] border border-[#00d4ff]/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎯</span>
          <h2 className="text-white font-black text-xl">DWA Sales Guide</h2>
        </div>
        <p className="text-slate-400 text-sm">Step-by-step playbook for finding, pitching, and closing each product. Scripts are copy-paste ready.</p>
      </div>

      {/* Daily Routine */}
      <div className="bg-[#0d1a2e] border border-[#1e3a5f] rounded-xl p-5">
        <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>⏰</span> Matt's Daily Selling Routine
        </h3>
        <div className="space-y-2">
          {DAILY_ROUTINE.map((item, i) => (
            <div key={i} className="flex gap-4 items-start">
              <span className="text-[#00d4ff] font-bold text-xs w-14 shrink-0 pt-0.5">{item.time}</span>
              <span className="text-slate-300 text-sm leading-relaxed">{item.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Product selector */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeSection === s.id
                ? "bg-[#00d4ff] text-[#0a1628]"
                : "bg-[#0d1a2e] border border-[#1e3a5f] text-slate-300 hover:border-[#00d4ff]/40"
            }`}
          >
            {s.emoji} {s.title}
          </button>
        ))}
      </div>

      {/* Active section */}
      <div className="space-y-4">
        {/* Title + target */}
        <div className="bg-[#0d1a2e] border border-[#1e3a5f] rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">{section.emoji}</span>
            <div>
              <h3 className="text-white font-black text-lg">{section.title}</h3>
              <p className="text-[#00d4ff] text-sm font-semibold">{section.subtitle}</p>
            </div>
          </div>
          {section.target && (
            <div className="bg-[#060c18] border border-[#1e3a5f] rounded-lg p-4 mt-3">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Who to Target</p>
              <p className="text-slate-200 text-sm leading-relaxed">{section.target}</p>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {section.steps.map((s, i) => (
            <div key={i} className="bg-[#0d1a2e] border border-[#1e3a5f] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-7 h-7 rounded-full bg-[#00d4ff] text-[#0a1628] text-xs font-black flex items-center justify-center shrink-0">
                  {s.step}
                </div>
                <h4 className="text-white font-bold text-sm">{s.action}</h4>
              </div>
              {(s.detail || s.script) && (
                <div className="px-5 pb-4 space-y-3 border-t border-[#1e3a5f] pt-3">
                  {s.detail && (
                    <p className="text-slate-400 text-sm leading-relaxed">{s.detail}</p>
                  )}
                  {s.script && (
                    <div className="bg-[#060c18] border-l-2 border-[#00d4ff] rounded-r-lg p-4">
                      <p className="text-[#00d4ff] text-[11px] font-bold uppercase tracking-wider mb-2">Script — copy and send</p>
                      <p className="text-slate-200 text-sm leading-relaxed italic">"{s.script}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Objections */}
        {section.objections && section.objections.length > 0 && (
          <div className="bg-[#0d1a2e] border border-[#1e3a5f] rounded-xl p-5">
            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4">💬 Common Objections</h4>
            <div className="space-y-3">
              {section.objections.map((obj, i) => {
                const key = `${section.id}-${i}`;
                const open = expandedObjections[key];
                return (
                  <div key={i} className="border border-[#1e3a5f] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedObjections((prev) => ({ ...prev, [key]: !open }))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-slate-300 text-sm font-semibold">"{obj.q}"</span>
                      <span className="text-slate-500 text-lg leading-none ml-2">{open ? "−" : "+"}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-3 border-t border-[#1e3a5f] pt-3">
                        <p className="text-slate-200 text-sm leading-relaxed">{obj.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-[#0a1628] to-[#0d1f2e] border border-[#00d4ff]/20 rounded-xl p-5 text-center">
        <p className="text-slate-400 text-sm mb-3">
          The goal: Matt's only job is to return texts and calls. Everything else runs itself.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="/admin" className="px-4 py-2 bg-[#0d1a2e] border border-[#1e3a5f] rounded-lg text-slate-300 text-sm font-semibold hover:border-[#00d4ff]/40 transition-colors">
            M2 Admin →
          </a>
          <a href="/dead-lead-intake" target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] rounded-lg text-sm font-bold hover:bg-[#00bce8] transition-colors">
            Dead Lead Intake Link →
          </a>
        </div>
      </div>
    </div>
  );
}
