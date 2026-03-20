import { lazy, Suspense, useState, useEffect, memo } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TimerProvider } from "@/hooks/useTimer";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
import ProtectedRoute from "@/components/ProtectedRoute";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBadge from "@/components/OfflineBadge";

import { useTimer } from "@/hooks/useTimer";
import { useAuth } from "@/hooks/useAuth";
import { useReferralCapture } from "@/hooks/useReferral";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

// Retry wrapper for lazy imports — retries up to 3 times on chunk load failure
function lazyRetry(importFn: () => Promise<any>, retries = 3): ReturnType<typeof lazy> {
  return lazy(() =>
    importFn().catch((err: Error) => {
      if (retries > 0 && /loading chunk|failed to fetch dynamically imported module|import|loading css chunk/i.test(err.message)) {
        return new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
          lazyRetry(importFn, retries - 1) as any
        );
      }
      throw err;
    })
  );
}

const AnnouncementBanner = lazyRetry(() => import("@/components/AnnouncementBanner"));
const IntervalTimer = lazyRetry(() => import("@/components/workout/IntervalTimer"));
const ActiveWorkoutZone = lazyRetry(() => import("@/components/workout/ActiveWorkoutZone"));

// Lazy-load all pages for code-splitting
import Index from "./pages/Index";
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

// Graceful storage fallback for privacy browsers that block localStorage
const dummyStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
};

let safeStorage: Storage = dummyStorage;
try {
  // Test that localStorage is actually usable (privacy browsers may throw on access)
  window.localStorage.setItem("__storage_test__", "1");
  window.localStorage.removeItem("__storage_test__");
  safeStorage = window.localStorage;
} catch {
  console.warn("[M²] localStorage blocked — running without cache persistence");
}

const persister = createSyncStoragePersister({
  storage: safeStorage,
  key: "m2-query-cache",
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="animate-spin text-primary" size={24} />
  </div>
);

const GlobalTimer = memo(() => {
  const { timerOpen, closeTimer, portalActive } = useTimer();
  if (!timerOpen || portalActive) return null;
  return (
    <Suspense fallback={null}>
      <IntervalTimer onClose={closeTimer} />
    </Suspense>
  );
});
GlobalTimer.displayName = "GlobalTimer";

const ActiveWorkoutWrapper = () => {
  const { user } = useAuth();
  const { setPortalActive } = useTimer();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneContext, setZoneContext] = useState<any>(null);
  const [hasPaused, setHasPaused] = useState(
    () => !!localStorage.getItem("m2-paused-workout")
  );

  // Listen for open event with context
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || null;
      setZoneContext(detail);
      setZoneOpen(true);
      setHasPaused(false);
      setPortalActive(true);
    };
    window.addEventListener("open-workout-zone", handler);
    return () => window.removeEventListener("open-workout-zone", handler);
  }, []);

  // Listen for resume event
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem("m2-paused-workout");
      if (saved) {
        try {
          setZoneContext(JSON.parse(saved));
          setZoneOpen(true);
          setHasPaused(false);
          setPortalActive(true);
        } catch {}
      }
    };
    window.addEventListener("resume-workout-zone", handler);
    return () => window.removeEventListener("resume-workout-zone", handler);
  }, []);

  if (!user || !zoneOpen) return null;
  return (
    <Suspense fallback={null}>
      <ActiveWorkoutZone
        initialContext={zoneContext}
        onFinish={() => {
          setZoneOpen(false);
          setZoneContext(null);
          setHasPaused(false);
          setPortalActive(false);
          localStorage.removeItem("m2-paused-workout");
        }}
        onPause={() => {
          setZoneOpen(false);
          setHasPaused(true);
          setPortalActive(false);
        }}
      />
    </Suspense>
  );
};

const ReferralCaptureWrapper = () => {
  useReferralCapture();
  return null;
};

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 60 * 60_000 }}>
    <AuthProvider>
      <TimerProvider>
        <OfflineSyncProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
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
                    <Route path="/install" element={<Install />} />
                    <Route path="/coach" element={<ProtectedRoute><SubscriptionGuard><Coach /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/trial-welcome" element={<ProtectedRoute><TrialWelcome /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><SubscriptionGuard><Dashboard /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/progress" element={<ProtectedRoute><SubscriptionGuard><Progress /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="/nutrition" element={<ProtectedRoute><SubscriptionGuard><Nutrition /></SubscriptionGuard></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
              <GlobalTimer />
              <ActiveWorkoutWrapper />
              <OfflineBadge />
            </BrowserRouter>
          </TooltipProvider>
        </OfflineSyncProvider>
      </TimerProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
