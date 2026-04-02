import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import {
  Voicemail, MessageSquare, Brain,
  ArrowRight, DollarSign, Clock, CheckCircle,
} from "lucide-react";

const HOW_IT_WORKS = [
  { icon: Voicemail, step: "01", title: "Caller Leaves Voicemail", desc: "When you miss a call and the caller leaves a voicemail, our system captures the recording automatically." },
  { icon: Brain, step: "02", title: "AI Transcribes & Summarizes", desc: "AI instantly transcribes the voicemail and creates a clean summary: who called, what they need, and their urgency level." },
  { icon: MessageSquare, step: "03", title: "Summary Texted to You", desc: "You get a text and email with the summary within seconds. No more listening to rambling voicemails." },
];

const INCLUDED = [
  "Instant voicemail transcription",
  "AI-powered call summary",
  "Text + email delivery",
  "Caller name & number extraction",
  "Urgency level detection",
  "Pairs with Missed Call Text-Back",
  "Searchable voicemail history",
  "7-day free trial — cancel anytime",
];

export default function AIVoicemailTranscription() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-6"><CheckCircle size={36} className="text-[#f97316]" /></div>
          <h1 className="text-2xl font-black mb-3">You're In — Trial Started!</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-4">Matt will reach out within 24 hours to complete voicemail forwarding setup. After that, every voicemail gets transcribed and summarized instantly.</p>
          <p className="text-xs text-[#666]">Questions? Email matt@mattmichelstraining.com</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI Voicemail Transcription & Summary — $49/mo" description="AI transcribes and summarizes your voicemails instantly. Get a text with who called, what they need, and how urgent. $49/mo." path="/ai-voicemail" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><Voicemail size={11} /> AI Voicemail</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Stop Listening to<br /><span className="text-[#f97316]">Rambling Voicemails.</span></h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">AI transcribes every voicemail and texts you a clean summary: who called, what they need, and how urgent it is. Read it in 5 seconds instead of listening for 2 minutes.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-4 font-bold rounded-xl flex items-center gap-2" onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })}>Start Free 7-Day Trial <ArrowRight size={16} /></button>
              <div className="flex items-center gap-2 text-[#888] text-sm"><Clock size={14} /><span>Setup in 10 minutes</span></div>
            </div>
            <p className="text-xs text-[#666] mt-4">$49/mo after trial · Month-to-month · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-10">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-6 text-center">
                  <div className="text-[10px] font-bold text-[#f97316] tracking-widest mb-3">STEP {s.step}</div>
                  <div className="w-12 h-12 rounded-xl bg-[#f97316]/15 flex items-center justify-center mx-auto mb-4"><s.icon size={20} className="text-[#f97316]" /></div>
                  <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="bg-[#1a1a2e] border border-[#f97316]/30 rounded-xl p-6 text-center">
              <div className="inline-flex items-center gap-1 bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold px-3 py-1 rounded-full mb-3"><DollarSign size={10} /> 7-DAY FREE TRIAL</div>
              <div className="text-4xl font-black text-[#f97316] mb-1">$49<span className="text-xl text-[#888] font-normal">/mo</span></div>
              <p className="text-sm text-[#aaa] mb-4">after trial · cancel anytime</p>
              <ul className="text-xs text-[#888] space-y-2 text-left max-w-xs mx-auto">
                {INCLUDED.map((item) => (<li key={item} className="flex items-start gap-2"><CheckCircle size={11} className="text-[#f97316] shrink-0 mt-0.5" />{item}</li>))}
              </ul>
            </div>
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-24">
          <div className="max-w-md mx-auto">
            <WaitlistGate productName="AI Voicemail Transcription" description="Automatic transcription and summary of voicemails sent to your inbox within seconds." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
