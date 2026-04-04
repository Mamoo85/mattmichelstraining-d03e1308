import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Truck, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "Monthly safety checklist and pre-trip inspection forms",
  "Driver communication and policy update letters",
  "Bill of lading and load confirmation templates",
  "HOS compliance reminder messages",
  "Incident report and documentation templates",
  "New driver onboarding packet copy",
  "Works for owner-operators and small fleets",
  "7-day free trial — cancel anytime",
];

export default function AITruckingDocs() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to get your fleet details and set up your document templates.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Trucking & Fleet Documents — $99/mo | M2 Development" description="AI writes safety checklists, driver comms, BOL templates, and HOS reminders for owner-operators and small trucking fleets. $99/month." path="/ai-trucking-docs" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Truck size={11} /> AI Trucking & Fleet Docs</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Less Paperwork.<br /><span className="text-[#f97316]">More Miles.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI generates your monthly safety checklists, driver letters, BOL templates, and HOS compliance reminders — so you spend less time on paperwork and more time running loads. Built for owner-operators and small fleets.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$99/mo after trial · Cancel anytime</p>
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
            <WaitlistGate productName="AI Trucking Docs" description="AI-generated driver logs, safety checklists, compliance documents, and carrier communication templates." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
