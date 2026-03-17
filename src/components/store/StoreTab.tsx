import { useState } from "react";
import PdfGuides from "./PdfGuides";
import InteractivePrograms from "./InteractivePrograms";
import OnlineServices from "../landing/OnlineServices";
import MerchSection from "../MerchSection";
import ShopGrid from "../ShopGrid";

const SUB_TABS = [
  { key: "programs", label: "Interactive Programs" },
  { key: "custom", label: "Custom Program" },
  { key: "merchandise", label: "Merchandise" },
];

const StoreTab = () => {
  const [subTab, setSubTab] = useState("programs");

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

      {subTab === "pdf-guides" && <PdfGuides />}
      {subTab === "programs" && <InteractivePrograms />}
      {subTab === "custom" && <CustomProgramSection />}
      {subTab === "merchandise" && <MerchSection />}
    </div>
  );
};

/** Custom program intake — extracted from old ShopGrid */
const CustomProgramSection = () => {
  return (
    <div>
      <div className="bg-primary/10 border border-primary/20 p-4 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          Matt reads your intake and builds a fully custom program from scratch — your goals, your equipment, your level. No templates. No AI. Just 20 years of doing this.
        </p>
      </div>
      <ShopGrid showCustomOnly />
    </div>
  );
};

export default StoreTab;
