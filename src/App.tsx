import { lazy, Suspense, useState, useEffect, memo } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
// Defer toast providers — only triggered on user action, not needed for FCP
const Sonner = lazyRetry(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const Toaster = lazyRetry(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TimerProvider, useTimer } from "@/hooks/useTimer";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
const ProtectedRoute = lazyRetry(() => import("@/components/layout/ProtectedRoute"));
const SubscriptionGuard = lazyRetry(() => import("@/components/billing/SubscriptionGuard"));
import ScrollToTop from "@/components/layout/ScrollToTop";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
const OfflineBadge = lazyRetry(() => import("@/components/layout/OfflineBadge"));
import SplashScreen from "@/components/layout/SplashScreen";
import { useAuth } from "@/hooks/useAuth";
import { useReferralCapture } from "@/hooks/useReferral";
import { safeLocalStorage } from "@/lib/browserStorage";

// CSS-only spinner — avoids pulling lucide-react into the entry chunk

// Retry wrapper for lazy imports — retries up to 3 times on chunk load failure
function lazyRetry(importFn: () => Promise<any>, retries = 3): ReturnType<typeof lazy> {
  return lazy(() =>
    importFn().catch((err: Error) => {
      if (retries > 0 && /loading chunk|failed to fetch|dynamically imported module|import|loading css chunk|load failed|typeerror.*module/i.test(err.message)) {
        return new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
          lazyRetry(importFn, retries - 1) as any
        );
      }
      throw err;
    })
  );
}

const AnnouncementBanner = lazyRetry(() => import("@/components/layout/AnnouncementBanner"));

const ActiveWorkoutZone = lazyRetry(() => import("@/components/workout/ActiveWorkoutZone"));
const ProveItZone = lazyRetry(() => import("@/components/workout/ProveItZone"));

const BottomTabBar = lazyRetry(() => import("@/components/layout/BottomTabBar"));

// Lazy-load ALL pages including Index for faster initial JS parse
const Index = lazyRetry(() => import("./pages/Index"));

