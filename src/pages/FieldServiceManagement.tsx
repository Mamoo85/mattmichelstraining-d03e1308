import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Phone, CheckCircle, XCircle, Zap, MapPin, MessageSquare, FileText, Calendar, Camera, Star } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ActionButton from "@/components/ui/action-button";
import TechTaxCalculator from "@/components/field-service/TechTaxCalculator";
import ReceiptStatusBanner from "@/components/shared/ReceiptStatusBanner";
import CheckEmailCard from "@/components/shared/CheckEmailCard";

const COMPARE = [
  { name: "FieldServio", price: "$1,400/mo", users: "10 users", note: "Built for forklift rental companies", bad: true },
  { name: "ServiceTitan", price: "$2,000+/mo", users: "Enterprise only", note: "Requires a sales call just to get pricing.", bad: true },
  { name: "Jobber", price: "$349/mo", users: "10 users", note: "No ERP, no dispatch map, no SMS", bad: true },
  { name: "Detroit Web Agency", price: "$199/mo", users: "Unlimited users", note: "Built for your crew. Syncs to QuickBooks.", bad: false },
];

const FEATURES = [
  { icon: <MapPin size={20} />, title: "Live Dispatch Map", body: "See every tech on a live Google Map. Drag jobs, assign in seconds." },
  { icon: <Calendar size={20} />, title: "Kanban Dispatch Board", body: "Open → Assigned → En Route → On Site → Done. Drag-and-drop job cards." },
  { icon: <MessageSquare size={20} />, title: "Auto-SMS Notifications", body: "Tech assigned? Customer gets a text. Job complete? Review request fires automatically." },
  { icon: <Zap size={20} />, title: "Mobile Tech App", body: "One-tap status updates from any phone. No tablet required. Works in boiler rooms." },
  { icon: <Camera size={20} />, title: "Job Photos & Notes", body: "Techs snap photos on-site. Everything attached to the work order automatically." },
  { icon: <FileText size={20} />, title: "Invoicing → QuickBooks", body: "Generate and send invoices. Syncs to QuickBooks so your accountant is happy." },
];

const INDUSTRIES = [
  { name: "HVAC", slug: "hvac", desc: "Equipment history per unit, seasonal maintenance contracts, auto-dispatch to service calls" },
  { name: "Plumbing", slug: "plumbing", desc: "Emergency dispatch, in-field invoicing, job photos before/after every call" },
  { name: "Electrical", slug: "electrical", desc: "Permit tracking, in-field estimates, schedule recurring inspections" },
  { name: "Boiler / Industrial", slug: "boiler-industrial", desc: "Asset history per boiler unit, service contracts, EPA compliance records" },
  { name: "Appliance Repair", slug: null, desc: "Parts tracking per job, warranty management, route optimization" },
  { name: "IT Support / MSP", slug: null, desc: "Remote + on-site jobs, SLA tracking, recurring maintenance contracts" },
  { name: "Pest Control", slug: "pest-control", desc: "Chemical/treatment logs per property, license expiration alerts, recurring routes" },
  { name: "Landscaping", slug: "landscaping", desc: "Seasonal contracts, crew dispatch, route optimization by neighborhood" },
  { name: "Fire Protection", slug: null, desc: "Inspection scheduling, compliance records, equipment certification tracking" },
];

const CSV_COLUMNS = [
  {
    label: "Customers",
    cols: "first_name, last_name, company_name, email, phone, mobile, address, city, state, zip, notes",
  },
  {
    label: "Assets",
    cols: "name, asset_type, manufacturer, model, serial_number, install_date, location_notes, notes",
  },
  {
    label: "Jobs",
    cols: "title, description, status, scheduled_date, completed_at, tech_name, customer_name, notes",
  },
];

const ADDONS = [
  { name: "Review Monitor", price: "+$25/mo", desc: "Get alerted on every new Google review" },
  { name: "Weekly SMS Blast", price: "+$19/mo", desc: "Promote slow weeks with one-click SMS campaigns" },
  { name: "GBP AI Posts", price: "+$49/mo", desc: "AI posts to Google Business Profile 3x/week" },
  { name: "After-Job Drip", price: "+$29/mo", desc: "Auto follow-up SMS series after every job" },
  { name: "Estimate Follow-Up", price: "+$39/mo", desc: "Chase open estimates automatically" },
];

