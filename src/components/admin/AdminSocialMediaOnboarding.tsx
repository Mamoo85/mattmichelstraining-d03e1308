import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Loader2, Facebook, Linkedin, RefreshCw } from "lucide-react";

interface SocialClient {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  plan: string | null;
  platforms: string[] | null;
  active: boolean;
  fb_page_id: string | null;
  linkedin_org_id: string | null;
  access_tokens: Record<string, string> | null;
  created_at: string;
}

interface TokenFormState {
  fb_page_id: string;
  fb_token: string;
  linkedin_org_id: string;
  linkedin_token: string;
}

function planLabel(plan: string | null) {
  if (plan === "standard") return "Standard $199/mo";
  if (plan === "pro") return "Pro $299/mo";
  if (plan === "trainer") return "Trainer $149/mo";
  return plan ?? "—";
}

function connectionStatus(client: SocialClient) {
  const tokens = client.access_tokens || {};
  const needsFb = client.platforms?.includes("facebook") || client.platforms?.includes("instagram");
  const needsLi = client.platforms?.includes("linkedin");
  const hasFb = !!(tokens.facebook && client.fb_page_id);
  const hasLi = !!(tokens.linkedin && client.linkedin_org_id);
  const needed = (needsFb ? 1 : 0) + (needsLi ? 1 : 0);
  const connected = (needsFb && hasFb ? 1 : 0) + (needsLi && hasLi ? 1 : 0);
  if (needed === 0) return "no-platforms";
  if (connected === needed) return "connected";
  if (connected > 0) return "partial";
  return "missing";
}

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "connected") return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px]">Connected</Badge>;
  if (status === "partial") return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px]">Partial</Badge>;
  if (status === "no-platforms") return <Badge variant="outline" className="text-[10px]">No platforms</Badge>;
  return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">Needs setup</Badge>;
};

const ClientRow = ({ client, onSaved }: { client: SocialClient; onSaved: () => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TokenFormState>({
    fb_page_id: client.fb_page_id || "",
    fb_token: client.access_tokens?.facebook || "",
    linkedin_org_id: client.linkedin_org_id || "",
    linkedin_token: client.access_tokens?.linkedin || "",
  });

  const status = connectionStatus(client);
  const needsFb = client.platforms?.includes("facebook") || client.platforms?.includes("instagram");
  const needsLi = client.platforms?.includes("linkedin");

  const handleSave = async () => {
    setSaving(true);
    try {
      const tokens: Record<string, string> = { ...(client.access_tokens || {}) };
      if (form.fb_token) tokens.facebook = form.fb_token;
      if (form.linkedin_token) tokens.linkedin = form.linkedin_token;

      const { error } = await (supabase as any).from("social_media_clients").update({
        fb_page_id: form.fb_page_id || null,
        linkedin_org_id: form.linkedin_org_id || null,
        access_tokens: tokens,
      }).eq("id", client.id);

      if (error) throw error;
      toast({ title: "Saved", description: `${client.business_name} tokens updated.` });
      onSaved();
      setExpanded(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{client.business_name || "Unnamed client"}</p>
            <p className="text-xs text-muted-foreground truncate">{client.email}</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{planLabel(client.plan)}</Badge>
          <StatusBadge status={status} />
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
          <div className="text-xs text-muted-foreground mb-3">
            Platforms: {client.platforms?.join(", ") || "none selected"} &nbsp;·&nbsp;
            Signed up {new Date(client.created_at).toLocaleDateString()}
          </div>

          {needsFb && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Facebook className="w-4 h-4 text-blue-500" />
                Facebook / Instagram
                {form.fb_token && form.fb_page_id && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Facebook Page ID</Label>
                  <Input
                    value={form.fb_page_id}
                    onChange={(e) => setForm(f => ({ ...f, fb_page_id: e.target.value }))}
                    placeholder="e.g. 123456789012345"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Page Access Token</Label>
                  <Input
                    value={form.fb_token}
                    onChange={(e) => setForm(f => ({ ...f, fb_token: e.target.value }))}
                    placeholder="EAABwzLixnjY..."
                    className="text-sm h-8 font-mono"
                    type="password"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get this from Meta Business Suite → Settings → Page Access Tokens. Token must have <code>pages_manage_posts</code> permission.
              </p>
            </div>
          )}

          {needsLi && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Linkedin className="w-4 h-4 text-blue-700" />
                LinkedIn
                {form.linkedin_token && form.linkedin_org_id && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Organization ID</Label>
                  <Input
                    value={form.linkedin_org_id}
                    onChange={(e) => setForm(f => ({ ...f, linkedin_org_id: e.target.value }))}
                    placeholder="e.g. 12345678"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Access Token</Label>
                  <Input
                    value={form.linkedin_token}
                    onChange={(e) => setForm(f => ({ ...f, linkedin_token: e.target.value }))}
                    placeholder="AQV..."
                    className="text-sm h-8 font-mono"
                    type="password"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get the Org ID from the client's LinkedIn Company Page URL. Token comes from LinkedIn Developer App with <code>w_organization_social</code> scope.
              </p>
            </div>
          )}

          {!needsFb && !needsLi && (
            <p className="text-sm text-muted-foreground">No platforms selected — client needs to update their signup.</p>
          )}

          {(needsFb || needsLi) && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="mt-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Tokens
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const AdminSocialMediaOnboarding = () => {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-social-media-clients"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_media_clients")
        .select("id, business_name, contact_name, email, plan, platforms, active, fb_page_id, linkedin_org_id, access_tokens, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocialClient[];
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-social-media-clients"] });
    queryClient.invalidateQueries({ queryKey: ["admin-business-dashboard"] });
  };

  const needsSetup = clients.filter(c => connectionStatus(c) !== "connected" && connectionStatus(c) !== "no-platforms");
  const ready = clients.filter(c => connectionStatus(c) === "connected");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No social media clients yet. They'll appear here after signup.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Social Media Client Setup</h3>
          <p className="text-sm text-muted-foreground">Connect each client's social accounts so the AI poster can publish on their behalf.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {needsSetup.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-yellow-600">
            <AlertTriangle className="w-4 h-4" />
            Needs setup ({needsSetup.length})
          </div>
          <div className="space-y-2">
            {needsSetup.map(client => (
              <ClientRow key={client.id} client={client} onSaved={handleSaved} />
            ))}
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            Connected ({ready.length})
          </div>
          <div className="space-y-2">
            {ready.map(client => (
              <ClientRow key={client.id} client={client} onSaved={handleSaved} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSocialMediaOnboarding;
