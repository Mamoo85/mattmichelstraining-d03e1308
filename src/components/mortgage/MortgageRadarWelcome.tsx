import { useEffect, useState } from "react";
import { X, Zap, MapPin, MessageSquare, TrendingUp } from "lucide-react";

const KEY = "mr_welcome_v1_dismissed";

export default function MortgageRadarWelcome({ name }: { name?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // localStorage unavailable — skip splash
    }
  }, []);

  if (!open) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {}
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-lg w-full bg-gradient-to-br from-[#0a1628] to-[#030711] border border-[#00d4ff]/40 rounded-2xl p-6 sm:p-8 shadow-[0_0_60px_-10px_rgba(0,212,255,0.4)]"
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-[#64748b] hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 mb-3">
            <Zap className="w-3 h-3 text-[#00d4ff]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00d4ff]">
              Welcome aboard
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {name ? `Hey ${name} — ` : ""}your radar is live.
          </h2>
          <p className="text-sm text-[#94a3b8] mt-2">
            Here's exactly how to turn signals into closed loans.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <Step
            icon={<TrendingUp className="w-4 h-4" />}
            title="Check your dashboard every morning"
            body="Hot leads (9–10) hit the top. We email you a summary at 6:30 AM ET so you can plan your call list over coffee."
          />
          <Step
            icon={<MapPin className="w-4 h-4" />}
            title="Use the Map tab to plan your day"
            body="See where leads cluster. Group nearby appointments to save windshield time."
          />
          <Step
            icon={<MessageSquare className="w-4 h-4" />}
            title="Draft outreach in one click"
            body="We pre-write the opener based on the signal. You approve before anything sends — full control, full compliance."
          />
        </div>

        <div className="bg-[#030711] border border-[#1e3a5f] rounded-lg p-3 mb-5">
          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
            <span className="text-[#00d4ff] font-bold">Pro tip:</span> Hot signals expire fast. Most
            close-able leads are contacted within 48 hours of the signal firing. Move fast on the 9s and 10s.
          </p>
        </div>

        <button
          onClick={dismiss}
          className="w-full py-3 bg-[#00d4ff] text-[#030711] font-black rounded-lg hover:bg-[#00d4ff]/90 transition-colors"
        >
          Let's go →
        </button>
        <p className="text-[10px] text-center text-[#475569] mt-3">
          Questions? Text Matt: (313) 992-1219
        </p>
      </div>
    </div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 bg-[#030711]/60 border border-[#1e3a5f] rounded-lg p-3">
      <div className="w-8 h-8 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/30 flex items-center justify-center text-[#00d4ff] flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
