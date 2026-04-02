import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Sparkles, Star, CheckCircle, ArrowRight, Heart } from "lucide-react";

const INCLUDED = [
  "AI-written weekly social media posts (Instagram, Facebook)",
  "Monthly email campaign to your client list",
  "Automated Google review request sequences",
  "AI-generated treatment spotlight content",
  "Before/after caption writing for your photos",
  "Seasonal promotion copy (holiday, Valentine's, etc.)",
  "7-day free trial — cancel anytime",
];

const RESULTS = [
  { stat: "3x", label: "more Google reviews on average" },
  { stat: "40%", label: "increase in repeat bookings" },
  { stat: "0 hrs", label: "of your time per week" },
];

export default function AIMedSpaMarketing() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-6"><CheckCircle size={36} className="text-[#f97316]" /></div>
          <h1 className="text-2xl font-black mb-3">Welcome! Trial Started.</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">We'll reach out within 24 hours to get your brand info and services. Your first content goes out this week.</p>
          <p className="text-xs text-[#666]">Questions? Email matt@mattmichelstraining.com</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Marketing for Med Spas — $149/mo | M² Development" description="AI writes and sends weekly social posts, email campaigns, and Google review requests for your med spa — fully automated. $149/month." path="/ai-med-spa-marketing" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Heart size={11} /> AI Med Spa Marketing</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Your Med Spa.<br /><span className="text-[#f97316]">Marketed on Autopilot.</span></h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">AI writes all your social content, email campaigns, and Google review requests — every week, automatically. You focus on clients. We handle the marketing.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-4 font-bold rounded-xl flex items-center gap-2">Start Free 7-Day Trial <ArrowRight size={16} /></button>
            </div>
            <p className="text-xs text-[#666] mt-4">$149/mo after trial · Month-to-month · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-12">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4">
            {RESULTS.map(r => (
              <div key={r.stat} className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <p className="text-3xl font-black text-[#f97316]">{r.stat}</p>
                <p className="text-[#aaa] text-xs mt-1">{r.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black mb-6 text-center">Everything included at $149/mo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INCLUDED.map(item => (
                <div key={item} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                  <CheckCircle size={16} className="text-[#f97316] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#ccc]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-20">
          <div className="max-w-xl mx-auto">
            <WaitlistGate productName="AI Med Spa Marketing" description="Weekly social media posts, monthly email campaigns, and automated Google review requests for med spas." price="$149/mo" />
          </div>
        </section>
      </div>
    </>
  );
}
