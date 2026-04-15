import { Search, Shield, BarChart3, Code, Zap, TrendingDown, Heart, MapPin, HardHat, Wrench, Stethoscope, ExternalLink } from "lucide-react";

const tools = [
  { icon: Zap, title: "Site Speed Audit", desc: "Test load time, performance score, mobile responsiveness.", path: "/free-site-scanner", color: "from-cyan-400 to-blue-500" },
  { icon: Search, title: "SEO Health Check", desc: "Analyze title, meta, headings, content quality.", path: "/free-tools/seo-health", color: "from-emerald-400 to-cyan-500" },
  { icon: Shield, title: "Domain Breach Scanner", desc: "Check domain exposure in known data breaches.", path: "/free-tools/breach-scan", color: "from-red-400 to-pink-500" },
  { icon: BarChart3, title: "Competitor Rank Checker", desc: "Top 10 for any keyword in any city.", path: "/free-tools/rank-check", color: "from-violet-400 to-purple-500" },
  { icon: Code, title: "Meta Tag Analyzer", desc: "Grade meta tags, OG, canonical, robots.", path: "/free-tools/meta-tags", color: "from-amber-400 to-orange-500" },
  { icon: TrendingDown, title: "Leaky Bucket CRM Audit", desc: "Calculate revenue lost on dead leads.", path: "/free-tools/leaky-bucket", color: "from-red-500 to-orange-500" },
  { icon: Heart, title: "Medicare Staffing", desc: "Federal staffing rating, fines, compliance risk.", path: "/free-tools/medicare-staffing", color: "from-pink-400 to-red-500" },
  { icon: MapPin, title: "Local Search Audit", desc: "Google Maps visibility vs competitors.", path: "/free-tools/local-search", color: "from-indigo-400 to-violet-500" },
  { icon: Code, title: "Service Gap Scanner", desc: "High-margin services competitors rank for.", path: "/free-tools/service-gap", color: "from-emerald-500 to-teal-500" },
  { icon: Shield, title: "ADA Lawsuit Risk Scanner", desc: "WCAG accessibility violations scan.", path: "/free-tools/ada-scanner", color: "from-amber-500 to-yellow-500" },
  { icon: HardHat, title: "OSHA Safety Check", desc: "OSHA/MIOSHA violations, citations, fines.", path: "/free-tools/osha-check", color: "from-orange-500 to-red-600" },
  { icon: Wrench, title: "Equipment Age Estimator", desc: "HVAC, boiler, roof replacement estimates.", path: "/free-tools/equipment-age", color: "from-blue-500 to-cyan-500" },
  { icon: Stethoscope, title: "Nursing Compliance", desc: "License expirations, revocations, actions.", path: "/free-tools/nursing-compliance", color: "from-pink-500 to-purple-500" },
];

export default function DWALabs() {
  return (
    <div className="space-y-6">
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-lg">🧪</span>
          <h3 className="text-white font-bold text-lg">Free Tools Lab</h3>
        </div>
        <p className="text-white/50 text-sm mb-1">Test all 13 Trojan Horse lead-gen tools. Each captures email on scan completion.</p>
        <a href="/free-tools" target="_blank" rel="noreferrer" className="text-[#00d4ff] text-xs font-mono hover:underline inline-flex items-center gap-1">
          Open Public Hub <ExternalLink size={10} />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((t) => (
          <a
            key={t.path}
            href={t.path}
            target="_blank"
            rel="noreferrer"
            className="group bg-[#0f1f35] border border-white/10 rounded-xl p-4 hover:border-[#00d4ff]/40 transition-all hover:bg-[#0f1f35]/80"
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                <t.icon size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <h4 className="text-white text-sm font-semibold truncate">{t.title}</h4>
                <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{t.desc}</p>
              </div>
            </div>
            <div className="mt-3 text-right">
              <span className="text-[#00d4ff] text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                Test → <ExternalLink size={10} />
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