const Coach = lazyRetry(() => import("./pages/Coach"));
const Shop = lazyRetry(() => import("./pages/Shop"));
const ForParents = lazyRetry(() => import("./pages/ForParents"));
const Welcome = lazyRetry(() => import("./pages/Welcome"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const Admin = lazyRetry(() => import("./pages/Admin"));
const Pricing = lazyRetry(() => import("./pages/Pricing"));
const About = lazyRetry(() => import("./pages/About"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const Schedule = lazyRetry(() => import("./pages/Schedule"));
const Progress = lazyRetry(() => import("./pages/Progress"));
const Merch = lazyRetry(() => import("./pages/Merch"));
const Learn = lazyRetry(() => import("./pages/Learn"));
const TrialWelcome = lazyRetry(() => import("./pages/TrialWelcome"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Install = lazyRetry(() => import("./pages/Install"));
const Nutrition = lazyRetry(() => import("./pages/Nutrition"));
const TheEdge = lazyRetry(() => import("./pages/TheEdge"));
const MatrixEasterEgg = lazyRetry(() => import("./pages/MatrixEasterEgg"));
const MatrixMerch = lazyRetry(() => import("./pages/MatrixMerch"));
const FreeAiGenerator = lazyRetry(() => import("./pages/FreeAiGenerator"));
const SEOLandingPage = lazyRetry(() => import("./pages/SEOLandingPage"));
const DynamicSitemap = lazyRetry(() => import("./pages/DynamicSitemap"));
const Assessment = lazyRetry(() => import("./pages/Assessment"));
const BusinessDirectory = lazyRetry(() => import("./pages/BusinessDirectory"));
const WebDesignAgency = lazyRetry(() => import("./pages/WebDesignAgency"));
const HvacMockup = lazyRetry(() => import("./pages/HvacMockup"));
const RestaurantMockup = lazyRetry(() => import("./pages/RestaurantMockup"));
const LandscapeMockup = lazyRetry(() => import("./pages/LandscapeMockup"));
const PlumberMockup = lazyRetry(() => import("./pages/PlumberMockup"));
const ElectricianMockup = lazyRetry(() => import("./pages/ElectricianMockup"));
const LawyerMockup = lazyRetry(() => import("./pages/LawyerMockup"));
const ClinicMockup = lazyRetry(() => import("./pages/ClinicMockup"));
const RoofingMockup = lazyRetry(() => import("./pages/RoofingMockup"));
const YoungbloodMockup = lazyRetry(() => import("./pages/YoungbloodMockup"));
const DentalMockup = lazyRetry(() => import("./pages/DentalMockup"));
const WebDesignIncluded = lazyRetry(() => import("./pages/WebDesignIncluded"));
const AutoRepairMockup = lazyRetry(() => import("./pages/AutoRepairMockup"));
const RealEstateMockup = lazyRetry(() => import("./pages/RealEstateMockup"));
const CleaningServiceMockup = lazyRetry(() => import("./pages/CleaningServiceMockup"));
const SalonMockup = lazyRetry(() => import("./pages/SalonMockup"));
const WebDesignServices = lazyRetry(() => import("./pages/WebDesignServices"));
const ReferWebDesign = lazyRetry(() => import("./pages/ReferWebDesign"));
const ClientPortal = lazyRetry(() => import("./pages/ClientPortal"));
const ClientSite = lazyRetry(() => import("./pages/ClientSite"));
const ContractorSeoPage = lazyRetry(() => import("./pages/ContractorSeoPage"));
const FreeProgram = lazyRetry(() => import("./pages/FreeProgram"));
const AdminViewUser = lazyRetry(() => import("./pages/AdminViewUser"));
const StudioRental = lazyRetry(() => import("./pages/StudioRental"));
const Results = lazyRetry(() => import("./pages/Results"));
const DemoHomepage = lazyRetry(() => import("./pages/DemoHomepage"));
const ZonePortal = lazyRetry(() => import("./pages/ZonePortal"));
const ZoneDashboard = lazyRetry(() => import("./pages/ZoneDashboard"));
const AiInsights = lazyRetry(() => import("./pages/AiInsights"));
const LocalBusinessScore = lazyRetry(() => import("./pages/LocalBusinessScore"));
const NewsletterSubscribe = lazyRetry(() => import("./pages/NewsletterSubscribe"));
const GiftCard = lazyRetry(() => import("./pages/GiftCard"));
const GuideStore = lazyRetry(() => import("./pages/GuideStore"));
const NutritionPlanGenerator = lazyRetry(() => import("./pages/NutritionPlanGenerator"));
const AffiliateDashboard = lazyRetry(() => import("./pages/AffiliateDashboard"));
const SeoPackage = lazyRetry(() => import("./pages/SeoPackage"));
const AuditReport = lazyRetry(() => import("./pages/AuditReport"));
const GbpManagement = lazyRetry(() => import("./pages/GbpManagement"));
const NewsletterSponsor = lazyRetry(() => import("./pages/NewsletterSponsor"));
const CampDirectory = lazyRetry(() => import("./pages/CampDirectory"));
const ContractorLeads = lazyRetry(() => import("./pages/ContractorLeads"));
const LeadCapturePage = lazyRetry(() => import("./pages/LeadCapturePage"));
const B2BLeads = lazyRetry(() => import("./pages/B2BLeads"));
const IndustrialDatabase = lazyRetry(() => import("./pages/IndustrialDatabase"));
const LinkedInGhostwriting = lazyRetry(() => import("./pages/LinkedInGhostwriting"));
const RevenueDashboard = lazyRetry(() => import("./pages/RevenueDashboard"));
const MicroSaasToolPage = lazyRetry(() => import("./pages/MicroSaasToolPage"));
const LocalMarketing = lazyRetry(() => import("./pages/LocalMarketing"));
const FieldRepTools = lazyRetry(() => import("./pages/FieldRepTools"));
const NewsletterPage = lazyRetry(() => import("./pages/NewsletterPage"));
const ManufacturingWebDesign = lazyRetry(() => import("./pages/ManufacturingWebDesign"));
const RealEstateWebDesign = lazyRetry(() => import("./pages/RealEstateWebDesign"));
const SocialMediaAI = lazyRetry(() => import("./pages/SocialMediaAI"));
const TrainerSocialAI = lazyRetry(() => import("./pages/TrainerSocialAI"));
const GetStarted = lazyRetry(() => import("./pages/GetStarted"));
const SocialConnect = lazyRetry(() => import("./pages/SocialConnect"));
const ReviewResponder = lazyRetry(() => import("./pages/ReviewResponder"));
const SeoAuditService = lazyRetry(() => import("./pages/SeoAuditService"));
const ContractorChatbot = lazyRetry(() => import("./pages/ContractorChatbot"));
const IndustrialNewsletter = lazyRetry(() => import("./pages/IndustrialNewsletter"));
const MissedCallSaaS = lazyRetry(() => import("./pages/MissedCallSaaS"));
const B2BPartnerPortal = lazyRetry(() => import("./pages/B2BPartnerPortal"));
const AINewsletterService = lazyRetry(() => import("./pages/AINewsletterService"));
const FreeTrendingProducts = lazyRetry(() => import("./pages/FreeTrendingProducts"));
const FreeGrantDigest = lazyRetry(() => import("./pages/FreeGrantDigest"));
const FreeRealEstateDigest = lazyRetry(() => import("./pages/FreeRealEstateDigest"));
const AIMedSpaMarketing = lazyRetry(() => import("./pages/AIMedSpaMarketing"));
const AIRealEstateDrip = lazyRetry(() => import("./pages/AIRealEstateDrip"));
const AIPodcastShowNotes = lazyRetry(() => import("./pages/AIPodcastShowNotes"));
const AIChurchNewsletter = lazyRetry(() => import("./pages/AIChurchNewsletter"));
const AIPropertyManagement = lazyRetry(() => import("./pages/AIPropertyManagement"));
const AIFranchiseOps = lazyRetry(() => import("./pages/AIFranchiseOps"));
const AIEcommerceListings = lazyRetry(() => import("./pages/AIEcommerceListings"));
const AIFinancialAdvisorContent = lazyRetry(() => import("./pages/AIFinancialAdvisorContent"));
const AIVetMarketing = lazyRetry(() => import("./pages/AIVetMarketing"));
const AITruckingDocs = lazyRetry(() => import("./pages/AITruckingDocs"));
const AIAdsCopyGenerator = lazyRetry(() => import("./pages/AIAdsCopyGenerator"));
const AIJobPostingWriter = lazyRetry(() => import("./pages/AIJobPostingWriter"));
const AIReputationDashboard = lazyRetry(() => import("./pages/AIReputationDashboard"));
const ContractorInvoicing = lazyRetry(() => import("./pages/ContractorInvoicing"));
const AIVoicemailTranscription = lazyRetry(() => import("./pages/AIVoicemailTranscription"));
const AIPhoneAnswering = lazyRetry(() => import("./pages/AIPhoneAnswering"));
const TextMessageMarketing = lazyRetry(() => import("./pages/TextMessageMarketing"));
const AIBlogPostService = lazyRetry(() => import("./pages/AIBlogPostService"));
const ReviewRequestSMS = lazyRetry(() => import("./pages/ReviewRequestSMS"));
const AIPressRelease = lazyRetry(() => import("./pages/AIPressRelease"));
const QuoteFollowupSMS = lazyRetry(() => import("./pages/QuoteFollowupSMS"));
const AISocialCaptionPack = lazyRetry(() => import("./pages/AISocialCaptionPack"));
const WinBackSMS = lazyRetry(() => import("./pages/WinBackSMS"));
const WeeklyBusinessDigest = lazyRetry(() => import("./pages/WeeklyBusinessDigest"));
const AIProposalGenerator = lazyRetry(() => import("./pages/AIProposalGenerator"));
const HolidaySMSBlast = lazyRetry(() => import("./pages/HolidaySMSBlast"));
const AIWebsiteCopy = lazyRetry(() => import("./pages/AIWebsiteCopy"));
const CompetitorWatch = lazyRetry(() => import("./pages/CompetitorWatch"));
const AppointmentReminders = lazyRetry(() => import("./pages/AppointmentReminders"));
const AIVideoScripts = lazyRetry(() => import("./pages/AIVideoScripts"));
const SatisfactionSurvey = lazyRetry(() => import("./pages/SatisfactionSurvey"));
const ThankYouSMS = lazyRetry(() => import("./pages/ThankYouSMS"));
const AIEstimateGenerator = lazyRetry(() => import("./pages/AIEstimateGenerator"));
const LocalSEOPages = lazyRetry(() => import("./pages/LocalSEOPages"));
const PaymentChaser = lazyRetry(() => import("./pages/PaymentChaser"));
const GoogleQAManager = lazyRetry(() => import("./pages/GoogleQAManager"));
const StaffNewsletter = lazyRetry(() => import("./pages/StaffNewsletter"));
const SpeedToLead = lazyRetry(() => import("./pages/SpeedToLead"));
const WelcomeDrip = lazyRetry(() => import("./pages/WelcomeDrip"));
const ReviewAlerts = lazyRetry(() => import("./pages/ReviewAlerts"));
const PromoPlanner = lazyRetry(() => import("./pages/PromoPlanner"));
const ReactivationEmails = lazyRetry(() => import("./pages/ReactivationEmails"));
const SalesScripts = lazyRetry(() => import("./pages/SalesScripts"));
const DirectMail = lazyRetry(() => import("./pages/DirectMail"));
const WarrantyReminders = lazyRetry(() => import("./pages/WarrantyReminders"));
const HiringAssistant = lazyRetry(() => import("./pages/HiringAssistant"));
const KPIEmail = lazyRetry(() => import("./pages/KPIEmail"));
const AllServices = lazyRetry(() => import("./pages/AllServices"));
const ReferralPage = lazyRetry(() => import("./pages/ReferralPage"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyRetry(() => import("./pages/TermsOfService"));
const AIOnboardingAgent = lazyRetry(() => import("./pages/AIOnboardingAgent"));
const AISocialProof = lazyRetry(() => import("./pages/AISocialProof"));
const AIPriceMonitor = lazyRetry(() => import("./pages/AIPriceMonitor"));
const AIMeetingPrep = lazyRetry(() => import("./pages/AIMeetingPrep"));
const AIDirectorySubmitter = lazyRetry(() => import("./pages/AIDirectorySubmitter"));
const M2Development = lazyRetry(() => import("./pages/M2Development"));
const AIHandbook = lazyRetry(() => import("./pages/AIHandbook"));
const AIGrantFinder = lazyRetry(() => import("./pages/AIGrantFinder"));
const AIReviewResponse = lazyRetry(() => import("./pages/AIReviewResponse"));
const AIBattlecard = lazyRetry(() => import("./pages/AIBattlecard"));
const AIMarketIntel = lazyRetry(() => import("./pages/AIMarketIntel"));
const AIPermitMonitor = lazyRetry(() => import("./pages/AIPermitMonitor"));
const AIOshaCompliance = lazyRetry(() => import("./pages/AIOshaCompliance"));
const AICollections = lazyRetry(() => import("./pages/AICollections"));
const AIInventoryAlerts = lazyRetry(() => import("./pages/AIInventoryAlerts"));
const AIBirthdayCampaign = lazyRetry(() => import("./pages/AIBirthdayCampaign"));
const LinkedInOutreach = lazyRetry(() => import("./pages/LinkedInOutreach"));
const AbandonedCartRecovery = lazyRetry(() => import("./pages/AbandonedCartRecovery"));
const ClientReportGenerator = lazyRetry(() => import("./pages/ClientReportGenerator"));
const RestaurantMenuCopy = lazyRetry(() => import("./pages/RestaurantMenuCopy"));
const InsuranceFollowUpDrip = lazyRetry(() => import("./pages/InsuranceFollowUpDrip"));
const PodcastPitchService = lazyRetry(() => import("./pages/PodcastPitchService"));
const TradeShowFollowUp = lazyRetry(() => import("./pages/TradeShowFollowUp"));
const TestimonialHarvester = lazyRetry(() => import("./pages/TestimonialHarvester"));
const NewMoverMarketing = lazyRetry(() => import("./pages/NewMoverMarketing"));
const AnnualBusinessReview = lazyRetry(() => import("./pages/AnnualBusinessReview"));
const LegalPage = lazyRetry(() => import("./pages/LegalPage"));
const CookieBanner = lazyRetry(() => import("./components/layout/CookieBanner"));
const LegalFooterLazy = lazyRetry(() => import("./components/layout/LegalFooter"));
const PartnerProgram = lazyRetry(() => import("./pages/PartnerProgram"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000, // 24h — keep in cache for offline
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const persister = createSyncStoragePersister({
  storage: safeLocalStorage,
  key: "m2-query-cache",
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);


const ActiveWorkoutWrapper = () => {
  const { user } = useAuth();
  const { setPortalActive } = useTimer();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneContext, setZoneContext] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || null;
      setZoneContext(detail);
      setZoneOpen(true);
    };
    const resumeHandler = () => {
      const saved = safeLocalStorage.getItem("m2-paused-workout");
      if (saved) {
        try {
          setZoneContext(JSON.parse(saved));
          setZoneOpen(true);
        } catch {}
      }
    };
    window.addEventListener("open-workout-zone", handler);
    window.addEventListener("resume-workout-zone", resumeHandler);
    return () => {
      window.removeEventListener("open-workout-zone", handler);
      window.removeEventListener("resume-workout-zone", resumeHandler);
    };
  }, []);

  if (!user || !zoneOpen) return null;
  return (
    <Suspense fallback={null}>
      <ActiveWorkoutZone
        initialContext={zoneContext}
        onFinish={() => {
          setZoneOpen(false);
          setZoneContext(null);
          setPortalActive(false);
          safeLocalStorage.removeItem("m2-paused-workout");
        }}
        onPause={() => { setZoneOpen(false); setPortalActive(false); }}
      />
    </Suspense>
  );
};

const ReferralCaptureWrapper = () => {
  useReferralCapture();
  return null;
};

const ProveItWrapper = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-prove-it-zone", handler);
    return () => window.removeEventListener("open-prove-it-zone", handler);
  }, []);

  if (!user || !open) return null;
  return (
    <Suspense fallback={null}>
      <ProveItZone onClose={() => setOpen(false)} />
    </Suspense>
  );
};


const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 60 * 60_000 }}>
    <SplashScreen />
    <AuthProvider>
      <TimerProvider>
        <OfflineSyncProvider>
          <TooltipProvider>
            <Suspense fallback={null}><Toaster /></Suspense>
            <Suspense fallback={null}><Sonner /></Suspense>
            <BrowserRouter>
              <ReferralCaptureWrapper />
              <ScrollToTop />
              <Suspense fallback={null}><AnnouncementBanner /></Suspense>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <div className="pb-16">
                    <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/login" element={<Navigate to="/auth" replace />} />
                    <Route path="/signin" element={<Navigate to="/auth" replace />} />
                    <Route path="/~oauth" element={<Auth />} />
                    <Route path="/~oauth/*" element={<Auth />} />
                    <Route path="/auth/callback" element={<Auth />} />
                    <Route path="/auth/callback/*" element={<Auth />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/for-parents" element={<ForParents />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/merch" element={<Merch />} />
                    <Route path="/learn" element={<Learn />} />
                    <Route path="/the-edge" element={<TheEdge />} />
                    <Route path="/matrix" element={<MatrixEasterEgg />} />
                    <Route path="/matrix-training" element={<MatrixEasterEgg />} />
                    <Route path="/matrix-merch" element={<MatrixMerch />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/free-ai-generator" element={<FreeAiGenerator />} />
                    <Route path="/training/:slug" element={<SEOLandingPage />} />
                    <Route path="/services/:slug" element={<ContractorSeoPage />} />
                    <Route path="/sitemap.xml" element={<DynamicSitemap />} />
                    <Route path="/detroit-web-design" element={<WebDesignAgency />} />
                    <Route path="/demo-landscaping" element={<LandscapeMockup />} />
                    <Route path="/demo-landscaping/*" element={<LandscapeMockup />} />
                    <Route path="/demo-plumber" element={<PlumberMockup />} />
                    <Route path="/demo-plumber/*" element={<PlumberMockup />} />
                    <Route path="/demo-electrician" element={<ElectricianMockup />} />
                    <Route path="/demo-electrician/*" element={<ElectricianMockup />} />
                    <Route path="/demo-lawyer" element={<LawyerMockup />} />
                    <Route path="/demo-lawyer/*" element={<LawyerMockup />} />
                    <Route path="/demo-clinic" element={<ClinicMockup />} />
                    <Route path="/demo-clinic/*" element={<ClinicMockup />} />
                    <Route path="/demo-roofing" element={<RoofingMockup />} />
                    <Route path="/demo-roofing/*" element={<RoofingMockup />} />
                    <Route path="/demo-youngblood" element={<YoungbloodMockup />} />
                    <Route path="/demo-youngblood/*" element={<YoungbloodMockup />} />
                    <Route path="/demo-dental" element={<DentalMockup />} />
                    <Route path="/demo-dental/*" element={<DentalMockup />} />
                    <Route path="/demo-hvac" element={<HvacMockup />} />
                    <Route path="/demo-hvac/*" element={<HvacMockup />} />
                    <Route path="/demo-restaurant" element={<RestaurantMockup />} />
                    <Route path="/demo-restaurant/*" element={<RestaurantMockup />} />
                    <Route path="/whats-included" element={<WebDesignIncluded />} />
                    <Route path="/web-design-services" element={<WebDesignServices />} />
                    <Route path="/refer-web-design" element={<ReferWebDesign />} />
                    <Route path="/demo-auto-repair" element={<AutoRepairMockup />} />
                    <Route path="/demo-auto-repair/*" element={<AutoRepairMockup />} />
                    <Route path="/demo-real-estate" element={<RealEstateMockup />} />
                    <Route path="/demo-real-estate/*" element={<RealEstateMockup />} />
                    <Route path="/demo-cleaning" element={<CleaningServiceMockup />} />
                    <Route path="/demo-cleaning/*" element={<CleaningServiceMockup />} />
                    <Route path="/demo-salon" element={<SalonMockup />} />
                    <Route path="/demo-salon/*" element={<SalonMockup />} />
                    <Route path="/local-business-score" element={<LocalBusinessScore />} />
                    <Route path="/newsletter" element={<NewsletterSubscribe />} />
                    <Route path="/gift" element={<GiftCard />} />
                    <Route path="/guides" element={<GuideStore />} />
                    <Route path="/nutrition-plan" element={<NutritionPlanGenerator />} />
                    <Route path="/affiliate" element={<AffiliateDashboard />} />
                    <Route path="/seo-package" element={<SeoPackage />} />
                    <Route path="/audit-report" element={<AuditReport />} />
                    <Route path="/gbp-management" element={<GbpManagement />} />
                    <Route path="/sponsor" element={<NewsletterSponsor />} />
                    <Route path="/contractor-leads" element={<ContractorLeads />} />
                    <Route path="/leads/:slug" element={<LeadCapturePage />} />
                    <Route path="/b2b-leads" element={<B2BLeads />} />
                    <Route path="/industrial-database" element={<IndustrialDatabase />} />
                    <Route path="/linkedin-ghostwriting" element={<LinkedInGhostwriting />} />
                    <Route path="/revenue-dashboard" element={<RevenueDashboard />} />
                    <Route path="/local-marketing" element={<LocalMarketing />} />
                    <Route path="/field-rep-tools" element={<FieldRepTools />} />
                    <Route path="/field-rep-weekly" element={<NewsletterPage />} />
                    <Route path="/manufacturing-web-design" element={<ManufacturingWebDesign />} />
                    <Route path="/real-estate-web-design" element={<RealEstateWebDesign />} />
                    <Route path="/social-media-ai" element={<SocialMediaAI />} />
                    <Route path="/trainer-social-ai" element={<TrainerSocialAI />} />
                    <Route path="/get-started" element={<GetStarted />} />
                    <Route path="/social-connect" element={<SocialConnect />} />
                    <Route path="/review-responder" element={<ReviewResponder />} />
                    <Route path="/seo-reports" element={<SeoAuditService />} />
                    <Route path="/contractor-chatbot" element={<ContractorChatbot />} />
                    <Route path="/industrial-newsletter" element={<IndustrialNewsletter />} />
                    <Route path="/missed-call-text" element={<MissedCallSaaS />} />
                    <Route path="/ai-newsletter-service" element={<AINewsletterService />} />
                    <Route path="/free-trending-products" element={<FreeTrendingProducts />} />
                    <Route path="/free-grant-digest" element={<FreeGrantDigest />} />
                    <Route path="/free-real-estate-digest" element={<FreeRealEstateDigest />} />
                    <Route path="/ai-med-spa-marketing" element={<AIMedSpaMarketing />} />
                    <Route path="/ai-real-estate-drip" element={<AIRealEstateDrip />} />
                    <Route path="/ai-podcast-show-notes" element={<AIPodcastShowNotes />} />
                    <Route path="/ai-church-newsletter" element={<AIChurchNewsletter />} />
                    <Route path="/ai-property-management" element={<AIPropertyManagement />} />
                    <Route path="/ai-franchise-ops" element={<AIFranchiseOps />} />
                    <Route path="/ai-ecommerce-listings" element={<AIEcommerceListings />} />
                    <Route path="/ai-financial-advisor-content" element={<AIFinancialAdvisorContent />} />
                    <Route path="/ai-vet-marketing" element={<AIVetMarketing />} />
                    <Route path="/ai-trucking-docs" element={<AITruckingDocs />} />
                    <Route path="/ai-ads-copy" element={<AIAdsCopyGenerator />} />
                    <Route path="/ai-job-postings" element={<AIJobPostingWriter />} />
                    <Route path="/ai-reputation" element={<AIReputationDashboard />} />
                    <Route path="/contractor-invoicing" element={<ContractorInvoicing />} />
                    <Route path="/ai-voicemail" element={<AIVoicemailTranscription />} />
                    <Route path="/ai-phone-answering" element={<AIPhoneAnswering />} />
                    <Route path="/text-message-marketing" element={<TextMessageMarketing />} />
                    <Route path="/ai-blog-posts" element={<AIBlogPostService />} />
                    <Route path="/review-request-sms" element={<ReviewRequestSMS />} />
                    <Route path="/ai-press-release" element={<AIPressRelease />} />
                    <Route path="/quote-followup-sms" element={<QuoteFollowupSMS />} />
                    <Route path="/ai-social-captions" element={<AISocialCaptionPack />} />
                    <Route path="/winback-sms" element={<WinBackSMS />} />
                    <Route path="/weekly-business-digest" element={<WeeklyBusinessDigest />} />
                    <Route path="/ai-proposal" element={<AIProposalGenerator />} />
                    <Route path="/holiday-sms" element={<HolidaySMSBlast />} />
                    <Route path="/ai-website-copy" element={<AIWebsiteCopy />} />
                    <Route path="/competitor-watch" element={<CompetitorWatch />} />
                    <Route path="/appointment-reminders" element={<AppointmentReminders />} />
                    <Route path="/ai-video-scripts" element={<AIVideoScripts />} />
                    <Route path="/satisfaction-survey" element={<SatisfactionSurvey />} />
                    <Route path="/thank-you-sms" element={<ThankYouSMS />} />
                    <Route path="/ai-estimates" element={<AIEstimateGenerator />} />
                    <Route path="/local-seo-pages" element={<LocalSEOPages />} />
                    <Route path="/payment-chaser" element={<PaymentChaser />} />
                    <Route path="/google-qa" element={<GoogleQAManager />} />
                    <Route path="/staff-newsletter" element={<StaffNewsletter />} />
                    <Route path="/speed-to-lead" element={<SpeedToLead />} />
                    <Route path="/welcome-drip" element={<WelcomeDrip />} />
                    <Route path="/review-alerts" element={<ReviewAlerts />} />
                    <Route path="/promo-planner" element={<PromoPlanner />} />
                    <Route path="/reactivation-emails" element={<ReactivationEmails />} />
                    <Route path="/sales-scripts" element={<SalesScripts />} />
                    <Route path="/direct-mail" element={<DirectMail />} />
                    <Route path="/warranty-reminders" element={<WarrantyReminders />} />
                    <Route path="/hiring-assistant" element={<HiringAssistant />} />
                    <Route path="/kpi-email" element={<KPIEmail />} />
                    <Route path="/all-services" element={<AllServices />} />
                    <Route path="/refer" element={<ReferralPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/ai-onboarding-agent" element={<AIOnboardingAgent />} />
                    <Route path="/ai-social-proof" element={<AISocialProof />} />
                    <Route path="/ai-price-monitor" element={<AIPriceMonitor />} />
                    <Route path="/ai-meeting-prep" element={<AIMeetingPrep />} />
                    <Route path="/ai-directory-submitter" element={<AIDirectorySubmitter />} />
                    <Route path="/m2-development" element={<M2Development />} />
                    <Route path="/business-directory" element={<BusinessDirectory />} />
                    <Route path="/ai-handbook" element={<AIHandbook />} />
                    <Route path="/ai-grant-finder" element={<AIGrantFinder />} />
                    <Route path="/ai-review-response" element={<AIReviewResponse />} />
                    <Route path="/ai-battlecard" element={<AIBattlecard />} />
                    <Route path="/ai-market-intel" element={<AIMarketIntel />} />
                    <Route path="/ai-permit-monitor" element={<AIPermitMonitor />} />
                    <Route path="/ai-osha-compliance" element={<AIOshaCompliance />} />
                    <Route path="/ai-collections" element={<AICollections />} />
                    <Route path="/ai-inventory-alerts" element={<AIInventoryAlerts />} />
                    <Route path="/ai-birthday-campaign" element={<AIBirthdayCampaign />} />
                    <Route path="/linkedin-outreach" element={<LinkedInOutreach />} />
                    <Route path="/abandoned-cart-recovery" element={<AbandonedCartRecovery />} />
                    <Route path="/client-report-generator" element={<ClientReportGenerator />} />
                    <Route path="/restaurant-menu-copy" element={<RestaurantMenuCopy />} />
                    <Route path="/insurance-follow-up-drip" element={<InsuranceFollowUpDrip />} />
                    <Route path="/podcast-pitch-service" element={<PodcastPitchService />} />
                    <Route path="/trade-show-follow-up" element={<TradeShowFollowUp />} />
                    <Route path="/testimonial-harvester" element={<TestimonialHarvester />} />
                    <Route path="/new-mover-marketing" element={<NewMoverMarketing />} />
                    <Route path="/annual-business-review" element={<AnnualBusinessReview />} />
                    <Route path="/tools/:slug" element={<MicroSaasToolPage />} />
                    <Route path="/legal/:type" element={<LegalPage />} />
                    <Route path="/partner-program" element={<PartnerProgram />} />
                    <Route path="/partners" element={<B2BPartnerPortal />} />
                    <Route path="/sports-camps" element={<CampDirectory />} />
                    <Route path="/free-program" element={<FreeProgram />} />
                    <Route path="/studio-rental" element={<StudioRental />} />
                    <Route path="/results" element={<Results />} />
                    <Route path="/demo-home" element={<DemoHomepage />} />
                    <Route path="/zone" element={<ZonePortal />} />
                    <Route path="/client-portal" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
                    <Route path="/site/:slug" element={<ClientSite />} />
                    <Route path="/zone-dashboard" element={<ProtectedRoute><ZoneDashboard /></ProtectedRoute>} />
                    <Route path="/coach" element={<ProtectedRoute><SubscriptionGuard><Coach /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/trial-welcome" element={<ProtectedRoute><TrialWelcome /></ProtectedRoute>} />
                    <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                    <Route path="/admin/view-user/:userId" element={<ProtectedRoute><AdminViewUser /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><SubscriptionGuard><ZoneDashboard /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/ai-insights" element={<ProtectedRoute><SubscriptionGuard><AiInsights /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><SubscriptionGuard><Profile /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/progress" element={<ProtectedRoute><SubscriptionGuard><Progress /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/nutrition" element={<ProtectedRoute><SubscriptionGuard><Nutrition /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </Suspense>
              </ErrorBoundary>
              
              <ActiveWorkoutWrapper />
              <ProveItWrapper />
              
              
              <Suspense fallback={null}><LegalFooterLazy /></Suspense>
              <Suspense fallback={null}><CookieBanner /></Suspense>
              <Suspense fallback={null}><BottomTabBar /></Suspense>
              <Suspense fallback={null}><OfflineBadge /></Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </OfflineSyncProvider>
      </TimerProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
