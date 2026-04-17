import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

const FreeSiteScanner = () => {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const { toast } = useToast();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("live-site-scanner", {
        body: { url, email: email || undefined },
      });
      if (error) throw error;
      setReport(data);
      if (email) {
        toast({ title: "Full report sent!", description: `Check ${email} for the detailed breakdown.` });
      }
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message || "Please try again.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0f" }}>
      <div className="container max-w-3xl mx-auto px-4 pt-32 pb-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#22d3ee" }}>
            <Search className="h-3.5 w-3.5" /> Free Tool
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: "#f8fafc" }}>
            Free Site Health Scanner
          </h1>
          <p className="text-lg" style={{ color: "#94a3b8" }}>
            Enter your URL and get an instant analysis of what's costing you leads.
          </p>
        </div>

        {!report ? (
          <form onSubmit={handleScan} className="rounded-2xl p-8" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <div className="space-y-4">
              <Input placeholder="https://yourbusiness.com" value={url} onChange={(e) => setUrl(e.target.value)} className="py-6 text-base bg-[#0a0a0f] border-[rgba(148,163,184,0.15)] text-white placeholder:text-[#475569]" required />
              <Input type="email" placeholder="Your email (optional — unlocks full report)" value={email} onChange={(e) => setEmail(e.target.value)} className="py-6 text-base bg-[#0a0a0f] border-[rgba(148,163,184,0.15)] text-white placeholder:text-[#475569]" />
              <Button type="submit" disabled={loading} className="w-full py-6 text-base font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</> : <>Scan My Site <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl p-8" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: "#e2e8f0" }}>Results for {report.url || url}</h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: "Mobile Score", value: report.mobileScore ?? "N/A", good: (report.mobileScore ?? 0) >= 70 },
                { label: "SEO Score", value: report.seoScore ?? "N/A", good: (report.seoScore ?? 0) >= 70 },
              ].map((m) => (
                <div key={m.label} className="text-center p-4 rounded-xl" style={{ background: m.good ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${m.good ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>
                  <div className="text-3xl font-black" style={{ color: m.good ? "#22c55e" : "#f87171" }}>{m.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] mt-1" style={{ color: "#94a3b8" }}>{m.label}</div>
                </div>
              ))}
            </div>

            {report.issues && report.issues.length > 0 && (
              <div className="space-y-3 mb-8">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: "#f87171" }}>
                  <AlertTriangle className="inline h-4 w-4 mr-1" /> Top Issues
                </h3>
                {report.issues.map((issue: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)" }}>
                    <span className="text-sm" style={{ color: "#fca5a5" }}>{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {!email && (
              <div className="p-4 rounded-lg text-center" style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
                <p className="text-sm mb-3" style={{ color: "#94a3b8" }}>Want the full detailed report?</p>
                <form onSubmit={async (e) => { e.preventDefault(); if (!email) return; await supabase.functions.invoke("live-site-scanner", { body: { url, email, sendReport: true } }); toast({ title: "Report sent!", description: `Check ${email}` }); }} className="flex gap-2">
                  <Input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#0a0a0f] border-[rgba(148,163,184,0.15)] text-white" required />
                  <Button type="submit" style={{ background: "#22d3ee", color: "#020617" }}>Send Report</Button>
                </form>
              </div>
            )}

            <div className="text-center mt-8">
              <Button asChild size="lg" className="px-10 py-5 font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
                <Link to="/ai-website-audit">
                  <CheckCircle className="mr-2 h-4 w-4" /> Get a Full Professional Audit
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FreeSiteScanner;
