import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Home, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "Monthly AI-written drip email to your leads list",
  "Market update newsletter for past clients",
  "Listing announcement email templates",
  "Seller/buyer lead nurture sequences",
  "Holiday and seasonal touchpoint emails",
  "Open house follow-up email copy",
  "7-day free trial — cancel anytime",
];

export default function AIRealEstateDrip() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to get your leads list and branding. First drip goes out this week.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Real Estate Drip Email — $79/mo | M² Development" description="AI writes and sends monthly drip emails to your real estate leads and past clients. Stay top of mind automatically. $79/month." path="/ai-real-estate-drip" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Home size={11} /> AI Real Estate Drip</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Stay in Front of Every Lead.<br /><span className="text-[#f97316]">Without Typing a Word.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI writes your monthly market updates, drip sequences, and listing announcements. Your leads hear from you every month — even when you're busy closing deals.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$79/mo after trial · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black mb-6 text-center">What's included</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INCLUDED.map(item => (
                <div key={item} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                  <CheckCircle size={15} className="text-[#f97316] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#ccc]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-20">
          <div className="max-w-xl mx-auto">
            <WaitlistGate productName="AI Real Estate Drip" description="Automated email drip campaigns written by AI for real estate agents — nurture leads on autopilot." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
