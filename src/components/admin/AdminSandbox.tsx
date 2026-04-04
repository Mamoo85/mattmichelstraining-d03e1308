import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, CheckCircle, AlertCircle, Zap, RefreshCw, Settings2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: string;
  description: string;
  type: "instant" | "subscription";
  category: string;
}

/** Defines which metadata fields each product exposes for customization.
 *  key = metadata field name, label = UI label, default = pre-filled value, multiline = textarea */
interface CustomField {
  key: string;
  label: string;
  default: string;
  multiline?: boolean;
}

const PRODUCT_FIELDS: Record<string, CustomField[]> = {
  // Instant delivery
  website_audit: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_url", label: "Website URL", default: "mattmichelstraining.com" },
  ],
  gbp_post_pack: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "fitness training" },
    { key: "city", label: "City", default: "Grosse Pointe" },
    { key: "business_info", label: "Business Description", default: "Performance training for athletes and families", multiline: true },
  ],
  competitor_report: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "fitness training" },
    { key: "city", label: "City", default: "Grosse Pointe" },
  ],
  // Subscriptions
  gbp_saas_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "plan", label: "Plan", default: "basic" },
    { key: "post_tone", label: "Post Tone", default: "" },
    { key: "content_focus", label: "Content Focus", default: "" },
  ],
  social_media_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "plan", label: "Plan (standard/pro/trainer)", default: "standard" },
    { key: "brand_voice", label: "Brand Voice", default: "" },
    { key: "content_focus", label: "Content Focus", default: "" },
  ],
  contractor_lead_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Test Roofing" },
    { key: "trade", label: "Trade (roofing, HVAC, plumbing, electrical)", default: "roofing" },
    { key: "city", label: "City / Service Area", default: "Grosse Pointe" },
  ],
  review_responder_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "" },
    { key: "brand_voice", label: "Brand Voice / Tone", default: "" },
  ],
  seo_report_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "website", label: "Website URL", default: "mattmichelstraining.com" },
    { key: "industry", label: "Industry", default: "" },
  ],
  missed_call_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "custom_message", label: "Auto-Reply Message (160 chars max)", default: "" },
  ],
  // SMS Products
  review_monitor_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  sms_blast_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "city", label: "City", default: "Grosse Pointe" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  noshow_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "booking_url", label: "Booking URL", default: "https://www.mattmichelstraining.com/schedule" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  estimate_drip_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  invoice_chaser_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  afterjob_drip_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  promo_blaster_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "city", label: "City", default: "Grosse Pointe" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  referral_program_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "reward_description", label: "Reward Description", default: "$25 off next session for both of you" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  slow_day_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "promo_offer", label: "Promo Offer Text", default: "First session free this week only" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  homeowner_campaign_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "service_area", label: "Service Area (zip codes)", default: "48236, 48230, 48224, Grosse Pointe area" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  // Autonomous products
  obituary_service_subscription: [
    { key: "funeralHomeName", label: "Funeral Home Name", default: "M2 Test Funeral Home" },
    { key: "phone", label: "Phone", default: "+13138064952" },
  ],
  sermon_prep_subscription: [
    { key: "churchName", label: "Church Name", default: "M2 Test Church" },
    { key: "denomination", label: "Denomination", default: "Non-denominational" },
  ],
  hoa_secretary_subscription: [
    { key: "hoaName", label: "HOA Name", default: "M2 Test HOA" },
  ],
  hoa_violation_subscription: [
    { key: "hoaName", label: "HOA Name", default: "M2 Test HOA" },
    { key: "state", label: "State", default: "MI" },
  ],
  rfp_alerts_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "servicesOffered", label: "Services Offered", default: "Sales training, coaching" },
    { key: "geography", label: "Geography", default: "Michigan" },
  ],
  franchise_analyzer_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
  ],
  insurance_drip_subscription: [
    { key: "businessName", label: "Agency Name", default: "M2 Insurance Agency" },
  ],
  str_reputation_subscription: [
    { key: "propertyUrls", label: "Property URLs", default: "https://airbnb.com/rooms/test" },
    { key: "propertyCount", label: "Property Count", default: "1" },
  ],
  grant_discovery_subscription: [
    { key: "orgName", label: "Organization Name", default: "M2 Foundation" },
    { key: "mission", label: "Mission Statement", default: "Helping field sales reps succeed", multiline: true },
    { key: "geography", label: "Geography", default: "Michigan" },
    { key: "causeAreas", label: "Cause Areas", default: "education, workforce development" },
  ],
  ag_price_alerts_subscription: [
    { key: "businessName", label: "Farm / Business Name", default: "M2 Farms" },
    { key: "commodities", label: "Commodities to Track", default: "corn, soybeans" },
  ],
  landlord_letters_subscription: [
    { key: "state", label: "State", default: "MI" },
    { key: "propertyCount", label: "Property Count", default: "3" },
  ],
  regulatory_monitor_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "fitness and wellness" },
    { key: "regulatoryBodies", label: "Regulatory Bodies", default: "FTC, OSHA" },
  ],
  trade_show_automation_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
  ],
  price_intelligence_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "competitorUrls", label: "Competitor URLs (comma separated)", default: "https://example.com/pricing" },
  ],
  citation_monitor_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "locationCount", label: "Location Count", default: "1" },
    { key: "primaryAddress", label: "Primary Address", default: "Grosse Pointe, MI" },
  ],
  menu_engineering_subscription: [
    { key: "restaurantName", label: "Restaurant Name", default: "M2 Cafe" },
    { key: "cuisineType", label: "Cuisine Type", default: "American" },
  ],
  gov_meeting_tracker_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development LLC" },
    { key: "targetCities", label: "Target Cities", default: "Grosse Pointe, Detroit" },
    { key: "keywords", label: "Keywords", default: "commercial, zoning, variance" },
  ],
  pet_memorial_subscription: [
    { key: "pet_name", label: "Pet Name", default: "Buddy" },
    { key: "pet_species", label: "Species", default: "Dog" },
    { key: "pet_breed", label: "Breed", default: "Golden Retriever" },
    { key: "owner_name", label: "Owner Name", default: "Matt Michels" },
    { key: "memories", label: "Memories", default: "Loved fetch at the park, always happy, best training buddy", multiline: true },
  ],
  dark_web_monitor_subscription: [
    { key: "domain", label: "Domain to Monitor", default: "mattmichelstraining.com" },
  ],
  gov_contract_monitor_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development LLC" },
    { key: "naics_codes", label: "NAICS Codes", default: "611430,541611" },
    { key: "past_performance", label: "Past Performance", default: "Sales training, leadership development, business coaching", multiline: true },
  ],
  podcast_revenue_subscription: [
    { key: "podcast_name", label: "Podcast Name", default: "M2 Development Podcast" },
    { key: "rss_url", label: "RSS Feed URL", default: "https://feeds.buzzsprout.com/test" },
    { key: "tone", label: "Tone", default: "motivational, practical" },
  ],
  regulatory_monitor_v2_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "fitness_wellness" },
    { key: "jurisdiction", label: "Jurisdiction", default: "federal" },
  ],
  competitor_pricing_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "competitor_urls", label: "Competitor URLs (comma separated)", default: "https://anytimefitness.com/pricing,https://orangetheory.com/en-us/membership" },
  ],
  re_newsletter_subscription: [
    { key: "agent_name", label: "Agent Name", default: "Matt Michels" },
    { key: "brokerage", label: "Brokerage", default: "M2 Realty" },
    { key: "target_zip", label: "Target ZIP", default: "48236" },
  ],
  trademark_watch_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development LLC" },
    { key: "mark_text", label: "Trademark Text", default: "M2 TRAINING" },
    { key: "goods_services", label: "Goods & Services", default: "fitness training, performance coaching" },
  ],
  employee_credential_audit: [
    { key: "company_name", label: "Company Name", default: "M2 Development" },
  ],
  new_hire_breach_check: [
    { key: "candidate_name", label: "Candidate Name", default: "Test Candidate" },
    { key: "candidate_email", label: "Candidate Email", default: "test@example.com" },
  ],
};

