import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Phone,
  ArrowRight,
  Eye,
  TrendingUp,
} from "lucide-react";

interface Check {
  category: string;
  label: string;
  status: "pass" | "fail" | "warning";
  detail: string;
  points: number;
  maxPoints: number;
}

interface ScoreResult {
  businessName: string;
  location: string;
  score: number;
  grade: string;
  totalPoints: number;
  maxPoints: number;
  summary: string;
  checks: Check[];
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-500",
  B: "text-blue-500",
  C: "text-yellow-500",
  D: "text-orange-500",
  F: "text-red-500",
};

const STATUS_ICON = {
  pass: <CheckCircle size={16} className="text-green-500 shrink-0" />,
  fail: <XCircle size={16} className="text-red-500 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-yellow-500 shrink-0" />,
};

export default function VisibilityScore() {
  const [form, setForm] = useState({ businessName: "", city: "", website: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName) {
      toast.error("Business name is required");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("visibility-score", {
        body: form,
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Scan failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const grouped = result
    ? result.checks.reduce<Record<string, Check[]>>((acc, c) => {
        (acc[c.category] = acc[c.category] || []).push(c);
        return acc;
      }, {})
    : {};

  return (
    <>
      <SEOHead
        title="Free Visibility Score — How Visible Is Your Business Online? | M² Development"
        description="Instant audit of your Google Business Profile, website, and lead capture. See your score in 30 seconds."
        path="/visibility-score"
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-16 pb-12 px-4 bg-[#1e293b] text-white">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8621a]/20 text-[#e8621a] text-[11px] font-bold tracking-widest uppercase mb-5">
              <Eye size={11} /> Free Visibility Scan
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              Can Customers <span className="text-[#e8621a]">Find You</span> Online?
            </h1>
            <p className="text-slate-300 max-w-lg mx-auto">
              Enter your business name. We'll check your Google presence, website, and lead capture — and show you exactly where you're invisible.
            </p>
          </div>
        </section>

        {/* Scan Form */}
        <section className="px-4 -mt-6 relative z-10">
          <div className="max-w-xl mx-auto">
            <Card className="shadow-lg border-border/40">
              <CardContent className="p-6">
                <form onSubmit={handleScan} className="space-y-4">
                  <div>
                    <Label htmlFor="businessName" className="text-sm font-bold">
                      Business Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="businessName"
                      required
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                      placeholder="Smith Roofing"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city" className="text-sm font-bold">City / Area</Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Grosse Pointe, MI"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="website" className="text-sm font-bold">Website (if any)</Label>
                      <Input
                        id="website"
                        value={form.website}
                        onChange={(e) => setForm({ ...form, website: e.target.value })}
                        placeholder="www.smithroofing.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#e8621a] hover:bg-[#d4570f] text-white py-5 font-bold"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" /> Scanning...
                      </>
                    ) : (
                      <>
                        <Search size={16} className="mr-2" /> Scan My Visibility
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Results */}
        {result && (
          <section className="px-4 py-12">
            <div className="max-w-2xl mx-auto">
              {/* Score Card */}
              <div className="text-center mb-8">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Visibility Score for {result.businessName}
                </p>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <span className={`text-8xl font-black ${GRADE_COLORS[result.grade] || "text-red-500"}`}>
                    {result.grade}
                  </span>
                  <div className="text-left">
                    <p className="text-4xl font-black">{result.score}<span className="text-lg text-muted-foreground">/100</span></p>
                    <p className="text-sm text-muted-foreground">
                      {result.totalPoints} of {result.maxPoints} points
                    </p>
                  </div>
                </div>
                {result.summary && (
                  <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed bg-muted/50 rounded-lg p-4 text-sm">
                    {result.summary}
                  </p>
                )}
              </div>

              {/* Checks by Category */}
              {Object.entries(grouped).map(([category, checks]) => {
                const catPoints = checks.reduce((s, c) => s + c.points, 0);
                const catMax = checks.reduce((s, c) => s + c.maxPoints, 0);
                return (
                  <div key={category} className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-sm uppercase tracking-wider">{category}</h3>
                      <span className="text-xs font-bold text-muted-foreground">
                        {catPoints}/{catMax} pts
                      </span>
                    </div>
                    <div className="space-y-2">
                      {checks.map((check) => (
                        <div
                          key={check.label}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            check.status === "pass"
                              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                              : check.status === "warning"
                                ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30"
                                : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                          }`}
                        >
                          {STATUS_ICON[check.status]}
                          <div className="min-w-0">
                            <p className="text-sm font-bold">{check.label}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{check.detail}</p>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground shrink-0 ml-auto">
                            {check.points}/{check.maxPoints}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* CTA */}
              {result.score < 80 && (
                <Card className="border-[#e8621a]/30 bg-[#e8621a]/5 mt-8">
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="mx-auto text-[#e8621a] mb-3" size={28} />
                    <h3 className="font-black text-lg mb-2">
                      {result.score < 40
                        ? "You're basically invisible online."
                        : result.score < 60
                          ? "You're missing major opportunities."
                          : "You're close — a few fixes would make a big difference."}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                      The Digital Foundation package fixes all of this — custom website, Google auto-posts, and missed call text-back. One price, zero manual work.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <a href="/digital-foundation">
                        <Button className="bg-[#e8621a] hover:bg-[#d4570f] text-white font-bold">
                          Fix My Visibility <ArrowRight size={16} className="ml-2" />
                        </Button>
                      </a>
                      <a
                        href="tel:+13138064952"
                        className="inline-flex items-center justify-center gap-2 border border-border px-5 py-2 rounded-lg text-sm font-medium hover:bg-muted/50"
                      >
                        <Phone size={14} /> Call Matt
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* How it works (before scan) */}
        {!result && !loading && (
          <section className="px-4 py-16">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-black text-center mb-8">What We Check</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                {[
                  { label: "Google Business Profile", desc: "Listing, reviews, photos, hours, and weekly posts" },
                  { label: "Website Quality", desc: "SSL, mobile-friendly, speed, phone number visibility" },
                  { label: "Lead Capture", desc: "Can customers reach you when you miss their call?" },
                ].map((item) => (
                  <div key={item.label} className="p-5 rounded-xl bg-muted/30 border border-border/40">
                    <p className="font-bold text-sm mb-1">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
