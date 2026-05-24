import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Loader2, Package, Mail } from "lucide-react";
import { toast } from "sonner";

type Plan = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  is_digital: boolean;
  included_items: Array<{ label: string }>;
  cover_image_url: string | null;
};

export default function GngSubscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Subscription Boxes · Guilds & Grains";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Sock, yarn, pattern & gift subscription boxes shipped monthly from Guilds & Grains. Cancel anytime.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description"; m.content = desc; document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("gng_subscription_plans")
        .select("slug,name,tagline,description,price_cents,is_digital,included_items,cover_image_url")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) toast.error("Couldn't load plans");
      else setPlans((data ?? []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  async function startCheckout(slug: string) {
    setCheckoutSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke("create-gng-subscription-checkout", {
        body: { plan_slug: slug },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
      setCheckoutSlug(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fdf6ec] text-[#3d2a1a]">
      <header className="border-b border-[#e8d8c0] bg-[#fdf6ec]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/gng" className="font-serif text-xl font-bold text-[#7a3e1d]">Guilds &amp; Grains</Link>
          <Link to="/gng" className="text-sm text-[#7a3e1d] hover:underline">← Back to shop</Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[#a8763c] mb-4">Monthly Boxes</p>
        <h1 className="font-serif text-5xl md:text-6xl font-bold mb-4 text-[#3d2a1a]">A new little luxury, every month.</h1>
        <p className="text-lg text-[#5b4636] max-w-2xl mx-auto">
          Hand-curated by Lisa. Shipped fresh to your door. Cancel anytime, no questions.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7a3e1d]" /></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <Card key={p.slug} className="bg-white border-[#e8d8c0] p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  {p.is_digital ? <Mail className="w-5 h-5 text-[#7a3e1d]" /> : <Package className="w-5 h-5 text-[#7a3e1d]" />}
                  <span className="text-[10px] uppercase tracking-widest text-[#a8763c]">
                    {p.is_digital ? "Digital" : "Ships monthly"}
                  </span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#3d2a1a] mb-1">{p.name}</h3>
                {p.tagline && <p className="text-sm text-[#7a6450] mb-4 italic">{p.tagline}</p>}
                <div className="my-4">
                  <span className="text-4xl font-bold text-[#7a3e1d]">${(p.price_cents / 100).toFixed(0)}</span>
                  <span className="text-sm text-[#7a6450]">/month</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {(p.included_items ?? []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#5b4636]">
                      <Check className="w-4 h-4 text-[#7a3e1d] mt-0.5 shrink-0" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => startCheckout(p.slug)}
                  disabled={checkoutSlug !== null}
                  className="w-full bg-[#7a3e1d] hover:bg-[#5b2e15] text-white"
                >
                  {checkoutSlug === p.slug ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting…</>
                  ) : "Start subscription"}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[#7a6450] mt-10">
          Powered by Stripe. Cancel any time from your welcome email or by replying to us.
        </p>
      </section>
    </main>
  );
}
