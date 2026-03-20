import { useState, useEffect } from "react";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import StoreGettingStarted from "@/components/store/StoreGettingStarted";
import StoreTab from "@/components/store/StoreTab";
import ExerciseLibrary from "@/components/features/ExerciseLibrary";
import FixItLibrary from "@/components/features/FixItLibrary";
import PaywallGate from "@/components/billing/PaywallGate";

const TABS = [
  { key: "start", label: "How It Works" },
  { key: "store", label: "Store" },
  { key: "library", label: "Exercise Library" },
  { key: "fixit", label: "Fix It Library" },
] as const;

const Shop = () => {
  const [activeTab, setActiveTab] = useState("start");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setActiveTab(detail);
    };
    window.addEventListener("switch-shop-tab", handler);
    return () => window.removeEventListener("switch-shop-tab", handler);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Shop — Training Programs & Exercise Library"
        description="Sport-specific training guides, custom programs, and an 85+ exercise library from Coach Matt Michels. Programs start at $9."
        path="/shop"
      />
      <AppNavbar />
      <div className="container pt-20 pb-12">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-m2 whitespace-nowrap ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "start" && <StoreGettingStarted />}
        {activeTab === "store" && <StoreTab />}
        {activeTab === "library" && (
          <PaywallGate featureKey="exercise_library" featureName="Exercise Library">
            <ExerciseLibrary />
          </PaywallGate>
        )}
        {activeTab === "fixit" && (
          <PaywallGate featureKey="fix_it_library" featureName="Fix It Rehab Library">
            <FixItLibrary />
          </PaywallGate>
        )}
      </div>
    </div>
  );
};

export default Shop;
