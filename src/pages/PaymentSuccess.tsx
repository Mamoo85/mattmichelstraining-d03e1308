import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const type = params.get("type");
  const business = params.get("business") || "your business";

  useEffect(() => {
    document.title = "Payment received — Detroit Web Agency";
  }, []);

  const isMaintenance = type === "maintenance";

  return (
    <div className="min-h-screen bg-[#0a1628] text-white px-5 py-16 sm:py-24">
      <div className="max-w-xl mx-auto text-center">
        <div className="text-5xl">{isMaintenance ? "🔧" : "🎉"}</div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-[#00d4ff]">
          {isMaintenance ? "Maintenance plan activated." : "Website project confirmed."}
        </h1>
        <p className="mt-4 text-slate-300 text-base sm:text-lg leading-relaxed">
          Payment received for <strong className="text-white">{business}</strong>.{" "}
          {isMaintenance
            ? "Matt will send confirmation and your first monthly report within 24 hours."
            : "Matt will text you within 1 business hour to schedule the kickoff call."}
        </p>
        <div className="mt-8 border border-[#1e3a5f] bg-[#0c1a2e] rounded-xl p-5 text-left">
          <div className="text-[#00d4ff] text-xs uppercase tracking-wider font-bold">What happens next</div>
          {isMaintenance ? (
            <ol className="mt-3 space-y-2 text-slate-200 text-[15px] list-decimal list-inside">
              <li>Confirmation email arrives within 1 hour</li>
              <li>We connect your site to our monitoring dashboard</li>
              <li>Monthly performance report on the 1st</li>
            </ol>
          ) : (
            <ol className="mt-3 space-y-2 text-slate-200 text-[15px] list-decimal list-inside">
              <li>Matt texts you within 1 business hour</li>
              <li>30-min kickoff call (today or tomorrow)</li>
              <li>First draft on day 5</li>
              <li>Live site on day 7</li>
            </ol>
          )}
        </div>
        <p className="mt-8 text-slate-400 text-sm">
          Need to reach Matt now?{" "}
          <a href="sms:+13139921219" className="text-[#00d4ff] font-semibold">
            (313) 992-1219
          </a>
        </p>
        <div className="mt-10">
          <Link to="/" className="text-slate-400 underline text-sm">
            ← back to detroitwebagent.com
          </Link>
        </div>
      </div>
    </div>
  );
}
