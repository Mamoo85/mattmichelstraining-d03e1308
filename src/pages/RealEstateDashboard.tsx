import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Upload, Users, Mail, Clock, Copy, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ReClient {
  id: string;
  agent_name: string;
  brokerage: string;
  phone: string;
  website: string;
  zip_codes: string;
  brand_color: string;
  contacts_count: number;
  last_sent_at: string | null;
  subscription_status: string;
  customer_email: string;
}

interface Issue {
  id: string;
  zip_code: string;
  subject: string;
  sent_count: number;
  sent_at: string;
  created_at: string;
}

interface Contact {
  id: string;
  contact_email: string;
  contact_name: string | null;
  added_at: string;
}

export default function RealEstateDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [client, setClient] = useState<ReClient | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"contacts" | "issues" | "branding">("contacts");

  // Contact upload state
  const [csvText, setCsvText] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ added: number; valid: number; total: number } | null>(null);

  // Branding state
  const [brandColor, setBrandColor] = useState("#1a4a7a");
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?redirect=/real-estate-newsletter/dashboard");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    setLoadingData(true);
    try {
      const { data: clientData } = await (supabase.from as any)("re_newsletter_clients")
        .select("*")
        .eq("user_id", user!.id)
        .eq("subscription_status", "active")
        .limit(1)
        .single();

      if (!clientData) {
        setLoadingData(false);
        return;
      }

      setClient(clientData);
      setBrandColor(clientData.brand_color || "#1a4a7a");

      const [{ data: issuesData }, { data: contactsData }] = await Promise.all([
        (supabase.from as any)("re_newsletter_issues")
          .select("id, zip_code, subject, sent_count, sent_at, created_at")
          .eq("client_id", clientData.id)
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase.from as any)("re_newsletter_contacts")
          .select("id, contact_email, contact_name, added_at")
          .eq("client_id", clientData.id)
          .order("added_at", { ascending: false })
          .limit(500),
      ]);

      setIssues(issuesData || []);
      setContacts(contactsData || []);
    } catch (e) {
      console.error("[DASHBOARD] Error loading data:", e);
    } finally {
      setLoadingData(false);
    }
  }

  // Parse CSV/pasted text into contacts array
  function parseContactsText(raw: string): { email: string; name?: string }[] {
    const lines = raw.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
    const results: { email: string; name?: string }[] = [];
    for (const line of lines) {
      // Try comma-separated: "Name, email" or "email, Name" or just "email"
      const parts = line.split(",").map((p) => p.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (parts.length >= 2) {
        const emailPart = parts.find((p) => emailRegex.test(p));
        const namePart = parts.find((p) => !emailRegex.test(p));
        if (emailPart) results.push({ email: emailPart, name: namePart || undefined });
      } else if (parts.length === 1 && emailRegex.test(parts[0])) {
        results.push({ email: parts[0] });
      }
    }
    return results;
  }

  async function handleUploadCsv() {
    if (!csvText.trim()) return;
    const parsed = parseContactsText(csvText);
    if (parsed.length === 0) {
      toast.error("No valid email addresses found. Check your formatting.");
      return;
    }
    await uploadContacts(parsed);
    setCsvText("");
  }

  async function handleAddManual() {
    if (!manualEmail.trim()) return;
    await uploadContacts([{ email: manualEmail.trim(), name: manualName.trim() || undefined }]);
    setManualEmail("");
    setManualName("");
  }

  async function uploadContacts(list: { email: string; name?: string }[]) {
    setUploading(true);
    setUploadResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/functions/v1/re-newsletter-add-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contacts: list }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadResult({ added: data.added, valid: data.valid, total: data.total_submitted });
      toast.success(`Added ${data.added} new contacts!`);
      await fetchData(); // Refresh
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    await (supabase.from as any)("re_newsletter_contacts").delete().eq("id", contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    toast.success("Contact removed");
  }

  async function handleSaveBranding() {
    if (!client) return;
    setSavingBrand(true);
    try {
      await (supabase.from as any)("re_newsletter_clients")
        .update({ brand_color: brandColor })
        .eq("id", client.id);
      toast.success("Branding saved — applies to your next newsletter");
      setClient((prev) => prev ? { ...prev, brand_color: brandColor } : prev);
    } catch {
      toast.error("Failed to save branding");
    } finally {
      setSavingBrand(false);
    }
  }

  function copyEmailList() {
    const list = contacts.map((c) => c.contact_email).join("\n");
    navigator.clipboard.writeText(list);
    toast.success("Email list copied to clipboard");
  }

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!user) return null;

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertCircle size={40} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-black mb-3">No Active Subscription Found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            We couldn't find an active Real Estate Newsletter subscription linked to your account. Make sure you checked out with the same email you used to sign in.
          </p>
          <a
            href="/real-estate-newsletter"
            className="inline-block bg-[#1a4a7a] text-white px-6 py-3 font-bold text-sm hover:bg-[#163d66] transition-all"
          >
            Subscribe — $79/mo
          </a>
        </div>
      </div>
    );
  }

  const zipList = (client.zip_codes || "").split(/[\n,]+/).map((z) => z.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <div style={{ background: client.brand_color || "#1a4a7a" }} className="text-white px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-75 mb-2">AI Real Estate Newsletter · Dashboard</p>
          <h1 className="text-2xl font-black mb-1">{client.agent_name || client.customer_email}</h1>
          {client.brokerage && <p className="text-white/80 text-sm">{client.brokerage}</p>}
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <span className="bg-white/15 px-3 py-1 rounded-full">
              <strong>{contacts.length}</strong> contacts
            </span>
            <span className="bg-white/15 px-3 py-1 rounded-full">
              <strong>{zipList.length}</strong> zip code{zipList.length !== 1 ? "s" : ""}
            </span>
            <span className="bg-white/15 px-3 py-1 rounded-full">
              <strong>{issues.length}</strong> issues sent
            </span>
            {client.last_sent_at && (
              <span className="bg-white/15 px-3 py-1 rounded-full">
                Last sent: {new Date(client.last_sent_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Zip Codes */}
        <div className="bg-muted/30 border border-border rounded-lg p-5 mb-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Zip Codes Covered Weekly</p>
          <div className="flex flex-wrap gap-2">
            {zipList.map((zip) => (
              <span key={zip} className="bg-[#1a4a7a]/10 border border-[#1a4a7a]/30 text-[#1a4a7a] dark:text-blue-300 px-3 py-1 rounded-full text-sm font-bold">
                {zip}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">To add or change zip codes, email matt@mattmichelstraining.com.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {[
            { key: "contacts", label: `Contacts (${contacts.length})`, icon: <Users size={14} /> },
            { key: "issues", label: `Sent Issues (${issues.length})`, icon: <Mail size={14} /> },
            { key: "branding", label: "Branding", icon: <Clock size={14} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-px ${
                activeTab === tab.key
                  ? "border-[#1a4a7a] text-[#1a4a7a] dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div className="space-y-6">

            {/* Upload Section */}
            <div className="border border-border rounded-lg p-5">
              <h2 className="font-black text-base mb-4 flex items-center gap-2">
                <Upload size={16} className="text-[#1a4a7a]" /> Upload Contacts
              </h2>

              {/* CSV Paste */}
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Paste CSV or Email List
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  One email per line, or <code className="bg-muted px-1 rounded">Name, email@example.com</code> format
                </p>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={6}
                  placeholder={`john@example.com\nSarah Connor, sarah@example.com\njane@gmail.com`}
                  className="w-full border border-border bg-background px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#1a4a7a] resize-none rounded"
                />
                <button
                  onClick={handleUploadCsv}
                  disabled={uploading || !csvText.trim()}
                  className="mt-2 bg-[#1a4a7a] text-white px-5 py-2 font-bold text-sm hover:bg-[#163d66] transition-all disabled:opacity-50 flex items-center gap-2 rounded"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Upload List
                </button>
              </div>

              <hr className="border-border mb-5" />

              {/* Manual Add */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Add Single Contact
                </label>
                <div className="flex gap-3 flex-wrap">
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Full Name (optional)"
                    className="flex-1 min-w-[160px] border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-[#1a4a7a] rounded"
                  />
                  <input
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="email@example.com"
                    type="email"
                    className="flex-1 min-w-[200px] border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-[#1a4a7a] rounded"
                    onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
                  />
                  <button
                    onClick={handleAddManual}
                    disabled={uploading || !manualEmail.trim()}
                    className="bg-[#1a4a7a] text-white px-4 py-2.5 font-bold text-sm hover:bg-[#163d66] transition-all disabled:opacity-50 rounded"
                  >
                    Add
                  </button>
                </div>
              </div>

              {uploadResult && (
                <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded p-3 flex items-start gap-2">
                  <CheckCircle size={15} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Added <strong>{uploadResult.added}</strong> new contacts ({uploadResult.valid} valid of {uploadResult.total} submitted — duplicates skipped automatically)
                  </p>
                </div>
              )}
            </div>

            {/* Contact List */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border">
                <p className="text-sm font-bold">{contacts.length} Contacts</p>
                {contacts.length > 0 && (
                  <button onClick={copyEmailList} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-all">
                    <Copy size={12} /> Copy list
                  </button>
                )}
              </div>
              {contacts.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  No contacts yet. Upload your sphere of influence above to get started.
                </div>
              ) : (
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-all">
                      <div>
                        {c.contact_name && <p className="text-sm font-semibold text-foreground">{c.contact_name}</p>}
                        <p className="text-sm text-muted-foreground">{c.contact_email}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteContact(c.id)}
                        className="text-muted-foreground hover:text-red-500 transition-all p-1"
                        title="Remove contact"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Issues Tab */}
        {activeTab === "issues" && (
          <div className="border border-border rounded-lg overflow-hidden">
            {issues.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                No newsletters sent yet. Your first issue will go out on the next weekly cycle after you've uploaded contacts.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {issues.map((issue) => (
                  <div key={issue.id} className="px-5 py-4 hover:bg-muted/20 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground mb-0.5">{issue.subject}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {issue.zip_code && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              ZIP {issue.zip_code}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {issue.sent_count} recipients
                          </span>
                          {issue.sent_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(issue.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <CheckCircle size={15} className="text-green-500 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === "branding" && (
          <div className="border border-border rounded-lg p-5 max-w-md">
            <h2 className="font-black text-base mb-5">Newsletter Branding</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Agent Name (on newsletters)
                </label>
                <p className="text-sm font-semibold text-foreground">{client.agent_name || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">To update your name, contact matt@mattmichelstraining.com</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Brokerage
                </label>
                <p className="text-sm font-semibold text-foreground">{client.brokerage || "—"}</p>
              </div>

              <hr className="border-border" />

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Brand Color
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-14 h-10 cursor-pointer border-0 bg-transparent p-0 rounded"
                  />
                  <div>
                    <p className="text-sm font-mono font-bold text-foreground">{brandColor}</p>
                    <p className="text-xs text-muted-foreground">Used for email header and CTA button</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-3 rounded overflow-hidden border border-border">
                  <div style={{ background: brandColor }} className="p-3 text-white text-sm font-bold">
                    Newsletter Header Preview
                  </div>
                  <div className="p-3 bg-white border-t border-slate-200 text-center">
                    <span style={{ background: brandColor }} className="inline-block text-white px-4 py-2 text-xs font-bold rounded">
                      CTA Button Preview
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSaveBranding}
                  disabled={savingBrand || brandColor === client.brand_color}
                  className="mt-4 bg-[#1a4a7a] text-white px-5 py-2 font-bold text-sm hover:bg-[#163d66] transition-all disabled:opacity-50 rounded"
                >
                  {savingBrand ? "Saving..." : "Save Brand Color"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
