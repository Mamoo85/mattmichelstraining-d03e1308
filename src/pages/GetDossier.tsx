import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface PreviewData {
  html: string;
  signal_id: string;
  company_name: string;
  confidence: number;
}

const FEATURES = [
  { icon: "📊", label: "Real Metro Detroit manufacturer about to spend on suppliers" },
  { icon: "🎯", label: "Predicted purchase categories (consumables, equipment, services)" },
  { icon: "⚡", label: "1-page printable PDF — share with your sales team" },
  { icon: "🔒", label: "100% public-data sourced. Free. No credit card." },
];

export default function GetDossier() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  // Show success/cancel toast on Stripe redirect.
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast({
        title: "🎉 Order received",
        description: "Matt will email your 5 dossiers within 24 hours.",
      });
    } else if (checkout === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "No charge made. Your free preview is still available below.",
      });
    }
  }, [searchParams, toast]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-free-dossier", {
        body: { email: email.trim(), company: company.trim() || undefined, source: "get-dossier-page" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreview(data as PreviewData);
      // Scroll to preview after render.
      setTimeout(() => {
        document.getElementById("dossier-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      toast({
        title: "Couldn't generate dossier",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!preview || !email) return;
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-dossier-pack-checkout", {
        body: { email: email.trim(), signal_id: preview.signal_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast({
        title: "Checkout failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <Helmet>
        <title>Free Industrial Intelligence Dossier | Detroit Web Agency</title>
        <meta
          name="description"
          content="Get a free 1-page intelligence dossier on a Metro Detroit manufacturer about to spend on suppliers. Real public data, no credit card."
        />
        <link rel="canonical" href="https://detroitwebagent.com/get-dossier" />
      </Helmet>

      {/* HERO */}
      <section className="px-4 py-16 sm:py-24 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-xs font-bold tracking-widest mb-6">
            FREE · NO CREDIT CARD
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold mb-6 leading-tight">
            One Metro Detroit manufacturer
            <span className="block text-[#00d4ff] mt-2">about to spend.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            We watch 16 public data sources for Detroit-area manufacturers actively hiring tradespeople.
            Hiring = imminent spend on consumables, equipment, and supplier services. Get one free 1-page
            dossier on a real, named company — right now.
          </p>
        </div>

        {/* EMAIL GATE */}
        {!preview ? (
          <form
            onSubmit={handleRequest}
            className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 sm:p-8 max-w-xl mx-auto backdrop-blur"
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-200 mb-2 block">Work email *</span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yoursupplyhouse.com"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-12"
                disabled={loading}
                maxLength={255}
                autoComplete="email"
              />
              <span className="text-xs text-slate-500 mt-1.5 block">
                Personal email providers (Gmail, Yahoo) aren't accepted — work email only.
              </span>
            </label>

            <label className="block mt-4">
              <span className="text-sm font-semibold text-slate-200 mb-2 block">
                Company <span className="text-slate-500 font-normal">(optional)</span>
              </span>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Behler-Young, ABC Supply, etc."
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-12"
                disabled={loading}
                maxLength={200}
                autoComplete="organization"
              />
            </label>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6 h-12 bg-[#00d4ff] hover:bg-[#00a8cc] text-[#0a1628] font-bold text-base"
            >
              {loading ? "Generating dossier…" : "Get my free dossier →"}
            </Button>

            <p className="text-xs text-slate-500 text-center mt-4">
              We'll email you the PDF and never share your address. One-click unsubscribe.
            </p>
          </form>
        ) : (
          // PREVIEW + UPGRADE
          <div id="dossier-preview" className="max-w-3xl mx-auto">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6 text-center">
              <p className="text-emerald-300 font-semibold">
                ✓ Your free dossier on <span className="text-white">{preview.company_name}</span> is ready below
              </p>
            </div>

            <div
              className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />

            {/* UPGRADE CTA */}
            <div className="mt-10 bg-gradient-to-br from-[#00d4ff]/10 to-slate-900/80 border border-[#00d4ff]/30 rounded-xl p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="text-xs font-bold tracking-widest text-[#00d4ff] mb-2">
                  WANT 5 MORE LIKE THIS?
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  Get the next 5 dossiers for <span className="text-[#00d4ff]">$50</span>
                </h2>
                <p className="text-slate-300 max-w-md mx-auto">
                  Hand-picked, freshly curated, and emailed within 24 hours. One-time charge.
                  No subscription. Cancel anytime — there's nothing to cancel.
                </p>
              </div>

              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full h-14 bg-[#00d4ff] hover:bg-[#00a8cc] text-[#0a1628] font-bold text-lg"
              >
                {upgrading ? "Opening checkout…" : "Buy 5 dossiers — $50 →"}
              </Button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Secured by Stripe. Or reply to your free dossier email and Matt will invoice you directly.
              </p>
            </div>

            <button
              onClick={() => {
                setPreview(null);
                setEmail("");
                setCompany("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="mt-6 text-sm text-slate-400 hover:text-[#00d4ff] mx-auto block"
            >
              ← Request another free dossier
            </button>
          </div>
        )}
      </section>

      {/* WHAT YOU GET */}
      {!preview && (
        <section className="px-4 pb-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">What's in the dossier</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 flex items-start gap-3"
              >
                <span className="text-2xl">{f.icon}</span>
                <span className="text-slate-200 leading-relaxed">{f.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="px-4 py-8 border-t border-slate-800 text-center text-sm text-slate-500">
        <p>
          Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219
        </p>
        <p className="mt-2">Compiled exclusively from public hiring data. We never call or text you.</p>
      </footer>
    </div>
  );
}
