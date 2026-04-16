import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";

interface Service {
  name: string;
  price: string;
  desc: string;
  url: string;
}

interface Category {
  label: string;
  services: Service[];
}

const CATEGORIES: Category[] = [
  {
    label: "Web & Marketing",
    services: [
      { name: "Web Design", price: "from $499", desc: "Custom websites built for local businesses — fast, modern, and conversion-focused.", url: "/get-started" },
      { name: "GBP SaaS (Google Business Posts)", price: "$49–99/mo", desc: "Automated posts 3×/week to your Google Business Profile to keep rankings climbing.", url: "/local-marketing" },
      { name: "Social Media Automation", price: "$149–299/mo", desc: "Done-for-you Facebook, Instagram, and LinkedIn posts — fully automated.", url: "/social-media-ai" },
      { name: "Local SEO Pages", price: "$59/mo", desc: "Hyper-local landing pages generated to capture nearby search traffic.", url: "/local-seo-pages" },
      { name: "Website Copy Refresh", price: "$49/mo", desc: "Fresh, high-converting copy for your existing website — rewritten monthly.", url: "/ai-website-copy" },
      { name: "Ads Copy Generator", price: "$39/mo", desc: "Google and Facebook ad copy that actually converts, generated on demand.", url: "/ai-ads-copy" },
      { name: "Direct Mail Copy", price: "$49/mo", desc: "Compelling mailer and postcard copy written for offline campaigns.", url: "/direct-mail" },
      { name: "Video Script Writer", price: "$39/mo", desc: "Short-form video scripts for Reels, TikTok, and YouTube Shorts on autopilot.", url: "/ai-video-scripts" },
      { name: "Seasonal Promo Planner", price: "$39/mo", desc: "Automated promotional calendar with copy and ideas for every season.", url: "/promo-planner" },
    ],
  },
  {
    label: "SMS & Phone",
    services: [
      { name: "Missed Call Text-Back", price: "$99/mo", desc: "Instantly texts anyone who calls and gets no answer — never lose a lead again.", url: "/missed-call-catch" },
      { name: "24/7 Call Routing Engine", price: "$149/mo", desc: "An automated voice system answers your phone 24/7 and captures caller information.", url: "/ai-phone-answering" },
      { name: "Text Message Marketing", price: "$79/mo", desc: "Automated SMS campaigns that drive repeat business and referrals.", url: "/text-message-marketing" },
      { name: "Review Request SMS", price: "$39/mo", desc: "Auto-sends a friendly text after every job asking customers for a Google review.", url: "/review-request-sms" },
      { name: "Quote Follow-Up SMS", price: "$49/mo", desc: "Follows up on open estimates via text so no quote goes cold and forgotten.", url: "/quote-followup-sms" },
      { name: "Win-Back SMS", price: "$49/mo", desc: "Re-engages past customers who haven't booked in 90+ days with a smart text.", url: "/winback-sms" },
      { name: "Holiday SMS Blast", price: "$39/mo", desc: "Seasonal holiday texts that keep your brand top-of-mind year-round.", url: "/holiday-sms" },
      { name: "Appointment Reminder SMS", price: "$39/mo", desc: "Automated reminder texts that slash no-shows and last-minute cancellations.", url: "/appointment-reminders" },
      { name: "Speed-to-Lead SMS", price: "$39/mo", desc: "Texts new leads within 60 seconds of inquiry — before your competitors call.", url: "/speed-to-lead" },
      { name: "Thank You Text", price: "$19/mo", desc: "Sends a personalized thank-you text after every completed job automatically.", url: "/thank-you-sms" },
      { name: "Warranty Reminder SMS", price: "$29/mo", desc: "Reminds customers when their service warranty is coming up for renewal.", url: "/warranty-reminders" },
      { name: "Satisfaction Survey SMS", price: "$29/mo", desc: "One-tap satisfaction surveys sent post-job to capture feedback effortlessly.", url: "/satisfaction-survey" },
    ],
  },
  {
    label: "Reputation & Reviews",
    services: [
      { name: "Reputation Dashboard", price: "$79/mo", desc: "Monitor and manage your online reviews across Google and Facebook in one place.", url: "/ai-reputation" },
      { name: "Google Review Auto-Responder", price: "$49/mo", desc: "Writes and posts thoughtful responses to every Google review automatically.", url: "/review-responder" },
      { name: "Review Alert SMS", price: "$19/mo", desc: "Texts you the moment a new review lands so you never miss one.", url: "/review-alerts" },
      { name: "Google Q&A Manager", price: "$29/mo", desc: "Automatically answers questions posted on your Google Business Profile.", url: "/google-qa" },
      { name: "Competitor Watch", price: "$69/mo", desc: "Tracks competitor reviews and rankings so you can stay one step ahead.", url: "/competitor-watch" },
    ],
  },
  {
    label: "Business Intelligence & Tools",
    services: [
      { name: "Estimate Generator", price: "$49/mo", desc: "Produces detailed project estimates instantly — branded and ready to send.", url: "/ai-estimates" },
      { name: "Hiring Assistant", price: "$49/mo", desc: "Writes job postings, screens applicants, and drafts interview questions for you.", url: "/hiring-assistant" },
      { name: "Weekly Business Digest", price: "$29/mo", desc: "A personalized weekly email summary of your key business metrics and tips.", url: "/weekly-business-digest" },
      { name: "Business KPI Weekly Email", price: "$49/mo", desc: "Auto-pulls your numbers and delivers a clean KPI report to your inbox weekly.", url: "/kpi-email" },
      { name: "Staff Internal Newsletter", price: "$29/mo", desc: "Automated internal newsletter that keeps your team informed and motivated.", url: "/staff-newsletter" },
    ],
  },
  {
    label: "Marketing Automation",
    services: [
      { name: "Email Welcome Drip", price: "$49/mo", desc: "Automated welcome email sequence that nurtures new leads into paying customers.", url: "/welcome-drip" },
      { name: "Customer Reactivation", price: "$39/mo", desc: "Wins back dormant customers with a smart 3-part reactivation email campaign.", url: "/reactivation-emails" },
      { name: "Late Payment Chaser", price: "$29/mo", desc: "Politely follows up on unpaid invoices via email so you don't have to.", url: "/payment-chaser" },
    ],
  },
  {
    label: "Lead Gen & B2B",
    services: [
      { name: "Contractor Lead Gen", price: "Waitlist", desc: "Exclusive, local contractor leads delivered directly to your inbox. Join the waitlist — limited markets.", url: "/contractor-leads" },
      { name: "B2B Dental Database", price: "$49/mo", desc: "Full Michigan dental office contact list — updated monthly and ready to dial.", url: "/b2b-leads" },
      { name: "Field Rep Tools", price: "$29/mo", desc: "4 automated tools built specifically for B2B field sales reps.", url: "/field-rep-tools" },
      { name: "Contractor Chatbot", price: "$149/mo", desc: "24/7 chatbot on your website that captures and qualifies contractor leads.", url: "/contractor-chatbot" },
      { name: "Field Rep Weekly Newsletter", price: "Free", desc: "Weekly B2B sales tips and affiliate tool spotlights for field reps.", url: "/newsletter" },
    ],
  },
  {
    label: "Professional Services",
    services: [
      { name: "Web Design Services", price: "Custom", desc: "Full-service web design for local businesses, manufacturers, and real estate pros.", url: "/web-design-services" },
      { name: "SEO Audit Report", price: "$29/mo", desc: "Monthly automated SEO audit report showing exactly what to fix and why.", url: "/seo-reports" },
    ],
  },
];

