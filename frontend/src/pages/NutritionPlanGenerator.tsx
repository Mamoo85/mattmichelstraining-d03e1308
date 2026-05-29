import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, ChevronRight, ChevronLeft, Loader2, Utensils, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SPORTS = [
  "Football", "Baseball", "Basketball", "Soccer", "Hockey", "Lacrosse",
  "Wrestling", "Track & Field", "Volleyball", "Swimming", "Tennis", "General Fitness",
];

const GOALS = [
  { key: "bulk", label: "Build Muscle & Size", desc: "Caloric surplus, strength focus" },
  { key: "cut", label: "Lean Out & Stay Fast", desc: "Caloric deficit, preserve muscle" },
  { key: "maintain", label: "Perform at My Best", desc: "Maintenance, maximum performance" },
];

const WHAT_YOU_GET = [
  "Daily macro targets built for your sport & body",
  "Pre and post-workout nutrition strategy",
  "Top foods to eat — and what to avoid",
  "Grocery list and meal prep guide",
];

const NutritionPlanGenerator = () => {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    sport: "",
    position: "",
    weight: "",
    age: "",
    goal: "",
    dietary: "",
    email: "",
    plan: "basic",
  });

  useEffect(() => {
    if (params.get("status") === "success") {
      setSuccess(true);
    }
  }, [params]);

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const canNext = () => {
    if (step === 1) return !!form.sport;
    if (step === 2) return !!form.weight;
    if (step === 3) return !!form.goal;
    return !!form.email;
  };

  const handleSubmit = async () => {
    if (!form.email || !form.sport) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-nutrition-plan-checkout", {
        body: {
          plan: form.plan,
          sport: form.sport,
          position: form.position,
          weight_lbs: parseInt(form.weight) || 170,
          goal: form.goal,
          dietary_restrictions: form.dietary,
          customer_email: form.email,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container max-w-lg pt-28 pb-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-6">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">Your blueprint is on the way.</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Check your inbox — Coach Matt's nutrition plan was sent to <strong>{params.get("email") || "your email"}</strong>.
            Usually arrives within 2 minutes.
          </p>
          <a
            href="/auth?redirect=/trial-welcome"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-black text-sm uppercase tracking-widest hover:bg-primary/90 transition-colors"
          >
            Start Full Training Program Free <ArrowRight size={14} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Athlete Nutrition Blueprint — Built by Coach Matt Michels</title>
        <meta
          name="description"
          content="Get a custom nutrition plan built for your sport by Coach Matt Michels. Football, baseball, basketball, soccer, and more. Instant delivery — starts at $9."
        />
      </Helmet>
      <AppNavbar />
      <div className="pt-20 pb-16">
        {/* Hero */}
        <div className="bg-primary/10 border-b border-primary/20 py-12">
          <div className="container max-w-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
              <Utensils size={22} className="text-primary" />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-3">
              Athlete Nutrition Blueprint
            </h1>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Built for your sport, your body, and your goals — by Coach Matt Michels. Delivered to your inbox in minutes.
            </p>
          </div>
        </div>

        <div className="container max-w-xl py-10">
          <div className="grid grid-cols-2 gap-3 mb-8">
            {WHAT_YOU_GET.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />
                <span className="text-xs text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="flex gap-1 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Step 1: Sport */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">What sport do you play?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SPORTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, sport: s })}
                    className={cn(
                      "py-2.5 px-3 text-xs font-semibold border transition-all text-left",
                      form.sport === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Position (optional)"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
          )}

          {/* Step 2: Body Stats */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Tell me about you.</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Current Weight (lbs) *</label>
                  <Input
                    type="number"
                    placeholder="170"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Age</label>
                  <Input
                    type="number"
                    placeholder="16"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dietary restrictions</label>
                <Input
                  placeholder="e.g. no dairy, vegetarian, gluten-free (or leave blank)"
                  value={form.dietary}
                  onChange={(e) => setForm({ ...form, dietary: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Step 3: Goal */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">What's your main goal?</h2>
              <div className="space-y-2">
                {GOALS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setForm({ ...form, goal: g.key })}
                    className={cn(
                      "w-full text-left p-4 border transition-all",
                      form.goal === g.key
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <div className="text-sm font-bold text-foreground">{g.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Email + Plan */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Where do I send it?</h2>
              <Input
                type="email"
                placeholder="Your email address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Choose your plan:</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "basic", label: "Nutrition Blueprint", price: "$9", desc: "Macros, key foods, pre/post-workout strategy" },
                    { key: "full", label: "Full 7-Day Plan", price: "$14", desc: "Every meal, grocery list & Sunday prep guide", popular: true },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setForm({ ...form, plan: p.key })}
                      className={cn(
                        "p-4 border text-left transition-all relative",
                        form.plan === p.key
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      {p.popular && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 uppercase tracking-widest">
                          Popular
                        </span>
                      )}
                      <div className="text-lg font-black text-primary">{p.price}</div>
                      <div className="text-xs font-bold text-foreground mt-0.5">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/20 border border-border p-4 text-xs text-muted-foreground">
                <strong className="text-foreground">What happens next:</strong> After checkout you'll receive your complete nutrition plan within minutes. Built specifically for {form.sport || "your sport"} by Coach Matt Michels.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={back}>
                <ChevronLeft size={14} className="mr-1" /> Back
              </Button>
            ) : <div />}

            {step < 4 ? (
              <Button onClick={next} disabled={!canNext()}>
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || !canNext()}>
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Get My Plan — ${form.plan === "full" ? "14" : "9"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutritionPlanGenerator;
