import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ExternalLink, Monitor, Tablet, Smartphone, RefreshCw, Save, Globe, Shield, Settings2,
} from "lucide-react";

/**
 * Iframe + customize panel for the DJ Conley client sandbox.
 * Two surfaces: public website (`/sandbox/djconley/`) and admin panel
 * (`/sandbox/djconley/admin`). Matt can preview, jump between admin tabs,
 * resize for device, and edit basic tenant config (brand color, owner, etc.).
 */

type Mode = "site" | "admin";
type Device = "desktop" | "tablet" | "mobile";

const ADMIN_TABS = [
  { path: "/sandbox/djconley/admin",              label: "Overview" },
  { path: "/sandbox/djconley/admin/site-radar",   label: "SiteRadar" },
  { path: "/sandbox/djconley/admin/missed-call",  label: "Missed-Call" },
  { path: "/sandbox/djconley/admin/buyer-radar",  label: "Buyer Radar" },
  { path: "/sandbox/djconley/admin/fielddesk",    label: "FieldDesk" },
  { path: "/sandbox/djconley/admin/techalert",    label: "TechAlert" },
  { path: "/sandbox/djconley/admin/trade-radar",  label: "Trade Radar" },
  { path: "/sandbox/djconley/admin/outreach",     label: "Outreach" },
  { path: "/sandbox/djconley/admin/reviews",      label: "Reviews" },
  { path: "/sandbox/djconley/admin/widgets",      label: "Site Widgets" },
  { path: "/sandbox/djconley/admin/reports",      label: "Reports" },
  { path: "/sandbox/djconley/admin/integrations", label: "Integrations" },
  { path: "/sandbox/djconley/admin/team",         label: "Team" },
  { path: "/sandbox/djconley/admin/settings",     label: "Settings" },
];

const SITE_PAGES = [
  { path: "/sandbox/djconley/",            label: "Home" },
  { path: "/sandbox/djconley/about",       label: "About" },
  { path: "/sandbox/djconley/industries",  label: "Industries" },
  { path: "/sandbox/djconley/service",     label: "Service" },
  { path: "/sandbox/djconley/parts",       label: "Parts" },
  { path: "/sandbox/djconley/products",    label: "Products" },
  { path: "/sandbox/djconley/projects",    label: "Projects" },
  { path: "/sandbox/djconley/rentals",     label: "Rentals" },
  { path: "/sandbox/djconley/education",   label: "Education" },
  { path: "/sandbox/djconley/resources",   label: "Resources" },
  { path: "/sandbox/djconley/careers",     label: "Careers" },
  { path: "/sandbox/djconley/contact",     label: "Contact" },
  { path: "/sandbox/djconley/blog",        label: "Blog" },
  { path: "/sandbox/djconley/tour",        label: "Admin Tour" },
];

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet:  "820px",
  mobile:  "390px",
};

type TenantConfig = {
  tenant_slug: string;
  brand_color: string;
  logo_url: string | null;
  owner_name: string;
  owner_email: string;
  enabled_radars: string[];
};

const DEFAULT_CONFIG: TenantConfig = {
  tenant_slug: "djconley",
  brand_color: "#27CCC0",
  logo_url: "/demo-djconley-current/djc-51-logo.png",
  owner_name: "Pat Michels",
  owner_email: "pmichels@djconley.com",
  enabled_radars: ["site-radar", "missed-call", "buyer-radar", "fielddesk", "techalert", "trade-radar"],
};

