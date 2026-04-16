import { useState } from "react";
import SocialMediaLab from "./SocialMediaLab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminHelpCard } from "./AdminHelpCard";
import { getAdminGuide } from "@/lib/admin-guides";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, CheckCircle, AlertCircle, Zap, RefreshCw, Settings2, Eye, Heart, ShieldAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  // Lab Products
  domain_breach_report: [
    { key: "domain", label: "Domain to Scan", default: "mattmichelstraining.com" },
  ],
  keyword_gap_report: [
    { key: "your_domain", label: "Your Domain", default: "mattmichelstraining.com" },
    { key: "competitor_domain", label: "Competitor Domain", default: "detroitwebagent.com" },
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
  holiday_sms_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "HVAC" },
    { key: "name", label: "Owner Name", default: "Matt Michels" },
  ],
  appointment_reminder_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "phone", label: "Phone", default: "+13138064952" },
    { key: "name", label: "Owner Name", default: "Matt Michels" },
  ],
  warranty_reminder_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "phone", label: "Phone", default: "+13138064952" },
    { key: "industry", label: "Industry", default: "HVAC" },
    { key: "name", label: "Owner Name", default: "Matt Michels" },
  ],
  review_monitor_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  sms_blast_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "city", label: "City", default: "Grosse Pointe" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  noshow_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "booking_url", label: "Booking URL", default: "https://www.mattmichelstraining.com/schedule" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  estimate_drip_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  invoice_chaser_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  afterjob_drip_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  promo_blaster_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "city", label: "City", default: "Grosse Pointe" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  referral_program_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "reward_description", label: "Reward Description", default: "$25 off next session for both of you" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  slow_day_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "promo_offer", label: "Promo Offer Text", default: "First session free this week only" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  homeowner_campaign_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "business_type", label: "Business Type", default: "fitness training" },
    { key: "service_area", label: "Service Area (zip codes)", default: "48236, 48230, 48224, Grosse Pointe area" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  // Autonomous products (kept)
  rfp_alerts_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "servicesOffered", label: "Services Offered", default: "Sales training, coaching" },
    { key: "geography", label: "Geography", default: "Michigan" },
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
  regulatory_monitor_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development" },
    { key: "industry", label: "Industry", default: "fitness and wellness" },
    { key: "regulatoryBodies", label: "Regulatory Bodies", default: "FTC, OSHA" },
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
  gov_meeting_tracker_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development LLC" },
    { key: "targetCities", label: "Target Cities", default: "Grosse Pointe, Detroit" },
    { key: "keywords", label: "Keywords", default: "commercial, zoning, variance" },
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
  seo_guard_subscription: [
    { key: "website_url", label: "Website URL", default: "https://mattmichelstraining.com" },
    { key: "keywords", label: "Keywords (comma separated)", default: "personal training grosse pointe, fitness coach detroit" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  // Wave 4
  storm_lead_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Test Roofing" },
    { key: "trade", label: "Trade (roofing, HVAC, etc.)", default: "roofing" },
    { key: "zip_codes", label: "Zip Codes to Monitor (comma separated)", default: "48236, 48230, 48224" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  recall_alert_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "product_categories", label: "Product Categories (food/vehicle/consumer)", default: "food, vehicle" },
    { key: "phone", label: "Phone", default: "+13139921219" },
  ],
  permit_watch_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "city", label: "City", default: "Grosse Pointe" },
    { key: "trades", label: "Trades to Watch", default: "commercial, residential renovation" },
  ],
  speed_audit_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development" },
    { key: "website_url", label: "Website URL", default: "https://mattmichelstraining.com" },
  ],
  crime_digest_subscription: [
    { key: "address", label: "Home Address", default: "123 Main St, Grosse Pointe, MI 48236" },
    { key: "radius_miles", label: "Radius (miles)", default: "2" },
    { key: "phone", label: "Phone (optional)", default: "+13139921219" },
  ],
  license_monitor_subscription: [
    { key: "business_name", label: "Business Name", default: "M2 Development LLC" },
    { key: "license_type", label: "License Type", default: "business, contractor" },
    { key: "state", label: "State", default: "MI" },
  ],
  // Wave 5 High-Ticket
  reg_filing_monitor_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development LLC" },
    { key: "industry", label: "Industry / Sector", default: "fitness and wellness" },
    { key: "jurisdiction", label: "Jurisdiction", default: "federal, Michigan" },
    { key: "regulatoryBodies", label: "Regulatory Bodies", default: "FTC, OSHA, IRS" },
  ],
  bid_intelligence_subscription: [
    { key: "businessName", label: "Business Name", default: "M2 Development LLC" },
    { key: "naics_codes", label: "NAICS Codes", default: "611430, 541611" },
    { key: "capabilities", label: "Core Capabilities", default: "Sales training, leadership coaching, business development", multiline: true },
    { key: "geography", label: "Target Geography", default: "Michigan, Midwest" },
  ],
  field_service_subscription: [
    { key: "company_name", label: "Company Name", default: "D.J. Conley Associates" },
    { key: "owner_name", label: "Owner Name", default: "Pat Michels" },
    { key: "phone", label: "Phone", default: "+13138064952" },
    { key: "plan", label: "Plan (standard/pro)", default: "standard" },
  ],
  hire_alert_subscription: [
    { key: "company_name", label: "Company Name", default: "D.J. Conley Associates" },
    { key: "phone", label: "Phone", default: "+13138064952" },
    { key: "plan", label: "Plan (standalone/bundle)", default: "standalone" },
    { key: "target_roles", label: "Target Roles (comma separated)", default: "boiler_operator,hvac_tech,plumber" },
  ],
};

