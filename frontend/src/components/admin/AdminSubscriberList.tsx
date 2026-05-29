import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Upload, Trash2, Search, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const AdminSubscriberList = () => {
  const [search, setSearch] = useState("");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("subscribed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .update({ is_active, unsubscribed_at: is_active ? null : new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] }),
  });

  const deleteSub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      toast({ title: "Subscriber removed" });
    },
  });

  const importEmails = useMutation({
    mutationFn: async (emails: string[]) => {
      const rows = emails.map((email) => ({ email: email.trim().toLowerCase(), source: "import" }));
      const { error } = await supabase.from("newsletter_subscribers").upsert(rows, { onConflict: "email" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      toast({ title: `${count} emails imported` });
      setImportText("");
      setShowImport(false);
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const handleImport = () => {
    const emails = importText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) return toast({ title: "No valid emails found", variant: "destructive" });
    importEmails.mutate(emails);
  };

  const handleExport = () => {
    const active = subscribers.filter((s) => s.is_active);
    const csv = "email,source,subscribed_at\n" + active.map((s) => `${s.email},${s.source},${s.subscribed_at}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "m2-subscribers.csv";
    a.click();
  };

  const filtered = subscribers.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = subscribers.filter((s) => s.is_active).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-2xl font-mono font-bold text-foreground">{subscribers.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
          <p className="text-2xl font-mono font-bold text-primary">{activeCount}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unsubscribed</p>
          <p className="text-2xl font-mono font-bold text-muted-foreground">{subscribers.length - activeCount}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emails..."
            className="w-full bg-card border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <button onClick={() => setShowImport(!showImport)} className="bg-muted px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 flex items-center gap-1.5">
          <Upload size={12} /> Import
        </button>
        <button onClick={handleExport} className="bg-muted px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 flex items-center gap-1.5">
          <Download size={12} /> Export
        </button>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="bg-card shadow-m2 p-4 space-y-3">
          <p className="text-xs text-foreground font-bold">Paste emails (one per line, or comma-separated)</p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-32 font-mono"
            placeholder={"john@example.com\njane@example.com"}
          />
          <button onClick={handleImport} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2">
            Import Emails
          </button>
        </div>
      )}

      {/* Subscriber list */}
      <div className="bg-card shadow-m2">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No subscribers found</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{sub.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase">{sub.source}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(sub.subscribed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive.mutate({ id: sub.id, is_active: !sub.is_active })}
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 transition-m2 ${
                      sub.is_active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sub.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => deleteSub.mutate(sub.id)}
                    className="text-muted-foreground hover:text-destructive transition-m2 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSubscriberList;
