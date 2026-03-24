import { lazy, Suspense, useState, useEffect, memo } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
const DualFab = lazyRetry(() => import("@/components/dashboard/DualFab"));
const BottomTabBar = lazyRetry(() => import("@/components/layout/BottomTabBar"));

// Lazy-load ALL pages including Index for faster initial JS parse
const Index = lazyRetry(() => import("./pages/Index"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
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
const FreeAiGenerator = lazyRetry(() => import("./pages/FreeAiGenerator"));
const SEOLandingPage = lazyRetry(() => import("./pages/SEOLandingPage"));
const DynamicSitemap = lazyRetry(() => import("./pages/DynamicSitemap"));
const Assessment = lazyRetry(() => import("./pages/Assessment"));
const WebDesignAgency = lazyRetry(() => import("./pages/WebDesignAgency"));
const LandscapeMockup = lazyRetry(() => import("./pages/LandscapeMockup"));
const PlumberMockup = lazyRetry(() => import("./pages/PlumberMockup"));
const ElectricianMockup = lazyRetry(() => import("./pages/ElectricianMockup"));

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
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
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
                    <Route path="/install" element={<Install />} />
                    <Route path="/free-ai-generator" element={<FreeAiGenerator />} />
                    <Route path="/training/:slug" element={<SEOLandingPage />} />
                    <Route path="/sitemap.xml" element={<DynamicSitemap />} />
                    <Route path="/detroit-web-design" element={<WebDesignAgency />} />
                    <Route path="/demo-landscaping" element={<LandscapeMockup />} />
                    <Route path="/demo-plumber" element={<PlumberMockup />} />
                    <Route path="/demo-electrician" element={<ElectricianMockup />} />
                    <Route path="/coach" element={<ProtectedRoute><SubscriptionGuard><Coach /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/trial-welcome" element={<ProtectedRoute><TrialWelcome /></ProtectedRoute>} />
                    <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><SubscriptionGuard><Dashboard /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><SubscriptionGuard><Profile /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/progress" element={<ProtectedRoute><SubscriptionGuard><Progress /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/nutrition" element={<ProtectedRoute><SubscriptionGuard><Nutrition /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
              
              <ActiveWorkoutWrapper />
              <ProveItWrapper />
              
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
