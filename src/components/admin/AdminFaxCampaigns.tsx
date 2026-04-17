/**
 * AdminFaxCampaigns — Admin UI for B2B fax campaigns via Phaxio.
 * Mirrors AdminPostcardCampaigns. TCPA-safe: only sends to verified-public prospects.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Segment = "nursing_home" | "medical" | "municipal" | "industrial" | "legal" | "school";

const SEGMENTS: { value: Segment; label: string; auto: boolean }[] = [
  { value: "nursing_home", label: "🏥 Nursing Homes (CMS auto-pull)", auto: true },
  { value: "medical", label: "⚕️ Medical Practices (NPI auto-pull)", auto: true },
  { value: "municipal", label: "🏛️ Municipal Offices (manual)", auto: false },
  { value: "industrial", label: "🏭 Industrial / Manufacturing (manual)", auto: false },
  { value: "legal", label: "⚖️ Law Firms (manual)", auto: false },
  { value: "school", label: "🎓 Schools / Districts (manual)", auto: false },
];

const COST_PER_FAX = 0.07;

interface Campaign {
  id: string;
  name: string;
  target_segment: string;
  status: string;
  total_sent: number | null;
  total_cost: number | null;
  created_at: string;
  sent_at: string | null;
}

export default function AdminFaxCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<Segment>("nursing_home");
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [prospectCount, setProspectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadCampaigns() {
    const { data } = await supabase
      .from("fax_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setCampaigns((data as Campaign[]) || []);
  }

  async function loadProspectCount(seg: Segment) {
    const { count } = await supabase
      .from("fax_prospects")
      .select("id", { count: "exact", head: true })
      .eq("segment", seg)
      .eq("verified_public", true);
    setProspectCount(count || 0);
  }

  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => { loadProspectCount(segment); }, [segment]);

  async function pullProspects() {
    setBusy(true);
    setMsg("Pulling fresh prospects from public source…");
    const { data, error } = await supabase.functions.invoke("fax-prospect-finder", {
      body: { segment, limit: 100 },
    });
    setBusy(false);
    if (error) { setMsg(`❌ ${error.message}`); return; }
    setMsg(`✅ Found ${data?.found || 0} · Inserted ${data?.inserted || 0} new · ${data?.duplicates || 0} dupes`);
    loadProspectCount(segment);
  }

  async function createCampaign() {
    if (!name.trim() || !messageHtml.trim()) {
      setMsg("Name and message are required.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("fax_campaigns").insert({
      name, target_segment: segment, subject, message_html: messageHtml, status: "draft",
    });
    setBusy(false);
    if (error) { setMsg(`❌ ${error.message}`); return; }
    setName(""); setSubject(""); setMessageHtml("");
    setMsg("✅ Campaign created");
    loadCampaigns();
  }

  async function sendCampaign(id: string, costEstimate: number) {
    if (!confirm(`Send campaign? Cost: $${costEstimate.toFixed(2)}. This is irreversible.`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-fax-phaxio", {
      body: { campaign_id: id },
    });
    setBusy(false);
    if (error) { setMsg(`❌ ${error.message}`); return; }
    if (data?.error) { setMsg(`❌ ${data.error}`); return; }
    setMsg(`✅ Sent ${data?.sent || 0} · cost $${data?.cost || 0}`);
    loadCampaigns();
  }

  const estCost = prospectCount * COST_PER_FAX;
  const segmentMeta = SEGMENTS.find(s => s.value === segment);

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-xl font-bold">📠 Fax Campaigns (Phaxio)</h2>
        <p className="text-white/50 text-sm mt-1">
          B2B faxes to verified public business numbers only · auto opt-out footer · TCPA hardened.
          Caps: 200/run, 1000/month, $0.07/fax.
        </p>
      </div>

      {/* Campaign Builder */}
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-white/70 uppercase text-xs tracking-wide">New Campaign</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Campaign name (e.g. Nursing Home CNA Pitch — Apr 2026)"
            className="bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white"
          />
          <select
            value={segment} onChange={e => setSegment(e.target.value as Segment)}
            className="bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white"
          >
            {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <input
          value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="Subject line (printed on header)"
          className="w-full bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white"
        />

        <textarea
          value={messageHtml} onChange={e => setMessageHtml(e.target.value)}
          placeholder="Message HTML body (opt-out footer auto-injected at send time)"
          rows={8}
          className="w-full bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={createCampaign} disabled={busy}
            className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] rounded font-bold text-sm disabled:opacity-50"
          >
            {busy ? "…" : "Save Draft"}
          </button>
          {segmentMeta?.auto && (
            <button
              onClick={pullProspects} disabled={busy}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded text-sm border border-white/20"
            >
              {busy ? "…" : `🔄 Pull Fresh ${segmentMeta.label.split(" ")[1]} Prospects`}
            </button>
          )}
        </div>

        <div className="text-xs text-white/50 pt-2 border-t border-white/10">
          <strong className="text-white/70">{prospectCount}</strong> verified-public prospects in <code>{segment}</code> ·
          est cost if sent today: <strong className="text-[#00d4ff]">${estCost.toFixed(2)}</strong>
        </div>
      </div>

      {msg && (
        <div className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white/80">{msg}</div>
      )}

      {/* Campaign List */}
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h3 className="text-white/70 uppercase text-xs tracking-wide">Campaigns</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase text-white/40">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Segment</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Sent</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-white/30">No campaigns yet.</td></tr>
            )}
            {campaigns.map(c => {
              const isDraft = c.status === "draft";
              return (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-white/60">{c.target_segment}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      c.status === "sent" ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/60"
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">{c.total_sent ?? 0}</td>
                  <td className="px-4 py-3">${(c.total_cost ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {isDraft && (
                      <button
                        onClick={() => sendCampaign(c.id, prospectCount * COST_PER_FAX)}
                        disabled={busy || prospectCount === 0}
                        className="px-3 py-1.5 bg-[#00d4ff] text-[#0a1628] rounded text-xs font-bold disabled:opacity-30"
                      >
                        Confirm & Send ${(prospectCount * COST_PER_FAX).toFixed(2)}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
