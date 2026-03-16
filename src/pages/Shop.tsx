import { useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import ShopGrid from "@/components/ShopGrid";
import ExerciseLibrary from "@/components/ExerciseLibrary";
import PaywallGate from "@/components/PaywallGate";

const TABS = [
  { key: "shop", label: "Guides & Programs" },
  { key: "library", label: "Exercise Library" },
];

const Shop = () => {
  const [activeTab, setActiveTab] = useState("shop");

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

        {activeTab === "shop" && <ShopGrid />}
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
