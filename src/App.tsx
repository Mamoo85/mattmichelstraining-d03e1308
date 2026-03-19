import { lazy, Suspense, useState, useEffect } from "react";
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
import IntervalTimer from "@/components/workout/IntervalTimer";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBadge from "@/components/OfflineBadge";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ActiveWorkoutZone from "@/components/workout/ActiveWorkoutZone";

import { useTimer } from "@/hooks/useTimer";
import { useAuth } from "@/hooks/useAuth";
import { useReferralCapture } from "@/hooks/useReferral";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

// Lazy-load all pages for code-splitting
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Coach = lazy(() => import("./pages/Coach"));
const Shop = lazy(() => import("./pages/Shop"));
const ForParents = lazy(() => import("./pages/ForParents"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Profile = lazy(() => import("./pages/Profile"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Progress = lazy(() => import("./pages/Progress"));
const Merch = lazy(() => import("./pages/Merch"));
const Learn = lazy(() => import("./pages/Learn"));
const TrialWelcome = lazy(() => import("./pages/TrialWelcome"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const Nutrition = lazy(() => import("./pages/Nutrition"));
const TheEdge = lazy(() => import("./pages/TheEdge"));

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
  storage: window.localStorage,
  key: "m2-query-cache",
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="animate-spin text-primary" size={24} />
  </div>
);

const GlobalTimer = () => {
  const { timerOpen, closeTimer } = useTimer();
  if (!timerOpen) return null;
  return <IntervalTimer onClose={closeTimer} />;
};

const ActiveWorkoutWrapper = () => {
  const { user } = useAuth();
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
        } catch {}
      }
    };
    window.addEventListener("resume-workout-zone", handler);
    return () => window.removeEventListener("resume-workout-zone", handler);
  }, []);

  if (!user || !zoneOpen) return null;
  return (
    <ActiveWorkoutZone
      initialContext={zoneContext}
      onFinish={() => {
        setZoneOpen(false);
        setZoneContext(null);
        setHasPaused(false);
        localStorage.removeItem("m2-paused-workout");
      }}
      onPause={() => {
        setZoneOpen(false);
        setHasPaused(true);
      }}
    />
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
              <AnnouncementBanner />
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
