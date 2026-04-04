import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { TrendingUp, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "Monthly educational newsletter for clients",
  "Weekly LinkedIn post copy (compliant tone)",
  "Market commentary blurbs (non-advisory)",
  "Retirement planning educational articles",
  "FAQs and explainer content for your website",
  "Seasonal financial topic content (tax season, etc.)",
  "Compliance-conscious — no specific investment advice",
  "7-day free trial — cancel anytime",
];

export default function AIFinancialAdvisorContent() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to get your brand voice and compliance preferences set up.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Content for Financial Advisors — $149/mo | M2 Development" description="AI writes compliance-aware newsletters, LinkedIn posts, and educational content for RIAs and financial planners. $149/month." path="/ai-financial-advisor-content" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><TrendingUp size={11} /> AI Financial Advisor Content</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Stay in Front of Clients.<br /><span className="text-[#f97316]">Without Compliance Headaches.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI writes educational newsletters, LinkedIn posts, and website content for financial advisors — in a compliance-conscious tone that educates without advising. Build trust with your audience on autopilot.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$149/mo after trial · RIAs, CFPs, planners welcome · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INCLUDED.map(item => (
              <div key={item} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <CheckCircle size={15} className="text-[#f97316] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#ccc]">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-20">
          <div className="max-w-xl mx-auto">
            <WaitlistGate productName="AI Financial Advisor Content" description="Compliant, AI-generated newsletters and social content for financial advisors and wealth managers." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
