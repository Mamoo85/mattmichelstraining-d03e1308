import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import WaitlistGate from "@/components/WaitlistGate";
import { ShoppingBag, CheckCircle, ArrowRight } from "lucide-react";

const INCLUDED = [
  "AI-written product titles and descriptions",
  "SEO-optimized bullet points for Amazon/Shopify",
  "Up to 20 product listings per month",
  "Keyword-rich copy to improve search ranking",
  "A/B title variations for testing",
  "Category-specific tone and formatting",
  "Works for Amazon, Shopify, Etsy, eBay, and more",
  "7-day free trial — cancel anytime",
];

export default function AIEcommerceListings() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-[#aaa] text-sm">Send us your product info and we'll have listings written within 48 hours.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="AI E-commerce Product Listings — $79/mo | M² Development" description="AI writes SEO-optimized product titles, descriptions, and bullet points for Amazon, Shopify, Etsy, and more. Up to 20 listings/month for $79." path="/ai-ecommerce-listings" />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6"><ShoppingBag size={11} /> AI Product Listings</div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Product Listings That<br /><span className="text-[#f97316]">Actually Get Found.</span></h1>
            <p className="text-[#aaa] max-w-2xl mx-auto mb-8 text-base leading-relaxed">AI writes SEO-optimized titles, bullet points, and descriptions for your Amazon, Shopify, or Etsy store. Better copy = more clicks = more sales. Up to 20 listings/month.</p>
            <button onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#f97316] hover:bg-[#ea6c10] text-white px-8 py-4 font-bold rounded-xl flex items-center gap-2 mx-auto">Start Free Trial <ArrowRight size={16} /></button>
            <p className="text-xs text-[#666] mt-4">$79/mo after trial · Up to 20 listings/mo · Cancel anytime</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INCLUDED.map(item => (
              <div key={item} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <CheckCircle size={15} className="text-[#f97316] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#ccc]">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="signup-form" className="px-4 pb-20">
          <div className="max-w-xl mx-auto">
            <WaitlistGate productName="AI Ecommerce Listings" description="AI-written product titles, descriptions, and bullet points optimized for Amazon, Shopify, and Etsy." price="See pricing" />
          </div>
        </section>
      </div>
    </>
  );
}
