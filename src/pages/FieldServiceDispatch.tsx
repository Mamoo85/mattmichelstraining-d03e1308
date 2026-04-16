import { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import TalentPipeline from "@/components/field-service/TalentPipeline";
import LockedFeatureTab from "@/components/field-service/LockedFeatureTab";
import DemoModeBadge, { DEMO_MASTER_TOKEN } from "@/components/DemoModeBadge";
import {
  Users, Zap, Phone, RotateCcw, LayoutGrid, Activity, Star, Globe,
  MapPin, Receipt, Wrench, FileText, ShoppingCart, ChevronLeft,
  MessageSquare, ArrowRight, CheckCircle2, Search, Shield,
  TrendingUp, Send, Database, Mail, Bell, Eye, Upload, Clock,
  Settings, BarChart3, UserPlus, Megaphone, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const DispatchBoard = lazy(() => import("@/components/field-service/DispatchBoard"));
const TechMap = lazy(() => import("@/components/field-service/TechMap"));
const InvoiceGenerator = lazy(() => import("@/components/field-service/InvoiceGenerator"));
const AssetManager = lazy(() => import("@/components/field-service/AssetManager"));
const ContractManager = lazy(() => import("@/components/field-service/ContractManager"));

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
interface ProductStep { Icon: LucideIcon; title: string; desc: string }
interface ProductStat { value: string; label: string }
interface Product {
  id: string;
  name: string;
  shortName: string;
  price: string;
  unit: string;
  oneLiner: string;
  Icon: LucideIcon;
  category: "hiring" | "operations" | "marketing" | "intelligence";
  industries: ("trades" | "healthcare" | "all")[];
  color: string;
  colorBg: string;
  features: string[];
  stats: ProductStat[];
  steps: ProductStep[];
  cta: string;
  ctaUrl: string;
}
type Tab = "pipeline" | "board" | "map" | "invoicing" | "assets" | "contracts" | "shop";

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — GitHub Dark
   ═══════════════════════════════════════════════════════════════════════════ */
const T = {
  bg:       "#0d1117",
  surface:  "#161b22",
  hover:    "#1c2128",
  elevated: "#21262d",
  border:   "#30363d",
  subtle:   "#21262d",
  text:     "#e6edf3",
  sec:      "#8b949e",
  ter:      "#484f58",
  blue:     "#4493f8",
  blueBg:   "#132d4d",
  green:    "#3fb950",
  greenBg:  "#12351e",
  orange:   "#d29922",
  orangeBg: "#352b12",
  red:      "#f85149",
  purple:   "#a371f7",
  purpleBg: "#261740",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace";

/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCT CATALOG
   ═══════════════════════════════════════════════════════════════════════════ */
const PRODUCTS: Product[] = [
  {
    id: "talent-pipeline",
    name: "Talent Pipeline",
    shortName: "Pipeline",
    price: "Included",
    unit: "",
    oneLiner: "Daily licensed candidate alerts",
    Icon: Users,
    category: "hiring",
    industries: ["all"],
    color: T.blue,
    colorBg: T.blueBg,
    features: ["Daily 7am automated scanner", "License verification", "Availability scoring 1-10", "48-hour exclusive claim", "One-click outreach drafts", "CSV export"],
    stats: [{ value: "7am", label: "Daily scan" }, { value: "48h", label: "Exclusive claim" }, { value: "1-10", label: "Availability score" }],
    steps: [
      { Icon: Search, title: "Scan", desc: "Databases scanned at 7am" },
      { Icon: Shield, title: "Verify", desc: "License checked vs state records" },
      { Icon: TrendingUp, title: "Score", desc: "Availability rated 1-10" },
      { Icon: Send, title: "Deliver", desc: "Alert sent with contact info" },
    ],
    cta: "Open Pipeline",
    ctaUrl: "#pipeline",
  },
  {
    id: "ondemand-pack",
    name: "On-Demand Name Pack",
    shortName: "Name Packs",
    price: "$50",
    unit: "/ 10 names",
    oneLiner: "Instant licensed names, no subscription",
    Icon: Zap,
    category: "hiring",
    industries: ["all"],
    color: T.orange,
    colorBg: T.orangeBg,
    features: ["10 names for $50 or 5 for $25", "Delivered to email in 5 min", "$5 refund per undeliverable", "License-verified professionals", "Availability scored", "No subscription required"],
    stats: [{ value: "5 min", label: "Delivery time" }, { value: "$5", label: "Refund per bad name" }, { value: "10", label: "Names per pack" }],
    steps: [
      { Icon: ShoppingCart, title: "Order", desc: "Select 5 or 10 name pack" },
      { Icon: Database, title: "Pull", desc: "Top-scored candidates selected" },
      { Icon: Shield, title: "Verify", desc: "License confirmation run" },
      { Icon: Mail, title: "Deliver", desc: "Sent to your email in 5 min" },
    ],
    cta: "Buy 10 Names — $50",
    ctaUrl: "/go/techalert",
  },
  {
    id: "missed-call",
    name: "Missed Call Text-Back",
    shortName: "Missed Call",
    price: "$49",
    unit: "/mo",
    oneLiner: "Auto-text when you miss a call",
    Icon: MessageSquare,
    category: "operations",
    industries: ["all"],
    color: T.green,
    colorBg: T.greenBg,
    features: ["Instant text to missed callers", "Customizable message per business", "Twilio-powered reliability", "Call tracking dashboard", "After-hours auto-response", "78% of leads go to first responder"],
    stats: [{ value: "78%", label: "Leads hire first responder" }, { value: "<5s", label: "Auto-text speed" }, { value: "24/7", label: "After-hours coverage" }],
    steps: [
      { Icon: Phone, title: "Ring", desc: "Customer calls your business" },
      { Icon: Clock, title: "Miss", desc: "Call goes unanswered" },
      { Icon: MessageSquare, title: "Auto-text", desc: "Personalized text sent instantly" },
      { Icon: CheckCircle2, title: "Save", desc: "Lead preserved, conversation started" },
    ],
    cta: "Add for $49/mo",
    ctaUrl: "/missed-call-catch",
  },
  {
    id: "dead-leads",
    name: "Dead Lead Reactivation",
    shortName: "Dead Leads",
    price: "$50",
    unit: "/ positive reply",
    oneLiner: "Reactivate your old leads via SMS",
    Icon: RotateCcw,
    category: "marketing",
    industries: ["all"],
    color: T.purple,
    colorBg: T.purpleBg,
    features: ["Pay only for positive replies", "AI-written SMS drip sequences", "TCPA compliant messaging", "Opt-out management built in", "Avg 8-12% reactivation rate", "Works with any old lead list"],
    stats: [{ value: "8-12%", label: "Reactivation rate" }, { value: "$50", label: "Per positive reply" }, { value: "$0", label: "If no response" }],
    steps: [
      { Icon: Upload, title: "Upload", desc: "Send us your old lead list" },
      { Icon: MessageSquare, title: "AI Write", desc: "AI creates SMS drip sequences" },
      { Icon: Send, title: "Send", desc: "TCPA-compliant messages sent" },
      { Icon: CheckCircle2, title: "Pay", desc: "Only charged on positive reply" },
    ],
    cta: "Reactivate My Leads",
    ctaUrl: "/dead-lead-intake",
  },
  {
    id: "fielddesk-pro",
    name: "FieldDesk Pro",
    shortName: "FieldDesk",
    price: "$199",
    unit: "/mo flat",
    oneLiner: "Full dispatch, GPS, invoicing — unlimited techs",
    Icon: LayoutGrid,
    category: "operations",
    industries: ["trades"],
    color: T.blue,
    colorBg: T.blueBg,
    features: ["Drag-and-drop dispatch board", "Real-time GPS tech tracking", "Auto-SMS on job status changes", "On-site invoicing + signatures", "Asset & contract management", "Unlimited users — no per-tech fees"],
    stats: [{ value: "$199", label: "Flat. Unlimited." }, { value: "\u221E", label: "Technicians" }, { value: "$0", label: "Per-tech fees" }],
    steps: [
      { Icon: LayoutGrid, title: "Dispatch", desc: "Drag-and-drop scheduling" },
      { Icon: MapPin, title: "Track", desc: "Real-time GPS for every tech" },
      { Icon: Bell, title: "Notify", desc: "Auto-SMS on status changes" },
      { Icon: Receipt, title: "Invoice", desc: "On-site invoicing + signatures" },
    ],
    cta: "Upgrade to FieldDesk Pro",
    ctaUrl: "/field-service",
  },
  {
    id: "industry-pulse",
    name: "Industry Pulse",
    shortName: "Pulse",
    price: "$149",
    unit: "/mo",
    oneLiner: "Predictive demand intelligence",
    Icon: Activity,
    category: "intelligence",
    industries: ["trades"],
    color: T.orange,
    colorBg: T.orangeBg,
    features: ["Predictive demand forecasting", "Equipment failure trend analysis", "Hiring pattern intelligence", "Metro Detroit market signals", "Weekly digest reports", "Early-mover advantage"],
    stats: [{ value: "2 wk", label: "Advance signals" }, { value: "5", label: "Data source feeds" }, { value: "7d", label: "Weekly digest" }],
    steps: [
      { Icon: Eye, title: "Monitor", desc: "Scan hiring & permit data" },
      { Icon: BarChart3, title: "Analyze", desc: "Detect demand patterns" },
      { Icon: TrendingUp, title: "Predict", desc: "2-week advance forecasting" },
      { Icon: Bell, title: "Alert", desc: "Early-mover intelligence" },
    ],
    cta: "Add Industry Pulse",
    ctaUrl: "/industry-pulse",
  },
  {
    id: "review-engine",
    name: "Review Engine",
    shortName: "Reviews",
    price: "$79",
    unit: "/mo",
    oneLiner: "Automated Google review collection",
    Icon: Star,
    category: "marketing",
    industries: ["all"],
    color: T.green,
    colorBg: T.greenBg,
    features: ["Auto-request after job completion", "SMS + email review requests", "Google review direct links", "Review monitoring dashboard", "Negative review alerts", "Response templates"],
    stats: [{ value: "4.8", label: "Avg rating at 90 days" }, { value: "90d", label: "Time to 4.8 stars" }, { value: "<1h", label: "Negative alert speed" }],
    steps: [
      { Icon: CheckCircle2, title: "Complete", desc: "Job marked as done" },
      { Icon: Send, title: "Request", desc: "Auto-send review request" },
      { Icon: Star, title: "Collect", desc: "Customer leaves Google review" },
      { Icon: Eye, title: "Monitor", desc: "Negative review alerts" },
    ],
    cta: "Add Review Engine",
    ctaUrl: "#",
  },
  {
    id: "website-seo",
    name: "Website + SEO",
    shortName: "Website",
    price: "$299",
    unit: "/mo",
    oneLiner: "Professional website with local SEO",
    Icon: Globe,
    category: "marketing",
    industries: ["all"],
    color: T.blue,
    colorBg: T.blueBg,
    features: ["Custom professional website", "Mobile-optimized design", "Local SEO optimization", "Google Business Profile mgmt", "Monthly performance reports", "Content updates included"],
    stats: [{ value: "3x", label: "Lead increase avg" }, { value: "90d", label: "Time to results" }, { value: "\u221E", label: "Updates included" }],
    steps: [
      { Icon: Globe, title: "Build", desc: "Custom professional website" },
      { Icon: Search, title: "Optimize", desc: "Local SEO applied" },
      { Icon: Settings, title: "Manage", desc: "Google Business Profile" },
      { Icon: BarChart3, title: "Report", desc: "Monthly performance data" },
    ],
    cta: "Get a Pro Website",
    ctaUrl: "#",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SCOPED CSS
   ═══════════════════════════════════════════════════════════════════════════ */
const STYLES = `
.fd-root { min-height:100vh; background:${T.bg}; color:${T.text}; font-family:${FONT}; display:flex; flex-direction:column; }
.fd-root *::-webkit-scrollbar { width:6px; }
.fd-root *::-webkit-scrollbar-track { background:transparent; }
.fd-root *::-webkit-scrollbar-thumb { background:${T.border}; border-radius:3px; }
.fd-header { height:52px; border-bottom:1px solid ${T.border}; display:flex; align-items:center; justify-content:space-between; padding:0 20px; flex-shrink:0; background:${T.surface}; }
.fd-body { flex:1; display:flex; overflow:hidden; }
.fd-nav { width:56px; border-right:1px solid ${T.border}; display:flex; flex-direction:column; align-items:center; padding:10px 0; gap:2px; flex-shrink:0; background:${T.surface}; }
.fd-nav-btn { width:44px; height:42px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:none; border-radius:6px; cursor:pointer; background:transparent; position:relative; transition:background .12s; }
.fd-nav-btn:hover { background:${T.hover}; }
.fd-nav-btn.active { background:${T.blueBg}; }
.fd-nav-btn.active::before { content:''; position:absolute; left:0; top:50%; transform:translateY(-50%); width:3px; height:20px; background:${T.blue}; border-radius:0 3px 3px 0; }
.fd-nav-lbl { font-size:9px; font-weight:600; letter-spacing:.3px; }
.fd-center { flex:1; overflow:auto; background:${T.bg}; }
.fd-shop-hdr { padding:14px 16px; border-bottom:1px solid ${T.border}; display:flex; align-items:center; justify-content:space-between; }
.fd-shop-list { flex:1; overflow:auto; padding:8px; }
.fd-cat-lbl { font-size:10px; font-weight:700; color:${T.ter}; text-transform:uppercase; letter-spacing:1.2px; padding:6px 10px 4px; }
.fd-shop-item { width:100%; display:flex; align-items:center; gap:10px; padding:10px; border:none; border-radius:6px; cursor:pointer; background:transparent; text-align:left; border-left:3px solid transparent; transition:all .12s; }
.fd-shop-item:hover { background:${T.hover}; }
.fd-shop-btn { background:none; border:1px solid ${T.border}; border-radius:6px; padding:6px 14px; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; transition:all .15s; }
.fd-shop-btn:hover { border-color:${T.blue}; color:${T.blue}; }
.fd-detail { padding:40px 48px; max-width:860px; }
.fd-detail-back { background:none; border:none; color:${T.sec}; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px; font-weight:500; padding:0; transition:color .12s; }
.fd-detail-back:hover { color:${T.text}; }
.fd-stat-card { border-radius:8px; padding:20px; background:${T.surface}; border:1px solid ${T.border}; border-top:3px solid var(--stat-color); }
.fd-feat-item { display:flex; align-items:center; gap:10px; padding:10px 14px; background:${T.surface}; border-radius:6px; border:1px solid ${T.border}; }
.fd-cta { display:inline-flex; align-items:center; gap:8px; font-weight:700; font-size:14px; padding:12px 24px; border-radius:6px; text-decoration:none; transition:opacity .15s; border:none; cursor:pointer; }
.fd-cta:hover { opacity:.88; }
.fd-cta-secondary { display:inline-flex; align-items:center; gap:8px; background:${T.surface}; color:${T.sec}; font-weight:600; font-size:13px; padding:12px 18px; border-radius:6px; text-decoration:none; border:1px solid ${T.border}; transition:all .12s; }
.fd-cta-secondary:hover { border-color:${T.blue}; color:${T.text}; }
.fd-steps-grid { display:grid; gap:0; position:relative; }
.fd-stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.fd-feats-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.fd-bottom-nav { position:fixed; bottom:0; left:0; right:0; height:56px; background:${T.surface}; border-top:1px solid ${T.border}; display:flex; align-items:stretch; z-index:40; }
.fd-bottom-btn { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; border:none; background:transparent; cursor:pointer; position:relative; color:${T.sec}; font-family:${FONT}; }
.fd-bottom-btn.active { color:${T.blue}; }
.fd-bottom-btn.active::after { content:''; position:absolute; top:0; left:20%; right:20%; height:2px; background:${T.blue}; border-radius:0 0 2px 2px; }
.fd-overlay-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:45; }
.fd-shop-overlay { position:fixed; top:0; right:0; bottom:0; width:320px; max-width:85vw; background:${T.surface}; border-left:1px solid ${T.border}; z-index:50; display:flex; flex-direction:column; }
.fd-shop-desktop { border-left:1px solid ${T.border}; overflow:hidden; flex-shrink:0; background:${T.surface}; display:flex; flex-direction:column; }
.fd-close-btn { background:none; border:none; cursor:pointer; color:${T.sec}; padding:4px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:all .12s; }
.fd-close-btn:hover { color:${T.text}; background:${T.hover}; }
.fd-fab-wrap { position:fixed; right:16px; bottom:72px; z-index:42; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.fd-fab { width:52px; height:52px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,.4); transition:transform .15s; }
.fd-fab:active { transform:scale(.92); }
.fd-fab-action { display:flex; align-items:center; gap:10px; padding:10px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; text-decoration:none; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,.3); transition:transform .1s; }
.fd-fab-action:active { transform:scale(.96); }
@media (max-width:768px) {
  .fd-nav { display:none !important; }
  .fd-header { padding:0 12px; }
  .fd-header-meta { display:none !important; }
  .fd-header-shop { display:none !important; }
  .fd-body { padding-bottom:56px; }
  .fd-detail { padding:24px 16px; }
  .fd-detail h1 { font-size:22px !important; }
  .fd-steps-grid { grid-template-columns:repeat(2,1fr) !important; gap:20px !important; }
  .fd-step-connector { display:none !important; }
  .fd-stats-grid { grid-template-columns:1fr !important; }
  .fd-feats-grid { grid-template-columns:1fr !important; }
  .fd-cta-row { flex-direction:column; }
  .fd-cta, .fd-cta-secondary { width:100%; justify-content:center; }
}
@media (min-width:769px) {
  .fd-bottom-nav { display:none !important; }
  .fd-fab-wrap { display:none !important; }
}
`;

const CATEGORY_META: Record<Product["category"], { label: string; Icon: LucideIcon }> = {
  hiring: { label: "Hiring", Icon: UserPlus },
  operations: { label: "Operations", Icon: Settings },
  marketing: { label: "Marketing", Icon: Megaphone },
  intelligence: { label: "Intelligence", Icon: BarChart3 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FieldServiceDispatch() {
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [shopOpen, setShopOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 769);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [authState, setAuthState] = useState<"loading" | "authorized" | "denied">("loading");
  const [resolvedClientId, setResolvedClientId] = useState("");
  const [hasFieldDesk, setHasFieldDesk] = useState(false);
  const [dashboardToken, setDashboardToken] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [userIndustry, setUserIndustry] = useState<"trades" | "healthcare">("trades");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 769);
  const [fabOpen, setFabOpen] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const rawToken = params.get("token") || "";
  const isDemo = rawToken === DEMO_MASTER_TOKEN || params.get("demo") === "1";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isDemo) {
      const industryOverride = params.get("industry");
      setResolvedClientId("demo");
      setHasFieldDesk(false);
      setDashboardToken("demo");
      if (industryOverride === "healthcare") {
        setCompanyName("Great Lakes Home Health");
        setUserIndustry("healthcare");
      } else {
        setCompanyName("Great Lakes Mechanical");
        setUserIndustry("trades");
      }
      setAuthState("authorized");
      return;
    }
    if (!rawToken) { setAuthState("denied"); return; }
    (async () => {
      const { data: fd } = await (supabase as any).from("field_crm_clients").select("id, company_name").eq("dispatch_token", rawToken).eq("active", true).maybeSingle();
      if (fd?.id) { setResolvedClientId(fd.id); setCompanyName(fd.company_name || ""); setHasFieldDesk(true); setDashboardToken(rawToken); setAuthState("authorized"); return; }
      const { data: ha } = await (supabase as any).from("hire_alert_clients").select("id, company_name, dashboard_token, target_roles").eq("dashboard_token", rawToken).eq("active", true).maybeSingle();
      if (ha?.id) {
        setResolvedClientId(ha.id);
        setCompanyName(ha.company_name || "");
        setHasFieldDesk(false);
        setDashboardToken(ha.dashboard_token);
        const roles: string[] = ha.target_roles || [];
        const healthcareRoles = ["cna", "rn", "lpn", "hha", "don", "nurse"];
        setUserIndustry(roles.some(r => healthcareRoles.includes(r)) ? "healthcare" : "trades");
        setAuthState("authorized");
        return;
      }
      setAuthState("denied");
    })();
  }, []);

  const relevantProducts = PRODUCTS.filter(p =>
    p.industries.includes("all") || p.industries.includes(userIndustry)
  );

  const handleProductClick = (product: Product) => {
    if (product.ctaUrl === "#pipeline") {
      setActiveTab("pipeline");
      setSelectedProduct(null);
    } else {
      setSelectedProduct(product);
      setActiveTab("shop");
    }
    if (isMobile) setShopOpen(false);
  };

  /* AUTH GATES */
  if (authState === "loading") {
    return (
      <div data-testid="fd-loading" style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.sec, fontSize: 13, fontFamily: FONT }}>Verifying access...</div>
      </div>
    );
  }
  if (authState === "denied") {
    return (
      <div data-testid="fd-denied" style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: FONT }}>
        <div style={{ color: T.red, fontSize: 18, fontWeight: 700 }}>Access Denied</div>
        <p style={{ color: T.sec, fontSize: 14, maxWidth: 400, textAlign: "center", lineHeight: 1.6, margin: 0 }}>
          Invalid or expired token. Check your welcome email for your dashboard link, or text Matt:{" "}
          <a href="sms:+13139921219" style={{ color: T.blue }}>313-992-1219</a>
        </p>
      </div>
    );
  }

  const navItems: { id: Tab; label: string; Icon: LucideIcon; locked: boolean }[] = [
    { id: "pipeline", label: "Pipeline", Icon: Users, locked: false },
    { id: "board", label: "Dispatch", Icon: LayoutGrid, locked: !hasFieldDesk },
    { id: "map", label: "Map", Icon: MapPin, locked: !hasFieldDesk },
    { id: "invoicing", label: "Invoicing", Icon: Receipt, locked: !hasFieldDesk },
    { id: "assets", label: "Assets", Icon: Wrench, locked: !hasFieldDesk },
    { id: "contracts", label: "Contracts", Icon: FileText, locked: !hasFieldDesk },
  ];

  const contentKey = activeTab === "shop" && selectedProduct ? `product-${selectedProduct.id}` : activeTab;

  /* Shop list content — shared between desktop sidebar and mobile overlay */
  const shopListContent = (
    <div className="fd-shop-list">
      {(["hiring", "operations", "marketing", "intelligence"] as const).map(cat => {
        const catProducts = relevantProducts.filter(p => p.category === cat);
        if (catProducts.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div className="fd-cat-lbl" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <meta.Icon size={10} />
              {meta.label}
            </div>
            {catProducts.map(product => {
              const isSelected = selectedProduct?.id === product.id;
              return (
                <button
                  key={product.id}
                  data-testid={`fd-shop-${product.id}`}
                  onClick={() => handleProductClick(product)}
                  className="fd-shop-item"
                  style={{
                    background: isSelected ? product.colorBg : undefined,
                    borderLeftColor: isSelected ? product.color : "transparent",
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: isSelected ? product.color : T.elevated, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .12s" }}>
                    <product.Icon size={15} style={{ color: isSelected ? "#fff" : T.sec }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? T.text : T.sec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.shortName}</div>
                    <div style={{ fontSize: 11, color: T.ter, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.oneLiner}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: product.color, fontFamily: MONO }}>{product.price}</div>
                    {product.unit && <div style={{ fontSize: 9, color: T.ter }}>{product.unit}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fd-root" data-testid="fd-root">
      <style>{STYLES}</style>
      {isDemo && <DemoModeBadge />}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="fd-header" data-testid="fd-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: ".5px", display: "flex", gap: 4 }}>
            <span style={{ color: T.text }}>DETROIT</span>
            <span style={{ color: T.ter }}>WEB AGENCY</span>
          </span>
          <span className="fd-header-meta" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 1, height: 16, background: T.border }} />
            {companyName && <span style={{ color: T.sec, fontSize: 13, fontWeight: 500 }}>{companyName}</span>}
            {!hasFieldDesk && (
              <span data-testid="fd-badge-hirealert" style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueBg, padding: "3px 10px", borderRadius: 4, letterSpacing: .5 }}>HIRE ALERT</span>
            )}
            {hasFieldDesk && (
              <span data-testid="fd-badge-fielddesk" style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenBg, padding: "3px 10px", borderRadius: 4, letterSpacing: .5 }}>FIELDDESK PRO</span>
            )}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            data-testid="fd-shop-toggle"
            onClick={() => setShopOpen(!shopOpen)}
            className="fd-shop-btn fd-header-shop"
            style={{ color: shopOpen ? T.blue : T.sec, borderColor: shopOpen ? T.blue : T.border, background: shopOpen ? T.blueBg : "transparent" }}
          >
            <ShoppingCart size={14} />
            <span>Shop</span>
          </button>
          <a href="sms:+13139921219" data-testid="fd-support-link" className="fd-header-meta" style={{ color: T.sec, fontSize: 12, textDecoration: "none", fontWeight: 500, transition: "color .12s" }}>Support</a>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div className="fd-body">

        {/* LEFT NAV — hidden on mobile via CSS */}
        <nav className="fd-nav" data-testid="fd-nav">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`fd-nav-${item.id}`}
                onClick={() => { setActiveTab(item.id); setSelectedProduct(null); }}
                title={item.label}
                className={`fd-nav-btn${isActive ? " active" : ""}`}
              >
                <item.Icon size={16} style={{ color: isActive ? T.blue : item.locked ? T.ter : T.sec, opacity: item.locked ? .4 : 1 }} />
                <span className="fd-nav-lbl" style={{ color: isActive ? T.blue : item.locked ? T.ter : T.sec }}>{item.label}</span>
                {item.locked && (
                  <span style={{ position: "absolute", top: 4, right: 4, fontSize: 8, color: T.ter, lineHeight: 1 }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* CENTER CONTENT — animated transitions */}
        <main className="fd-center" data-testid="fd-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={contentKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{ minHeight: "100%" }}
            >
              {selectedProduct && activeTab === "shop" ? (
                <ProductDetail
                  product={selectedProduct}
                  onClose={() => { setSelectedProduct(null); setActiveTab("pipeline"); }}
                  isMobile={isMobile}
                />
              ) : (
                <>
                  {activeTab === "pipeline" && <TalentPipeline token={dashboardToken} clientId={resolvedClientId} />}
                  {activeTab === "board" && (hasFieldDesk ? <Suspense fallback={<Loader />}><DispatchBoard clientId={resolvedClientId} /></Suspense> : <LockedFeatureTab feature="dispatch" />)}
                  {activeTab === "map" && (hasFieldDesk ? <Suspense fallback={<Loader />}><TechMap clientId={resolvedClientId} /></Suspense> : <LockedFeatureTab feature="map" />)}
                  {activeTab === "invoicing" && (hasFieldDesk ? <Suspense fallback={<Loader />}><InvoiceGenerator job={{ id: "new", title: "New Invoice", field_service_customers: null, field_service_techs: null, scheduled_date: null }} onClose={() => {}} /></Suspense> : <LockedFeatureTab feature="invoicing" />)}
                  {activeTab === "assets" && (hasFieldDesk ? <Suspense fallback={<Loader />}><AssetManager clientId={resolvedClientId} /></Suspense> : <LockedFeatureTab feature="assets" />)}
                  {activeTab === "contracts" && (hasFieldDesk ? <Suspense fallback={<Loader />}><ContractManager clientId={resolvedClientId} /></Suspense> : <LockedFeatureTab feature="contracts" />)}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* DESKTOP SHOP SIDEBAR */}
        {!isMobile && (
          <motion.aside
            className="fd-shop-desktop"
            data-testid="fd-shop-sidebar"
            animate={{ width: shopOpen ? 300 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="fd-shop-hdr">
              <span style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: .8, textTransform: "uppercase" }}>Services</span>
              <span style={{ fontSize: 10, color: T.ter, fontWeight: 500, fontFamily: MONO }}>{relevantProducts.length} available</span>
            </div>
            {shopListContent}
          </motion.aside>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────── */}
      {isMobile && (
        <nav className="fd-bottom-nav" data-testid="fd-bottom-nav">
          {navItems.map(item => {
            const isActive = activeTab === item.id && !selectedProduct;
            return (
              <button
                key={item.id}
                data-testid={`fd-bnav-${item.id}`}
                onClick={() => { setActiveTab(item.id); setSelectedProduct(null); }}
                className={`fd-bottom-btn${isActive ? " active" : ""}`}
              >
                <item.Icon size={18} style={{ opacity: item.locked ? .35 : 1 }} />
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: .2 }}>{item.label}</span>
              </button>
            );
          })}
          <button
            data-testid="fd-bnav-shop"
            onClick={() => setShopOpen(!shopOpen)}
            className={`fd-bottom-btn${shopOpen ? " active" : ""}`}
          >
            <ShoppingCart size={18} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: .2 }}>Shop</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE SHOP OVERLAY ────────────────────────────────────────── */}
      <AnimatePresence>
        {isMobile && shopOpen && (
          <motion.div
            key="shop-backdrop"
            className="fd-overlay-backdrop"
            data-testid="fd-shop-backdrop"
            onClick={() => setShopOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
        {isMobile && shopOpen && (
          <motion.div
            key="shop-panel"
            className="fd-shop-overlay"
            data-testid="fd-shop-mobile"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="fd-shop-hdr">
              <span style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: .8, textTransform: "uppercase" }}>Services</span>
              <button className="fd-close-btn" data-testid="fd-shop-close" onClick={() => setShopOpen(false)}>
                <X size={16} />
              </button>
            </div>
            {shopListContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE QUICK ACTIONS FAB ───────────────────────────────────── */}
      {isMobile && (
        <div className="fd-fab-wrap" data-testid="fd-fab-wrap">
          <AnimatePresence>
            {fabOpen && (
              <>
                <motion.a
                  key="fab-names"
                  href="/go/techalert"
                  className="fd-fab-action"
                  data-testid="fd-fab-buy-names"
                  style={{ background: T.orange, color: "#fff" }}
                  initial={{ opacity: 0, y: 12, scale: .9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: .9 }}
                  transition={{ duration: .12, delay: .04 }}
                >
                  <Zap size={16} /> Buy Names
                </motion.a>
                <motion.a
                  key="fab-text"
                  href="sms:+13139921219"
                  className="fd-fab-action"
                  data-testid="fd-fab-text-matt"
                  style={{ background: T.green, color: "#fff" }}
                  initial={{ opacity: 0, y: 12, scale: .9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: .9 }}
                  transition={{ duration: .12 }}
                >
                  <MessageSquare size={16} /> Text Matt
                </motion.a>
              </>
            )}
          </AnimatePresence>
          <button
            className="fd-fab"
            data-testid="fd-fab-toggle"
            onClick={() => setFabOpen(!fabOpen)}
            style={{ background: fabOpen ? T.red : T.blue }}
          >
            <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: .15 }}>
              <ArrowRight size={22} color="#fff" style={{ transform: "rotate(-45deg)" }} />
            </motion.div>
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCT DETAIL VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function ProductDetail({ product, onClose, isMobile }: { product: Product; onClose: () => void; isMobile: boolean }) {
  const PIcon = product.Icon;
  const stepCols = isMobile ? 2 : product.steps.length;

  return (
    <div className="fd-detail" data-testid="fd-product-detail">
      <button data-testid="fd-detail-back" onClick={onClose} className="fd-detail-back">
        <ChevronLeft size={14} /> Back to dashboard
      </button>

      {/* Hero */}
      <div style={{ marginTop: 28, display: "flex", alignItems: "flex-start", gap: isMobile ? 14 : 20, marginBottom: 32 }}>
        <div style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius: 12, background: product.colorBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${product.color}30` }}>
          <PIcon size={isMobile ? 22 : 26} style={{ color: product.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, margin: "0 0 4px", color: T.text, letterSpacing: -.5 }}>{product.name}</h1>
          <p style={{ fontSize: 14, color: T.sec, margin: "0 0 12px" }}>{product.oneLiner}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: product.color, fontFamily: MONO, letterSpacing: -1 }}>{product.price}</span>
            {product.unit && <span style={{ fontSize: 13, color: T.ter }}>{product.unit}</span>}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.ter, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 }}>How it works</div>
        <div className="fd-steps-grid" style={{ gridTemplateColumns: `repeat(${stepCols}, 1fr)` }}>
          {!isMobile && <div className="fd-step-connector" style={{ position: "absolute", top: 22, left: "8%", right: "8%", height: 2, background: T.border, zIndex: 0 }} />}
          {product.steps.map((step, i) => {
            const SIcon = step.Icon;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }} data-testid={`fd-step-${i}`}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: product.colorBg,
                  border: `2px solid ${product.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <SIcon size={20} style={{ color: product.color }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>{step.title}</div>
                  <div style={{ fontSize: 11, color: T.sec, lineHeight: 1.4, maxWidth: 140 }}>{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STATS */}
      <div className="fd-stats-grid" style={{ marginBottom: 36 }}>
        {product.stats.map((stat, i) => (
          <div key={i} className="fd-stat-card" style={{ "--stat-color": product.color } as React.CSSProperties} data-testid={`fd-stat-${i}`}>
            <div style={{ fontSize: 28, fontWeight: 800, color: product.color, fontFamily: MONO, letterSpacing: -1, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: T.sec, fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.ter, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>What's included</div>
        <div className="fd-feats-grid">
          {product.features.map(f => (
            <div key={f} className="fd-feat-item">
              <CheckCircle2 size={14} style={{ color: product.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: T.sec }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="fd-cta-row" style={{ display: "flex", gap: 12 }}>
        <a href={product.ctaUrl} className="fd-cta" data-testid="fd-detail-cta" style={{ background: product.color, color: "#fff" }}>
          {product.cta} <ArrowRight size={15} />
        </a>
        <a href="sms:+13139921219" className="fd-cta-secondary" data-testid="fd-detail-text-matt">
          <MessageSquare size={14} /> Text Matt
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function Loader() {
  return <div style={{ padding: 40, color: T.sec, fontSize: 13, fontFamily: FONT }}>Loading...</div>;
}
