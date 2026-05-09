import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { Copy, Send } from "lucide-react";

export default function AdminCounselBeta() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ magic_link: string; trial_ends_at: string; email: string } | null>(null);

  const generate = async () => {
    if (!email.trim()) return toast.error("Email required");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-counsel-beta-invite", {
        body: { email: email.trim(), contact_name: name.trim(), firm_name: firm.trim(), days, note: note.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      setResult(data);
      toast.success("Invite created — welcome email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!result?.magic_link) return;
    await navigator.clipboard.writeText(result.magic_link);
    toast.success("Magic link copied");
  };

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet><title>Counsel Search Beta Invites — Admin</title></Helmet>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[3px] mb-2">⚖️ ADMIN — COUNSEL SEARCH</p>
        <h1 className="text-2xl font-bold mb-1">Beta Invites</h1>
        <p className="text-[#94a3b8] text-sm mb-6">Grant time-limited free access (default 30 days). Sends a branded welcome email with a one-click dashboard link.</p>

        <Card className="bg-[#0a1628] border-[#1e3a5f]">
          <CardContent className="p-5 space-y-3">
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Email *</label>
              <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="jess@firm.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#94a3b8] block mb-1">Contact name</label>
                <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Jess Smith" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-[#94a3b8] block mb-1">Firm</label>
                <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Smith Law" value={firm} onChange={(e) => setFirm(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Free access days: <strong className="text-white">{days}</strong></label>
              <input type="range" min={7} max={90} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-[#94a3b8] block mb-1">Internal note (optional)</label>
              <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Beta tester — return feedback by [date]" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button className="w-full bg-[#00d4ff] text-black hover:bg-[#00b8e0] font-bold" disabled={loading || !email} onClick={generate}>
              <Send className="w-4 h-4 mr-1.5" /> {loading ? "Generating…" : "Generate & Send Invite"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="bg-[#0a1628] border-[#00d4ff] mt-4">
            <CardContent className="p-5">
              <p className="text-[#00d4ff] text-xs font-bold mb-2">✓ INVITE LIVE FOR {result.email}</p>
              <p className="text-xs text-[#94a3b8] mb-2">Trial ends {new Date(result.trial_ends_at).toLocaleDateString()}</p>
              <div className="bg-[#030711] border border-[#1e3a5f] rounded p-2 text-[11px] font-mono break-all mb-2">{result.magic_link}</div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-[#00d4ff] text-black hover:bg-[#00b8e0]" onClick={copyLink}><Copy className="w-3 h-3 mr-1" /> Copy Link</Button>
                <a href={`sms:?&body=${encodeURIComponent("Your Counsel Records Search access: " + result.magic_link)}`} className="inline-flex items-center text-xs px-3 py-1.5 rounded bg-[#1e3a5f] text-white hover:bg-[#2a4a6f]">📱 Send via SMS</a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
