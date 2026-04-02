import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, Facebook, Linkedin } from "lucide-react";

interface ClientInfo {
  business_name: string;
  plan: string;
  contact_name: string | null;
}

interface FormData {
  fb_page_url: string;
  linkedin_page_url: string;
  brand_voice: string;
  target_audience: string;
  post_topics: string;
  avoid_topics: string;
}

interface ConnectStatus {
  facebook: boolean;
  linkedin: boolean;
}

function getNextPostingDay(): string {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // posting days: Mon=1, Wed=3, Fri=5
  const posting = [1, 3, 5];
  for (let i = 1; i <= 7; i++) {
    const next = (dow + i) % 7;
    if (posting.includes(next)) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    }
  }
  return "Monday";
}

export default function SocialConnect() {
  const [params] = useSearchParams();
  const clientId = params.get("client_id") || "";

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormData>({
    fb_page_url: "",
    linkedin_page_url: "",
    fb_access_token: "",
    linkedin_access_token: "",
    brand_voice: "",
    target_audience: "",
    post_topics: "",
    avoid_topics: "",
  });
  const [showFbTokenHelp, setShowFbTokenHelp] = useState(false);
  const [showLinkedInTokenHelp, setShowLinkedInTokenHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setLoadError("No client ID found in the URL. Please use the link from your welcome email.");
      setLoading(false);
      return;
    }
    supabase.functions
      .invoke("social-connect-intake", { body: { action: "get_client", client_id: clientId } })
      .then(({ data, error }) => {
        if (error || !data || data.error) {
          setLoadError("Could not load your account. Please use the link from your welcome email or contact Matt.");
        } else {
          setClient({ business_name: data.business_name, plan: data.plan, contact_name: data.contact_name });
        }
        setLoading(false);
      });
  }, [clientId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!form.fb_page_url && !form.linkedin_page_url) {
      setSubmitError("Please enter at least one social page URL.");
      return;
    }
    if (!form.brand_voice.trim()) {
      setSubmitError("Please enter 3 adjectives describing your brand voice.");
      return;
    }
    if (!form.post_topics.trim()) {
      setSubmitError("Please enter the topics you want to post about.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("social-connect-intake", {
      body: { action: "connect", client_id: clientId, ...form },
    });
    setSubmitting(false);
    if (error || !data || data.error) {
      setSubmitError(data?.error || "Something went wrong. Please try again or contact Matt at (313) 806-4952.");
      return;
    }
    setSuccess(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <p className="text-red-600 font-medium mb-2">Unable to load your account</p>
          <p className="text-gray-600 text-sm">{loadError}</p>
          <p className="text-gray-500 text-sm mt-4">
            Questions? Text or call Matt at{" "}
            <a href="tel:+13138064952" className="text-orange-600 font-medium">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">You're all set!</h1>
          <p className="text-gray-600 mb-4">
            Your first AI post goes out on <strong>{getNextPostingDay()}</strong>. We'll email you a preview first so
            you know exactly what's going out.
          </p>
          <p className="text-gray-500 text-sm">
            Questions? Text Matt at{" "}
            <a href="tel:+13138064952" className="text-orange-600 font-medium">(313) 806-4952</a>
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <img
              src="https://www.mattmichelstraining.com/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="text-sm text-gray-500">— Matt Michels, M² Training</span>
          </div>
        </div>
      </div>
    );
  }

  const firstName = client?.contact_name?.split(" ")[0] || null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="https://www.mattmichelstraining.com/images/matt-boat.jpg"
            alt="Matt Michels"
            className="w-14 h-14 rounded-full object-cover mx-auto mb-3"
          />
          <p className="text-sm text-gray-500 mb-4">Matt Michels — M² Training</p>
          <h1 className="text-2xl font-bold text-slate-800">
            {firstName ? `Hey ${firstName} — ` : ""}Let's connect your accounts
          </h1>
          {client && (
            <p className="text-gray-500 text-sm mt-1">
              {client.business_name} · {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)} plan
            </p>
          )}
        </div>

        {/* Step indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Step 2 of 2: Connect your accounts</span>
            <span>Almost done</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: "100%" }} />
          </div>
          <div className="flex mt-1 text-xs text-gray-400">
            <div className="flex-1 text-center">Payment ✓</div>
            <div className="flex-1 text-center font-semibold text-orange-600">Account setup</div>
          </div>
        </div>

        {/* Reassurance */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-4 mb-6 text-sm text-slate-700">
          This takes about 2 minutes. Once you submit, I'll review everything and your AI posts will start going out
          Mon, Wed, and Fri. You'll get an email preview before each post goes live.
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Facebook */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Facebook Business Page URL
            </label>
            <input
              type="url"
              name="fb_page_url"
              value={form.fb_page_url}
              onChange={handleChange}
              placeholder="https://facebook.com/yourpage"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Find this: go to your Facebook Page → About → Page transparency → see "Page URL"
            </p>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              LinkedIn Company Page URL
            </label>
            <input
              type="url"
              name="linkedin_page_url"
              value={form.linkedin_page_url}
              onChange={handleChange}
              placeholder="https://linkedin.com/company/yourcompany"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Find this: go to your LinkedIn Company Page → click the 3 dots (···) → Copy link
            </p>
          </div>

          {/* Facebook Access Token */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Facebook Page Access Token{" "}
              <span className="text-gray-400 font-normal">(optional — enables posting)</span>
            </label>
            <input
              type="password"
              name="fb_access_token"
              value={form.fb_access_token}
              onChange={handleChange}
              placeholder="EAABs..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowFbTokenHelp((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-700"
            >
              {showFbTokenHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              How to get this (3 steps)
            </button>
            {showFbTokenHelp && (
              <ol className="mt-2 text-xs text-gray-600 space-y-1 list-decimal list-inside bg-white rounded-lg p-3 border border-gray-100">
                <li>Go to <strong>Meta Business Suite</strong> (business.facebook.com)</li>
                <li>Click <strong>Settings</strong> → <strong>Pages</strong> → select your Page → <strong>Advanced</strong></li>
                <li>Under <strong>Page Access Tokens</strong>, click <strong>Generate token</strong> and copy it here</li>
              </ol>
            )}
          </div>

          {/* LinkedIn Access Token */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              LinkedIn Access Token{" "}
              <span className="text-gray-400 font-normal">(optional — enables posting)</span>
            </label>
            <input
              type="password"
              name="linkedin_access_token"
              value={form.linkedin_access_token}
              onChange={handleChange}
              placeholder="AQV..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowLinkedInTokenHelp((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-medium hover:text-orange-700"
            >
              {showLinkedInTokenHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              How to get this (3 steps)
            </button>
            {showLinkedInTokenHelp && (
              <ol className="mt-2 text-xs text-gray-600 space-y-1 list-decimal list-inside bg-white rounded-lg p-3 border border-gray-100">
                <li>Go to <strong>linkedin.com/developers</strong> → select or create your app</li>
                <li>Click <strong>Auth</strong> tab → <strong>OAuth 2.0 tools</strong> → <strong>Request access token</strong></li>
                <li>Check the <strong>w_organization_social</strong> scope → authorize → copy the token here</li>
              </ol>
            )}
          </div>

          {/* Brand Voice */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Brand Voice — 3 adjectives <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="brand_voice"
              value={form.brand_voice}
              onChange={handleChange}
              placeholder="e.g. professional, friendly, local"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              How would you describe your brand's personality in 3 words?
            </p>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Target Audience <span className="text-red-500">*</span>
            </label>
            <textarea
              name="target_audience"
              value={form.target_audience}
              onChange={handleChange}
              placeholder="e.g. Homeowners in Southeast Michigan, ages 35–65, who own their home and need help with repairs and improvements"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              required
            />
          </div>

          {/* Post Topics */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Post Topics <span className="text-red-500">*</span>
            </label>
            <textarea
              name="post_topics"
              value={form.post_topics}
              onChange={handleChange}
              placeholder="e.g. roofing tips, before/after project photos, seasonal offers, storm damage reminders, 5-star reviews"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              What kinds of content do you want the AI to create? More detail = better posts.
            </p>
          </div>

          {/* Avoid Topics */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Topics to Avoid{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="avoid_topics"
              value={form.avoid_topics}
              onChange={handleChange}
              placeholder="e.g. competitor names, pricing, political topics"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {submitError && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Submit — I'm ready to go"
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Questions? Text Matt at{" "}
            <a href="tel:+13138064952" className="text-orange-500">(313) 806-4952</a>
          </p>
        </form>
      </div>
    </div>
  );
}
