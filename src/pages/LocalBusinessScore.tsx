import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Search, ArrowRight, Phone, CheckCircle, AlertTriangle, XCircle, Loader2, TrendingUp } from "lucide-react";

const PHONE = "(313) 806-4952";

type Step = "search" | "email" | "loading" | "result";

interface ScoreCategory {
  name: string;
  score: number;
  max: number;
  finding: string;
}

interface ScoreResult {
  total: number;
  grade: string;
  categories: ScoreCategory[];
  summary: string;
  topIssues: string[];
}

function GradeColor(grade: string): string {
  if (grade === "A") return "text-green-500";
  if (grade.startsWith("B")) return "text-emerald-400";
  if (grade.startsWith("C")) return "text-yellow-500";
  return "text-red-500";
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function CategoryIcon({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  if (pct >= 70) return <CheckCircle size={16} className="text-green-500 shrink-0" />;
  if (pct >= 40) return <AlertTriangle size={16} className="text-yellow-500 shrink-0" />;
  return <XCircle size={16} className="text-red-500 shrink-0" />;
}

const FAKE_PROGRESS_STEPS = [
  "Searching for your business online...",
  "Checking your website...",
  "Analyzing Google Business Profile...",
  "Reviewing local search rankings...",
  "Scoring conversion elements...",
  "Generating your report...",
];

const LocalBusinessScore = () => {
  const [step, setStep] = useState<Step>("search");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");
  const [progressStep, setProgressStep] = useState(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !city.trim()) return;
    setStep("email");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("loading");
    setError("");

    // Animate progress steps
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx++;
      setProgressStep(stepIdx);
      if (stepIdx >= FAKE_PROGRESS_STEPS.length - 1) clearInterval(interval);
    }, 2800);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("score-business-presence", {
        body: { business_name: businessName.trim(), city: city.trim(), email: email.trim() },
      });

      clearInterval(interval);
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      setResult(data as ScoreResult);
      setStep("result");
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("email");
    }
  };

  return (
    <>
      <SEOHead
        title="Free Business Presence Score | Matt Michels Web Design Detroit"
        description="Find out how your Metro Detroit business looks online in 60 seconds. Free digital presence score — website, Google Maps, SEO, and conversion analysis."
        path="/local-business-score"
      />

      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="relative pt-20 pb-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/6 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-5">
              <Search size={11} /> Free Tool · No Login Required
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5 tracking-tight">
              How Does Your Business<br />
              <span className="text-primary">Look Online?</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-4 leading-relaxed">
              Get your free Digital Presence Score in 60 seconds. We analyze your website, Google ranking, Maps visibility, and conversion — and tell you exactly what's costing you calls.
            </p>
            <p className="text-xs text-muted-foreground">
              Built by <Link to="/detroit-web-design" className="text-primary hover:underline">Matt Michels Web Design</Link> · Metro Detroit's local web designer
            </p>
          </div>
        </section>

        {/* Main Tool */}
        <section className="px-4 pb-24">
          <div className="max-w-xl mx-auto">

            {/* Step 1: Business Info */}
            {step === "search" && (
              <Card className="border-border/40 bg-card/80">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-xl font-bold mb-1">Check Your Business</h2>
                  <p className="text-sm text-muted-foreground mb-6">Enter your business name and city to get started. Takes about 60 seconds.</p>
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                      <Label htmlFor="biz-name">Business Name *</Label>
                      <Input
                        id="biz-name"
                        value={businessName}
                        onChange={e => setBusinessName(e.target.value)}
                        placeholder="e.g. Smith Plumbing LLC"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="biz-city">City / Area *</Label>
                      <Input
                        id="biz-city"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Grosse Pointe, MI"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full py-5 text-base font-bold">
                      Check My Score <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Free · No account needed · No spam
                    </p>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Email Gate */}
            {step === "email" && (
              <Card className="border-border/40 bg-card/80">
                <CardContent className="p-6 sm:p-8">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mb-4">
                    <Search size={22} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-bold mb-1">Almost There</h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    We found <span className="font-semibold text-foreground">"{businessName}"</span> in {city}. Enter your email to see the full report — we'll also send you a copy.
                  </p>
                  {error && <p className="text-sm text-destructive mb-3">{error}</p>}
                  <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="report-email">Email Address *</Label>
                      <Input
                        id="report-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="john@smithplumbing.com"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full py-5 text-base font-bold">
                      Show My Score <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      No spam. Your email is used to send your report — that's it.
                    </p>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Loading */}
            {step === "loading" && (
              <Card className="border-border/40 bg-card/80">
                <CardContent className="p-8 text-center">
                  <Loader2 size={32} className="text-primary animate-spin mx-auto mb-4" />
                  <h2 className="text-lg font-bold mb-2">Analyzing {businessName}...</h2>
                  <p className="text-sm text-muted-foreground mb-6">This takes about 30–60 seconds.</p>
                  <div className="space-y-2 text-left max-w-xs mx-auto">
                    {FAKE_PROGRESS_STEPS.map((s, i) => (
                      <div key={s} className={`flex items-center gap-2 text-xs transition-all ${i <= progressStep ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {i < progressStep ? (
                          <CheckCircle size={12} className="text-primary shrink-0" />
                        ) : i === progressStep ? (
                          <Loader2 size={12} className="text-primary animate-spin shrink-0" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-muted shrink-0" />
                        )}
                        {s}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Results */}
            {step === "result" && result && (
              <div className="space-y-4">
                {/* Score Card */}
                <Card className="border-primary/20 bg-card/80">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold">{businessName}</h2>
                        <p className="text-xs text-muted-foreground">{city}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-5xl font-black ${GradeColor(result.grade)}`}>{result.grade}</div>
                        <div className="text-xs text-muted-foreground">{result.total}/100</div>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${result.total}%`,
                          background: result.total >= 70 ? "#10b981" : result.total >= 50 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card className="border-border/40 bg-card/60">
                  <CardContent className="p-5 sm:p-6">
                    <h3 className="font-bold mb-4 text-sm uppercase tracking-wide">Score Breakdown</h3>
                    <div className="space-y-4">
                      {result.categories.map(cat => (
                        <div key={cat.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <CategoryIcon score={cat.score} max={cat.max} />
                              <span className="text-sm font-semibold">{cat.name}</span>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground">{cat.score}/{cat.max}</span>
                          </div>
                          <ScoreBar score={cat.score} max={cat.max} />
                          <p className="text-xs text-muted-foreground mt-1.5">{cat.finding}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Issues */}
                {result.topIssues.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5">
                    <CardContent className="p-5">
                      <h3 className="font-bold mb-3 text-sm text-destructive uppercase tracking-wide flex items-center gap-2">
                        <AlertTriangle size={14} /> Issues Costing You Leads
                      </h3>
                      <ul className="space-y-2">
                        {result.topIssues.map(issue => (
                          <li key={issue} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <XCircle size={13} className="text-destructive shrink-0 mt-0.5" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* CTA */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <TrendingUp size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold mb-1.5">Want These Fixed?</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          I fix exactly these issues for Metro Detroit businesses. $499 flat build fee, live in 7 days, $49/month. I'll review your score with you personally and tell you exactly what your site needs.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Link to="/detroit-web-design">
                            <Button className="w-full sm:w-auto font-bold">
                              Get a Free Site Review <ArrowRight size={14} className="ml-1.5" />
                            </Button>
                          </Link>
                          <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-border/60 px-4 py-2 rounded-lg hover:border-primary/50 transition-colors">
                            <Phone size={13} /> {PHONE}
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-xs text-center text-muted-foreground">
                  Want to check another business?{" "}
                  <button onClick={() => { setStep("search"); setResult(null); setBusinessName(""); setCity(""); setEmail(""); }}
                    className="text-primary hover:underline">Start over</button>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Social Proof Strip */}
        <section className="px-4 pb-16 border-t border-border/30 pt-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6 font-bold">Used By Local Detroit Businesses</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { result: "Ranked #1 on Google Maps in 6 weeks", biz: "East Side Plumber" },
                { result: "Phone calls up 3× in the first month", biz: "Grosse Pointe Roofer" },
                { result: "4 new jobs booked week 1 site went live", biz: "Harper Woods Electrician" },
              ].map(r => (
                <div key={r.biz} className="bg-card/50 border border-border/40 rounded-xl p-4 text-left">
                  <p className="text-sm font-semibold mb-1">{r.result}</p>
                  <p className="text-xs text-muted-foreground">{r.biz}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/30 py-6 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Matt Michels Web Design · Grosse Pointe, MI</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Link to="/detroit-web-design" className="hover:text-foreground">Web Design</Link>
              <Link to="/web-design-services" className="hover:text-foreground">Services</Link>
              <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="hover:text-foreground flex items-center gap-1"><Phone size={11} /> {PHONE}</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LocalBusinessScore;
