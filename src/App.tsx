import { Suspense, useState, useEffect, memo } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { queryClient } from "@/lib/queryClient";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";
import { getDomainBrand } from "@/lib/domainConfig";
// Defer toast providers — only triggered on user action, not needed for FCP
const Sonner = lazyRetry(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const Toaster = lazyRetry(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TimerProvider, useTimer } from "@/hooks/useTimer";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
const ProtectedRoute = lazyRetry(() => import("@/components/layout/ProtectedRoute"));
const SubscriptionGuard = lazyRetry(() => import("@/components/billing/SubscriptionGuard"));
const BlurGate = lazyRetry(() => import("@/components/layout/BlurGate"));
import ScrollToTop from "@/components/layout/ScrollToTop";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
const OfflineBadge = lazyRetry(() => import("@/components/layout/OfflineBadge"));
import SplashScreen from "@/components/layout/SplashScreen";
import { useAuth } from "@/hooks/useAuth";
import { useReferralCapture } from "@/hooks/useReferral";
import { safeLocalStorage } from "@/lib/browserStorage";

// CSS-only spinner — avoids pulling lucide-react into the entry chunk

const AnnouncementBanner = lazyRetry(() => import("@/components/layout/AnnouncementBanner"));

const ActiveWorkoutZone = lazyRetry(() => import("@/components/workout/ActiveWorkoutZone"));
const ProveItZone = lazyRetry(() => import("@/components/workout/ProveItZone"));

const BottomTabBar = lazyRetry(() => import("@/components/layout/BottomTabBar"));

// Lazy-load ALL pages including Index for faster initial JS parse
const Index = lazyRetry(() => import("./pages/Index"));
const AgencyHome = lazyRetry(() => import("./pages/AgencyHome"));
const OwnerLogin = lazyRetry(() => import("./pages/OwnerLogin"));
const OwnerVerify = lazyRetry(() => import("./pages/OwnerVerify"));
const OwnerDashboard = lazyRetry(() => import("./pages/OwnerDashboard"));
const ClientDashboard = lazyRetry(() => import("./pages/ClientDashboard"));
const AgencyClientPortal = lazyRetry(() => import("./pages/AgencyClientPortal"));
const EmbedCapture = lazyRetry(() => import("./pages/EmbedCapture"));
const AgencyAdminRoute = lazyRetry(() => import("./components/layout/AgencyAdminRoute"));
const AdminHealth = lazyRetry(() => import("./pages/AdminHealth"));
const ClientRoute = lazyRetry(() => import("./components/layout/ClientRoute"));
const FreeSiteScanner = lazyRetry(() => import("./pages/FreeSiteScanner"));
const FreeToolsHub = lazyRetry(() => import("./pages/FreeToolsHub"));
const FreeSeoHealth = lazyRetry(() => import("./pages/FreeSeoHealth"));
const FreeBreachScanner = lazyRetry(() => import("./pages/FreeBreachScanner"));
const FreeRankChecker = lazyRetry(() => import("./pages/FreeRankChecker"));
const FreeMetaAnalyzer = lazyRetry(() => import("./pages/FreeMetaAnalyzer"));
const FreeLeakyBucketAudit = lazyRetry(() => import("./pages/FreeLeakyBucketAudit"));
const FreeMedicareStaffingCheck = lazyRetry(() => import("./pages/FreeMedicareStaffingCheck"));
const FreeLocalSearchAudit = lazyRetry(() => import("./pages/FreeLocalSearchAudit"));
const FreeServiceGapScanner = lazyRetry(() => import("./pages/FreeServiceGapScanner"));
const FreeAdaScanner = lazyRetry(() => import("./pages/FreeAdaScanner"));
const FreeOshaCheck = lazyRetry(() => import("./pages/FreeOshaCheck"));
const FreeEquipmentAgeCheck = lazyRetry(() => import("./pages/FreeEquipmentAgeCheck"));
const FreeNursingComplianceCheck = lazyRetry(() => import("./pages/FreeNursingComplianceCheck"));
const ClientCommandCenter = lazyRetry(() => import("./pages/ClientCommandCenter"));
const ComputerRepair = lazyRetry(() => import("./pages/ComputerRepair"));

const Coach = lazyRetry(() => import("./pages/Coach"));
const CoachHub = lazyRetry(() => import("./pages/CoachHub"));
const MyTeam = lazyRetry(() => import("./pages/MyTeam"));
const JoinTeam = lazyRetry(() => import("./pages/JoinTeam"));
const Shop = lazyRetry(() => import("./pages/Shop"));
const ForParents = lazyRetry(() => import("./pages/ForParents"));
const ForNurses = lazyRetry(() => import("./pages/ForNurses"));
const Welcome = lazyRetry(() => import("./pages/Welcome"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const Admin = lazyRetry(() => import("./pages/Admin"));
const DWAAdmin = lazyRetry(() => import("./pages/DWAAdmin"));
const OutreachAuditLog = lazyRetry(() => import("./pages/admin/OutreachAuditLog"));
const OutreachQueuePage = lazyRetry(() => import("./pages/admin/OutreachQueue"));
const OutreachObservabilityPage = lazyRetry(() => import("./pages/admin/OutreachObservability"));
const Wave5Dashboard = lazyRetry(() => import("./pages/admin/Wave5Dashboard"));
const AuditTimeline = lazyRetry(() => import("./pages/admin/AuditTimeline"));
const Quarantine = lazyRetry(() => import("./pages/admin/Quarantine"));
const AdminEdgeHealth = lazyRetry(() => import("./pages/admin/AdminEdgeHealth"));
const AdminSecretsHealth = lazyRetry(() => import("./pages/admin/AdminSecretsHealth"));
const AdminMarketTargeting = lazyRetry(() => import("./pages/admin/AdminMarketTargeting"));
const AdminProspectorTargetsAudit = lazyRetry(() => import("./pages/admin/AdminProspectorTargetsAudit"));
const AdminCheckoutEvents = lazyRetry(() => import("./pages/admin/AdminCheckoutEvents"));
const DwaAdminV4 = lazyRetry(() => import("./pages/DwaAdminV4"));
const DwaAdminStripeReconcile = lazyRetry(() => import("./pages/DwaAdminStripeReconcile"));
const DwaAdminQbrQueue = lazyRetry(() => import("./pages/DwaAdminQbrQueue"));
const MyAddons = lazyRetry(() => import("./pages/MyAddons"));
const CommercialRoofingDetroit = lazyRetry(() => import("./pages/CommercialRoofingDetroit"));
const ProspectRedirect = lazyRetry(() => import("./pages/ProspectRedirect"));
const Pricing = lazyRetry(() => import("./pages/Pricing"));
const About = lazyRetry(() => import("./pages/About"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const Schedule = lazyRetry(() => import("./pages/Schedule"));
const Progress = lazyRetry(() => import("./pages/Progress"));
const Merch = lazyRetry(() => import("./pages/Merch"));
const Learn = lazyRetry(() => import("./pages/Learn"));
const TrialWelcome = lazyRetry(() => import("./pages/TrialWelcome"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Unsubscribe = lazyRetry(() => import("./pages/Unsubscribe"));
const Changelog = lazyRetry(() => import("./pages/Changelog"));
const PredictiveSales = lazyRetry(() => import("./pages/PredictiveSales"));
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
const PetfectionDemo = lazyRetry(() => import("./pages/PetfectionDemo"));
const YoungbloodMockup = lazyRetry(() => import("./pages/YoungbloodMockup"));
const DentalMockup = lazyRetry(() => import("./pages/DentalMockup"));
const ProposalStewartDental = lazyRetry(() => import("./pages/ProposalStewartDental"));
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
const GrowthRadarDashboard = lazyRetry(() => import("./pages/GrowthRadarDashboard"));
const GetDossier = lazyRetry(() => import("./pages/GetDossier"));
const ContractorROIReport = lazyRetry(() => import("./pages/ContractorROIReport"));
const MyContractorLeads = lazyRetry(() => import("./pages/MyContractorLeads"));
const DeadLeadStats = lazyRetry(() => import("./pages/DeadLeadStats"));
const MyTechAlert = lazyRetry(() => import("./pages/MyTechAlert"));
const DeadLeadIntake = lazyRetry(() => import("./pages/DeadLeadIntake"));
const DeadLeadsRoofingTexas = lazyRetry(() => import("./pages/DeadLeadsRoofingTexas"));
const DeadLeadsHvacFlorida = lazyRetry(() => import("./pages/DeadLeadsHvacFlorida"));
const DeadLeadsRoofingFlorida = lazyRetry(() => import("./pages/DeadLeadsRoofingFlorida"));
const HireTradeCity = lazyRetry(() => import("./pages/HireTradeCity"));
const CandidateJobBoard = lazyRetry(() => import("./pages/CandidateJobBoard"));
const MortgageRadarDemo = lazyRetry(() => import("./pages/MortgageRadarDemo"));
const TechAlertVsIndeed = lazyRetry(() => import("./pages/TechAlertVsIndeed"));
const MortgageRadarVsZillow = lazyRetry(() => import("./pages/MortgageRadarVsZillow"));
const DeadLeadsVsHomeAdvisor = lazyRetry(() => import("./pages/DeadLeadsVsHomeAdvisor"));
const HireTradePage = lazyRetry(() => import("./pages/HireTradePage"));
const ContractorOnboardingStatus = lazyRetry(() => import("./pages/ContractorOnboardingStatus"));
const ContractorQuoteLanding = lazyRetry(() => import("./pages/ContractorQuoteLanding"));
const ContractorTrustDashboard = lazyRetry(() => import("./pages/ContractorTrustDashboard"));
const TheWire = lazyRetry(() => import("./pages/TheWire"));
const PostcardLanding = lazyRetry(() => import("./pages/PostcardLanding"));
const GetQuote = lazyRetry(() => import("./pages/GetQuote"));
const ContractorTerritory = lazyRetry(() => import("./pages/ContractorTerritory"));
const ContractorMarketplace = lazyRetry(() => import("./pages/ContractorMarketplace"));
const ClaimLead = lazyRetry(() => import("./pages/ClaimLead"));
const LeadUnlocked = lazyRetry(() => import("./pages/LeadUnlocked"));
const LeadClaimed = lazyRetry(() => import("./pages/LeadClaimed"));
const FieldServiceManagement = lazyRetry(() => import("./pages/FieldServiceManagement"));
const FieldServiceDispatch = lazyRetry(() => import("./pages/FieldServiceDispatch"));
const FieldDeskDemo = lazyRetry(() => import("./pages/FieldDeskDemo"));
const FieldServiceTechApp = lazyRetry(() => import("./pages/FieldServiceTechApp"));
const FieldServiceIndustry = lazyRetry(() => import("./pages/FieldServiceIndustry"));
const JobStatusPage = lazyRetry(() => import("./pages/JobStatusPage"));
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
const DentalWebDesign = lazyRetry(() => import("./pages/DentalWebDesign"));
const LegalWebDesign = lazyRetry(() => import("./pages/LegalWebDesign"));
const HealthcareWebDesign = lazyRetry(() => import("./pages/HealthcareWebDesign"));
const RestaurantWebDesign = lazyRetry(() => import("./pages/RestaurantWebDesign"));
const RestaurantSMS = lazyRetry(() => import("./pages/RestaurantSMS"));
const SocialMediaAI = lazyRetry(() => import("./pages/SocialMediaAI"));
const TrainerSocialAI = lazyRetry(() => import("./pages/TrainerSocialAI"));
const GetStarted = lazyRetry(() => import("./pages/GetStarted"));
const SocialConnect = lazyRetry(() => import("./pages/SocialConnect"));
const ReviewResponder = lazyRetry(() => import("./pages/ReviewResponder"));
const ReviewMonitor = lazyRetry(() => import("./pages/ReviewMonitor"));
const WeeklySMSBlast = lazyRetry(() => import("./pages/WeeklySMSBlast"));
const NoShowRebooker = lazyRetry(() => import("./pages/NoShowRebooker"));
const EstimateFollowup = lazyRetry(() => import("./pages/EstimateFollowup"));
const InvoiceChaser = lazyRetry(() => import("./pages/InvoiceChaser"));
const AfterJobFollowup = lazyRetry(() => import("./pages/AfterJobFollowup"));
const SeasonalPromos = lazyRetry(() => import("./pages/SeasonalPromos"));
const ReferralProgram = lazyRetry(() => import("./pages/ReferralProgram"));
const SlowDaySMS = lazyRetry(() => import("./pages/SlowDaySMS"));
const NewHomeownerCampaign = lazyRetry(() => import("./pages/NewHomeownerCampaign"));
const HOASecretary = lazyRetry(() => import("./pages/HOASecretary"));
const HOAMinutesTemplate = lazyRetry(() => import("./pages/HOAMinutesTemplate"));
const HOAMeetingMinutes = lazyRetry(() => import("./pages/blog/HOAMeetingMinutes"));
const HOAViolation = lazyRetry(() => import("./pages/HOAViolation"));
const RFPAlerts = lazyRetry(() => import("./pages/RFPAlerts"));
const FranchiseAnalyzer = lazyRetry(() => import("./pages/FranchiseAnalyzer"));
const InsuranceDrip = lazyRetry(() => import("./pages/InsuranceDrip"));
const STRReputation = lazyRetry(() => import("./pages/STRReputation"));
const GrantDiscovery = lazyRetry(() => import("./pages/GrantDiscovery"));
const AgPriceAlerts = lazyRetry(() => import("./pages/AgPriceAlerts"));
const LandlordLetters = lazyRetry(() => import("./pages/LandlordLetters"));
const RegulatoryMonitor = lazyRetry(() => import("./pages/RegulatoryMonitor"));
const TradeShowAutomation = lazyRetry(() => import("./pages/TradeShowAutomation"));
const PriceIntelligence = lazyRetry(() => import("./pages/PriceIntelligence"));
const CitationMonitor = lazyRetry(() => import("./pages/CitationMonitor"));
const MenuEngineering = lazyRetry(() => import("./pages/MenuEngineering"));
const FitnessReports = lazyRetry(() => import("./pages/FitnessReports"));
const GovMeetingTracker = lazyRetry(() => import("./pages/GovMeetingTracker"));
const SeoAuditService = lazyRetry(() => import("./pages/SeoAuditService"));
const ContractorChatbot = lazyRetry(() => import("./pages/ContractorChatbot"));
const IndustrialNewsletter = lazyRetry(() => import("./pages/IndustrialNewsletter"));
const MissedCallSaaS = lazyRetry(() => import("./pages/MissedCallSaaS"));
const MissedCallSetup = lazyRetry(() => import("./pages/MissedCallSetup"));
const B2BPartnerPortal = lazyRetry(() => import("./pages/B2BPartnerPortal"));
// AINewsletterService — DELISTED (orphan, no live checkout). File preserved at src/pages/AINewsletterService.tsx
const FreeTrendingProducts = lazyRetry(() => import("./pages/FreeTrendingProducts"));
const FreeGrantDigest = lazyRetry(() => import("./pages/FreeGrantDigest"));
const FreeRealEstateDigest = lazyRetry(() => import("./pages/FreeRealEstateDigest"));
// AIMedSpaMarketing, AIRealEstateDrip, AIPodcastShowNotes, AIChurchNewsletter, AIPropertyManagement,
// AIFranchiseOps, AIEcommerceListings, AIFinancialAdvisorContent, AIVetMarketing, AITruckingDocs,
// AIJobPostingWriter — DELISTED (orphans, waitlist-only). Files preserved in src/pages/.
const AIAdsCopyGenerator = lazyRetry(() => import("./pages/AIAdsCopyGenerator"));
const AIReputationDashboard = lazyRetry(() => import("./pages/AIReputationDashboard"));
const ContractorInvoicing = lazyRetry(() => import("./pages/ContractorInvoicing"));
// AIVoicemailTranscription — DELISTED. File preserved.
const AIPhoneAnswering = lazyRetry(() => import("./pages/AIPhoneAnswering"));
const TextMessageMarketing = lazyRetry(() => import("./pages/TextMessageMarketing"));
const ReviewRequestSMS = lazyRetry(() => import("./pages/ReviewRequestSMS"));
const QuoteFollowupSMS = lazyRetry(() => import("./pages/QuoteFollowupSMS"));
const WinBackSMS = lazyRetry(() => import("./pages/WinBackSMS"));
const WeeklyBusinessDigest = lazyRetry(() => import("./pages/WeeklyBusinessDigest"));
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
const DirectMail = lazyRetry(() => import("./pages/DirectMail"));
const WarrantyReminders = lazyRetry(() => import("./pages/WarrantyReminders"));
const HiringAssistant = lazyRetry(() => import("./pages/HiringAssistant"));
const KPIEmail = lazyRetry(() => import("./pages/KPIEmail"));
const AllServices = lazyRetry(() => import("./pages/AllServices"));
const ReferralPage = lazyRetry(() => import("./pages/ReferralPage"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyRetry(() => import("./pages/TermsOfService"));
// AIOnboardingAgent, AISocialProof, AIPriceMonitor, AIMeetingPrep, AIDirectorySubmitter — DELISTED. Files preserved.
const M2Development = lazyRetry(() => import("./pages/M2Development"));
// AIHandbook, AIGrantFinder, AIBattlecard, AIMarketIntel, AIPermitMonitor, AIOshaCompliance — DELISTED. Files preserved.
const DarkWebMonitor = lazyRetry(() => import("./pages/DarkWebMonitor"));
const DarkWebDashboard = lazyRetry(() => import("./pages/DarkWebDashboard"));
// AICollections, AIInventoryAlerts, AIBirthdayCampaign — DELISTED. Files preserved.
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
const PodcastRevenueMachine = lazyRetry(() => import("./pages/PodcastRevenueMachine"));
const PodcastDashboard = lazyRetry(() => import("./pages/PodcastDashboard"));
const StormDamageLeads = lazyRetry(() => import("./pages/StormDamageLeads"));
const RecallAlertService = lazyRetry(() => import("./pages/RecallAlertService"));
const PermitWatch = lazyRetry(() => import("./pages/PermitWatch"));
const HireAlert = lazyRetry(() => import("./pages/HireAlert"));
const BuyerRadarPreview = lazyRetry(() => import("./pages/BuyerRadarPreview"));
const DemandRadarPreview = lazyRetry(() => import("./pages/DemandRadarPreview"));
const HireAlertMSPInquiry = lazyRetry(() => import("./pages/HireAlertMSPInquiry"));

const FreeLeadsQR = lazyRetry(() => import("./pages/FreeLeadsQR"));
const HireAlertTrial = lazyRetry(() => import("./pages/HireAlertTrial"));
const HealthcareHireAlert = lazyRetry(() => import("./pages/HealthcareHireAlert"));
const WebsiteSpeedAudits = lazyRetry(() => import("./pages/WebsiteSpeedAudits"));
const CrimeDigest = lazyRetry(() => import("./pages/CrimeDigest"));
const IndustryPulse = lazyRetry(() => import("./pages/IndustryPulse"));
const IndustrialPulse = lazyRetry(() => import("./pages/IndustrialPulse"));
const GrowthSignalsLanding = lazyRetry(() => import("./pages/GrowthSignalsLanding"));
const MyIndustryPulse = lazyRetry(() => import("./pages/MyIndustryPulse"));
const DemandRadar = lazyRetry(() => import("./pages/DemandRadar"));
const TalentRadarVsStaffing = lazyRetry(() => import("./pages/TalentRadarVsStaffing"));
const FieldDeskVsEway = lazyRetry(() => import("./pages/FieldDeskVsEway"));
const MarketingLayerForEway = lazyRetry(() => import("./pages/MarketingLayerForEway"));
const FieldDeskMigration = lazyRetry(() => import("./pages/FieldDeskMigration"));
const HealthcareStaffingMI = lazyRetry(() => import("./pages/HealthcareStaffingMI"));
const DwaReferContractor = lazyRetry(() => import("./pages/DwaReferContractor"));
const MortgageRadarVsTriggerLeads = lazyRetry(() => import("./pages/MortgageRadarVsTriggerLeads"));
const FsboHeatmap = lazyRetry(() => import("./pages/FsboHeatmap"));
const MortgageRadar = lazyRetry(() => import("./pages/MortgageRadar"));
const Marketplace = lazyRetry(() => import("./pages/Marketplace"));
const MarketplaceReceipts = lazyRetry(() => import("./pages/MarketplaceReceipts"));
const LeadDetail = lazyRetry(() => import("./pages/LeadDetail"));
const SharedLead = lazyRetry(() => import("./pages/SharedLead"));
const MyMortgageRadar = lazyRetry(() => import("./pages/MyMortgageRadar"));
const MyMissedCall = lazyRetry(() => import("./pages/MyMissedCall"));
const MySiteRadar = lazyRetry(() => import("./pages/MySiteRadar"));
const SiteRadarLanding = lazyRetry(() => import("./pages/SiteRadarLanding"));
const BuyerRadar = lazyRetry(() => import("./pages/BuyerRadar"));
const MyBuyerRadar = lazyRetry(() => import("./pages/MyBuyerRadar"));
const BuyerRadarDemo = lazyRetry(() => import("./pages/BuyerRadarDemo"));
const BuyerRadarPricing = lazyRetry(() => import("./pages/BuyerRadarPricing"));
const HighVolumeBuyerAlerts = lazyRetry(() => import("./pages/HighVolumeBuyerAlerts"));
const StaffingAgency = lazyRetry(() => import("./pages/StaffingAgency"));

const RoofingRadar = lazyRetry(() => import("./pages/RoofingRadar"));
const RoofingRadarDemo = lazyRetry(() => import("./pages/RoofingRadarDemo"));
const HVACRadar = lazyRetry(() => import("./pages/HVACRadar"));
const HVACRadarDemo = lazyRetry(() => import("./pages/HVACRadarDemo"));
const PlumbingRadar = lazyRetry(() => import("./pages/PlumbingRadar"));
const PlumbingRadarDemo = lazyRetry(() => import("./pages/PlumbingRadarDemo"));
const ElectricalRadar = lazyRetry(() => import("./pages/ElectricalRadar"));
const ElectricalRadarDemo = lazyRetry(() => import("./pages/ElectricalRadarDemo"));
const PestControlRadar = lazyRetry(() => import("./pages/PestControlRadar"));
const PestControlRadarDemo = lazyRetry(() => import("./pages/PestControlRadarDemo"));
const GuttersRadar = lazyRetry(() => import("./pages/GuttersRadar"));
const GuttersRadarDemo = lazyRetry(() => import("./pages/GuttersRadarDemo"));
const PaintingRadar = lazyRetry(() => import("./pages/PaintingRadar"));
const PaintingRadarDemo = lazyRetry(() => import("./pages/PaintingRadarDemo"));
const MyRoofingRadar = lazyRetry(() => import("./pages/MyRoofingRadar"));
const MyHVACRadar = lazyRetry(() => import("./pages/MyHVACRadar"));
const MyPlumbingRadar = lazyRetry(() => import("./pages/MyPlumbingRadar"));
const MyElectricalRadar = lazyRetry(() => import("./pages/MyElectricalRadar"));
const MyPestControlRadar = lazyRetry(() => import("./pages/MyPestControlRadar"));
const MyGuttersRadar = lazyRetry(() => import("./pages/MyGuttersRadar"));
const MyPaintingRadar = lazyRetry(() => import("./pages/MyPaintingRadar"));

const AgencyPortal = lazyRetry(() => import("./pages/AgencyPortal"));
const LicenseMonitor = lazyRetry(() => import("./pages/LicenseMonitor"));
const RegulatoryFilingMonitor = lazyRetry(() => import("./pages/RegulatoryFilingMonitor"));
const BidIntelligence = lazyRetry(() => import("./pages/BidIntelligence"));
const CommercialLease = lazyRetry(() => import("./pages/CommercialLease"));
const PatentWatch = lazyRetry(() => import("./pages/PatentWatch"));
const PEIntelligence = lazyRetry(() => import("./pages/PEIntelligence"));
const RDIntelligence = lazyRetry(() => import("./pages/RDIntelligence"));
const CreditDispute = lazyRetry(() => import("./pages/CreditDispute"));
const MedicalBillDispute = lazyRetry(() => import("./pages/MedicalBillDispute"));
const SupplementAnalyzer = lazyRetry(() => import("./pages/SupplementAnalyzer"));
const TradeAssociationIntel = lazyRetry(() => import("./pages/TradeAssociationIntel"));
const LuxuryRealEstate = lazyRetry(() => import("./pages/LuxuryRealEstate"));
const TechSupportServices = lazyRetry(() => import("./pages/TechSupportServices"));
const RevenuePreventer = lazyRetry(() => import("./pages/RevenuePreventer"));
const BundleRevenueSuite = lazyRetry(() => import("./pages/BundleRevenueSuite"));
const SeoGuard = lazyRetry(() => import("./pages/SeoGuard"));
const FreeComplianceScan = lazyRetry(() => import("./pages/FreeComplianceScan"));
const FreeBidReport = lazyRetry(() => import("./pages/FreeBidReport"));
const LegalPage = lazyRetry(() => import("./pages/LegalPage"));
const CookieBanner = lazyRetry(() => import("./components/layout/CookieBanner"));
const LegalFooterLazy = lazyRetry(() => import("./components/layout/LegalFooter"));
const PartnerProgram = lazyRetry(() => import("./pages/PartnerProgram"));
const AiWebsiteAudit = lazyRetry(() => import("./pages/AiWebsiteAudit"));
const DigitalFoundation = lazyRetry(() => import("./pages/DigitalFoundation"));
const Portfolio = lazyRetry(() => import("./pages/Portfolio"));
const AdDigitalFoundation = lazyRetry(() => import("./pages/AdDigitalFoundation"));
const AdFreeAudit = lazyRetry(() => import("./pages/AdFreeAudit"));
const VisibilityScore = lazyRetry(() => import("./pages/VisibilityScore"));
const AiGbpPostPack = lazyRetry(() => import("./pages/AiGbpPostPack"));
const AiCompetitorReport = lazyRetry(() => import("./pages/AiCompetitorReport"));
const AdCompetitorReport = lazyRetry(() => import("./pages/AdCompetitorReport"));
const AdWebsiteAudit = lazyRetry(() => import("./pages/AdWebsiteAudit"));
const LabDomainBreach = lazyRetry(() => import("./pages/LabDomainBreach"));
const LabKeywordGap = lazyRetry(() => import("./pages/LabKeywordGap"));
const AdGbpPosts = lazyRetry(() => import("./pages/AdGbpPosts"));
const YoungbloodMockupAlt1 = lazyRetry(() => import("./pages/YoungbloodMockupAlt1"));
const YoungbloodMockupAlt2 = lazyRetry(() => import("./pages/YoungbloodMockupAlt2"));
const DentalMockupAlt1 = lazyRetry(() => import("./pages/DentalMockupAlt1"));
const DentalMockupAlt2 = lazyRetry(() => import("./pages/DentalMockupAlt2"));
const GovContractMonitor = lazyRetry(() => import("./pages/GovContractMonitor"));
const GovContractDashboard = lazyRetry(() => import("./pages/GovContractDashboard"));

const RegulatoryDashboard = lazyRetry(() => import("./pages/RegulatoryDashboard"));
const TrademarkWatch = lazyRetry(() => import("./pages/TrademarkWatch"));
const TrademarkDashboard = lazyRetry(() => import("./pages/TrademarkDashboard"));
const CompetitorPricing = lazyRetry(() => import("./pages/CompetitorPricing"));
const CompetitorPricingDashboard = lazyRetry(() => import("./pages/CompetitorPricingDashboard"));
const PetMemorial = lazyRetry(() => import("./pages/PetMemorial"));
const PetMemorialSuccess = lazyRetry(() => import("./pages/PetMemorial").then(m => ({ default: m.PetMemorialSuccess })));
const MemorialPage = lazyRetry(() => import("./pages/MemorialPage"));
const RealEstateNewsletter = lazyRetry(() => import("./pages/RealEstateNewsletter"));
const RealEstateDashboard = lazyRetry(() => import("./pages/RealEstateDashboard"));
const EmployeeCredentialAudit = lazyRetry(() => import("./pages/EmployeeCredentialAudit"));
const NewHireCheck = lazyRetry(() => import("./pages/NewHireCheck"));
const StewartDentalProduction = lazyRetry(() => import("./pages/StewartDentalProduction"));
const StewartDentalPrivacy = lazyRetry(() => import("./pages/StewartDentalPrivacy"));
const DJConleyDemo1 = lazyRetry(() => import("./pages/DJConleyDemo1"));
const DJConleyDemo2 = lazyRetry(() => import("./pages/DJConleyDemo2"));
const DemoTemplate = lazyRetry(() => import("./pages/DemoTemplate"));
const CommunicationsCenter = lazyRetry(() => import("./pages/CommunicationsCenter"));

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
                    <Route path="/" element={getDomainBrand() === "agency" ? <AgencyHome /> : <Index />} />
                    <Route path="/agency" element={<AgencyHome />} />
                    <Route path="/free-site-scanner" element={<FreeSiteScanner />} />
                    <Route path="/free-tools" element={<FreeToolsHub />} />
                    <Route path="/free-tools/seo-health" element={<FreeSeoHealth />} />
                    <Route path="/free-tools/breach-scan" element={<FreeBreachScanner />} />
                    <Route path="/free-tools/rank-check" element={<FreeRankChecker />} />
                    <Route path="/free-tools/meta-tags" element={<FreeMetaAnalyzer />} />
                    <Route path="/free-tools/leaky-bucket" element={<FreeLeakyBucketAudit />} />
                    <Route path="/free-tools/medicare-staffing" element={<FreeMedicareStaffingCheck />} />
                    <Route path="/free-tools/local-search" element={<FreeLocalSearchAudit />} />
                    <Route path="/free-tools/service-gap" element={<FreeServiceGapScanner />} />
                    <Route path="/free-tools/ada-scanner" element={<FreeAdaScanner />} />
                    <Route path="/free-tools/osha-check" element={<FreeOshaCheck />} />
                    <Route path="/free-tools/equipment-age" element={<FreeEquipmentAgeCheck />} />
                    <Route path="/free-tools/nursing-compliance" element={<FreeNursingComplianceCheck />} />
                    <Route path="/command-center" element={<ProtectedRoute><ClientCommandCenter /></ProtectedRoute>} />
                    <Route path="/computer-repair" element={<ComputerRepair />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route path="/changelog" element={<Changelog />} />
                    <Route path="/predictive-sales" element={<PredictiveSales />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/login" element={<Navigate to="/auth" replace />} />
                    <Route path="/signin" element={<Navigate to="/auth" replace />} />
                    <Route path="/~oauth" element={<Auth />} />
                    <Route path="/~oauth/*" element={<Auth />} />
                    <Route path="/auth/callback" element={<Auth />} />
                    <Route path="/auth/callback/*" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/for-parents" element={<ForParents />} />
                    <Route path="/for-nurses" element={<ForNurses />} />
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
                    <Route path="/proposal/stewart-dental" element={<ProposalStewartDental />} />
                    <Route path="/ai-website-audit" element={<AiWebsiteAudit />} />
                    <Route path="/digital-foundation" element={<DigitalFoundation />} />
                    <Route path="/portfolio" element={<Portfolio />} />
                    <Route path="/ad/digital-foundation" element={<AdDigitalFoundation />} />
                    <Route path="/ad/free-audit" element={<AdFreeAudit />} />
                    <Route path="/visibility-score" element={<VisibilityScore />} />
                    <Route path="/ai-gbp-post-pack" element={<AiGbpPostPack />} />
                    <Route path="/ai-competitor-report" element={<AiCompetitorReport />} />
                    <Route path="/ad/website-audit" element={<AdWebsiteAudit />} />
                    <Route path="/lab/domain-breach" element={<LabDomainBreach />} />
                    <Route path="/lab/keyword-gap" element={<LabKeywordGap />} />
                    <Route path="/ad/gbp-posts" element={<AdGbpPosts />} />
                    <Route path="/ad/competitor-report" element={<AdCompetitorReport />} />
                    <Route path="/demo-youngblood-alt1" element={<YoungbloodMockupAlt1 />} />
                    <Route path="/demo-youngblood-alt1/*" element={<YoungbloodMockupAlt1 />} />
                    <Route path="/demo-dental-alt1" element={<DentalMockupAlt1 />} />
                    <Route path="/demo-dental-alt1/*" element={<DentalMockupAlt1 />} />
                    <Route path="/stewart-dental" element={<StewartDentalProduction />} />
                    <Route path="/stewart-dental/privacy" element={<StewartDentalPrivacy />} />
                    <Route path="/demo-dental-alt2" element={<DentalMockupAlt2 />} />
                    <Route path="/demo-dental-alt2/*" element={<DentalMockupAlt2 />} />
                    <Route path="/demo-djconley-1" element={<DJConleyDemo1 />} />
                    <Route path="/demo-djconley-1/*" element={<DJConleyDemo1 />} />
                    <Route path="/demo-djconley-2" element={<DJConleyDemo2 />} />
                    <Route path="/demo/:slug" element={<DemoTemplate />} />
                    <Route path="/demo-youngblood-alt2" element={<YoungbloodMockupAlt2 />} />
                    <Route path="/demo-youngblood-alt2/*" element={<YoungbloodMockupAlt2 />} />
                    <Route path="/demo-hvac" element={<HvacMockup />} />
                    <Route path="/demo-hvac/*" element={<HvacMockup />} />
                    <Route path="/demo-restaurant" element={<RestaurantMockup />} />
                    <Route path="/demo-restaurant/*" element={<RestaurantMockup />} />
                    <Route path="/whats-included" element={<WebDesignIncluded />} />
                    <Route path="/web-design-services" element={<WebDesignServices />} />
                    <Route path="/web-design" element={<Navigate to="/web-design-services" replace />} />
                    <Route path="/refer-web-design" element={<ReferWebDesign />} />
                    <Route path="/demo-auto-repair" element={<AutoRepairMockup />} />
                    <Route path="/demo-auto-repair/*" element={<AutoRepairMockup />} />
                    <Route path="/demo-real-estate" element={<RealEstateMockup />} />
                    <Route path="/demo-real-estate/*" element={<RealEstateMockup />} />
                    <Route path="/demo-cleaning" element={<CleaningServiceMockup />} />
                    <Route path="/demo-cleaning/*" element={<CleaningServiceMockup />} />
                    <Route path="/demo-salon" element={<SalonMockup />} />
                    <Route path="/demo-salon/*" element={<SalonMockup />} />
                    <Route path="/demo-petfection" element={<PetfectionDemo />} />
                    <Route path="/demo-petfection/*" element={<PetfectionDemo />} />
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
                    <Route path="/roi" element={<ContractorROIReport />} />
                    <Route path="/my-contractor-leads" element={<MyContractorLeads />} />
                    <Route path="/dead-lead-stats" element={<DeadLeadStats />} />
                    <Route path="/my-techalert" element={<Navigate to="/talent-radar/dashboard" replace />} />
                    <Route path="/dead-lead-intake" element={<DeadLeadIntake />} />
                    <Route path="/dead-leads-roofing-texas" element={<DeadLeadsRoofingTexas />} />
                    <Route path="/dead-leads-hvac-florida" element={<DeadLeadsHvacFlorida />} />
                    <Route path="/dead-leads-roofing-florida" element={<DeadLeadsRoofingFlorida />} />
                    <Route path="/hire-:trade-in-:city" element={<HireTradeCity />} />
                    <Route path="/jobs" element={<CandidateJobBoard />} />
                    <Route path="/mortgage-radar-demo" element={<MortgageRadarDemo />} />
                    <Route path="/techalert-vs-indeed" element={<TechAlertVsIndeed />} />
                    <Route path="/mortgage-radar-vs-zillow-leads" element={<MortgageRadarVsZillow />} />
                    <Route path="/dead-leads-vs-homeadvisor" element={<DeadLeadsVsHomeAdvisor />} />
                    <Route path="/hire/:trade/:city" element={<HireTradePage />} />
                    <Route path="/contractor-onboarding-status" element={<ContractorOnboardingStatus />} />
                    <Route path="/quote/:trade/:city" element={<ContractorQuoteLanding />} />
                    <Route path="/contractor-portal/:token" element={<ContractorTrustDashboard />} />
                    <Route path="/postcard" element={<PostcardLanding />} />
                    <Route path="/the-wire" element={<TheWire />} />
                    <Route path="/get-quote/:trade/:city" element={<GetQuote />} />
                    <Route path="/get-quote/:trade" element={<GetQuote />} />
                    <Route path="/contractors/:slug" element={<ContractorTerritory />} />
                    <Route path="/claim-lead" element={<ClaimLead />} />
                    <Route path="/lead-unlocked" element={<LeadUnlocked />} />
                    <Route path="/lead-claimed" element={<LeadClaimed />} />
                    <Route path="/contractor-marketplace" element={<ContractorMarketplace />} />
                    <Route path="/field-service" element={<FieldServiceManagement />} />
                    <Route path="/field-service/dispatch" element={<FieldServiceDispatch />} />
                    <Route path="/fielddesk-demo" element={<FieldDeskDemo />} />
                    <Route path="/demo-fielddesk" element={<FieldDeskDemo />} />
                    <Route path="/field-service/tech" element={<FieldServiceTechApp />} />
                    <Route path="/field-service/:industry" element={<FieldServiceIndustry />} />
                    <Route path="/job-status" element={<JobStatusPage />} />
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
                    <Route path="/dental-web-design" element={<DentalWebDesign />} />
                    <Route path="/legal-web-design" element={<LegalWebDesign />} />
                    <Route path="/healthcare-web-design" element={<HealthcareWebDesign />} />
                    <Route path="/restaurant-web-design" element={<RestaurantWebDesign />} />
                    <Route path="/restaurant-sms" element={<RestaurantSMS />} />
                    <Route path="/social-media-ai" element={<SocialMediaAI />} />
                    <Route path="/trainer-social-ai" element={<TrainerSocialAI />} />
                    <Route path="/get-started" element={<GetStarted />} />
                    <Route path="/social-connect" element={<SocialConnect />} />
                    <Route path="/review-responder" element={<ReviewResponder />} />
                    <Route path="/seo-reports" element={<SeoAuditService />} />
                    <Route path="/contractor-chatbot" element={<ContractorChatbot />} />
                    <Route path="/industrial-newsletter" element={<IndustrialNewsletter />} />
                    <Route path="/missed-call-text" element={<MissedCallSaaS />} />
                    <Route path="/missed-call-catch" element={<MissedCallSaaS />} />
                    <Route path="/missed-call-text/:industry" element={<MissedCallSaaS />} />
                    <Route path="/missed-call-setup" element={<MissedCallSetup />} />
                    <Route path="/review-monitor" element={<ReviewMonitor />} />
                    <Route path="/weekly-sms-blast" element={<WeeklySMSBlast />} />
                    <Route path="/no-show-rebooker" element={<NoShowRebooker />} />
                    <Route path="/estimate-followup" element={<EstimateFollowup />} />
                    <Route path="/invoice-chaser" element={<InvoiceChaser />} />
                    <Route path="/after-job-followup" element={<AfterJobFollowup />} />
                    <Route path="/seasonal-promos" element={<SeasonalPromos />} />
                    <Route path="/referral-program" element={<ReferralProgram />} />
                    <Route path="/slow-day-sms" element={<SlowDaySMS />} />
                    <Route path="/new-homeowner-campaign" element={<NewHomeownerCampaign />} />
                    <Route path="/hoa-secretary" element={<HOASecretary />} />
                    <Route path="/hoa-minutes-template" element={<HOAMinutesTemplate />} />
                    <Route path="/blog/hoa-meeting-minutes" element={<HOAMeetingMinutes />} />
                    <Route path="/hoa-violation" element={<HOAViolation />} />
                    <Route path="/rfp-alerts" element={<RFPAlerts />} />
                    <Route path="/franchise-analyzer" element={<FranchiseAnalyzer />} />
                    <Route path="/insurance-drip" element={<InsuranceDrip />} />
                    <Route path="/str-reputation" element={<STRReputation />} />
                    <Route path="/grant-discovery" element={<GrantDiscovery />} />
                    <Route path="/ag-price-alerts" element={<AgPriceAlerts />} />
                    <Route path="/landlord-letters" element={<LandlordLetters />} />
                    <Route path="/regulatory-monitor" element={<RegulatoryMonitor />} />
                    <Route path="/trade-show-automation" element={<TradeShowAutomation />} />
                    <Route path="/price-intelligence" element={<PriceIntelligence />} />
                    <Route path="/citation-monitor" element={<CitationMonitor />} />
                    <Route path="/menu-engineering" element={<MenuEngineering />} />
                    <Route path="/fitness-reports" element={<FitnessReports />} />
                    <Route path="/gov-meeting-tracker" element={<GovMeetingTracker />} />
                    {/* Orphaned AI product routes delisted (waitlist-only, unlinked). Pages preserved on disk. */}
                    <Route path="/free-trending-products" element={<FreeTrendingProducts />} />
                    <Route path="/free-grant-digest" element={<FreeGrantDigest />} />
                    <Route path="/free-real-estate-digest" element={<FreeRealEstateDigest />} />
                    <Route path="/ai-ads-copy" element={<AIAdsCopyGenerator />} />
                    <Route path="/ai-reputation" element={<AIReputationDashboard />} />
                    <Route path="/contractor-invoicing" element={<ContractorInvoicing />} />
                    <Route path="/ai-phone-answering" element={<AIPhoneAnswering />} />
                    <Route path="/text-message-marketing" element={<TextMessageMarketing />} />
                    <Route path="/review-request-sms" element={<ReviewRequestSMS />} />
                    <Route path="/quote-followup-sms" element={<QuoteFollowupSMS />} />
                    <Route path="/winback-sms" element={<WinBackSMS />} />
                    <Route path="/weekly-business-digest" element={<WeeklyBusinessDigest />} />
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
                    <Route path="/direct-mail" element={<DirectMail />} />
                    <Route path="/warranty-reminders" element={<WarrantyReminders />} />
                    <Route path="/hiring-assistant" element={<HiringAssistant />} />
                    <Route path="/kpi-email" element={<KPIEmail />} />
                    <Route path="/all-services" element={<AllServices />} />
                    <Route path="/revenue-suite" element={<BundleRevenueSuite />} />
                    <Route path="/refer" element={<ReferralPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    {/* Orphaned AI product routes delisted. Pages preserved on disk. */}
                    <Route path="/m2-development" element={<M2Development />} />
                    <Route path="/business-directory" element={<BusinessDirectory />} />
                    <Route path="/dark-web-monitor" element={<DarkWebMonitor />} />
                    <Route path="/dark-web-monitor/dashboard" element={<ProtectedRoute><DarkWebDashboard /></ProtectedRoute>} />
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
                    <Route path="/podcast-revenue-machine" element={<PodcastRevenueMachine />} />
                    <Route path="/podcast-revenue-machine/dashboard" element={<ProtectedRoute><PodcastDashboard /></ProtectedRoute>} />
                    <Route path="/storm-leads" element={<StormDamageLeads />} />
                    <Route path="/recall-alerts" element={<RecallAlertService />} />
                    <Route path="/permit-watch" element={<PermitWatch />} />
                    {/* Talent Radar — canonical hiring intelligence brand */}
                    <Route path="/talent-radar" element={<HireAlert />} />
                    <Route path="/talent-radar/enterprise" element={<HireAlertMSPInquiry />} />
                    <Route path="/talent-radar/healthcare" element={<HealthcareHireAlert />} />
                    <Route path="/talent-radar/dashboard" element={<MyTechAlert />} />
                    <Route path="/talent-radar/trial" element={<HireAlertTrial />} />
                    {/* Legacy redirects → Talent Radar */}
                    <Route path="/hire-alert" element={<Navigate to="/talent-radar" replace />} />
                    <Route path="/hire-alert/enterprise" element={<Navigate to="/talent-radar/enterprise" replace />} />
                    <Route path="/hire-alert-healthcare" element={<Navigate to="/talent-radar/healthcare" replace />} />
                    <Route path="/hire-alert-trial" element={<Navigate to="/talent-radar/trial" replace />} />
                    <Route path="/talent-intelligence" element={<Navigate to="/talent-radar" replace />} />
                    <Route path="/go/techalert" element={<Navigate to="/talent-radar" replace />} />
                    <Route path="/radars" element={<Navigate to="/talent-radar" replace />} />
                    <Route path="/textback" element={<Navigate to="/missed-call-catch" replace />} />
                    {/* Golden Ticket Marketplace v2 — single-buyer leads à la carte */}
                    <Route path="/mortgage-leads" element={<Marketplace />} />
                    <Route path="/talent-leads" element={<Marketplace />} />
                    <Route path="/demand-leads" element={<Marketplace />} />
                    <Route path="/growth-leads" element={<Marketplace />} />
                    <Route path="/supply-leads" element={<Marketplace />} />
                    <Route path="/marketplace/receipts" element={<MarketplaceReceipts />} />
                    <Route path="/lead/share/:token" element={<SharedLead />} />
                    <Route path="/lead/:slug" element={<LeadDetail />} />
                    {/* Growth Radar (company-side intelligence — separate product) */}
                    <Route path="/growth-radar" element={<IndustryPulse />} />
                    <Route path="/growth-radar-dashboard" element={<GrowthRadarDashboard />} />
                    <Route path="/get-dossier" element={<GetDossier />} />
                    <Route path="/industry-pulse" element={<Navigate to="/growth-radar" replace />} />
                    <Route path="/industrial-pulse" element={<IndustrialPulse />} />
                    <Route path="/growth-signals" element={<GrowthSignalsLanding />} />
                    <Route path="/my-industry-pulse" element={<MyIndustryPulse />} />
                    <Route path="/lead-radar" element={<ContractorLeads />} />
                    <Route path="/free-leads" element={<FreeLeadsQR />} />
                    <Route path="/website-speed-audit" element={<WebsiteSpeedAudits />} />
                    <Route path="/crime-digest" element={<CrimeDigest />} />
                    <Route path="/demand-radar" element={<Navigate to="/growth-radar" replace />} />
                    <Route path="/talent-radar-vs-staffing" element={<TalentRadarVsStaffing />} />
                    <Route path="/fielddesk-vs-eway" element={<FieldDeskVsEway />} />
                    <Route path="/marketing-layer-for-eway" element={<MarketingLayerForEway />} />
                    <Route path="/fielddesk-migration" element={<FieldDeskMigration />} />
                    <Route path="/healthcare-staffing-michigan" element={<HealthcareStaffingMI />} />
                    <Route path="/dwa/refer" element={<DwaReferContractor />} />
                    <Route path="/refer-a-contractor" element={<DwaReferContractor />} />
                    <Route path="/mortgage-radar-vs-trigger-leads" element={<MortgageRadarVsTriggerLeads />} />
                    <Route path="/mortgage-radar" element={<MortgageRadar />} />
                    <Route path="/fsbo-heatmap" element={<FsboHeatmap />} />
                    <Route path="/my-mortgage-radar" element={<MyMortgageRadar />} />
                    <Route path="/my-missed-call" element={<MyMissedCall />} />
                    <Route path="/my-site-radar" element={<MySiteRadar />} />
                    <Route path="/site-radar" element={<SiteRadarLanding />} />
                    <Route path="/bundle-revenue-suite" element={<BundleRevenueSuite />} />
                    <Route path="/buyer-radar" element={<BuyerRadar />} />
                    <Route path="/buyer-radar/demo" element={<BuyerRadarDemo />} />
                    <Route path="/buyer-radar/pricing" element={<BuyerRadarPricing />} />
                    <Route path="/buyer-radar-preview" element={<BuyerRadarPreview />} />
                    <Route path="/demand-radar-preview" element={<DemandRadarPreview />} />
                    <Route path="/my-buyer-radar" element={<MyBuyerRadar />} />
                    <Route path="/high-volume-buyer-alerts" element={<HighVolumeBuyerAlerts />} />
                    <Route path="/staffing" element={<StaffingAgency />} />
                    <Route path="/roofing-radar" element={<RoofingRadar />} />
                    <Route path="/roofing-radar/demo" element={<RoofingRadarDemo />} />
                    <Route path="/hvac-radar" element={<HVACRadar />} />
                    <Route path="/hvac-radar/demo" element={<HVACRadarDemo />} />
                    <Route path="/plumbing-radar" element={<PlumbingRadar />} />
                    <Route path="/plumbing-radar/demo" element={<PlumbingRadarDemo />} />
                    <Route path="/electrical-radar" element={<ElectricalRadar />} />
                    <Route path="/electrical-radar/demo" element={<ElectricalRadarDemo />} />
                    <Route path="/pest-control-radar" element={<PestControlRadar />} />
                    <Route path="/pest-control-radar/demo" element={<PestControlRadarDemo />} />
                    <Route path="/gutters-radar" element={<GuttersRadar />} />
                    <Route path="/gutters-radar/demo" element={<GuttersRadarDemo />} />
                    <Route path="/painting-radar" element={<PaintingRadar />} />
                    <Route path="/painting-radar/demo" element={<PaintingRadarDemo />} />
                    <Route path="/my-roofing-radar" element={<MyRoofingRadar />} />
                    <Route path="/my-hvac-radar" element={<MyHVACRadar />} />
                    <Route path="/my-plumbing-radar" element={<MyPlumbingRadar />} />
                    <Route path="/my-electrical-radar" element={<MyElectricalRadar />} />
                    <Route path="/my-pest-control-radar" element={<MyPestControlRadar />} />
                    <Route path="/my-gutters-radar" element={<MyGuttersRadar />} />
                    <Route path="/my-painting-radar" element={<MyPaintingRadar />} />
                    <Route path="/agency-portal" element={<AgencyPortal />} />
                    <Route path="/license-monitor" element={<LicenseMonitor />} />
                    <Route path="/regulatory-filing-monitor" element={<RegulatoryFilingMonitor />} />
                    <Route path="/bid-intelligence" element={<BidIntelligence />} />
                    <Route path="/commercial-lease" element={<CommercialLease />} />
                    <Route path="/patent-watch" element={<PatentWatch />} />
                    <Route path="/pe-intelligence" element={<PEIntelligence />} />
                    <Route path="/rd-intelligence" element={<RDIntelligence />} />
                    <Route path="/credit-dispute" element={<CreditDispute />} />
                    <Route path="/medical-bill-dispute" element={<MedicalBillDispute />} />
                    <Route path="/supplement-analyzer" element={<SupplementAnalyzer />} />
                    <Route path="/trade-association-intel" element={<TradeAssociationIntel />} />
                    <Route path="/luxury-re-intel" element={<LuxuryRealEstate />} />
                    <Route path="/tech-support" element={<TechSupportServices />} />
                    <Route path="/revenue-preventer" element={<RevenuePreventer />} />
                    <Route path="/free-compliance-scan" element={<FreeComplianceScan />} />
                    <Route path="/free-bid-report" element={<FreeBidReport />} />
                    <Route path="/seo-guard" element={<SeoGuard />} />
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
                     <Route path="/zone-dashboard" element={<ZoneDashboard />} />
                     <Route path="/coach" element={<BlurGate requireSubscription><Coach /></BlurGate>} />
                     <Route path="/trial-welcome" element={<ProtectedRoute><TrialWelcome /></ProtectedRoute>} />
                     <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
                      <Route path="/admin" element={<AgencyAdminRoute><Admin /></AgencyAdminRoute>} />
                      <Route path="/admin/health" element={<AgencyAdminRoute><AdminHealth /></AgencyAdminRoute>} />
                       <Route path="/dwa-admin" element={<AgencyAdminRoute><DWAAdmin /></AgencyAdminRoute>} />
                       <Route path="/owner/login" element={<OwnerLogin />} />
                       <Route path="/owner/verify" element={<OwnerVerify />} />
                       <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                      <Route path="/dwa-admin/outreach-audit" element={<AgencyAdminRoute><OutreachAuditLog /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/outreach-queue" element={<AgencyAdminRoute><OutreachQueuePage /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/outreach-observability" element={<AgencyAdminRoute><OutreachObservabilityPage /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/wave5" element={<AgencyAdminRoute><Wave5Dashboard /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/audit-timeline" element={<AgencyAdminRoute><AuditTimeline /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/quarantine" element={<AgencyAdminRoute><Quarantine /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/edge-health" element={<AgencyAdminRoute><AdminEdgeHealth /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/secrets-health" element={<AgencyAdminRoute><AdminSecretsHealth /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/market-targeting" element={<AgencyAdminRoute><AdminMarketTargeting /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/market-targeting/audit" element={<AgencyAdminRoute><AdminProspectorTargetsAudit /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/checkout-events" element={<AgencyAdminRoute><AdminCheckoutEvents /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/v4" element={<AgencyAdminRoute><DwaAdminV4 /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/qbr-queue" element={<AgencyAdminRoute><DwaAdminQbrQueue /></AgencyAdminRoute>} />
                      <Route path="/dwa-admin/stripe-reconcile" element={<AgencyAdminRoute><DwaAdminStripeReconcile /></AgencyAdminRoute>} />
                      <Route path="/my-addons" element={<ProtectedRoute><MyAddons /></ProtectedRoute>} />
                      <Route path="/commercial-roofing-detroit" element={<CommercialRoofingDetroit />} />
                     <Route path="/r/:token" element={<ProspectRedirect />} />
                     <Route path="/admin/view-user/:userId" element={<ProtectedRoute><AdminViewUser /></ProtectedRoute>} />
                     <Route path="/comms-center" element={<ProtectedRoute><CommunicationsCenter /></ProtectedRoute>} />
                     <Route path="/dashboard" element={<ZoneDashboard />} />
                    <Route path="/ai-insights" element={<BlurGate requireSubscription><AiInsights /></BlurGate>} />
                    <Route path="/profile" element={<BlurGate><Profile /></BlurGate>} />
                    <Route path="/progress" element={<BlurGate requireSubscription><Progress /></BlurGate>} />
                    <Route path="/nutrition" element={<BlurGate requireSubscription><Nutrition /></BlurGate>} />
                    <Route path="/pet-memorial" element={<PetMemorial />} />
                    <Route path="/pet-memorial/success" element={<PetMemorialSuccess />} />
                    <Route path="/memorial/:slug" element={<MemorialPage />} />
                    <Route path="/gov-contract-monitor" element={<GovContractMonitor />} />
                    <Route path="/gov-contract-monitor/dashboard" element={<ProtectedRoute><GovContractDashboard /></ProtectedRoute>} />
                    <Route path="/regulatory-monitor/dashboard" element={<ProtectedRoute><RegulatoryDashboard /></ProtectedRoute>} />
                    <Route path="/trademark-watch" element={<TrademarkWatch />} />
                    <Route path="/trademark-watch/dashboard" element={<ProtectedRoute><TrademarkDashboard /></ProtectedRoute>} />
                    <Route path="/competitor-pricing" element={<CompetitorPricing />} />
                    <Route path="/competitor-pricing/dashboard" element={<ProtectedRoute><CompetitorPricingDashboard /></ProtectedRoute>} />
                    <Route path="/real-estate-newsletter" element={<RealEstateNewsletter />} />
                    <Route path="/real-estate-newsletter/dashboard" element={<ProtectedRoute><RealEstateDashboard /></ProtectedRoute>} />
                    <Route path="/employee-credential-audit" element={<EmployeeCredentialAudit />} />
                    <Route path="/new-hire-check" element={<NewHireCheck />} />
                    <Route path="/join/:code" element={<JoinTeam />} />
                    <Route path="/coach-hub" element={<ProtectedRoute><CoachHub /></ProtectedRoute>} />
                    <Route path="/my-team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
                    <Route path="/client-dash" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
                    <Route path="/agency-portal" element={<ClientRoute><AgencyClientPortal /></ClientRoute>} />
                    <Route path="/embed/capture/:tenantId" element={<EmbedCapture />} />
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
              <SpeedInsights />
            </BrowserRouter>
          </TooltipProvider>
        </OfflineSyncProvider>
      </TimerProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
