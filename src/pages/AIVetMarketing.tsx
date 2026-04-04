import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { PawPrint, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "Weekly social media posts (Instagram, Facebook)",
  "Monthly email newsletter to pet owners",
  "Google review request sequences",
  "Seasonal pet care tip content",
  "Vaccination and wellness reminder copy",
  "New patient welcome email templates",
  "Works for vet clinics, groomers, daycares & boarders",
  "7-day free trial — cancel anytime",
];

export default function AIVetMarketing() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to get your practice info and start creating content.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Marketing for Vet Clinics & Pet Care — $79/mo | M2 Development" description="AI writes social posts, email newsletters, and review requests for veterinary clinics, groomers, and pet daycares. $79/month." path="/ai-vet-marketing" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><PawPrint size={11} /> AI Vet & Pet Care Marketing</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">More Pet Owners.<br /><span className="text-[#f97316]">Zero Marketing Effort.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI writes your weekly social posts, monthly newsletters, and Google review requests — so your vet clinic, grooming shop, or pet daycare stays top of mind with pet owners in your area.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$79/mo after trial · Cancel anytime</p>
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
            <WaitlistGate productName="AI Vet Marketing" description="AI-generated social posts, newsletters, and client communication templates for veterinary practices." price="$99/mo" />
          </div>
        </section>
      </div>
    </>
  );
}
