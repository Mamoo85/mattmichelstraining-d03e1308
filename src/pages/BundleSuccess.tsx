import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function BundleSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  useEffect(() => {
    document.title = "You're in! — Detroit Web Agency";
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white px-5 py-16 sm:py-24">
      <div className="max-w-xl mx-auto text-center">
        <div className="text-5xl">🎯</div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-[#00d4ff]">You're in.</h1>
        <p className="mt-4 text-slate-300 text-base sm:text-lg leading-relaxed">
          Payment received. Matt will text you within 1 business hour to schedule the kickoff call. Your new site + FieldDesk goes live in <strong className="text-white">7 days</strong>.
        </p>
        <div className="mt-8 border border-[#1e3a5f] bg-[#0c1a2e] rounded-xl p-5 text-left">
          <div className="text-[#00d4ff] text-xs uppercase tracking-wider font-bold">What happens next</div>
          <ol className="mt-3 space-y-2 text-slate-200 text-[15px] list-decimal list-inside">
            <li>Matt texts you within 1 business hour</li>
            <li>We schedule a 30-min kickoff (today or tomorrow)</li>
            <li>You see the new site on day 5</li>
            <li>Go live on day 7</li>
          </ol>
        </div>
        <p className="mt-8 text-slate-400 text-sm">
          Need to reach Matt now? <a href="sms:+13139921219" className="text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </p>
        {sessionId && <p className="mt-6 text-slate-600 text-xs">Receipt ref: {sessionId.slice(0, 20)}…</p>}
        <div className="mt-10">
          <Link to="/" className="text-slate-400 underline text-sm">← back to detroitwebagent.com</Link>
        </div>
      </div>
    </div>
  );
}
