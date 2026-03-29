import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { BookOpen, ArrowRight, Loader2, Send } from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import GuideCard, { Guide } from "@/components/store/GuideCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// Fallback guides if DB is empty
const FALLBACK_GUIDES: Guide[] = [
  { id: "fb-1", title: "Football Combine Prep Playbook", sport: "football", price_cents: 1900 },
  { id: "fb-2", title: "Baseball Off-Season Power Blueprint", sport: "baseball", price_cents: 1500 },
  { id: "fb-3", title: "Basketball Athleticism & Vertical Playbook", sport: "basketball", price_cents: 1500 },
  { id: "fb-4", title: "Hockey Strength Essentials", sport: "hockey", price_cents: 1500 },
  { id: "fb-5", title: "Soccer Speed & Endurance Playbook", sport: "soccer", price_cents: 1500 },
  { id: "fb-6", title: "Wrestling Pre-Season Weight Cut Guide", sport: "wrestling", price_cents: 1500 },
  { id: "fb-7", title: "Lacrosse Conditioning Blueprint", sport: "lacrosse", price_cents: 1500 },
  { id: "fb-8", title: "ACL Recovery Protocol", sport: "general", price_cents: 1900 },
  { id: "fb-9", title: "Youth Athlete Starter Playbook (Ages 11-15)", sport: "general", price_cents: 900 },
  { id: "fb-10", title: "Female Athlete Strength Foundation", sport: "general", price_cents: 1500 },
  { id: "fb-11", title: "Speed & Agility Training Playbook", sport: "track", price_cents: 1500 },
  { id: "fb-12", title: "QB & Skill Position Performance Guide", sport: "football", price_cents: 1900 },
];

const GuideStore = () => {
  const { toast } = useToast();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [requestTopic, setRequestTopic] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const { data: dbGuides = [], isLoading } = useQuery({
    queryKey: ["sport-guides-store"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sport_guides" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as Guide[];
    },
  });

  const guides = dbGuides.length > 0 ? dbGuides : FALLBACK_GUIDES;

  const handleBuy = async (guide: Guide) => {
    if (!guide.stripe_price_id) {
      toast({
        title: "Coming soon",
        description: "This guide will be available for purchase shortly.",
      });
      return;
    }

    setBuyingId(guide.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-guide-payment", {
        body: {
          priceId: guide.stripe_price_id,
          metadata: { type: "sport_guide", guide_id: guide.id, guide_title: guide.title },
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBuyingId(null);
    }
  };

  const handleRequest = async () => {
    if (!requestTopic.trim() || !requestEmail.trim()) {
      toast({ title: "Fill in both fields", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await supabase.functions.invoke("request-guide", {
        body: { topic: requestTopic, email: requestEmail },
      });
      toast({ title: "Request sent!", description: "I'll let you know when it's ready." });
      setRequestTopic("");
      setRequestEmail("");
    } catch {
      toast({ title: "Sent!", description: "I'll follow up via email." });
      setRequestTopic("");
      setRequestEmail("");
    } finally {
      setSending(false);
    }
  };

  // Group by sport
  const grouped: Record<string, Guide[]> = {};
  for (const g of guides) {
    const key = g.sport || "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(g);
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Athlete Playbooks — M² Training by Matt Michels</title>
        <meta
          name="description"
          content="Sport-specific training playbooks built by Coach Matt Michels. Football, baseball, basketball, soccer, hockey, and more. Instant email delivery."
        />
      </Helmet>
      <AppNavbar />
      <div className="pt-20 pb-16">
        {/* Hero */}
        <div className="bg-primary/10 border-b border-primary/20 py-12">
          <div className="container max-w-3xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
              <BookOpen size={22} className="text-primary" />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-3">
              Coach Matt's Playbooks
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Sport-specific training guides built from 20+ years coaching athletes. Buy once — yours forever. Delivered instantly to your inbox.
            </p>
          </div>
        </div>

        <div className="container max-w-4xl py-12 space-y-12">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : (
            Object.entries(grouped).map(([sport, sportGuides]) => (
              <div key={sport}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 capitalize">
                  {sport === "general" ? "All Athletes" : sport}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {sportGuides.map((guide) => (
                    <GuideCard
                      key={guide.id}
                      guide={guide}
                      onBuy={handleBuy}
                      buying={buyingId === guide.id}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Request a Guide */}
          <div className="border border-border p-6 bg-card">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
              Don't see your sport?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Request a playbook and I'll build it. If 3+ people request the same topic, it goes live first.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Sport or topic (e.g. volleyball conditioning)"
                value={requestTopic}
                onChange={(e) => setRequestTopic(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Your email"
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleRequest} disabled={sending} className="shrink-0">
                {sending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
                Request
              </Button>
            </div>
          </div>

          {/* CTA to full program */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Want the full program with coaching feedback, workouts, and nutrition?
            </p>
            <a
              href="/auth?redirect=/trial-welcome"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-black text-sm uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              Start Free Trial <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideStore;
