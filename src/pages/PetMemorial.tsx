import { useState } from "react";
import { Heart, BookOpen, FileText, Globe } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";

const SPECIES_OPTIONS = [
  "Dog",
  "Cat",
  "Bird",
  "Rabbit",
  "Guinea Pig",
  "Hamster",
  "Fish",
  "Horse",
  "Other",
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "Personalized Poem",
    description:
      "A 10-14 line rhyming poem written from your pet's perspective — capturing their personality and the love you shared.",
  },
  {
    icon: FileText,
    title: "Tribute Narrative",
    description:
      "Three heartfelt paragraphs celebrating who your pet was, the memories you made, and the legacy they leave behind.",
  },
  {
    icon: Globe,
    title: "Permanent Memorial Page",
    description:
      "A shareable public page at your own URL — so friends and family can visit and remember your pet anytime.",
  },
];

export default function PetMemorial() {
  const [form, setForm] = useState({
    pet_name: "",
    pet_species: "",
    pet_breed: "",
    pet_age: "",
    personality_traits: "",
    favorite_memories: "",
    special_message: "",
    customer_name: "",
    customer_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pet-memorial-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout. Please try again.");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  const submitLabel = form.pet_name
    ? `Create ${form.pet_name}'s Memorial →`
    : "Create Their Memorial →";

  return (
    <>
      <SEOHead
        title="AI Pet Memorial & Tribute | M2 Development"
        description="Honor your beloved pet with a personalized poem, tribute narrative, and permanent memorial page — crafted by AI, shaped by your memories. One-time $79."
      />
      <div className="min-h-screen bg-amber-50 text-stone-800">

        {/* Hero */}
        <div className="bg-stone-800 text-amber-50 px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-700/30 border border-amber-600/40 rounded-full px-4 py-1.5 mb-6">
            <Heart size={14} className="text-amber-400" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">Pet Memorial Service</span>
          </div>
          <h1 className="text-3xl font-black mb-4 leading-tight font-serif">
            Honor the pet who<br />changed your life
          </h1>
          <p className="text-amber-100 text-base max-w-xl mx-auto leading-relaxed mb-6">
            A personalized poem, tribute narrative, and permanent memorial page — crafted from your memories and delivered to your inbox within minutes.
          </p>
          <div className="inline-block bg-amber-600 text-white font-black text-xl px-6 py-2 rounded-full">
            $79 one-time
          </div>
        </div>

        {/* Features */}
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-14">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white border border-amber-200 rounded-lg p-5 shadow-sm"
              >
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
                  <f.icon size={18} className="text-amber-700" />
                </div>
                <h3 className="font-bold text-sm text-stone-800 mb-1">{f.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Heart size={18} className="text-amber-600" />
              <h2 className="text-lg font-bold text-stone-800">Tell us about your pet</h2>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Pet's Name <span className="text-amber-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="pet_name"
                    value={form.pet_name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Buddy"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Species
                  </label>
                  <select
                    name="pet_species"
                    value={form.pet_species}
                    onChange={handleChange}
                    className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                  >
                    <option value="">Select species…</option>
                    {SPECIES_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Breed
                  </label>
                  <input
                    type="text"
                    name="pet_breed"
                    value={form.pet_breed}
                    onChange={handleChange}
                    placeholder="e.g. Golden Retriever"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Age / Years Together
                  </label>
                  <input
                    type="text"
                    name="pet_age"
                    value={form.pet_age}
                    onChange={handleChange}
                    placeholder="e.g. 12 years"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                  Personality Traits
                </label>
                <textarea
                  name="personality_traits"
                  value={form.personality_traits}
                  onChange={handleChange}
                  rows={3}
                  placeholder="What made them unique? Were they playful, gentle, mischievous, loyal? Any funny quirks or habits?"
                  className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                  Favorite Memories
                </label>
                <textarea
                  name="favorite_memories"
                  value={form.favorite_memories}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Share your favorite moments together. Walks, cuddles, the way they greeted you, places you went, things you did together…"
                  className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                  Special Message or Anything Else to Include
                </label>
                <textarea
                  name="special_message"
                  value={form.special_message}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Anything else you'd like the memorial to reflect — a nickname, a song, a phrase they inspired, a final message to them…"
                  className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50 resize-none"
                />
              </div>

              <hr className="border-amber-100" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Your Name <span className="text-amber-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={form.customer_name}
                    onChange={handleChange}
                    required
                    placeholder="Your full name"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Your Email <span className="text-amber-600">*</span>
                  </label>
                  <input
                    type="email"
                    name="customer_email"
                    value={form.customer_email}
                    onChange={handleChange}
                    required
                    placeholder="where we'll send the memorial"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white font-bold text-base py-3.5 rounded-lg transition-colors mt-2"
              >
                {loading ? "Redirecting to payment…" : submitLabel}
              </button>

              <p className="text-center text-xs text-stone-400 mt-1">
                Secure checkout via Stripe · $79 one-time · Memorial delivered within minutes
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export function PetMemorialSuccess() {
  return (
    <>
      <SEOHead
        title="Thank You — Pet Memorial in Progress | M2 Development"
        description="Your pet memorial is being created. Check your inbox in a few minutes."
      />
      <div className="min-h-screen bg-amber-50 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart size={32} className="text-amber-600" />
          </div>
          <h1 className="text-3xl font-black text-stone-800 font-serif mb-4">
            Your memorial is being created
          </h1>
          <p className="text-stone-600 text-base leading-relaxed mb-6">
            Thank you for trusting us to honor your companion. Your personalized poem, tribute, and memorial page are being crafted right now and will arrive in your inbox within a few minutes.
          </p>
          <div className="bg-white border border-amber-200 rounded-xl p-6 text-left space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg leading-none mt-0.5">📬</span>
              <p className="text-sm text-stone-600 leading-relaxed"><strong className="text-stone-800">Check your email</strong> — your memorial will arrive within a few minutes. Check spam if you don't see it.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg leading-none mt-0.5">🔗</span>
              <p className="text-sm text-stone-600 leading-relaxed"><strong className="text-stone-800">Permanent page included</strong> — your email will include a link to share with friends and family.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg leading-none mt-0.5">💬</span>
              <p className="text-sm text-stone-600 leading-relaxed"><strong className="text-stone-800">Questions?</strong> Reply to the email or text Matt at <a href="tel:+13138064952" className="text-amber-700 font-semibold">(313) 806-4952</a>.</p>
            </div>
          </div>
          <a
            href="/"
            className="inline-block bg-stone-800 text-amber-50 font-bold px-6 py-3 rounded-lg hover:bg-stone-700 transition-colors text-sm"
          >
            Back to Home
          </a>
        </div>
      </div>
    </>
  );
}