const PRODUCTS: Product[] = [
  { id: "website_audit", name: "Website Audit", price: "$9", description: "Full audit delivered within minutes.", type: "instant", category: "One-Time" },
  { id: "gbp_post_pack", name: "GBP Post Pack", price: "$49", description: "30 Google posts delivered to inbox.", type: "instant", category: "One-Time" },
  { id: "competitor_report", name: "Competitor Report", price: "$9", description: "Full competitor analysis.", type: "instant", category: "One-Time" },
  { id: "gbp_saas_subscription", name: "GBP SaaS", price: "$49/mo", description: "AI posts 3x/week to Google Business Profile.", type: "subscription", category: "Subscription" },
  { id: "social_media_subscription", name: "Social Media AI", price: "$99/mo", description: "3 posts/week to Facebook, Instagram, LinkedIn.", type: "subscription", category: "Subscription" },
  { id: "field_rep_subscription", name: "Field Rep Tools", price: "$29/mo", description: "4 AI sales tools for field reps.", type: "subscription", category: "Subscription" },
  { id: "b2b_database_subscription", name: "B2B Database", price: "$49/mo", description: "Michigan dental office contacts database.", type: "subscription", category: "Subscription" },
  { id: "review_responder_subscription", name: "Review Responder", price: "$79/mo", description: "AI responds to Google reviews automatically.", type: "subscription", category: "Subscription" },
  { id: "seo_report_subscription", name: "SEO Reports", price: "$99/mo", description: "Monthly SEO audit reports.", type: "subscription", category: "Subscription" },
  { id: "missed_call_subscription", name: "Missed Call Text", price: "$99/mo", description: "Auto-texts back missed calls.", type: "subscription", category: "Subscription" },
  { id: "review_monitor_subscription", name: "Review Monitor", price: "$25/mo", description: "Monitors Google reviews every 6h.", type: "subscription", category: "SMS Products" },
  { id: "sms_blast_subscription", name: "Weekly SMS Blast", price: "$19/mo", description: "AI text to customer list every Tuesday.", type: "subscription", category: "SMS Products" },
  { id: "noshow_subscription", name: "No-Show Re-Booker", price: "$25/mo", description: "Re-books via SMS 30 min after no-show.", type: "subscription", category: "SMS Products" },
  { id: "estimate_drip_subscription", name: "Estimate Follow-Up Drip", price: "$39/mo", description: "5-step SMS drip per quote.", type: "subscription", category: "SMS Products" },
  { id: "invoice_chaser_subscription", name: "Invoice Chaser", price: "$29/mo", description: "Day 7/14/21 reminders.", type: "subscription", category: "SMS Products" },
  { id: "afterjob_drip_subscription", name: "After-Job Drip", price: "$29/mo", description: "3-touch post-job sequence.", type: "subscription", category: "SMS Products" },
  { id: "promo_blaster_subscription", name: "Seasonal Promo Blaster", price: "$29/mo", description: "6 campaigns/year auto-sent.", type: "subscription", category: "SMS Products" },
  { id: "referral_program_subscription", name: "Referral Program", price: "$39/mo", description: "Auto-tracks referrals + rewards.", type: "subscription", category: "SMS Products" },
  { id: "slow_day_subscription", name: "Slow Day SMS", price: "$25/mo", description: "Keyword trigger → instant promo blast.", type: "subscription", category: "SMS Products" },
  { id: "homeowner_campaign_subscription", name: "New Homeowner Campaign", price: "$59/mo", description: "Monthly new-mover texts.", type: "subscription", category: "SMS Products" },
  { id: "obituary_service_subscription", name: "AI Obituary Service", price: "$199/mo", description: "Funeral home AI writing.", type: "subscription", category: "Autonomous Products" },
  { id: "sermon_prep_subscription", name: "Sermon Prep", price: "$79/mo", description: "Weekly AI sermon outlines.", type: "subscription", category: "Autonomous Products" },
  { id: "hoa_secretary_subscription", name: "HOA Secretary AI", price: "$149/mo", description: "AI meeting minutes.", type: "subscription", category: "Autonomous Products" },
  { id: "hoa_violation_subscription", name: "HOA Violation Letters", price: "$149/mo", description: "AI violation letters.", type: "subscription", category: "Autonomous Products" },
  { id: "rfp_alerts_subscription", name: "RFP Alert Service", price: "$149/mo", description: "Daily gov contract alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "franchise_analyzer_subscription", name: "Franchise FDD Analyzer", price: "$299/mo", description: "AI FDD risk analysis.", type: "subscription", category: "Autonomous Products" },
  { id: "insurance_drip_subscription", name: "Insurance Lead Drip", price: "$149/mo", description: "AI lead follow-up sequences.", type: "subscription", category: "Autonomous Products" },
  { id: "str_reputation_subscription", name: "STR Reputation Manager", price: "$79/mo", description: "Airbnb review monitor.", type: "subscription", category: "Autonomous Products" },
  { id: "grant_discovery_subscription", name: "Grant Discovery", price: "$199/mo", description: "Weekly nonprofit grants.", type: "subscription", category: "Autonomous Products" },
  { id: "ag_price_alerts_subscription", name: "Ag Price Alerts", price: "$79/mo", description: "Commodity price SMS alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "landlord_letters_subscription", name: "Landlord-Tenant Letters", price: "$149/mo", description: "AI legal letters.", type: "subscription", category: "Autonomous Products" },
  { id: "regulatory_monitor_subscription", name: "Regulatory Monitor", price: "$299/mo", description: "Weekly compliance alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "trade_show_automation_subscription", name: "Trade Show Follow-Up", price: "$99/mo", description: "AI badge-scan sequences.", type: "subscription", category: "Autonomous Products" },
  { id: "price_intelligence_subscription", name: "Competitor Price Intel", price: "$199/mo", description: "Daily price monitoring.", type: "subscription", category: "Autonomous Products" },
  { id: "citation_monitor_subscription", name: "Citation Monitor", price: "$99/mo", description: "NAP consistency weekly.", type: "subscription", category: "Autonomous Products" },
  { id: "menu_engineering_subscription", name: "Menu Engineering", price: "$99/mo", description: "Monthly BCG analysis.", type: "subscription", category: "Autonomous Products" },
  { id: "fitness_reports_subscription", name: "Fitness Progress Reports", price: "$79/mo", description: "Monthly client reports.", type: "subscription", category: "Autonomous Products" },
  { id: "gov_meeting_tracker_subscription", name: "Gov Meeting Tracker", price: "$199/mo", description: "Weekly zoning alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "pet_memorial_subscription", name: "AI Pet Memorial", price: "$79 one-time", description: "Poem + tribute + hosted memorial.", type: "instant", category: "One-Time" },
  { id: "dark_web_monitor_subscription", name: "Dark Web Monitor", price: "$49/mo", description: "Weekly HIBP credential scan.", type: "subscription", category: "Autonomous Products" },
  { id: "gov_contract_monitor_subscription", name: "Gov Contract Monitor", price: "$299/mo", description: "Daily SAM.gov opportunity matching.", type: "subscription", category: "Autonomous Products" },
  { id: "podcast_revenue_subscription", name: "Podcast-to-Revenue Machine", price: "$199/mo", description: "Blog, LinkedIn, email, YouTube per episode.", type: "subscription", category: "Autonomous Products" },
  { id: "regulatory_monitor_v2_subscription", name: "Regulatory Change Monitor", price: "$197/mo", description: "Weekly Federal Register digest.", type: "subscription", category: "Autonomous Products" },
  { id: "competitor_pricing_subscription", name: "Competitor Pricing Intel", price: "$149/mo", description: "Weekly price change detection.", type: "subscription", category: "Autonomous Products" },
  { id: "re_newsletter_subscription", name: "Real Estate Newsletter", price: "$79/mo", description: "Weekly branded market report.", type: "subscription", category: "Autonomous Products" },
  { id: "trademark_watch_subscription", name: "Trademark Watch Service", price: "$49/mo", description: "Weekly USPTO similarity scan.", type: "subscription", category: "Autonomous Products" },
  { id: "employee_credential_audit", name: "Employee Credential Audit", price: "$149 one-time", description: "HIBP breach report for employees.", type: "instant", category: "One-Time" },
  { id: "new_hire_breach_check", name: "New Hire Breach Screen", price: "$9.99/check", description: "Check candidate email against HIBP.", type: "instant", category: "One-Time" },
];

type TestStatus = "idle" | "loading" | "success" | "error";

export default function AdminSandbox() {
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const hasCustomFields = (productId: string) => !!PRODUCT_FIELDS[productId]?.length;

  const openCustomize = (product: Product) => {
    const fields = PRODUCT_FIELDS[product.id] || [];
    const defaults: Record<string, string> = {};
    fields.forEach(f => { defaults[f.key] = f.default; });
    setFieldValues(defaults);
    setModalProduct(product);
  };

  const runTest = async (product: Product, overrides?: Record<string, string>) => {
    setModalProduct(null);
    setStatuses(s => ({ ...s, [product.id]: "loading" }));
    try {
      const body: Record<string, unknown> = { product: product.id };
      if (overrides && Object.keys(overrides).length > 0) {
        // Only send non-empty overrides
        const filtered: Record<string, string> = {};
        Object.entries(overrides).forEach(([k, v]) => { if (v.trim()) filtered[k] = v.trim(); });
        if (Object.keys(filtered).length > 0) body.overrides = filtered;
      }
      const { data, error } = await supabase.functions.invoke("create-test-checkout", { body });
      if (error || !data?.url) throw new Error(error?.message || "No checkout URL returned");
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

  const ProductCard = ({ p, borderClass, badgeClass, btnClass }: { p: Product; borderClass?: string; badgeClass: string; btnClass: string }) => (
    <Card key={p.id} className={`bg-slate-800 border-slate-700 ${borderClass || ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-white text-base">{p.name}</CardTitle>
          <Badge className={`${badgeClass} text-xs shrink-0 ml-2`}>{p.price}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
        <div className="flex items-center gap-2">
          {hasCustomFields(p.id) ? (
            <Button
              onClick={() => openCustomize(p)}
              disabled={statuses[p.id] === "loading"}
              className={`flex-1 text-sm h-8 ${btnClass}`}
            >
              {statuses[p.id] === "loading" ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Opening...</>
              ) : (
                <><Settings2 className="h-3 w-3 mr-1" /> Customize &amp; Test</>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => runTest(p)}
              disabled={statuses[p.id] === "loading"}
              className={`flex-1 text-sm h-8 ${btnClass}`}
            >
              {statuses[p.id] === "loading" ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Opening...</>
              ) : (
                <><ExternalLink className="h-3 w-3 mr-1" /> Test $0</>
              )}
            </Button>
          )}
          {statuses[p.id] && statuses[p.id] !== "loading" && (
            <button onClick={() => resetStatus(p.id)} className="text-slate-500 hover:text-slate-300">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          <StatusIcon status={statuses[p.id] || "idle"} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Customization Modal */}
      <Dialog open={!!modalProduct} onOpenChange={(open) => { if (!open) setModalProduct(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-orange-500" />
              {modalProduct?.name} — Customize Test
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-slate-400 text-xs">
              Fill in these fields just like a customer would. The $0 test checkout will use these values.
            </p>
            {modalProduct && (PRODUCT_FIELDS[modalProduct.id] || []).map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="text-slate-300 text-xs font-medium">{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white text-sm min-h-[60px]"
                    placeholder={field.default || `Enter ${field.label.toLowerCase()}`}
                  />
                ) : (
                  <Input
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white text-sm h-9"
                    placeholder={field.default || `Enter ${field.label.toLowerCase()}`}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => {
                if (modalProduct) runTest(modalProduct);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Use Defaults
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => {
                if (modalProduct) runTest(modalProduct, fieldValues);
              }}
            >
              <Zap className="h-3 w-3 mr-1" />
              Test $0 with Custom Values
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="bg-slate-900 rounded-lg p-5 border border-orange-500/20">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-white font-bold text-lg">Product Sandbox</h2>
            <p className="text-slate-400 text-sm mt-1">
              Click any product to customize and test at <strong className="text-orange-400">$0</strong>.
              Products with customizable fields will open a modal where you can fill in values just like a customer would.
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Only works for Matt's email addresses. Test records are tagged <code className="bg-slate-800 px-1 rounded">is_test: true</code>.
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
          {instant.map(p => <ProductCard key={p.id} p={p} badgeClass="bg-orange-500/20 text-orange-400 border-orange-500/30" btnClass="bg-orange-500 hover:bg-orange-600 text-white" />)}
        </div>
      </div>

      {/* Subscriptions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Subscriptions</h3>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Welcome email + DB record</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subs.map(p => <ProductCard key={p.id} p={p} badgeClass="bg-slate-600 text-slate-300 border-slate-500" btnClass="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600" />)}
        </div>
      </div>

      {/* SMS Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">SMS &amp; Monitoring Products</h3>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Welcome email + DB record + Twilio</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {smsProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-purple-500/50" badgeClass="bg-purple-500/20 text-purple-400 border-purple-500/30" btnClass="bg-purple-900/30 hover:bg-purple-800/40 text-purple-300 border border-purple-600/50" />)}
        </div>
      </div>

      {/* Autonomous Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Autonomous Products</h3>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Welcome email + DB record + AI automation</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {autonomousProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-emerald-500/50" badgeClass="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" btnClass="bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-300 border border-emerald-600/50" />)}
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
