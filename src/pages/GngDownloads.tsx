// Customer-facing page for Guilds & Grains digital downloads.
// - If ?token=... → resolves and offers the download.
// - If ?session_id=... → shows "thanks, check your email".
// - Otherwise → browses the digital catalog with checkout buttons.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, Mail, FileText } from "lucide-react";
import { toast } from "sonner";

type DigitalProduct = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  preview_image_url: string | null;
  category: string | null;
};

export default function GngDownloads() {
  const [sp] = useSearchParams();
  const token = sp.get("token");
  const sessionId = sp.get("session_id");

  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);

  const [resolving, setResolving] = useState<boolean>(!!token);
  const [resolved, setResolved] = useState<{ product_name: string; file_url: string } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Downloads · Guilds & Grains";
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("gng-download-resolve", {
          method: "GET" as any,
          body: undefined,
          // Edge function reads from URL params; pass via fetch:
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setResolved(data);
      } catch (_e) {
        // Fallback: hit the function URL directly with the token param
        try {
          const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const url = `https://${projectRef}.supabase.co/functions/v1/gng-download-resolve?token=${encodeURIComponent(token)}`;
          const resp = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
          const json = await resp.json();
          if (!resp.ok || json.error) throw new Error(json.error || "resolve_failed");
          setResolved(json);
        } catch (e2: any) {
          setResolveError(e2.message ?? "Could not resolve download");
        }
      } finally {
        setResolving(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (token || sessionId) return;
    (async () => {
      const { data } = await supabase
        .from("gng_digital_products_public" as any)
        .select("slug,name,tagline,description,price_cents,preview_image_url,category")
        .order("sort_order", { ascending: true });
      setProducts((data ?? []) as DigitalProduct[]);
      setLoadingList(false);
    })();
  }, [token, sessionId]);

  async function buy(slug: string) {
    setCheckoutSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke("create-gng-digital-checkout", {
        body: { product_slug: slug },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
      setCheckoutSlug(null);
    }
  }

  // — Download view —
  if (token) {
    return (
      <main className="min-h-screen bg-[#fdf6ec] text-[#3d2a1a] grid place-items-center px-6">
        <div className="max-w-md w-full text-center">
          {resolving && <><Loader2 className="w-8 h-8 animate-spin text-[#7a3e1d] mx-auto mb-4" /><p>Preparing your download…</p></>}
          {resolveError && (
            <>
              <h1 className="font-serif text-3xl mb-3">Link expired or invalid</h1>
              <p className="text-[#5b4636] mb-6">Reply to your receipt email and we'll send a fresh link.</p>
              <Link to="/gng/downloads"><Button className="bg-[#7a3e1d] hover:bg-[#5b2e15] text-white">Browse downloads</Button></Link>
            </>
          )}
          {resolved && (
            <>
              <Download className="w-12 h-12 text-[#7a3e1d] mx-auto mb-4" />
              <h1 className="font-serif text-3xl mb-3">{resolved.product_name}</h1>
              <p className="text-[#5b4636] mb-6">Your file is ready.</p>
              <a href={resolved.file_url} target="_blank" rel="noreferrer" download>
                <Button className="bg-[#7a3e1d] hover:bg-[#5b2e15] text-white">Download file</Button>
              </a>
            </>
          )}
        </div>
      </main>
    );
  }

  // — Post-checkout view —
  if (sessionId) {
    return (
      <main className="min-h-screen bg-[#fdf6ec] text-[#3d2a1a] grid place-items-center px-6">
        <div className="max-w-md w-full text-center">
          <Mail className="w-12 h-12 text-[#7a3e1d] mx-auto mb-4" />
          <h1 className="font-serif text-3xl mb-3">Check your email</h1>
          <p className="text-[#5b4636] mb-6">Your download link is on the way. Link is good for 90 days.</p>
          <Link to="/gng"><Button variant="outline" className="border-[#7a3e1d] text-[#7a3e1d]">Back to shop</Button></Link>
        </div>
      </main>
    );
  }

  // — Catalog —
  return (
    <main className="min-h-screen bg-[#fdf6ec] text-[#3d2a1a]">
      <header className="border-b border-[#e8d8c0] sticky top-0 bg-[#fdf6ec]/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/gng" className="font-serif text-xl font-bold text-[#7a3e1d]">Guilds &amp; Grains</Link>
          <Link to="/gng" className="text-sm text-[#7a3e1d] hover:underline">← Back to shop</Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[#a8763c] mb-4">Digital Downloads</p>
        <h1 className="font-serif text-5xl md:text-6xl font-bold mb-4">Patterns &amp; printables</h1>
        <p className="text-lg text-[#5b4636] max-w-2xl mx-auto">Premium PDF patterns and printable goods. Instant delivery after checkout.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        {loadingList ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#7a3e1d]" /></div>
        ) : products.length === 0 ? (
          <Card className="bg-white border-[#e8d8c0] p-10 text-center text-[#5b4636]">
            <FileText className="w-10 h-10 mx-auto mb-3 text-[#7a3e1d]" />
            <p className="font-serif text-xl mb-2">First patterns launching soon</p>
            <p className="text-sm">Subscribe to the <Link to="/gng/subscriptions" className="underline text-[#7a3e1d]">Pattern of the Month</Link> to be first.</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(p => (
              <Card key={p.slug} className="bg-white border-[#e8d8c0] p-6 flex flex-col">
                {p.preview_image_url && (
                  <div className="aspect-video bg-[#f3ecdc] rounded mb-4 overflow-hidden">
                    <img src={p.preview_image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
                <h3 className="font-serif text-xl font-bold mb-1">{p.name}</h3>
                {p.tagline && <p className="text-sm text-[#7a6450] italic mb-3">{p.tagline}</p>}
                {p.description && <p className="text-sm text-[#5b4636] mb-4 line-clamp-3">{p.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="text-2xl font-bold text-[#7a3e1d]">${(p.price_cents / 100).toFixed(2)}</span>
                  <Button onClick={() => buy(p.slug)} disabled={checkoutSlug !== null}
                          className="bg-[#7a3e1d] hover:bg-[#5b2e15] text-white">
                    {checkoutSlug === p.slug ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy & download"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
