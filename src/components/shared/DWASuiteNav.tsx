type Product = {
  key: string;
  label: string;
  icon: string;
  path: string;
  active: boolean;
  upgradeHref?: string;
};

interface DWASuiteNavProps {
  activeProduct: "contractor_leads" | "mortgage_radar" | "techalert" | "industry_pulse" | "fielddesk";
  email?: string;
}

const PRODUCTS: Omit<Product, "active">[] = [
  { key: "contractor_leads", label: "Contractor Leads", icon: "🏗️", path: "/my-contractor-leads", upgradeHref: "/contractor-leads" },
  { key: "mortgage_radar", label: "Mortgage Radar", icon: "🏠", path: "/my-mortgage-radar", upgradeHref: "/mortgage-radar" },
  { key: "techalert", label: "TechAlert", icon: "⚡", path: "/talent-radar/dashboard", upgradeHref: "/hire-alert" },
  { key: "industry_pulse", label: "Growth Radar", icon: "📈", path: "/my-industry-pulse", upgradeHref: "/industry-pulse" },
  { key: "fielddesk", label: "FieldDesk", icon: "🔧", path: "/field-service/dispatch", upgradeHref: "/field-service" },
];

export default function DWASuiteNav({ activeProduct, email }: DWASuiteNavProps) {
  // Products the client has access to — passed via props or inferred from active product
  // For now we highlight the active one and show others as upgrade prompts
  const subscribed = new Set([activeProduct]);

  return (
    <div style={{ background: "#0a1628", borderBottom: "1px solid #1e3a5f" }} className="w-full">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto py-0" style={{ scrollbarWidth: "none" }}>
          {/* Brand */}
          <span className="text-xs font-bold mr-3 whitespace-nowrap" style={{ color: "#00d4ff" }}>
            DWA Suite
          </span>

          {PRODUCTS.map((p) => {
            const isActive = p.key === activeProduct;
            const isOwned = subscribed.has(p.key as typeof activeProduct);

            if (isActive) {
              return (
                <div
                  key={p.key}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2"
                  style={{ color: "#00d4ff", borderColor: "#00d4ff" }}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </div>
              );
            }

            // Not subscribed — show as upgrade link
            const href = email
              ? `${p.upgradeHref}?prefilled_email=${encodeURIComponent(email)}`
              : p.upgradeHref!;

            return (
              <a
                key={p.key}
                href={href}
                className="flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors hover:text-white"
                style={{ color: "#4a6080", borderColor: "transparent" }}
                title={`Add ${p.label} to your DWA suite`}
              >
                <span className="opacity-50">{p.icon}</span>
                <span>{p.label}</span>
                <span style={{ color: "#00d4ff", fontSize: "9px" }} className="ml-0.5">+</span>
              </a>
            );
          })}

          <div className="ml-auto pl-4 py-2 flex items-center gap-2 whitespace-nowrap">
            <a
              href="https://detroitwebagent.com"
              className="text-xs hover:text-white transition-colors"
              style={{ color: "#2a4060" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              detroitwebagent.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