export default function FieldServiceManagement() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("hvac");
  const [loading, setLoading] = useState(false);

  if (isSuccess) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🚀</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px" }}>FieldDesk is Live!</h1>
          <p style={{ color: "#00d4ff", fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Your dispatch platform is being provisioned now.</p>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 32px" }}>
            Check your email — we're setting up your dispatch board, tech app, and customer portal. You'll receive login credentials and a quick-start guide within the hour.
          </p>
          <a href="/" style={{ background: "#00d4ff", color: "#0a1628", padding: "14px 32px", borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: "none", display: "inline-block" }}>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  async function handleCheckout(plan: "standalone" | "bundle") {
    if (!email) { toast.error("Enter your email to continue"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-field-service-checkout", {
        body: { email, name, company, plan, industry },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <SEOHead
        title="Field Service Management Software — Detroit Web Agency"
        description="Replace FieldServio for $199/mo. Dispatch board, mobile tech app, GPS tracking, auto-SMS, and QuickBooks sync. Built by Detroit Web Agency."
      />
      <div className="min-h-screen bg-[#0a1628] text-white">

        {/* Nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <span className="font-black text-lg tracking-tight">DETROIT</span>
            <span className="text-[#00d4ff] font-black text-lg tracking-tight"> WEB AGENCY</span>
          </div>
          <a href="tel:+13139921219" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
            <Phone size={14} /> (313) 992-1219
          </a>
        </div>

        {/* Hero */}
        <div className="px-6 pt-16 pb-12 text-center max-w-4xl mx-auto">
          <div className="inline-block bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-[11px] font-bold uppercase tracking-widest px-3 py-1 mb-6">
            Detroit Web Agency — Field Service Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
            Your techs are in the field,<br />not a cubicle. Give them{" "}
            <span className="text-[#00d4ff]">tools that work.</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto leading-relaxed mb-6">
            Detroit Web Agency Field Service replaces bloated ERPs for any company with field technicians.
            Dispatch board, mobile tech app, GPS tracking, auto-SMS, and QuickBooks sync.{" "}
            <strong className="text-white">$199/mo.</strong>
          </p>

          {/* Industry badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {["HVAC", "Plumbing", "Electrical", "Boiler Service", "Appliance Repair", "IT Support", "Pest Control", "Landscaping", "Fire Protection", "Elevator Service", "And more..."].map((badge) => (
              <span key={badge} className="bg-white/5 border border-white/10 text-white/60 text-xs px-3 py-1">
                {badge}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#pricing"
              className="bg-[#00d4ff] text-[#0a1628] font-black px-8 py-3 text-sm uppercase tracking-wide hover:bg-[#00d4ff]/90 transition-colors"
            >
              See Pricing →
            </a>
            <a
              href="sms:+13139921219"
              className="border border-white/30 text-white px-8 py-3 font-bold text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <MessageSquare size={14} /> Text Matt
            </a>
          </div>
        </div>

        {/* Competitor Comparison */}
        <div className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-center text-xl font-black mb-8 uppercase tracking-wide text-white/80">
            What field service software actually costs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COMPARE.map((c) => (
              <div
                key={c.name}
                className={`p-5 border ${c.bad ? "border-red-900/40 bg-red-950/20" : "border-[#00d4ff]/40 bg-[#00d4ff]/10"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {c.bad
                    ? <XCircle size={15} className="text-red-500 flex-shrink-0" />
                    : <CheckCircle size={15} className="text-[#00d4ff] flex-shrink-0" />
                  }
                  <span className="font-black text-sm">{c.name}</span>
                </div>
                <div className={`text-2xl font-black mb-1 ${c.bad ? "text-red-400" : "text-[#00d4ff]"}`}>{c.price}</div>
                <div className="text-xs text-white/50 mb-2">{c.users}</div>
                <p className="text-xs text-white/60">{c.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center bg-[#00d4ff]/10 border border-[#00d4ff]/20 p-4">
            <p className="text-[#00d4ff] font-black text-lg">Pat saves $14,400 in year one switching from FieldServio.</p>
            <p className="text-white/60 text-sm mt-1">$16,800/yr saved every year after that.</p>
          </div>
        </div>

        {/* Tech-Tax Calculator */}
        <TechTaxCalculator />

        {/* Features */}
        <div className="bg-[#0f1f35] py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-xl font-black mb-2 uppercase tracking-wide">Everything your crew needs</h2>
            <p className="text-center text-white/50 text-sm mb-10">Nothing they don't.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-[#0a1628] border border-white/10 p-5">
                  <div className="text-[#00d4ff] mb-3">{f.icon}</div>
                  <h3 className="font-black text-sm mb-2">{f.title}</h3>
                  <p className="text-white/60 text-xs leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QuickBooks callout */}
        <div className="py-12 px-6 border-y border-white/10">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="flex-shrink-0 bg-[#2CA01C]/10 border border-[#2CA01C]/30 rounded-full w-16 h-16 flex items-center justify-center">
              <FileText size={24} className="text-[#2CA01C]" />
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Invoicing syncs straight to QuickBooks</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Your accountant doesn't need to learn new software. When a job is marked complete and invoiced,
                it syncs to QuickBooks Online automatically. FieldServio's built-in accounting goes away.
                Your accountant stays happy.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div id="pricing" className="py-16 px-6 max-w-4xl mx-auto">
          <h2 className="text-center text-xl font-black mb-2 uppercase tracking-wide">Simple Pricing</h2>
          <p className="text-center text-white/50 text-sm mb-10">No per-user fees. No setup traps. Cancel anytime.</p>

          {/* Signup form */}
          <div className="max-w-sm mx-auto mb-8 space-y-3">
            <input
              className="w-full bg-white/5 border border-white/20 text-white px-4 py-2.5 text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full bg-white/5 border border-white/20 text-white px-4 py-2.5 text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]"
              placeholder="Company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <input
              type="email"
              className="w-full bg-white/5 border border-white/20 text-white px-4 py-2.5 text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]"
              placeholder="Your email address *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="w-full bg-white/5 border border-white/20 text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#00d4ff]"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="hvac" className="bg-[#0a1628]">HVAC</option>
              <option value="plumbing" className="bg-[#0a1628]">Plumbing</option>
              <option value="electrical" className="bg-[#0a1628]">Electrical</option>
              <option value="boiler_industrial" className="bg-[#0a1628]">Boiler / Industrial</option>
              <option value="appliance_repair" className="bg-[#0a1628]">Appliance Repair</option>
              <option value="it_support" className="bg-[#0a1628]">IT Support</option>
              <option value="pest_control" className="bg-[#0a1628]">Pest Control</option>
              <option value="landscaping" className="bg-[#0a1628]">Landscaping</option>
              <option value="fire_protection" className="bg-[#0a1628]">Fire Protection</option>
              <option value="other" className="bg-[#0a1628]">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Standalone */}
            <div className="border border-white/20 p-6 flex flex-col">
              <div className="text-white/50 text-xs uppercase tracking-widest mb-2">Standalone</div>
              <div className="text-4xl font-black mb-1">$299<span className="text-lg font-normal text-white/50">/mo</span></div>
              <p className="text-white/50 text-xs mb-5">Field service platform only. Good if you already have a website.</p>
              <ul className="space-y-2 text-xs text-white/70 mb-6 flex-1">
                {["Unlimited users", "Dispatch board + live map", "Mobile tech app (PWA)", "Auto-SMS workflows", "Invoicing + QuickBooks sync", "Job photos + notes"].map(f => (
                  <li key={f} className="flex items-center gap-2"><CheckCircle size={12} className="text-[#00d4ff] flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <ActionButton
                onClick={() => handleCheckout("standalone")}
                busyLabel="Loading..."
                ariaLabel="Get started — Standalone $299/mo"
                style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 0, minHeight: 40, fontSize: 13 }}
              >
                Get Started →
              </ActionButton>
            </div>

            {/* Bundle */}
            <div className="border-2 border-[#00d4ff] p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d4ff] text-[#0a1628] text-[10px] font-black uppercase tracking-widest px-3 py-1">
                Best Value
              </div>
              <div className="text-[#00d4ff] text-xs uppercase tracking-widest mb-2">Website Bundle</div>
              <div className="text-4xl font-black text-[#00d4ff] mb-1">$199<span className="text-lg font-normal text-white/50">/mo</span></div>
              <p className="text-white/50 text-xs mb-1">+ Website build: $499 / $1,499 / $3,499 (one-time)</p>
              <p className="text-[#00d4ff]/70 text-xs mb-5 font-semibold">Save $100/mo when you bundle with a Detroit Web Agency website</p>
              <ul className="space-y-2 text-xs text-white/70 mb-6 flex-1">
                {["Everything in Standalone", "Custom website by Detroit Web Agency", "detroitwebagent.com hosting", "SEO-optimized + mobile-first", "Lifetime updates included", "Priority support"].map(f => (
                  <li key={f} className="flex items-center gap-2"><CheckCircle size={12} className="text-[#00d4ff] flex-shrink-0" />{f}</li>
                ))}
              </ul>
              <ActionButton
                onClick={() => handleCheckout("bundle")}
                busyLabel="Loading..."
                ariaLabel="Get the Website Bundle — $199/mo"
                style={{ background: "#00d4ff", color: "#0a1628", borderRadius: 0, minHeight: 40, fontSize: 13 }}
              >
                Get the Bundle →
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Industries */}
        <div className="py-16 px-6 max-w-4xl mx-auto">
          <h2 className="text-center text-xl font-black mb-2 uppercase tracking-wide">Built for your trade</h2>
          <p className="text-center text-white/50 text-sm mb-10">Workflows tuned for how your crew actually works.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDUSTRIES.map((ind) =>
              ind.slug ? (
                <a
                  key={ind.name}
                  href={`/field-service/${ind.slug}`}
                  className="bg-[#0f1f35] border border-white/10 p-5 flex flex-col hover:border-[#00d4ff]/50 hover:bg-[#00d4ff]/5 cursor-pointer transition-all"
                >
                  <h3 className="font-black text-sm text-[#00d4ff] mb-2">{ind.name}</h3>
                  <p className="text-white/60 text-xs leading-relaxed flex-1">{ind.desc}</p>
                  <p className="text-[#00d4ff] text-[11px] font-bold mt-3">View {ind.name} Package →</p>
                </a>
              ) : (
                <div key={ind.name} className="bg-[#0f1f35] border border-white/10 p-5">
                  <h3 className="font-black text-sm text-[#00d4ff] mb-2">{ind.name}</h3>
                  <p className="text-white/60 text-xs leading-relaxed">{ind.desc}</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* CSV Import */}
        <div className="bg-[#0f1f35] py-14 px-6 border-t border-white/10">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-center text-xl font-black mb-2 uppercase tracking-wide">Migrate from Jobber or FieldServio in minutes</h2>
            <p className="text-center text-white/50 text-sm mb-10">
              Export your data from any FSM tool and import it with a single CSV upload. We match the industry-standard column headers you already have.
            </p>
            <div className="space-y-4">
              {CSV_COLUMNS.map((section) => (
                <div key={section.label} className="bg-[#0a1628] border border-white/10 p-5">
                  <div className="text-[#00d4ff] text-xs font-black uppercase tracking-widest mb-2">{section.label}</div>
                  <code className="text-white/60 text-xs font-mono leading-relaxed break-all">{section.cols}</code>
                </div>
              ))}
            </div>
            <p className="text-center text-white/30 text-xs mt-6">
              These column names match what Jobber, FieldServio, and ServiceTitan export by default — no reformatting needed.
            </p>
          </div>
        </div>

        {/* Add-ons */}
        <div className="bg-[#0f1f35] py-12 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-center text-base font-black mb-1 uppercase tracking-wide">Power it up with add-ons</h2>
            <p className="text-center text-white/40 text-xs mb-8">Each add-on runs automatically — no extra work for you or your team.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ADDONS.map((a) => (
                <div key={a.name} className="bg-[#0a1628] border border-white/10 p-4 flex items-start gap-3">
                  <Star size={13} className="text-[#00d4ff] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold">{a.name}</span>
                      <span className="text-[#00d4ff] text-xs font-bold whitespace-nowrap">{a.price}</span>
                    </div>
                    <p className="text-white/50 text-[11px]">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-white/30 text-xs mt-6">
              Fully stacked: $199/mo platform + $161/mo add-ons = <strong className="text-white/60">$360/mo total</strong> vs FieldServio's $1,400/mo
            </p>
          </div>
        </div>

        {/* Metro Detroit Local Section */}
        <div className="bg-[#0f1f35] py-10 px-6 border-t border-white/10">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[#00d4ff] text-xs uppercase tracking-widest font-bold mb-2">Local & On Call</p>
            <h2 className="text-xl font-black mb-3">Proudly serving Metro Detroit &amp; Southeast Michigan</h2>
            <p className="text-white/50 text-sm mb-4">
              Wayne County · Oakland County · Macomb County · Grosse Pointe · Warren · Sterling Heights · Troy · Livonia · Dearborn · Birmingham · Royal Oak
            </p>
            <p className="text-white/40 text-sm">
              Detroit Web Agency — Grosse Pointe, MI · (313) 992-1219
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="py-16 px-6 text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Ready to make the switch?</p>
          <h2 className="text-2xl font-black mb-4">
            Text Matt. We'll have you live in 48 hours.
          </h2>
          <a
            href="sms:+13139921219"
            className="inline-flex items-center gap-2 bg-[#00d4ff] text-[#0a1628] font-black px-8 py-3 text-sm uppercase tracking-wide hover:bg-[#00d4ff]/90 transition-colors"
          >
            <MessageSquare size={14} /> Text (313) 992-1219
          </a>
          <p className="text-white/30 text-xs mt-4">Detroit Web Agency — We Handle The Tech</p>
        </div>

      </div>
    </>
  );
}
