import { useState } from "react";
import ShopGrid from "../ShopGrid";
import OnlineServices from "../landing/OnlineServices";
import MerchSection from "../MerchSection";

const SUB_TABS = [
  { key: "guides", label: "Guides & Programs" },
  { key: "training", label: "Training" },
  { key: "merchandise", label: "Merchandise" },
];

const StoreTab = () => {
  const [subTab, setSubTab] = useState("guides");

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
              subTab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "guides" && <ShopGrid />}
      {subTab === "training" && <OnlineServices />}
      {subTab === "merchandise" && <MerchSection />}
    </div>
  );
};

export default StoreTab;
