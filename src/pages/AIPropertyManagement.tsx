import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Building2, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "Monthly tenant communication letters (lease renewals, notices)",
  "Maintenance request follow-up messages",
  "Late payment reminder sequences",
  "Move-in / move-out checklists and instructions",
  "Seasonal property maintenance reminders",
  "Vacancy listing description copy",
  "Works for landlords with 1 unit or 100+",
  "7-day free trial — cancel anytime",
];

export default function AIPropertyManagement() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're Set!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to learn about your properties and get your automation set up.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Property Management Automation — $99/mo | M² Development" description="AI writes tenant notices, lease renewal letters, maintenance follow-ups, and late payment reminders for landlords and property managers. $99/month." path="/ai-property-management" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Building2 size={11} /> AI Property Management</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Landlord Paperwork.<br /><span className="text-[#f97316]">Done by AI.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">Tenant notices, lease renewals, late payment reminders, and maintenance follow-ups — all written by AI and ready to send. Whether you have 1 unit or 100, this saves hours every month.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$99/mo after trial · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
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
            <WaitlistGate productName="AI Property Management Docs" description="AI-generated lease templates, tenant notices, maintenance request responses, and landlord communications." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
