import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Search, Shield, BarChart3, Code, Zap, TrendingDown, Heart, MapPin, HardHat, Wrench, Stethoscope } from "lucide-react";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

const tools = [
  { icon: Zap, title: "Site Speed Audit", desc: "Test your website's load time, performance score, and mobile responsiveness.", path: "/free-site-scanner", color: "from-cyan-400 to-blue-500" },
  { icon: Search, title: "SEO Health Check", desc: "Analyze your page's title, meta description, headings, and content quality.", path: "/free-tools/seo-health", color: "from-emerald-400 to-cyan-500" },
  { icon: Shield, title: "Domain Breach Scanner", desc: "Check if your business domain has been exposed in known data breaches.", path: "/free-tools/breach-scan", color: "from-red-400 to-pink-500" },
  { icon: BarChart3, title: "Competitor Rank Checker", desc: "See who ranks in the top 10 for any keyword in any city.", path: "/free-tools/rank-check", color: "from-violet-400 to-purple-500" },
  { icon: Code, title: "Meta Tag Analyzer", desc: "Grade your page's meta tags, Open Graph, canonical, and robots directives.", path: "/free-tools/meta-tags", color: "from-amber-400 to-orange-500" },
  { icon: TrendingDown, title: "Leaky Bucket CRM Audit", desc: "Calculate how much revenue you lose on dead leads every year — and how much is recoverable.", path: "/free-tools/leaky-bucket", color: "from-red-500 to-orange-500" },
  { icon: Heart, title: "Medicare Staffing Assessment", desc: "Pull any nursing home's federal staffing rating, fines, and compliance risk from CMS data.", path: "/free-tools/medicare-staffing", color: "from-pink-400 to-red-500" },
  { icon: MapPin, title: "Local Search Audit", desc: "Check if your business shows up in Google Maps and how you compare to competitors.", path: "/free-tools/local-search", color: "from-indigo-400 to-violet-500" },
  { icon: Code, title: "Service Gap Scanner", desc: "See which high-margin services your competitors rank for that you're missing.", path: "/free-tools/service-gap", color: "from-emerald-500 to-teal-500" },
  { icon: Shield, title: "ADA Lawsuit Risk Scanner", desc: "Scan your website for WCAG accessibility violations that make you vulnerable to ADA lawsuits.", path: "/free-tools/ada-scanner", color: "from-amber-500 to-yellow-500" },
  { icon: HardHat, title: "OSHA Safety Check", desc: "Search public OSHA and MIOSHA databases for safety violations, citations, and fines.", path: "/free-tools/osha-check", color: "from-orange-500 to-red-600" },
  { icon: Wrench, title: "Equipment Age Estimator", desc: "Estimate when your building's HVAC, boiler, and roof were last replaced using public permits.", path: "/free-tools/equipment-age", color: "from-blue-500 to-cyan-500" },
  { icon: Stethoscope, title: "Nursing Compliance Check", desc: "Check up to 5 nurse license numbers for expirations, revocations, and disciplinary actions.", path: "/free-tools/nursing-compliance", color: "from-pink-500 to-purple-500" },
];

export default function FreeToolsHub() {
  useDwaDomainRedirect();
  return (
    <>
      <SEOHead title="Free SEO, Security & Business Intelligence Tools | Detroit Web Agency" description="Run free scans on your website and business: speed audit, SEO health, breach scanner, OSHA check, ADA scan, Medicare staffing, and more." path="/free-tools" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 text-cyan-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <Search size={12} /> Free Diagnostic Tools
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4">Free Digital Infrastructure Tools</h1>
            <p className="text-[#888] max-w-2xl mx-auto">Run instant audits on your website's SEO, security, compliance, and visibility. No signup required to start — just enter your info.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((t) => (
              <Link key={t.path} to={t.path} className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-cyan-400/40 transition-all hover:bg-white/[0.05]">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <t.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{t.title}</h3>
                <p className="text-sm text-[#888] mb-4">{t.desc}</p>
                <span className="text-cyan-400 text-sm font-bold font-mono">Run Free Scan →</span>
              </Link>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-[#555] text-sm">Need a deeper analysis? <Link to="/ai-website-audit" className="text-cyan-400 hover:underline">Get a full website diagnostic →</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}