const TOTAL_SERVICES = CATEGORIES.reduce((sum, cat) => sum + cat.services.length, 0);

export default function AllServices() {
  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0a0f" }}>
      <SEOHead title="All Services — Detroit Web Agency" description="The full Detroit Web Agency service stack: FieldDesk CRM, TechAlert hiring monitor, SiteRadar visitor intel, SEO Guard, dead lead reactivation, and more." path="/all-services" />
      {/* Hero */}
      <section className="relative py-16 px-4 text-center overflow-hidden" style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #22d3ee 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="max-w-3xl mx-auto relative">
          <div className="inline-block rounded-full px-4 py-1 text-sm font-medium mb-6" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}>
            All {TOTAL_SERVICES} Services
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight" style={{ color: "#f8fafc" }}>
            {TOTAL_SERVICES} done-for-you services.<br />
            <span style={{ color: "#22d3ee" }}>Pick one. Everything runs itself.</span>
          </h1>
          <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: "#64748b" }}>
            Every service below is fully automated — set it up once and it works around the clock. No ongoing work required on your end.
          </p>
          <a
            href="tel:3139921219"
            className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-lg text-base transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
          >
            <Phone className="w-4 h-4" />
            (313) 992-1219 — Text or call Matt
          </a>
        </div>
      </section>

      {/* Categories */}
      <main className="max-w-7xl mx-auto px-4 py-14 space-y-14">
        {CATEGORIES.map((cat) => (
          <section key={cat.label}>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold uppercase tracking-wider" style={{ color: "#f1f5f9" }}>
                {cat.label}
              </h2>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(34,211,238,0.08)", color: "#64748b" }}>
                {cat.services.length}
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(148,163,184,0.08)" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.services.map((svc) => (
                <div
                  key={svc.name}
                  className="rounded-xl p-5 flex flex-col gap-3 transition-all border-l-4"
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(148,163,184,0.08)",
                    borderLeftColor: "#22d3ee",
                    borderLeftWidth: "4px",
                  }}
                >
                  <div>
                    <h3 className="font-bold text-base leading-snug" style={{ color: "#e2e8f0" }}>{svc.name}</h3>
                    <p className="font-semibold text-sm mt-1" style={{ color: "#22d3ee" }}>{svc.price}</p>
                  </div>
                  <p className="text-sm flex-1" style={{ color: "#64748b" }}>{svc.desc}</p>
                  <Link
                    to={svc.url}
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors mt-auto hover:opacity-80"
                    style={{ color: "#22d3ee" }}
                  >
                    Get Started <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Footer CTA */}
      <section className="py-12 px-4 text-center" style={{ borderTop: "1px solid rgba(148,163,184,0.08)", background: "#0d1117" }}>
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#f1f5f9" }}>Not sure where to start?</h2>
          <p className="mb-6" style={{ color: "#64748b" }}>
            Text Matt directly and he'll point you to the right service for your business.
          </p>
          <a
            href="sms:3139921219"
            className="inline-flex items-center gap-2 font-bold px-8 py-3 rounded-lg text-lg transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
          >
            <Phone className="w-5 h-5" />
            Text Matt at (313) 992-1219
          </a>
        </div>
      </section>
    </div>
  );
}
