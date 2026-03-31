import { useState, useEffect } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, TrendingUp, Users, Target } from "lucide-react";

interface RevenueMetrics {
  industrial_subscribers: number;
  linkedin_clients: number;
  newsletter_subscribers: number;
  total_mrr: number;
  this_month_signups: number;
  last_month_signups: number;
}

export default function RevenueDashboard() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    // Simple password protection for now
    const password = prompt("Enter dashboard password:");
    if (password === "m2matrix") {
      setAuthorized(true);
      fetchMetrics();
    } else {
      alert("Unauthorized");
      window.location.href = "/";
    }
  }

  async function fetchMetrics() {
    setLoading(true);
    try {
      // Get industrial database subscribers
      const { count: industrialCount } = await supabase
        .from("b2b_subscribers" as any)
        .select("*", { count: "exact", head: true })
        .eq("niche", "industrial")
        .eq("active", true);

      // Get LinkedIn ghostwriting clients
      const { count: linkedinCount } = await supabase
        .from("linkedin_ghostwriting_clients" as any)
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Get newsletter subscribers
      const { count: newsletterCount } = await supabase
        .from("newsletter_subscribers" as any)
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Calculate MRR
      const industrialMRR = (industrialCount || 0) * 99;
      const linkedinMRR = (linkedinCount || 0) * 299;
      const totalMRR = industrialMRR + linkedinMRR;

      // Get signups this month vs last month
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const { count: thisMonthCount } = await supabase
        .from("b2b_subscribers" as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", firstOfMonth.toISOString());

      const { count: lastMonthCount } = await supabase
        .from("b2b_subscribers" as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", firstOfLastMonth.toISOString())
        .lt("created_at", firstOfMonth.toISOString());

      setMetrics({
        industrial_subscribers: industrialCount || 0,
        linkedin_clients: linkedinCount || 0,
        newsletter_subscribers: newsletterCount || 0,
        total_mrr: totalMRR,
        this_month_signups: thisMonthCount || 0,
        last_month_signups: lastMonthCount || 0,
      });
    } catch (e) {
      console.error("Error fetching metrics:", e);
    } finally {
      setLoading(false);
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checking authorization...</p>
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const growthRate = metrics.last_month_signups > 0
    ? ((metrics.this_month_signups - metrics.last_month_signups) / metrics.last_month_signups) * 100
    : 0;

  return (
    <>
      <SEOHead title="Revenue Dashboard — M² Training" description="Internal revenue metrics dashboard" />
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-foreground">Revenue Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time metrics for automated revenue streams</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total MRR</p>
              </div>
              <p className="text-3xl font-black text-foreground">${metrics.total_mrr.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
            </div>

            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Industrial DB</p>
              </div>
              <p className="text-3xl font-black text-foreground">{metrics.industrial_subscribers}</p>
              <p className="text-xs text-muted-foreground mt-1">${(metrics.industrial_subscribers * 99).toLocaleString()} MRR</p>
            </div>

            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">LinkedIn</p>
              </div>
              <p className="text-3xl font-black text-foreground">{metrics.linkedin_clients}</p>
              <p className="text-xs text-muted-foreground mt-1">${(metrics.linkedin_clients * 299).toLocaleString()} MRR</p>
            </div>

            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Growth</p>
              </div>
              <p className="text-3xl font-black text-foreground">{growthRate > 0 ? '+' : ''}{growthRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground mt-1">vs last month</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-card border border-border p-6 mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Revenue Breakdown</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Industrial Database</p>
                  <p className="text-xs text-muted-foreground">{metrics.industrial_subscribers} subscribers × $99/mo</p>
                </div>
                <p className="text-xl font-black text-primary">${(metrics.industrial_subscribers * 99).toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">LinkedIn Ghostwriting</p>
                  <p className="text-xs text-muted-foreground">{metrics.linkedin_clients} clients × $299/mo</p>
                </div>
                <p className="text-xl font-black text-primary">${(metrics.linkedin_clients * 299).toLocaleString()}</p>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <p className="font-black text-foreground uppercase tracking-wide">Total MRR</p>
                <p className="text-2xl font-black text-foreground">${metrics.total_mrr.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Newsletter Metrics */}
          <div className="bg-card border border-border p-6 mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Newsletter (Affiliate Revenue)</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Field Rep Weekly</p>
                <p className="text-xs text-muted-foreground">Active subscribers</p>
              </div>
              <p className="text-xl font-black text-primary">{metrics.newsletter_subscribers.toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Estimated affiliate revenue: ${Math.round(metrics.newsletter_subscribers * 0.02 * 100).toLocaleString()}/mo
              (assumes 2% click rate × $100 avg commission)
            </p>
          </div>

          {/* Goals */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">$10K/Mo Goal Tracker</h2>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-sm font-bold text-foreground">${metrics.total_mrr.toLocaleString()} / $10,000</p>
              </div>
              <div className="w-full bg-muted h-4">
                <div
                  className="bg-primary h-4 transition-all"
                  style={{ width: `${Math.min((metrics.total_mrr / 10000) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.total_mrr >= 10000
                  ? "🎉 Goal achieved!"
                  : `$${(10000 - metrics.total_mrr).toLocaleString()} to go`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">To reach $10K with Industrial DB only:</p>
                  <p className="font-bold text-foreground">{Math.ceil(10000 / 99)} subscribers needed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target size={14} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">To reach $10K with LinkedIn only:</p>
                  <p className="font-bold text-foreground">{Math.ceil(10000 / 299)} clients needed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target size={14} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Mix needed (50 Industrial + X LinkedIn):</p>
                  <p className="font-bold text-foreground">{Math.ceil((10000 - 50 * 99) / 299)} LinkedIn clients</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={fetchMetrics}
            className="mt-6 bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            Refresh Metrics
          </button>
        </div>
      </div>
    </>
  );
}
