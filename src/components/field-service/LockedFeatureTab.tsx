import { Lock, ArrowRight, Zap, MapPin, FileText, Package, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  feature: "dispatch" | "map" | "invoicing" | "assets" | "contracts";
}

const T = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  sec: "#8b949e",
  ter: "#484f58",
  blue: "#4493f8",
  blueBg: "#132d4d",
};

const FEATURES: Record<string, { icon: LucideIcon; title: string; description: string; preview: string[] }> = {
  dispatch: {
    icon: ClipboardList,
    title: "Dispatch Board",
    description: "Drag-and-drop job scheduling. Assign techs, track status in real-time, auto-notify customers via SMS.",
    preview: ["Drag jobs between techs", "Real-time status updates", "Auto-SMS on arrival/completion", "Priority color coding", "Customer history at a glance"],
  },
  map: {
    icon: MapPin,
    title: "Live Tech Map",
    description: "See where every technician is right now. GPS tracking, route optimization, nearest-tech dispatch.",
    preview: ["Real-time GPS tracking", "Nearest-tech auto-dispatch", "Customer pin mapping", "Traffic-aware routing", "Geofence alerts"],
  },
  invoicing: {
    icon: FileText,
    title: "Invoicing",
    description: "Create invoices on-site, collect signatures, sync to QuickBooks. No more paper invoices.",
    preview: ["On-site invoice creation", "Digital signature capture", "QuickBooks sync", "Payment tracking", "Revenue reporting"],
  },
  assets: {
    icon: Package,
    title: "Asset Manager",
    description: "Track every piece of equipment — serial numbers, maintenance schedules, warranty dates.",
    preview: ["Equipment serial tracking", "Maintenance scheduling", "Warranty expiry alerts", "Install location history", "Photo documentation"],
  },
  contracts: {
    icon: Zap,
    title: "Service Contracts",
    description: "Manage recurring service agreements. Auto-schedule maintenance, track contract value.",
    preview: ["Recurring contract management", "Auto-scheduled maintenance", "Revenue forecasting", "Renewal reminders", "SLA compliance tracking"],
  },
};

export default function LockedFeatureTab({ feature }: Props) {
  const config = FEATURES[feature];
  const Icon = config.icon;

  return (
    <div className="relative" data-testid={`locked-tab-${feature}`}>
      {/* Blurred fake content */}
      <div className="pointer-events-none select-none opacity-30 p-6" style={{ filter: "blur(6px)" }}>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: T.surface, borderRadius: 8, padding: 16, height: 96, border: `1px solid ${T.border}` }}>
              <div style={{ height: 12, background: T.border, borderRadius: 4, width: "66%", marginBottom: 8 }} />
              <div style={{ height: 24, background: T.border, borderRadius: 4, width: "50%" }} />
            </div>
          ))}
        </div>
        <div style={{ background: T.surface, borderRadius: 8, padding: 16, height: 256, marginBottom: 16, border: `1px solid ${T.border}` }}>
          <div style={{ height: 12, background: T.border, borderRadius: 4, width: "25%", marginBottom: 16 }} />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, background: T.border, borderRadius: 6 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: T.border, borderRadius: 4, width: "75%", marginBottom: 4 }} />
                <div style={{ height: 8, background: T.border, borderRadius: 4, width: "50%" }} />
              </div>
              <div style={{ height: 24, width: 64, background: T.border, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Unlock overlay */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${T.bg}cc`, backdropFilter: "blur(4px)" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 32, maxWidth: 420, textAlign: "center", boxShadow: `0 16px 48px ${T.bg}80` }} data-testid={`locked-overlay-${feature}`}>
          <div style={{ width: 52, height: 52, background: T.blueBg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon style={{ width: 24, height: 24, color: T.blue }} />
          </div>

          <Lock style={{ width: 16, height: 16, color: T.ter, margin: "0 auto 12px", display: "block" }} />

          <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 8 }}>{config.title}</h3>
          <p style={{ fontSize: 13, color: T.sec, marginBottom: 20, lineHeight: 1.6, margin: "0 0 20px" }}>{config.description}</p>

          <ul style={{ textAlign: "left", marginBottom: 24, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {config.preview.map(item => (
              <li key={item} style={{ fontSize: 12, color: T.sec, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: T.blue, fontSize: 13 }}>&#10003;</span>
                {item}
              </li>
            ))}
          </ul>

          <a
            href="/field-service"
            data-testid={`locked-cta-${feature}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: T.blue, color: "#fff",
              fontWeight: 700, padding: "12px 24px", borderRadius: 6,
              textDecoration: "none", fontSize: 14,
              transition: "opacity .15s",
            }}
          >
            Unlock with FieldDesk — $199/mo <ArrowRight style={{ width: 16, height: 16 }} />
          </a>

          <p style={{ fontSize: 10, color: T.ter, marginTop: 12 }}>
            Free for 7 days &middot; Cancel anytime &middot; All features included
          </p>
        </div>
      </div>
    </div>
  );
}
