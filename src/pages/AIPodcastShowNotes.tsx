import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { Mic, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "AI-written show notes for every episode",
  "Episode summary (200–400 words)",
  "Key takeaways bullet list",
  "Guest bio section (if applicable)",
  "Timestamps / chapter markers",
  "SEO-optimized title and description",
  "7-day free trial — cancel anytime",
];

export default function AIPodcastShowNotes() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-[#aaa] text-sm">Send us your first episode and we'll have show notes back within 24 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Podcast Show Notes — $49/mo | M² Development" description="Send us your episode, get back professional show notes, summaries, timestamps, and SEO descriptions. $49/month, fully automated." path="/ai-podcast-show-notes" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Mic size={11} /> AI Podcast Show Notes</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Stop Writing Show Notes.<br /><span className="text-[#f97316]">We Do It for $49/month.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">Send us your episode link or audio. We send back complete show notes, summaries, timestamps, and SEO-optimized descriptions — within 24 hours.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$49/mo after trial · Up to 8 episodes/mo · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black mb-6 text-center">What's included per episode</h2>
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
            <WaitlistGate productName="AI Podcast Show Notes" description="AI-generated show notes, summaries, and social clips for every episode you publish." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
