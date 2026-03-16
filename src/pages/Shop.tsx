import { useState, useEffect } from "react";
import AppNavbar from "@/components/AppNavbar";
import StoreGettingStarted from "@/components/store/StoreGettingStarted";
import StoreTab from "@/components/store/StoreTab";
import ExerciseLibrary from "@/components/ExerciseLibrary";
import PaywallGate from "@/components/PaywallGate";

const TABS = [
  { key: "start", label: "Getting Started" },
  { key: "store", label: "Store" },
  { key: "library", label: "Exercise Library" },
];

const Shop = () => {
  const [activeTab, setActiveTab] = useState("start");

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-m2 ${
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
          <PaywallGate requiredTier="basic" featureName="Exercise Library">
            <ExerciseLibrary />
          </PaywallGate>
        )}
      </div>
    </div>
  );
};

export default Shop;
