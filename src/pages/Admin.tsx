import { useState, useEffect, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AppNavbar from "@/components/layout/AppNavbar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Dumbbell, DollarSign, Megaphone, Globe,
  ArrowLeft, ChevronRight, Activity, AlertTriangle,
  CheckCircle, Mail, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ── Lazy-load ALL admin sub-components ─────────────────────────────────────── */
// AI Bar (always rendered)
const AdminAiBar = lazy(() => import("@/components/admin/AdminAiBar"));

// Training domain
const AdminPrograms           = lazy(() => import("@/components/admin/AdminPrograms"));
const AdminExerciseLibrary    = lazy(() => import("@/components/admin/AdminExerciseLibrary"));
const AdminWorkoutInventory   = lazy(() => import("@/components/admin/AdminWorkoutInventory"));
const AdminBatchGenerator     = lazy(() => import("@/components/admin/AdminBatchGenerator"));
const AdminExerciseGenerator  = lazy(() => import("@/components/admin/AdminExerciseGenerator"));
const AdminProgramCreator     = lazy(() => import("@/components/admin/AdminProgramCreator"));
const AdminAiQueue            = lazy(() => import("@/components/admin/AdminAiQueue"));
const AdminRecoveryHeatmap    = lazy(() => import("@/components/admin/AdminRecoveryHeatmap"));
const AdminMonthlyFocus       = lazy(() => import("@/components/admin/AdminMonthlyFocus"));
const AdminBiomechanics       = lazy(() => import("@/components/admin/AdminBiomechanics"));
const AdminAiToolkit          = lazy(() => import("@/components/admin/AdminAiToolkit"));
const AdminCoachAiQueue       = lazy(() => import("@/components/admin/AdminCoachAiQueue"));
const AdminCustomRequests     = lazy(() => import("@/components/admin/AdminCustomRequests"));
const AdminUserGeneratedWorkouts = lazy(() => import("@/components/admin/AdminUserGeneratedWorkouts"));
const AdminImageMatcher       = lazy(() => import("@/components/admin/AdminImageMatcher"));
const AdminProgressLogger     = lazy(() => import("@/components/admin/AdminProgressLogger"));
const AdminLiftVideoReview    = lazy(() => import("@/components/admin/AdminLiftVideoReview"));
const AdminProveItReview      = lazy(() => import("@/components/admin/AdminProveItReview"));

// People domain
const AdminClientList         = lazy(() => import("@/components/admin/AdminClientList"));
const AdminSupportCopilot     = lazy(() => import("@/components/admin/AdminSupportCopilot"));
const AdminFamilyManager      = lazy(() => import("@/components/admin/AdminFamilyManager"));
const AdminTeamRosters        = lazy(() => import("@/components/admin/AdminTeamRosters"));
const AdminCoachManager       = lazy(() => import("@/components/admin/AdminCoachManager"));
const AdminTeamSandbox        = lazy(() => import("@/components/admin/AdminTeamSandbox"));
const AdminParentReports      = lazy(() => import("@/components/admin/AdminParentReports"));
const AdminParentInbox        = lazy(() => import("@/components/admin/AdminParentInbox"));
const AdminCoachInbox         = lazy(() => import("@/components/admin/AdminCoachInbox"));
const AdminPostureRequests    = lazy(() => import("@/components/admin/AdminPostureRequests"));
const AdminCoachDashboard     = lazy(() => import("@/components/admin/AdminCoachDashboard"));
const AdminDirectMessages     = lazy(() => import("@/components/admin/AdminDirectMessages"));
const AdminVideoReview        = lazy(() => import("@/components/admin/AdminVideoReview"));
const AdminTrialSettings      = lazy(() => import("@/components/admin/AdminTrialSettings"));
const AdminClientOnboarding   = lazy(() => import("@/components/admin/AdminClientOnboarding"));
const AdminChurnRadar         = lazy(() => import("@/components/admin/AdminChurnRadar"));
const AdminSchedule           = lazy(() => import("@/components/admin/AdminSchedule"));
const AdminVipAccess          = lazy(() => import("@/components/admin/AdminVipAccess"));
const UserActivityFeed        = lazy(() => import("@/components/admin/UserActivityFeed"));

// Business & Ops domain
const AdminFinancials         = lazy(() => import("@/components/admin/AdminFinancials"));
const AdminPromotions         = lazy(() => import("@/components/admin/AdminPromotions"));
const AdminPointsManager      = lazy(() => import("@/components/admin/AdminPointsManager"));
const AdminTierManager        = lazy(() => import("@/components/admin/AdminTierManager"));
const AdminSystemSettings     = lazy(() => import("@/components/admin/AdminSystemSettings"));
const AdminStripeProducts     = lazy(() => import("@/components/admin/AdminStripeProducts"));
const AdminServiceCatalog     = lazy(() => import("@/components/admin/AdminServiceCatalog"));
const AdminGiftCards          = lazy(() => import("@/components/admin/AdminGiftCards"));
const AdminGuideStore         = lazy(() => import("@/components/admin/AdminGuideStore"));
const AdminAffiliateManager   = lazy(() => import("@/components/admin/AdminAffiliateManager"));
const AdminReferrals          = lazy(() => import("@/components/admin/AdminReferrals"));
const AdminLegalCompliance    = lazy(() => import("@/components/admin/AdminLegalCompliance"));
const AdminTrash              = lazy(() => import("@/components/admin/AdminTrash"));
const AdminFulfillment        = lazy(() => import("@/components/admin/AdminFulfillment"));
const AdminOrders             = lazy(() => import("@/components/admin/AdminOrders"));
const AdminOpsCenter          = lazy(() => import("@/components/admin/AdminOpsCenter"));
const AdminSandbox            = lazy(() => import("@/components/admin/AdminSandbox"));
const AdminBusinessDashboard  = lazy(() => import("@/components/admin/AdminBusinessDashboard"));
const AdminClientHealth       = lazy(() => import("@/components/admin/AdminClientHealth"));
const AdminEmailLog           = lazy(() => import("@/components/admin/AdminEmailLog"));
const AdminMigrations         = lazy(() => import("@/components/admin/AdminMigrations"));
const AdminB2BPipeline        = lazy(() => import("@/components/admin/AdminB2BPipeline"));
const AdminSocialMediaOnboarding = lazy(() => import("@/components/admin/AdminSocialMediaOnboarding"));

// Marketing & Content domain
const AdminFrontPage          = lazy(() => import("@/components/admin/AdminFrontPage"));
const AdminSiteEditor         = lazy(() => import("@/components/admin/AdminSiteEditor"));
const AdminTestimonials       = lazy(() => import("@/components/admin/AdminTestimonials"));
const AdminLearnEditor        = lazy(() => import("@/components/admin/AdminLearnEditor"));
const AdminBroadcasts         = lazy(() => import("@/components/admin/AdminBroadcasts"));
const AdminSubscriberList     = lazy(() => import("@/components/admin/AdminSubscriberList"));
const AdminNewsletterComposer = lazy(() => import("@/components/admin/AdminNewsletterComposer"));
const AdminSendHistory        = lazy(() => import("@/components/admin/AdminSendHistory"));
const AdminMarketingDrafts    = lazy(() => import("@/components/admin/AdminMarketingDrafts"));
const AdminAiBusinessTools    = lazy(() => import("@/components/admin/AdminAiBusinessTools"));
const AdminCmoReports         = lazy(() => import("@/components/admin/AdminCmoReports"));
const AdminMediaVault         = lazy(() => import("@/components/admin/AdminMediaVault"));
const AdminSeoGenerator       = lazy(() => import("@/components/admin/AdminSeoGenerator"));
const AdminTrainingNewsletter = lazy(() => import("@/components/admin/AdminTrainingNewsletter"));
const AdminM2GrowthHub        = lazy(() => import("@/components/admin/AdminM2GrowthHub"));
const AdminAdCampaigns        = lazy(() => import("@/components/admin/AdminAdCampaigns"));
const AdminOutreach           = lazy(() => import("@/components/admin/AdminOutreach"));
const AdminSeoPages           = lazy(() => import("@/components/admin/AdminSeoPages"));
const AdminSearchConsole      = lazy(() => import("@/components/admin/AdminSearchConsole"));
const AdminGbpPosts           = lazy(() => import("@/components/admin/AdminGbpPosts"));
const AdminInstagramPosts     = lazy(() => import("@/components/admin/AdminInstagramPosts"));
const AdminContentGenerator   = lazy(() => import("@/components/admin/AdminContentGenerator"));

// Agency domain
const AdminWebDesignCRM       = lazy(() => import("@/components/admin/AdminWebDesignCRM"));
const AdminAgencyCRM          = lazy(() => import("@/components/admin/AdminAgencyCRM"));
const AdminDemoLinkGenerator  = lazy(() => import("@/components/admin/AdminDemoLinkGenerator"));
const AdminProspector         = lazy(() => import("@/components/admin/AdminProspector"));
const AdminAutomationHub      = lazy(() => import("@/components/admin/AdminAutomationHub"));
const AdminSiteBuilder        = lazy(() => import("@/components/admin/AdminSiteBuilder"));
const AdminWebDesignAutomations = lazy(() => import("@/components/admin/AdminWebDesignAutomations"));

// Command Deck (quick actions)
const AdminCommandDeck        = lazy(() => import("@/components/admin/AdminCommandDeck"));

/* ── Domain definitions ─────────────────────────────────────────────────────── */
interface Tool {
  key: string;
  label: string;
  component: React.ReactNode;
  badge?: number;
}

interface Domain {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  desc: string;
  tools: Tool[];
}

/* ── Loader ─────────────────────────────────────────────────────────────────── */
const TabLoader = () => (
  <div className="flex justify-center py-12">
    <Loader2 size={20} className="text-primary animate-spin" />
  </div>
);

/* ── Main Admin Component ───────────────────────────────────────────────────── */
const Admin = () => {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [testEmailState, setTestEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { isAdmin, isLoading } = useIsAdmin();

  /* Cross-component navigation events */
  useEffect(() => {
    const handleNavigateAdmin = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        // Map old tab keys to new domain keys
        const domainMap: Record<string, string> = {
          command: "actions", business: "business", roster: "people",
          engine: "training", vault: "business", content: "marketing",
          growth: "marketing", webdesign: "agency", ai: "actions",
        };
        setActiveDomain(domainMap[detail] || detail);
        setActiveTool(null);
      }
    };
    window.addEventListener("navigate-admin", handleNavigateAdmin);
    return () => window.removeEventListener("navigate-admin", handleNavigateAdmin);
  }, []);

  /* ── Badge counts (30s polling) ──────────────────────────────────────────── */
  const { data: badges } = useQuery({
    queryKey: ["admin-badge-counts"],
    queryFn: async () => {
      const [aiQueue, support, drafts, posture, custom, liftVideos, proveIt, trash] = await Promise.all([
        supabase.from("ai_action_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("coach_ai_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("posture_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("custom_program_requests" as any).select("id", { count: "exact", head: true }).in("status", ["pending", "ready_for_review"]),
        supabase.from("lift_videos" as any).select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("pr_submissions" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("admin_trash" as any).select("id", { count: "exact", head: true }),
      ]);
      return {
        aiQueue: aiQueue.count ?? 0,
        support: support.count ?? 0,
        drafts: drafts.count ?? 0,
        posture: posture.count ?? 0,
        custom: custom.count ?? 0,
        liftVideos: liftVideos.count ?? 0,
        proveIt: proveIt.count ?? 0,
        trash: trash.count ?? 0,
      };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const b = badges ?? { aiQueue: 0, support: 0, drafts: 0, posture: 0, custom: 0, liftVideos: 0, proveIt: 0, trash: 0 };

  /* ── Domain definitions with all tools ──────────────────────────────────── */
  const domains: Domain[] = [
    {
      key: "training",
      label: "Training",
      icon: Dumbbell,
      color: "#f97316",
      desc: "Programs · Exercises · AI Generators · Recovery",
      tools: [
        { key: "log-lifts", label: "📊 Log Lifts", component: <AdminProgressLogger /> },
        { key: "programs", label: "Programs", component: <AdminPrograms /> },
        { key: "exercises", label: "Exercise Library", component: <AdminExerciseLibrary /> },
        { key: "image-matcher", label: "Image Matcher", component: <AdminImageMatcher /> },
        { key: "workouts", label: "Workouts", component: <AdminWorkoutInventory /> },
        { key: "ai-workouts", label: "⚡ AI Workouts", component: <AdminBatchGenerator /> },
        { key: "user-generated", label: "User Generated", component: <AdminUserGeneratedWorkouts /> },
        { key: "ai-exercises", label: "⚡ AI Exercises", component: <AdminExerciseGenerator /> },
        { key: "ai-programs", label: "⚡ AI Programs", component: <AdminProgramCreator /> },
        { key: "ai-queue", label: "AI Queue", component: <AdminAiQueue />, badge: b.aiQueue },
        { key: "ai-toolkit", label: "AI Toolkit", component: <AdminAiToolkit /> },
        { key: "recovery", label: "Recovery Map", component: <AdminRecoveryHeatmap /> },
        { key: "monthly", label: "Monthly Focus", component: <AdminMonthlyFocus /> },
        { key: "biomechanics", label: "Biomechanics", component: <AdminBiomechanics /> },
        { key: "coach-ai", label: "Coach AI", component: <AdminCoachAiQueue />, badge: b.drafts },
        { key: "custom-req", label: "Custom Requests", component: <AdminCustomRequests />, badge: b.custom },
        { key: "lift-videos", label: "Lift Videos", component: <AdminLiftVideoReview />, badge: b.liftVideos },
        { key: "prove-it", label: "Prove It", component: <AdminProveItReview />, badge: b.proveIt },
      ],
    },
    {
      key: "people",
      label: "People",
      icon: Users,
      color: "#3b82f6",
      desc: "Users · Support · Coaching · Families · Teams",
      tools: [
        { key: "athletes", label: "👥 All Users", component: <AdminClientList /> },
        { key: "activity", label: "Activity Feed", component: <UserActivityFeed /> },
        { key: "support", label: "Support", component: <AdminSupportCopilot />, badge: b.support },
        { key: "coaching", label: "Coach Review", component: (
          <div className="space-y-8">
            <AdminCoachInbox />
            <div className="border-t border-border pt-6"><AdminCoachDashboard /></div>
            <div className="border-t border-border pt-6"><AdminPostureRequests /></div>
            <div className="border-t border-border pt-6"><AdminVideoReview /></div>
          </div>
        ), badge: b.posture },
        { key: "messages", label: "Messages", component: <AdminDirectMessages /> },
        { key: "families", label: "Families", component: <AdminFamilyManager /> },
        { key: "teams", label: "🏟️ Teams", component: (
          <div className="space-y-8">
            <AdminTeamSandbox />
            <div className="border-t border-border pt-6"><AdminCoachManager /></div>
            <div className="border-t border-border pt-6"><AdminTeamRosters /></div>
          </div>
        )},
        { key: "parents", label: "Parent Hub", component: (
          <div className="space-y-8">
            <AdminParentInbox />
            <div className="border-t border-border pt-6"><AdminParentReports /></div>
          </div>
        )},
        { key: "onboarding", label: "Onboarding", component: (
          <div className="space-y-8">
            <AdminClientOnboarding />
            <div className="border-t border-border pt-6"><AdminTrialSettings /></div>
          </div>
        )},
        { key: "churn", label: "Churn Radar", component: <AdminChurnRadar /> },
        { key: "schedule", label: "Schedule", component: <AdminSchedule /> },
        { key: "vip", label: "VIP Access", component: <AdminVipAccess /> },
      ],
    },
    {
      key: "business",
      label: "Business",
      icon: DollarSign,
      color: "#22c55e",
      desc: "Revenue · Orders · Ops · Billing · Legal",
      tools: [
        { key: "overview", label: "📊 Overview", component: <AdminBusinessDashboard /> },
        { key: "fulfillment", label: "🔔 Fulfillment", component: <AdminFulfillment /> },
        { key: "orders", label: "📦 Orders", component: <AdminOrders /> },
        { key: "ops", label: "Ops Center", component: <AdminOpsCenter /> },
        { key: "health", label: "Client Health", component: <AdminClientHealth /> },
        { key: "revenue", label: "Revenue & Ledger", component: <AdminFinancials /> },
        { key: "promotions", label: "Promotions", component: <AdminPromotions /> },
        { key: "points", label: "Points", component: <AdminPointsManager /> },
        { key: "tiers", label: "Tier Access", component: <AdminTierManager /> },
        { key: "stripe", label: "Stripe Products", component: <AdminStripeProducts /> },
        { key: "catalog", label: "Service Catalog", component: <AdminServiceCatalog /> },
        { key: "gift-cards", label: "Gift Cards", component: <AdminGiftCards /> },
        { key: "guides", label: "Playbooks Store", component: <AdminGuideStore /> },
        { key: "affiliates", label: "Affiliates", component: <AdminAffiliateManager /> },
        { key: "referrals", label: "Referrals", component: <AdminReferrals /> },
        { key: "pipeline", label: "B2B Pipeline", component: <AdminB2BPipeline /> },
        { key: "social-setup", label: "Social Setup", component: <AdminSocialMediaOnboarding /> },
        { key: "legal", label: "Legal", component: <AdminLegalCompliance /> },
        { key: "sandbox", label: "🧪 Sandbox", component: <AdminSandbox /> },
        { key: "email-log", label: "📧 Email Log", component: <AdminEmailLog /> },
        { key: "system", label: "System & Refs", component: <AdminSystemSettings /> },
        { key: "migrations", label: "DB Migrations", component: <AdminMigrations /> },
        { key: "trash", label: "🗑 Trash", component: <AdminTrash />, badge: b.trash },
      ],
    },
    {
      key: "marketing",
      label: "Marketing",
      icon: Megaphone,
      color: "#a855f7",
      desc: "Content · SEO · Email · Social · Growth",
      tools: [
        { key: "m2-hub", label: "🚀 Growth Hub", component: <AdminM2GrowthHub /> },
        { key: "ad-campaigns", label: "⚡ Ad Campaigns", component: <AdminAdCampaigns /> },
        { key: "front-page", label: "Front Page", component: <AdminFrontPage /> },
        { key: "site", label: "Site Editor", component: <AdminSiteEditor /> },
        { key: "testimonials", label: "Testimonials", component: <AdminTestimonials /> },
        { key: "learn", label: "Learn Hub", component: <AdminLearnEditor /> },
        { key: "broadcasts", label: "Broadcasts", component: <AdminBroadcasts /> },
        { key: "subscribers", label: "Subscribers", component: <AdminSubscriberList /> },
        { key: "compose", label: "Newsletter", component: <AdminNewsletterComposer /> },
        { key: "training-newsletter", label: "Training Newsletter", component: <AdminTrainingNewsletter /> },
        { key: "history", label: "Send History", component: <AdminSendHistory /> },
        { key: "marketing-ai", label: "Marketing AI", component: (
          <div className="space-y-8">
            <AdminMarketingDrafts />
            <div className="border-t border-border pt-6"><AdminAiBusinessTools /></div>
          </div>
        )},
        { key: "cmo", label: "CMO Reports", component: <AdminCmoReports /> },
        { key: "media-vault", label: "Media Vault", component: <AdminMediaVault /> },
        { key: "seo", label: "SEO Engine", component: <AdminSeoGenerator /> },
        { key: "outreach", label: "Outreach", component: <AdminOutreach /> },
        { key: "seo-pages", label: "SEO Pages", component: <AdminSeoPages /> },
        { key: "search", label: "📊 Search Console", component: <AdminSearchConsole /> },
        { key: "gbp", label: "GBP Posts", component: <AdminGbpPosts /> },
        { key: "instagram", label: "Instagram", component: <AdminInstagramPosts /> },
        { key: "content-gen", label: "Content Generator", component: <AdminContentGenerator /> },
      ],
    },
    {
      key: "agency",
      label: "Agency",
      icon: Globe,
      color: "#06b6d4",
      desc: "Web Design · CRM · Prospecting · Demos",
      tools: [
        { key: "agency-crm", label: "Agency CRM", component: <AdminAgencyCRM /> },
        { key: "crm", label: "Web Design CRM", component: <AdminWebDesignCRM /> },
        { key: "site-builder", label: "Site Builder", component: <AdminSiteBuilder /> },
        { key: "prospector", label: "Prospector", component: <AdminProspector /> },
        { key: "automation", label: "Automation Hub", component: <AdminAutomationHub /> },
        { key: "wd-automations", label: "Email Automations", component: <AdminWebDesignAutomations /> },
        { key: "demo-links", label: "🔗 Demo Links", component: <AdminDemoLinkGenerator /> },
      ],
    },
  ];

  const totalBadge = (d: Domain) => d.tools.reduce((sum, t) => sum + (t.badge ?? 0), 0);

  const sendTestEmail = async () => {
    setTestEmailState("sending");
    try {
      const { error } = await supabase.functions.invoke("send-test-email");
      setTestEmailState(error ? "error" : "sent");
      setTimeout(() => setTestEmailState("idle"), 5000);
    } catch {
      setTestEmailState("error");
      setTimeout(() => setTestEmailState("idle"), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const currentDomain = domains.find((d) => d.key === activeDomain);
  const currentTool = currentDomain?.tools.find((t) => t.key === activeTool);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <div className="container pt-20 pb-24 md:pb-12 max-w-4xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {(activeDomain || activeTool) && (
              <button
                onClick={() => {
                  if (activeTool) { setActiveTool(null); }
                  else { setActiveDomain(null); }
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <ArrowLeft size={14} className="text-muted-foreground" />
              </button>
            )}
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                {activeTool && currentTool ? currentTool.label :
                 activeDomain && currentDomain ? currentDomain.label :
                 "Mission Control"}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {activeTool ? `${currentDomain?.label} → ${currentTool?.label}` :
                 activeDomain ? currentDomain?.desc :
                 "Oz is watching. Everything is running."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm" variant="ghost"
              onClick={sendTestEmail}
              disabled={testEmailState === "sending"}
              className="text-[10px] text-muted-foreground h-7 px-2"
            >
              {testEmailState === "sending" && <Loader2 size={10} className="animate-spin mr-1" />}
              {testEmailState === "sent" && <CheckCircle size={10} className="text-green-400 mr-1" />}
              {testEmailState === "error" && <AlertTriangle size={10} className="text-red-400 mr-1" />}
              {testEmailState === "idle" && <Mail size={10} className="mr-1" />}
              {testEmailState === "idle" ? "Test" : testEmailState === "sending" ? "…" : testEmailState === "sent" ? "✓" : "✗"}
            </Button>
          </div>
        </div>

        {/* ── AI Bar (always visible) ────────────────────────────────────── */}
        <div className="mb-6">
          <Suspense fallback={<div className="h-12 rounded-2xl bg-muted/10 animate-pulse" />}>
            <AdminAiBar />
          </Suspense>
        </div>

        {/* ── Content Area ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* === HOME: Domain cards === */}
          {!activeDomain && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Quick Actions card */}
              <button
                onClick={() => { setActiveDomain("actions"); setActiveTool(null); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.04))",
                  border: "1px solid rgba(249,115,22,0.2)",
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.15)" }}>
                  <Zap size={22} style={{ color: "#f97316" }} />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm font-bold text-foreground">Quick Actions</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Fire automations · Power tools · System controls</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>

              {/* Domain cards */}
              {domains.map((d) => {
                const Icon = d.icon;
                const badge = totalBadge(d);
                return (
                  <button
                    key={d.key}
                    onClick={() => { setActiveDomain(d.key); setActiveTool(null); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl transition active:scale-[0.98]"
                    style={{
                      background: `${d.color}08`,
                      border: `1px solid ${d.color}20`,
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${d.color}15` }}>
                      <Icon size={22} style={{ color: d.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{d.label}</span>
                        {badge > 0 && (
                          <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-4">{badge}</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{d.desc}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[9px] text-muted-foreground">{d.tools.length} tools</span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </button>
                );
              })}

              {/* Oz Status */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(34,197,94,0.05)",
                  border: "1px solid rgba(34,197,94,0.15)",
                }}
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Agent Oz — Online</span>
                  <p className="text-[9px] text-muted-foreground">Monitoring all systems · Auto-fixing issues · Generating reports</p>
                </div>
                <Activity size={14} className="text-green-500/50 shrink-0" />
              </div>
            </motion.div>
          )}

          {/* === QUICK ACTIONS (CommandDeck) === */}
          {activeDomain === "actions" && !activeTool && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<TabLoader />}>
                <AdminCommandDeck />
              </Suspense>
            </motion.div>
          )}

          {/* === DOMAIN DRILL-DOWN: Tool list === */}
          {activeDomain && activeDomain !== "actions" && !activeTool && currentDomain && (
            <motion.div
              key={`domain-${activeDomain}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {currentDomain.tools.map((tool) => (
                <button
                  key={tool.key}
                  onClick={() => setActiveTool(tool.key)}
                  className="relative flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left transition active:scale-[0.97]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-xs font-semibold text-foreground leading-tight">{tool.label}</span>
                  {(tool.badge ?? 0) > 0 && (
                    <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-3.5 absolute top-2 right-2">
                      {tool.badge}
                    </Badge>
                  )}
                </button>
              ))}
            </motion.div>
          )}

          {/* === TOOL VIEW === */}
          {activeTool && currentTool && (
            <motion.div
              key={`tool-${activeTool}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<TabLoader />}>
                {currentTool.component}
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Admin;
