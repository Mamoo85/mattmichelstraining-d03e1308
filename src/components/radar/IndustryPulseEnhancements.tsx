import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Star, Plus, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  clientId: string;
  vendorOffering?: string;
}

/**
 * Batch 3 DR-12/13/14 — drop-in panel for MyIndustryPulse.
 * - Pitch draft button per signal
 * - Thumbs feedback per signal
 * - Companies-to-watch saved list
 */
export const IndustryPulseEnhancements = ({ clientId, vendorOffering }: Props) => {
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [newCompany, setNewCompany] = useState("");

  useEffect(() => {
    if (clientId) void loadWatchlist();
  }, [clientId]);

  const loadWatchlist = async () => {
    const { data } = await supabase
      .from("companies_watchlist")
      .select("id, company_name, notes")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setWatchlist(data || []);
  };

  const addToWatchlist = async () => {
    const name = newCompany.trim();
    if (!name) return;
    const { error } = await supabase
      .from("companies_watchlist")
      .insert({ client_id: clientId, company_name: name });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already on your list" : "Failed");
      return;
    }
    setNewCompany("");
    await loadWatchlist();
    toast.success(`${name} pinned`);
  };

  const removeFromWatchlist = async (id: string) => {
    await supabase.from("companies_watchlist").delete().eq("id", id);
    await loadWatchlist();
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-card/50">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Companies to Watch</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="e.g. Stellantis, Detroit Diesel..."
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addToWatchlist()}
            className="text-sm"
          />
          <Button size="sm" onClick={addToWatchlist}><Plus className="h-3 w-3" /></Button>
        </div>
        {watchlist.length === 0 ? (
          <p className="text-xs text-muted-foreground">Pin MI companies to surface their signals first.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {watchlist.map((w) => (
              <Badge
                key={w.id}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive/20"
                onClick={() => removeFromWatchlist(w.id)}
                title="Click to remove"
              >
                {w.company_name} ×
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-muted/20 border-dashed">
        <p className="text-xs text-muted-foreground">
          💡 Use <SignalActions clientId={clientId} signalId="" vendorOffering={vendorOffering} compact /> on any signal card to draft a pitch or vote on relevance.
        </p>
      </Card>
    </div>
  );
};

/**
 * Per-signal action buttons — compose into individual signal cards.
 */
export const SignalActions = ({
  clientId,
  signalId,
  signalTable = "industry_pulse_signals",
  vendorOffering,
  compact = false,
}: {
  clientId: string;
  signalId: string;
  signalTable?: string;
  vendorOffering?: string;
  compact?: boolean;
}) => {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [pitch, setPitch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitVote = async (v: "up" | "down") => {
    if (!signalId) return;
    setVote(v);
    await supabase.from("signal_feedback").upsert(
      { client_id: clientId, signal_id: signalId, signal_table: signalTable, vote: v },
      { onConflict: "client_id,signal_id,signal_table" }
    );
    toast.success(v === "up" ? "Marked relevant" : "We'll show fewer like this");
  };

  const draftPitch = async () => {
    if (!signalId) {
      toast.info("Select a specific signal to draft a pitch.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demand-radar-pitch-generator", {
        body: { signal_id: signalId, vendor_offering: vendorOffering },
      });
      if (error) throw error;
      setPitch(data?.pitch || "Could not generate.");
    } catch (e) {
      toast.error("Pitch draft failed");
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return <span className="font-medium">✍️ Draft Pitch / 👍👎 Feedback</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={draftPitch} disabled={loading}>
          <Sparkles className="h-3 w-3 mr-1" /> {loading ? "Drafting..." : "Draft pitch"}
        </Button>
        <Button
          size="sm"
          variant={vote === "up" ? "default" : "outline"}
          onClick={() => submitVote("up")}
        >
          <ThumbsUp className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant={vote === "down" ? "default" : "outline"}
          onClick={() => submitVote("down")}
        >
          <ThumbsDown className="h-3 w-3" />
        </Button>
      </div>
      {pitch && (
        <Card className="p-3 bg-muted/30 text-xs whitespace-pre-wrap">
          {pitch}
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-6 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(pitch);
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
        </Card>
      )}
    </div>
  );
};
