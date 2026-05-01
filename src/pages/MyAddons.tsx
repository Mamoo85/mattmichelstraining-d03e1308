import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Sparkles, Check } from "lucide-react";

interface Addon {
  id: string;
  slug: string;
  name: string;
  pitch: string;
  monthly_price_cents: number;
  display_order: number;
}

export default function MyAddons() {
  const { user } = useAuth();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: catalog } = await supabase
        .from("addon_catalog" as any)
        .select("*")
        .eq("active", true)
        .order("display_order");
      setAddons((catalog as any) || []);

      if (user?.email) {
        const { data: pitches } = await supabase
          .from("addon_pitches" as any)
          .select("addon_slug, outcome")
          .eq("client_email", user.email)
          .eq("outcome", "subscribed");
        setOwned(new Set(((pitches as any) || []).map((p: any) => p.addon_slug)));
      }
      setLoading(false);
    })();
  }, [user?.email]);

  async function addToPlan(slug: string) {
    if (!user?.email) {
      alert("Please log in first.");
      return;
    }
    setBusy(slug);
    try {
      const { data, error } = await supabase.functions.invoke("create-addon-checkout", {
        body: { addon_slug: slug, client_email: user.email },
      });
      if (error) throw error;
      if ((data as any)?.url) {
        window.location.href = (data as any).url;
      }
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(null);
    }
  }

  return (
    <>
      <SEOHead
        title="Your Add-Ons | Detroit Web Agency"
        description="Add new revenue tools to your plan in one click."
      />
      <main className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-black tracking-tight">Your Add-Ons</h1>
          <p className="text-muted-foreground mt-2">
            Stack more revenue tools on top of your plan. One click — no new account needed.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addons.map((a) => {
              const isOwned = owned.has(a.slug);
              return (
                <article key={a.id} className="border border-border bg-card rounded-xl p-6">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      <h2 className="text-xl font-bold">{a.name}</h2>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black">${(a.monthly_price_cents / 100).toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">/mo</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{a.pitch}</p>
                  {isOwned ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                      <Check className="w-4 h-4" /> Active on your plan
                    </div>
                  ) : (
                    <button
                      onClick={() => addToPlan(a.slug)}
                      disabled={busy === a.slug}
                      className="w-full bg-cyan-500 text-slate-900 font-bold py-2.5 rounded-lg hover:bg-cyan-400 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {busy === a.slug && <Loader2 className="w-4 h-4 animate-spin" />}
                      {busy === a.slug ? "Redirecting…" : "Add to my plan"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