const PRODUCTS: Product[] = [
  { id: "website_audit", name: "Website Audit", price: "$9", description: "Full audit delivered within minutes.", type: "instant", category: "One-Time" },
  { id: "gbp_post_pack", name: "GBP Post Pack", price: "$19", description: "30 Google posts delivered to inbox.", type: "instant", category: "One-Time" },
  { id: "competitor_report", name: "Competitor Report", price: "$9", description: "Full competitor analysis.", type: "instant", category: "One-Time" },
  { id: "gbp_saas_subscription", name: "GBP SaaS", price: "$199/mo", description: "AI posts 3x/week to Google Business Profile.", type: "subscription", category: "Subscription" },
  { id: "social_media_subscription", name: "Social Media AI", price: "$199/mo", description: "3 posts/week to Facebook, Instagram, LinkedIn.", type: "subscription", category: "Subscription" },
  { id: "field_rep_subscription", name: "Field Rep Tools", price: "$29/mo", description: "4 AI sales tools for field reps.", type: "subscription", category: "Subscription" },
  { id: "b2b_database_subscription", name: "B2B Database", price: "$49/mo", description: "Michigan dental office contacts database.", type: "subscription", category: "Subscription" },
  { id: "review_responder_subscription", name: "Review Responder", price: "$79/mo", description: "AI responds to Google reviews automatically.", type: "subscription", category: "Subscription" },
  { id: "seo_report_subscription", name: "SEO Reports", price: "$99/mo", description: "Monthly SEO audit reports.", type: "subscription", category: "Subscription" },
  { id: "missed_call_subscription", name: "Missed Call Text", price: "$99/mo", description: "Auto-texts back missed calls.", type: "subscription", category: "Subscription" },
  { id: "holiday_sms_subscription", name: "Holiday SMS Blast", price: "$39/mo", description: "8 AI-written holiday texts/year sent to your customer list automatically.", type: "subscription", category: "SMS Products" },
  { id: "appointment_reminder_subscription", name: "Appointment Reminder SMS", price: "$39/mo", description: "24hr + 1hr automated reminders. Reduces no-shows by 80%.", type: "subscription", category: "SMS Products" },
  { id: "warranty_reminder_subscription", name: "Warranty Reminder SMS", price: "$29/mo", description: "Auto-texts customers 30 days before warranty expires. Books service calls.", type: "subscription", category: "SMS Products" },
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
  { id: "rfp_alerts_subscription", name: "RFP Alert Service", price: "$149/mo", description: "Daily gov contract alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "grant_discovery_subscription", name: "Grant Discovery", price: "$199/mo", description: "Weekly nonprofit grants.", type: "subscription", category: "Autonomous Products" },
  { id: "ag_price_alerts_subscription", name: "Ag Price Alerts", price: "$79/mo", description: "Commodity price SMS alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "regulatory_monitor_subscription", name: "Regulatory Monitor", price: "$299/mo", description: "Weekly compliance alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "price_intelligence_subscription", name: "Competitor Price Intel", price: "$199/mo", description: "Daily price monitoring.", type: "subscription", category: "Autonomous Products" },
  { id: "citation_monitor_subscription", name: "Citation Monitor", price: "$99/mo", description: "NAP consistency weekly.", type: "subscription", category: "Autonomous Products" },
  { id: "fitness_reports_subscription", name: "Fitness Progress Reports", price: "$79/mo", description: "Monthly client reports.", type: "subscription", category: "Autonomous Products" },
  { id: "gov_meeting_tracker_subscription", name: "Gov Meeting Tracker", price: "$199/mo", description: "Weekly zoning alerts.", type: "subscription", category: "Autonomous Products" },
  { id: "dark_web_monitor_subscription", name: "Dark Web Monitor", price: "$49/mo", description: "Weekly HIBP credential scan.", type: "subscription", category: "Autonomous Products" },
  { id: "gov_contract_monitor_subscription", name: "Gov Contract Monitor", price: "$299/mo", description: "Daily SAM.gov opportunity matching.", type: "subscription", category: "Autonomous Products" },
  { id: "re_newsletter_subscription", name: "Real Estate Newsletter", price: "$79/mo", description: "Weekly branded market report.", type: "subscription", category: "Autonomous Products" },
  { id: "trademark_watch_subscription", name: "Trademark Watch Service", price: "$49/mo", description: "Weekly USPTO similarity scan.", type: "subscription", category: "Autonomous Products" },
  { id: "employee_credential_audit", name: "Employee Credential Audit", price: "$149 one-time", description: "HIBP breach report for employees.", type: "instant", category: "One-Time" },
  { id: "new_hire_breach_check", name: "New Hire Breach Screen", price: "$9.99/check", description: "Check candidate email against HIBP.", type: "instant", category: "One-Time" },
  { id: "seo_guard_subscription", name: "SEO Guard", price: "$29/mo (7-day trial)", description: "Weekly JS visibility, keyword rank tracking, citation health, SMS alerts.", type: "subscription", category: "Subscription" },
  { id: "field_service_subscription", name: "Field Service Management", price: "$199-299/mo", description: "Detroit Web Agency dispatch board, mobile tech app, GPS, auto-SMS, QuickBooks sync.", type: "subscription", category: "Detroit Web Agency" },
  { id: "hire_alert_subscription", name: "TechAlert Hiring Monitor", price: "$49-99/mo", description: "Daily MIOSHA license DB + Apollo + job board scan for available licensed tradespeople.", type: "subscription", category: "Detroit Web Agency" },
  // Wave 4
  { id: "storm_lead_subscription", name: "Storm Damage Leads", price: "$29/mo", description: "NOAA storm alerts → contractor lead blasts.", type: "subscription", category: "Wave 4" },
  { id: "recall_alert_subscription", name: "Recall Alert Service", price: "$19/mo", description: "FDA/NHTSA recall alerts by SMS.", type: "subscription", category: "Wave 4" },
  { id: "permit_watch_subscription", name: "Permit Watch", price: "$29/mo", description: "Weekly local permit pulling alerts.", type: "subscription", category: "Wave 4" },
  { id: "speed_audit_subscription", name: "Website Speed Audit", price: "$29/mo", description: "Monthly PageSpeed Insights report.", type: "subscription", category: "Wave 4" },
  
  { id: "crime_digest_subscription", name: "Neighborhood Crime Digest", price: "$19/mo", description: "Weekly local crime summary SMS.", type: "subscription", category: "Wave 4" },
  { id: "license_monitor_subscription", name: "Business License Monitor", price: "$25/mo", description: "License expiry alerts before renewal.", type: "subscription", category: "Wave 4" },
  // Wave 5 High-Ticket
  { id: "reg_filing_monitor_subscription", name: "Regulatory Filing Monitor", price: "$497/mo", description: "Daily reg scan + AI draft filings.", type: "subscription", category: "High-Ticket" },
  { id: "bid_intelligence_subscription", name: "Bid Intelligence", price: "$599/mo", description: "Daily gov bid scan + AI proposal drafts.", type: "subscription", category: "High-Ticket" },
  // Lab Products
  { id: "domain_breach_report", name: "Domain Breach Report", price: "$19 one-time", description: "HIBP domain scan finds all breached employee credentials. AI-generated executive risk summary with severity tiers and remediation steps.", type: "instant", category: "Lab" },
  { id: "keyword_gap_report", name: "Local Keyword Gap Report", price: "$19 one-time", description: "DataForSEO pulls all keywords both domains rank for, then surfaces keywords your competitor ranks for that you don't — sorted by opportunity.", type: "instant", category: "Lab" },
];

type TestStatus = "idle" | "loading" | "success" | "error";

export default function AdminSandbox() {
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const PREVIEWABLE = ["employee_credential_audit"];

  const runPreview = async (product: Product, overrides?: Record<string, string>) => {
    setModalProduct(null);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const body: Record<string, unknown> = { product: product.id };
      if (overrides) {
        const filtered: Record<string, string> = {};
        Object.entries(overrides).forEach(([k, v]) => { if (v.trim()) filtered[k] = v.trim(); });
        if (Object.keys(filtered).length > 0) body.overrides = filtered;
      }
      const { data, error } = await supabase.functions.invoke("generate-sample-preview", { body });
      if (error) throw error;
      setPreviewData(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Preview failed", description: msg, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

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
      window.location.href = data.url;
      setStatuses(s => ({ ...s, [product.id]: "success" }));
      toast({ title: `${product.name} test launched`, description: "Complete the $0 checkout — then check your email." });
    } catch (e: unknown) {
      setStatuses(s => ({ ...s, [product.id]: "error" }));
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Test failed", description: msg, variant: "destructive" });
    }
  };

  const resetStatus = (id: string) => setStatuses(s => ({ ...s, [id]: "idle" }));

  const q = search.toLowerCase();
  const matches = (p: Product) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
  const instant = PRODUCTS.filter(p => p.type === "instant" && matches(p));
  const subs = PRODUCTS.filter(p => p.type === "subscription" && p.category === "Subscription" && matches(p));
  const smsProducts = PRODUCTS.filter(p => p.category === "SMS Products" && matches(p));
  const autonomousProducts = PRODUCTS.filter(p => p.category === "Autonomous Products" && matches(p));
  const dwaProducts = PRODUCTS.filter(p => p.category === "Detroit Web Agency" && matches(p));
  const wave4Products = PRODUCTS.filter(p => p.category === "Wave 4" && matches(p));
  const highTicketProducts = PRODUCTS.filter(p => p.category === "High-Ticket" && matches(p));
  const labProducts = PRODUCTS.filter(p => p.category === "Lab" && matches(p));

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
        <div className="flex flex-col gap-2">
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
          {PREVIEWABLE.includes(p.id) && (
            <Button
              onClick={() => {
                const fields = PRODUCT_FIELDS[p.id] || [];
                const defaults: Record<string, string> = {};
                fields.forEach(f => { defaults[f.key] = f.default; });
                runPreview(p, defaults);
              }}
              disabled={previewLoading}
              variant="outline"
              className="w-full text-sm h-8 border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/30"
            >
              {previewLoading ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</>
              ) : (
                <><Eye className="h-3 w-3 mr-1" /> Preview Sample</>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const guide = getAdminGuide("sandbox");

  return (
    <div className="space-y-6">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} />}

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
          <DialogFooter className="flex flex-wrap gap-2">
            {modalProduct && PREVIEWABLE.includes(modalProduct.id) && (
              <Button
                variant="outline"
                className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/30"
                disabled={previewLoading}
                onClick={() => {
                  if (modalProduct) runPreview(modalProduct, fieldValues);
                }}
              >
                {previewLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                Preview Sample
              </Button>
            )}
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

      {/* Preview Results Modal */}
      <Dialog open={!!previewData} onOpenChange={(open) => { if (!open) setPreviewData(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {previewData?.type === "pet_memorial" ? (
                <><Heart className="h-5 w-5 text-amber-500" /> Pet Memorial Preview</>
              ) : (
                <><ShieldAlert className="h-5 w-5 text-red-500" /> Credential Audit Preview</>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {previewData?.type === "pet_memorial" && (
              <div className="space-y-6">
                <div className="bg-stone-800 rounded-lg p-6 text-center">
                  <Badge className="bg-amber-700/30 text-amber-300 border-amber-600/40 mb-3">In Loving Memory</Badge>
                  <h3 className="text-2xl font-bold text-amber-50 font-serif">{previewData.pet_name}</h3>
                  <p className="text-amber-300 text-sm">{previewData.breed} · {previewData.species}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">A Poem from {previewData.pet_name}</h4>
                  <div className="bg-slate-800 border-l-4 border-amber-500 rounded-r-lg p-4">
                    {previewData.poem?.split("\n").filter(Boolean).map((line: string, i: number) => (
                      <p key={i} className="text-slate-300 italic font-serif leading-loose text-sm">{line}</p>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">A Tribute to {previewData.pet_name}</h4>
                  {previewData.tribute?.split("\n\n").filter(Boolean).map((para: string, i: number) => (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed mb-3">{para}</p>
                  ))}
                </div>
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Social Caption</h4>
                  <p className="text-slate-300 text-sm">{previewData.social_caption}</p>
                </div>
              </div>
            )}
            {previewData?.type === "employee_credential_audit" && (
              <div className="space-y-5">
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-white font-bold text-lg mb-1">{previewData.company_name}</h3>
                  <p className="text-slate-400 text-sm">{previewData.summary}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">{previewData.emails_scanned}</p>
                    <p className="text-slate-400 text-xs">Emails Scanned</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">{previewData.total_breaches_found}</p>
                    <p className="text-slate-400 text-xs">Breaches Found</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{previewData.critical_accounts}</p>
                    <p className="text-slate-400 text-xs">Critical</p>
                  </div>
                </div>
                {previewData.results?.map((r: any, i: number) => (
                  <div key={i} className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-mono">{r.email}</span>
                      <Badge className={r.severity === "critical" ? "bg-red-500/20 text-red-400 border-red-500/30" : r.severity === "clean" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                        {r.severity} — {r.breach_count} breach(es)
                      </Badge>
                    </div>
                    {r.breaches?.slice(0, 3).map((b: any, j: number) => (
                      <div key={j} className="ml-3 mt-2 border-l-2 border-slate-600 pl-3">
                        <p className="text-slate-300 text-xs font-bold">{b.name} <span className="text-slate-500 font-normal">({b.date})</span></p>
                        <p className="text-slate-500 text-xs">{b.data_classes?.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                  <h4 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Recommendation</h4>
                  <p className="text-slate-300 text-sm">{previewData.recommendation}</p>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setPreviewData(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header + Search */}
      <div className="bg-slate-900 rounded-lg p-5 border border-orange-500/20">
        <div className="flex items-start gap-3 mb-4">
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
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 h-9"
        />
      </div>

      {/* Instant Delivery */}
      {instant.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-white font-semibold">Instant Delivery</h3>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Fires in seconds</Badge>
            <span className="text-slate-500 text-xs ml-auto">{instant.length} products</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {instant.map(p => <ProductCard key={p.id} p={p} badgeClass="bg-orange-500/20 text-orange-400 border-orange-500/30" btnClass="bg-orange-500 hover:bg-orange-600 text-white" />)}
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {subs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-white font-semibold">Subscriptions</h3>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Welcome email + DB record</Badge>
            <span className="text-slate-500 text-xs ml-auto">{subs.length} products</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subs.map(p => <ProductCard key={p.id} p={p} badgeClass="bg-slate-600 text-slate-300 border-slate-500" btnClass="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600" />)}
          </div>
        </div>
      )}

      {/* Social Media Lab */}
      {!search && <SocialMediaLab />}

      {/* SMS Products */}
      {smsProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-white font-semibold">SMS &amp; Monitoring Products</h3>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Welcome email + DB record + Twilio</Badge>
            <span className="text-slate-500 text-xs ml-auto">{smsProducts.length} products</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {smsProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-purple-500/50" badgeClass="bg-purple-500/20 text-purple-400 border-purple-500/30" btnClass="bg-purple-900/30 hover:bg-purple-800/40 text-purple-300 border border-purple-600/50" />)}
          </div>
        </div>
      )}

      {/* Autonomous Products */}
      {autonomousProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-white font-semibold">Autonomous Products</h3>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Welcome email + DB record + AI automation</Badge>
            <span className="text-slate-500 text-xs ml-auto">{autonomousProducts.length} products</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {autonomousProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-emerald-500/50" badgeClass="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" btnClass="bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-300 border border-emerald-600/50" />)}
          </div>
        </div>
      )}

      {/* Detroit Web Agency */}
      {dwaProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-white font-semibold">Detroit Web Agency</h3>
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">FieldDesk · TechAlert · SiteRadar</Badge>
            <span className="text-slate-500 text-xs ml-auto">{dwaProducts.length} products</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dwaProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-cyan-500/50" badgeClass="bg-cyan-500/20 text-cyan-400 border-cyan-500/30" btnClass="bg-cyan-900/30 hover:bg-cyan-800/40 text-cyan-300 border border-cyan-600/50" />)}
          </div>
        </div>
      )}

      {/* Empty search state */}
      {search && instant.length === 0 && subs.length === 0 && smsProducts.length === 0 && autonomousProducts.length === 0 && dwaProducts.length === 0 && labProducts.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No products match "<span className="text-slate-300">{search}</span>"
        </div>
      )}

      {/* Detroit Web Agency Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Detroit Web Agency</h3>
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">FieldDesk · TechAlert · SiteRadar</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dwaProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-cyan-500/50" badgeClass="bg-cyan-500/20 text-cyan-400 border-cyan-500/30" btnClass="bg-cyan-900/30 hover:bg-cyan-800/40 text-cyan-300 border border-cyan-600/50" />)}
        </div>
      </div>

      {/* Wave 4 Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">Wave 4 Products</h3>
          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-xs">Storm, recalls, permits, speed, stories, crime, licenses</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {wave4Products.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-sky-500/50" badgeClass="bg-sky-500/20 text-sky-400 border-sky-500/30" btnClass="bg-sky-900/30 hover:bg-sky-800/40 text-sky-300 border border-sky-600/50" />)}
        </div>
      </div>

      {/* High-Ticket Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">High-Ticket Products</h3>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">$497–$599/mo • Reg Filing + Bid Intelligence</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {highTicketProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-amber-500/50" badgeClass="bg-amber-500/20 text-amber-400 border-amber-500/30" btnClass="bg-amber-900/30 hover:bg-amber-800/40 text-amber-300 border border-amber-600/50" />)}
        </div>
      </div>

      {/* Lab Products */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold">🧪 Lab Products</h3>
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">Direct URL only · Not in nav · Ad-ready</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {labProducts.map(p => <ProductCard key={p.id} p={p} borderClass="border-l-2 border-l-violet-500/50" badgeClass="bg-violet-500/20 text-violet-400 border-violet-500/30" btnClass="bg-violet-900/30 hover:bg-violet-800/40 text-violet-300 border border-violet-600/50" />)}
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