export default function ClientSandboxFrame({ initialMode = "admin" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [device, setDevice] = useState<Device>("desktop");
  const [path, setPath] = useState<string>(initialMode === "admin" ? "/sandbox/djconley/admin" : "/sandbox/djconley/");
  const [config, setConfig] = useState<TenantConfig>(DEFAULT_CONFIG);
  const [showCustomize, setShowCustomize] = useState(false);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const tabs = mode === "admin" ? ADMIN_TABS : SITE_PAGES;

  useEffect(() => {
    // Load existing tenant config
    (async () => {
      const { data } = await (supabase as any)
        .from("sandbox_tenant_config")
        .select("*")
        .eq("tenant_slug", "djconley")
        .maybeSingle();
      if (data) {
        setConfig({
          tenant_slug: data.tenant_slug,
          brand_color: data.brand_color || DEFAULT_CONFIG.brand_color,
          logo_url: data.logo_url ?? DEFAULT_CONFIG.logo_url,
          owner_name: data.owner_name || DEFAULT_CONFIG.owner_name,
          owner_email: data.owner_email || DEFAULT_CONFIG.owner_email,
          enabled_radars: data.enabled_radars || DEFAULT_CONFIG.enabled_radars,
        });
      }
    })();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("sandbox_tenant_config")
      .upsert({ ...config, updated_at: new Date().toISOString() }, { onConflict: "tenant_slug" });
    setSaving(false);
    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success("Tenant config saved");
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    const next = m === "admin" ? "/sandbox/djconley/admin" : "/sandbox/djconley/";
    setPath(next);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="border-b bg-card/50 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Client Sandbox — DJ Conley
            </h1>
            <p className="text-xs text-muted-foreground">
              Live preview of Pat's website mirror + admin command center. Customize on the right; everything renders below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
              <TabsList className="h-8">
                <TabsTrigger value="site" className="text-xs h-6"><Globe className="h-3.5 w-3.5 mr-1" /> Public Site</TabsTrigger>
                <TabsTrigger value="admin" className="text-xs h-6"><Shield className="h-3.5 w-3.5 mr-1" /> Owner Admin</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button size="sm" variant={device === "desktop" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setDevice("desktop")}>
                <Monitor className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant={device === "tablet" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setDevice("tablet")}>
                <Tablet className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant={device === "mobile" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setDevice("mobile")}>
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => iframeRef.current?.contentWindow?.location.reload()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={showCustomize ? "default" : "outline"} onClick={() => setShowCustomize((v) => !v)}>
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Customize
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={path} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Page jumper */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.path}
              onClick={() => setPath(t.path)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition border ${
                path === t.path
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted border-border text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body: iframe + optional customize rail */}
      <div className="flex-1 flex overflow-hidden bg-muted/30">
        <div className="flex-1 flex items-start justify-center p-2 overflow-auto">
          <div
            className="bg-background border rounded-lg shadow-md transition-all"
            style={{
              width: DEVICE_WIDTHS[device],
              maxWidth: "100%",
              height: "calc(100vh - 12rem)",
            }}
          >
            <iframe
              ref={iframeRef}
              key={path}
              src={path}
              title="DJ Conley sandbox"
              className="w-full h-full border-0 rounded-lg"
            />
          </div>
        </div>

        {showCustomize && (
          <aside className="w-80 border-l bg-card overflow-y-auto p-4 space-y-4 shrink-0">
            <div>
              <h3 className="text-sm font-bold mb-1">Tenant Customization</h3>
              <p className="text-[10px] text-muted-foreground">
                Saved to <code>sandbox_tenant_config</code>. Use this to dial the DJ Conley demo before promoting to a real client provisioning record.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Brand color</Label>
              <div className="flex gap-2">
                <Input type="color" value={config.brand_color} onChange={(e) => setConfig({ ...config, brand_color: e.target.value })} className="w-16 h-8 p-0.5" />
                <Input value={config.brand_color} onChange={(e) => setConfig({ ...config, brand_color: e.target.value })} className="h-8 text-xs font-mono" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Logo URL</Label>
              <Input value={config.logo_url ?? ""} onChange={(e) => setConfig({ ...config, logo_url: e.target.value })} className="h-8 text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Owner name</Label>
              <Input value={config.owner_name} onChange={(e) => setConfig({ ...config, owner_name: e.target.value })} className="h-8 text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Owner email</Label>
              <Input value={config.owner_email} onChange={(e) => setConfig({ ...config, owner_email: e.target.value })} className="h-8 text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Enabled radars (free for now)</Label>
              <div className="flex flex-wrap gap-1">
                {["site-radar","missed-call","buyer-radar","fielddesk","techalert","trade-radar","reviews","outreach"].map((r) => {
                  const on = config.enabled_radars.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => setConfig({
                        ...config,
                        enabled_radars: on
                          ? config.enabled_radars.filter((x) => x !== r)
                          : [...config.enabled_radars, r],
                      })}
                      className={`px-2 py-0.5 rounded text-[10px] border ${
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={saveConfig} disabled={saving} className="w-full" size="sm">
              <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save Config"}
            </Button>

            <Card className="p-3 bg-muted/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">Site mirror: ✓ live</Badge>
                <Badge variant="outline" className="text-[10px]">Admin shell: ✓ live</Badge>
                <Badge variant="outline" className="text-[10px]">12 admin tabs</Badge>
                <Badge variant="outline" className="text-[10px]">18 site pages</Badge>
              </div>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
