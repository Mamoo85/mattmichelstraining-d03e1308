import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { BookOpen, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "Monthly AI-written congregation newsletter",
  "Weekly bulletin content and announcements",
  "Sermon recap summaries",
  "Volunteer spotlights and event recaps",
  "Upcoming events section (you provide dates)",
  "Seasonal devotionals and reflections",
  "Works for churches, nonprofits, and ministries",
  "7-day free trial — cancel anytime",
];

export default function AIChurchNewsletter() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">Welcome!</h1>
          <p className="text-[#aaa] text-sm">We'll reach out within 24 hours to learn about your church and get your first newsletter started.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Church & Nonprofit Newsletter — $29/mo | M² Development" description="AI writes your monthly congregation newsletter, weekly bulletin content, and sermon recaps. $29/month — the most affordable ministry tool available." path="/ai-church-newsletter" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><BookOpen size={11} /> AI Church & Nonprofit Newsletter</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Your Congregation Deserves<br /><span className="text-[#f97316]">a Great Newsletter.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI writes your monthly newsletter, weekly bulletin copy, and sermon summaries. You give us the heart of your ministry — we handle the writing. Just $29/month.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$29/mo after trial · Churches, nonprofits & ministries · Cancel anytime</p>
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
            <WaitlistGate productName="AI Church Newsletter" description="Weekly AI-written newsletters for your congregation — announcements, reflections, and event highlights." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
