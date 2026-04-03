import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, CheckCircle, AlertCircle, Zap, RefreshCw } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: string;
  description: string;
  type: "instant" | "subscription";
  category: string;
}

const PRODUCTS: Product[] = [
  // Instant delivery
  { id: "website_audit", name: "Website Audit", price: "$49", description: "Full audit delivered within minutes. Tests instant-audit edge function.", type: "instant", category: "One-Time" },
  { id: "gbp_post_pack", name: "GBP Post Pack", price: "$49", description: "30 Google posts delivered to inbox. Tests gbp-post-pack edge function.", type: "instant", category: "One-Time" },
  { id: "competitor_report", name: "Competitor Report", price: "$49", description: "Full competitor analysis. Tests competitor-report edge function.", type: "instant", category: "One-Time" },
  // Subscriptions
  { id: "gbp_saas_subscription", name: "GBP SaaS", price: "$49/mo", description: "Welcome email + client record created. Posts start Mon/Wed/Fri.", type: "subscription", category: "Subscription" },
  { id: "social_media_subscription", name: "Social Media AI", price: "$199/mo", description: "Welcome email + social_media_clients record. Posts start Mon/Wed/Fri.", type: "subscription", category: "Subscription" },
  { id: "field_rep_subscription", name: "Field Rep Tools", price: "$29/mo", description: "Welcome email + b2b_subscribers record. Portal access active.", type: "subscription", category: "Subscription" },
  { id: "contractor_lead_subscription", name: "Contractor Leads", price: "$399/mo", description: "Welcome email + contractor_clients record created.", type: "subscription", category: "Subscription" },
  { id: "b2b_database_subscription", name: "B2B Database", price: "$49/mo", description: "Welcome email + b2b_subscribers record. Database access active.", type: "subscription", category: "Subscription" },
  { id: "review_responder_subscription", name: "Review Responder", price: "$79/mo", description: "Welcome email + review_responder_clients record created.", type: "subscription", category: "Subscription" },
  { id: "seo_report_subscription", name: "SEO Reports", price: "$99/mo", description: "Welcome email + seo_report_clients record created.", type: "subscription", category: "Subscription" },
  { id: "chatbot_subscription", name: "AI Chatbot", price: "$79/mo", description: "Welcome email + chatbot_clients record created.", type: "subscription", category: "Subscription" },
  { id: "missed_call_subscription", name: "Missed Call Text", price: "$49/mo", description: "Welcome email + missed_call_clients record created.", type: "subscription", category: "Subscription" },
  // ── 10 New SMS/Monitoring Products ──────────────────────────────────────────
  { id: "review_monitor_subscription", name: "Review Monitor", price: "$25/mo", description: "Welcome email + review_monitor_clients record. Monitors Google reviews every 6h.", type: "subscription", category: "SMS Products" },
  { id: "sms_blast_subscription", name: "Weekly SMS Blast", price: "$19/mo", description: "Welcome email + sms_blast_clients record. Blasts every Tuesday.", type: "subscription", category: "SMS Products" },
  { id: "noshow_subscription", name: "No-Show Re-Booker", price: "$25/mo", description: "Welcome email + noshow_clients record. Re-books via SMS 30 min after no-show.", type: "subscription", category: "SMS Products" },
  { id: "estimate_drip_subscription", name: "Estimate Follow-Up Drip", price: "$39/mo", description: "Welcome email + estimate_drip_clients record. 5-step SMS drip per quote.", type: "subscription", category: "SMS Products" },
  { id: "invoice_chaser_subscription", name: "Invoice Chaser", price: "$29/mo", description: "Welcome email + invoice_chaser_clients record. Day 7/14/21 reminders.", type: "subscription", category: "SMS Products" },
  { id: "afterjob_drip_subscription", name: "After-Job Drip", price: "$29/mo", description: "Welcome email + afterjob_drip_clients record. 3-touch post-job sequence.", type: "subscription", category: "SMS Products" },
  { id: "promo_blaster_subscription", name: "Seasonal Promo Blaster", price: "$29/mo", description: "Welcome email + promo_blaster_clients record. 6 campaigns/year auto-sent.", type: "subscription", category: "SMS Products" },
  { id: "referral_program_subscription", name: "Referral Program", price: "$39/mo", description: "Welcome email + referral_program_clients record. Auto-tracks referrals + rewards.", type: "subscription", category: "SMS Products" },
  { id: "slow_day_subscription", name: "Slow Day SMS", price: "$25/mo", description: "Welcome email + slow_day_clients record. Keyword trigger → instant promo blast.", type: "subscription", category: "SMS Products" },
  { id: "homeowner_campaign_subscription", name: "New Homeowner Campaign", price: "$59/mo", description: "Welcome email + homeowner_campaign_clients record. Monthly new-mover texts.", type: "subscription", category: "SMS Products" },
  { id: "obituary_service_subscription", name: "AI Obituary Service", price: "$199/mo", description: "Welcome email + obituary_clients record. Funeral home AI writing.", type: "subscription", category: "Autonomous Products" },
  { id: "sermon_prep_subscription", name: "Sermon Prep", price: "$79/mo", description: "Welcome email + sermon_prep_clients record. Weekly AI sermon outlines.", type: "subscription", category: "Autonomous Products" },
  { id: "hoa_secretary_subscription", name: "HOA Secretary AI", price: "$149/mo", description: "Welcome email + hoa_secretary_clients record. AI meeting minutes.", type: "subscription", category: "Autonomous Products" },
  { id: "hoa_violation_subscription", name: "HOA Violation Letters", price: "$149/mo", description: "Welcome email + hoa_violation_clients record. AI violation letters.", type: "subscription", category: "Autonomous Products" },
  { id: "rfp_alerts_subscription", name: "RFP Alert Service", price: "$149/mo", description: "Welcome email + rfp_alert_clients record. Daily gov contract alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "franchise_analyzer_subscription", name: "Franchise FDD Analyzer", price: "$299/mo", description: "Welcome email + franchise_analyzer_clients record. AI FDD risk analysis.", type: "subscription", category: "Autonomous Products" },
  { id: "insurance_drip_subscription", name: "Insurance Lead Drip", price: "$149/mo", description: "Welcome email + insurance_drip_clients record. AI lead follow-up sequences.", type: "subscription", category: "Autonomous Products" },
  { id: "str_reputation_subscription", name: "STR Reputation Manager", price: "$79/mo", description: "Welcome email + str_reputation_clients record. Airbnb review monitor.", type: "subscription", category: "Autonomous Products" },
  { id: "grant_discovery_subscription", name: "Grant Discovery", price: "$199/mo", description: "Welcome email + grant_discovery_clients record. Weekly nonprofit grants.", type: "subscription", category: "Autonomous Products" },
  { id: "ag_price_alerts_subscription", name: "Ag Price Alerts", price: "$79/mo", description: "Welcome email + ag_price_alert_clients record. Commodity price SMS alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "landlord_letters_subscription", name: "Landlord-Tenant Letters", price: "$149/mo", description: "Welcome email + landlord_letter_clients record. AI legal letters.", type: "subscription", category: "Autonomous Products" },
  { id: "regulatory_monitor_subscription", name: "Regulatory Monitor", price: "$299/mo", description: "Welcome email + regulatory_monitor_clients record. Weekly compliance alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "trade_show_automation_subscription", name: "Trade Show Follow-Up", price: "$99/mo", description: "Welcome email + trade_show_clients record. AI badge-scan sequences.", type: "subscription", category: "Autonomous Products" },
  { id: "price_intelligence_subscription", name: "Competitor Price Intel", price: "$199/mo", description: "Welcome email + price_intelligence_clients record. Daily price monitoring.", type: "subscription", category: "Autonomous Products" },
  { id: "citation_monitor_subscription", name: "Citation Monitor", price: "$99/mo", description: "Welcome email + citation_monitor_clients record. NAP consistency weekly.", type: "subscription", category: "Autonomous Products" },
  { id: "menu_engineering_subscription", name: "Menu Engineering", price: "$99/mo", description: "Welcome email + menu_engineering_clients record. Monthly BCG analysis.", type: "subscription", category: "Autonomous Products" },
  { id: "fitness_reports_subscription", name: "Fitness Progress Reports", price: "$79/mo", description: "Welcome email + fitness_report_clients record. Monthly client reports.", type: "subscription", category: "Autonomous Products" },
  { id: "gov_meeting_tracker_subscription", name: "Gov Meeting Tracker", price: "$199/mo", description: "Welcome email + gov_meeting_tracker_clients record. Weekly zoning alerts.", type: "subscription", category: "Autonomous Products" },
];

type TestStatus = "idle" | "loading" | "success" | "error";

export default function AdminSandbox() {
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});
  const { toast } = useToast();

  const runTest = async (product: Product) => {
    setStatuses(s => ({ ...s, [product.id]: "loading" }));
    try {
      const { data, error } = await supabase.functions.invoke("create-test-checkout", {
        body: { product: product.id },
      });
      if (error || !data?.url) throw new Error(error?.message || "No checkout URL returned");

      // Open Stripe $0 checkout in new tab
      window.open(data.url, "_blank");
      setStatuses(s => ({ ...s, [product.id]: "success" }));
      toast({ title: `${product.name} test launched`, description: "Complete the $0 checkout — then check your email." });
    } catch (e: unknown) {
      setStatuses(s => ({ ...s, [product.id]: "error" }));
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Test failed", description: msg, variant: "destructive" });
    }
  };

  const resetStatus = (id: string) => setStatuses(s => ({ ...s, [id]: "idle" }));

  const instant = PRODUCTS.filter(p => p.type === "instant");
  const subs = PRODUCTS.filter(p => p.type === "subscription" && p.category === "Subscription");
  const smsProducts = PRODUCTS.filter(p => p.category === "SMS Products");
  const autonomousProducts = PRODUCTS.filter(p => p.category === "Autonomous Products");

  const StatusIcon = ({ status }: { status: TestStatus }) => {
    if (status === "loading") return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (status === "success") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "error") return <AlertCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-lg p-5 border border-orange-500/20">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-white font-bold text-lg">Product Sandbox</h2>
            <p className="text-slate-400 text-sm mt-1">
              Click any product to go through the real purchase flow at <strong className="text-orange-400">$0</strong>.
              A real Stripe checkout opens, you complete it, the webhook fires, and you receive the exact email your customer would get.
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Only works for Matt's email addresses. Test records are tagged <code className="bg-slate-800 px-1 rounded">is_test: true</code> and excluded from revenue reporting.
            </p>
          </div>
        </div>
      </div>

      {/* Instant Delivery */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Instant Delivery</h3>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Fires in seconds</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {instant.map(p => (
            <Card key={p.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white text-base">{p.name}</CardTitle>
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs shrink-0 ml-2">{p.price}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => runTest(p)}
                    disabled={statuses[p.id] === "loading"}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm h-8"
                  >
                    {statuses[p.id] === "loading" ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Opening...</>
                    ) : (
                      <><ExternalLink className="h-3 w-3 mr-1" /> Test $0</>
                    )}
                  </Button>
                  {statuses[p.id] && statuses[p.id] !== "loading" && (
                    <button onClick={() => resetStatus(p.id)} className="text-slate-500 hover:text-slate-300">
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                  <StatusIcon status={statuses[p.id] || "idle"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Subscriptions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Subscriptions</h3>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Welcome email + DB record</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subs.map(p => (
            <Card key={p.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white text-base">{p.name}</CardTitle>
                  <Badge className="bg-slate-600 text-slate-300 border-slate-500 text-xs shrink-0 ml-2">{p.price}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => runTest(p)}
                    disabled={statuses[p.id] === "loading"}
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 text-sm h-8"
                  >
                    {statuses[p.id] === "loading" ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Opening...</>
                    ) : (
                      <><ExternalLink className="h-3 w-3 mr-1" /> Test $0</>
                    )}
                  </Button>
                  {statuses[p.id] && statuses[p.id] !== "loading" && (
                    <button onClick={() => resetStatus(p.id)} className="text-slate-500 hover:text-slate-300">
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                  <StatusIcon status={statuses[p.id] || "idle"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* SMS Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">SMS &amp; Monitoring Products</h3>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Welcome email + DB record + Twilio setup</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {smsProducts.map(p => (
            <Card key={p.id} className="bg-slate-800 border-slate-700 border-l-2 border-l-purple-500/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white text-base">{p.name}</CardTitle>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs shrink-0 ml-2">{p.price}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => runTest(p)}
                    disabled={statuses[p.id] === "loading"}
                    variant="outline"
                    className="flex-1 border-purple-600/50 text-purple-300 hover:bg-purple-900/30 text-sm h-8"
                  >
                    {statuses[p.id] === "loading" ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Opening...</>
                    ) : (
                      <><ExternalLink className="h-3 w-3 mr-1" /> Test $0</>
                    )}
                  </Button>
                  {statuses[p.id] && statuses[p.id] !== "loading" && (
                    <button onClick={() => resetStatus(p.id)} className="text-slate-500 hover:text-slate-300">
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                  <StatusIcon status={statuses[p.id] || "idle"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Autonomous Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Autonomous Products</h3>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Welcome email + DB record + AI automation</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {autonomousProducts.map(p => (
            <Card key={p.id} className="bg-slate-800 border-slate-700 border-l-2 border-l-emerald-500/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white text-base">{p.name}</CardTitle>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs shrink-0 ml-2">{p.price}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => runTest(p)}
                    disabled={statuses[p.id] === "loading"}
                    variant="outline"
                    className="flex-1 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/30 text-sm h-8"
                  >
                    {statuses[p.id] === "loading" ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Opening...</>
                    ) : (
                      <><ExternalLink className="h-3 w-3 mr-1" /> Test $0</>
                    )}
                  </Button>
                  {statuses[p.id] && statuses[p.id] !== "loading" && (
                    <button onClick={() => resetStatus(p.id)} className="text-slate-500 hover:text-slate-300">
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                  <StatusIcon status={statuses[p.id] || "idle"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* What to check */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">What to verify after each test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
            <div>
              <p className="text-orange-400 font-semibold mb-1">Instant products</p>
              <ul className="space-y-1">
                <li>✓ Stripe checkout completes at $0</li>
                <li>✓ Email arrives within 2 min</li>
                <li>✓ Content is correct and useful</li>
                <li>✓ No error in Supabase logs</li>
              </ul>
            </div>
            <div>
              <p className="text-blue-400 font-semibold mb-1">Subscription products</p>
              <ul className="space-y-1">
                <li>✓ Stripe checkout completes at $0</li>
                <li>✓ Welcome email arrives within 1 min</li>
                <li>✓ Record appears in client DB table</li>
                <li>✓ Matt notification email arrives</li>
              </ul>
            </div>
            <div>
              <p className="text-green-400 font-semibold mb-1">After testing</p>
              <ul className="space-y-1">
                <li>✓ Cancel any $0 test subscriptions in Stripe</li>
                <li>✓ Test records tagged is_test=true</li>
                <li>✓ Oracle won't count them in MRR</li>
                <li>✓ Check Supabase Edge Function logs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
