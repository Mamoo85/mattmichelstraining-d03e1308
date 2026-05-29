// ServicesAdmin.tsx — Master e-commerce dashboard: all DWA service subscribers
// Shows every active product line, subscriber counts, MRR, last delivery, and quick actions.
// Route: /dwa-admin/services

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Users, DollarSign, Clock, AlertCircle, CheckCircle2,
  Play, ExternalLink, Video, Newspaper, Bell, Mic, FileVideo, Mail
} from "lucide-react";

// ─── Product definitions ──────────────────────────────────────────────────────
interface ProductConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  price: number;        // monthly price
  table: string;        // DB table name
  project: "primary" | "secondary";
  ctaUrl: string;
  detailRoute: string;
  color: string;
  deliveryFunction?: string;
}

const PRODUCTS: ProductConfig[] = [
  {
    id: "captions",
    name: "AI Social Captions",
    icon: <Newspaper className="w-5 h-5" />,
    price: 29,
    table: "social_captions_clients",
    project: "primary",
    ctaUrl: "detroitwebagent.com/ai-social-captions",
    detailRoute: "/dwa-admin/services/captions",
    color: "bg-blue-500",
    deliveryFunction: "ai-social-captions-generator",
  },
  {
    id: "church",
    name: "AI Church Newsletter",
    icon: <Newspaper className="w-5 h-5" />,
    price: 29,
    table: "church_newsletter_clients",
    project: "primary",
    ctaUrl: "detroitwebagent.com/ai-church-newsletter",
    detailRoute: "/dwa-admin/services/church",
    color: "bg-purple-500",
    deliveryFunction: "church-newsletter-generator",
  },
  {
    id: "ag-alerts",
    name: "Ag Price Alerts",
    icon: <Bell className="w-5 h-5" />,
    price: 79,
    table: "ag_price_alert_clients",
    project: "secondary",
    ctaUrl: "detroitwebagent.com/ag-price-alerts",
    detailRoute: "/dwa-admin/services/ag-alerts",
    color: "bg-amber-500",
  },
  {
    id: "podcast",
    name: "Podcast Show Notes",
    icon: <Mic className="w-5 h-5" />,
    price: 49,
    table: "podcast_clients",
    project: "secondary",
    ctaUrl: "detroitwebagent.com/podcast-show-notes",
    detailRoute: "/dwa-admin/services/podcast",
    color: "bg-red-500",
    deliveryFunction: "podcast-show-notes-generator",
  },
  {
    id: "video-scripts",
    name: "AI Video Scripts",
    icon: <FileVideo className="w-5 h-5" />,
    price: 39,
    table: "video_script_clients",
    project: "primary",
    ctaUrl: "detroitwebagent.com/ai-video-scripts",
    detailRoute: "/dwa-admin/services/video-scripts",
    color: "bg-cyan-500",
    deliveryFunction: "video-script-generator",
  },
  {
    id: "dead-leads",
    name: "Dead Lead Reactivation",
    icon: <Mail className="w-5 h-5" />,
    price: 49,
    table: "dead_lead_campaigns",
    project: "primary",
    ctaUrl: "detroitwebagent.com/dead-lead-reactivation",
    detailRoute: "/dwa-admin/services/dead-leads",
    color: "bg-orange-500",
  },
  {
    id: "shorts",
    name: "YouTube Shorts Engine",
    icon: <Video className="w-5 h-5" />,
    price: 0, // internal tool
    table: "youtube_shorts",
    project: "secondary",
    ctaUrl: "youtube.com/@detroitwebagency",
    detailRoute: "/dwa-admin/shorts",
    color: "bg-green-500",
  },
];

// ─── Supabase URLs ──────────────────────────────────────────────────────────
const PRIMARY_URL = "https://eauvubfpanpeuxsrqesu.supabase.co";
const SECONDARY_URL = "https://zmyczlfuufhngzovkjdh.supabase.co";
const SECONDARY_ANON = "eyJ.REDACTED.JWT";

async function fetchProductStats(product: ProductConfig): Promise<{
  count: number;
  lastActivity?: string;
  error?: string;
}> {
  try {
    if (product.project === "primary") {
      const { count, error } = await supabase
        .from(product.table as Parameters<typeof supabase.from>[0])
        .select("*", { count: "exact", head: true });
      if (error) return { count: 0, error: error.message };
      return { count: count ?? 0 };
    } else {
      // Secondary project — use REST API
      const res = await fetch(
        `${SECONDARY_URL}/rest/v1/${product.table}?select=count`,
        {
          headers: {
            "apikey": SECONDARY_ANON,
            "Authorization": `Bearer ${SECONDARY_ANON}`,
            "Prefer": "count=exact",
          },
        }
      );
      const countHeader = res.headers.get("content-range");
      const count = countHeader ? parseInt(countHeader.split("/")[1] ?? "0") : 0;
      return { count };
    }
  } catch (e) {
    return { count: 0, error: String(e) };
  }
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: ProductConfig }) {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["service-stats", product.id],
    queryFn: () => fetchProductStats(product),
    staleTime: 60_000,
  });

  const mrr = (stats?.count ?? 0) * product.price;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(product.detailRoute)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg text-white ${product.color}`}>
              {product.icon}
            </div>
            <CardTitle className="text-base">{product.name}</CardTitle>
          </div>
          {product.price > 0 && (
            <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
              ${product.price}/mo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <div className="text-center">
            <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" />
              <span>Subscribers</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mx-auto mt-1" />
            ) : (
              <div className="text-2xl font-bold text-gray-900">{stats?.count ?? 0}</div>
            )}
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span>MRR</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mx-auto mt-1" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {product.price > 0 ? `$${mrr.toLocaleString()}` : "—"}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Status</span>
            </div>
            <div className="mt-1">
              {stats?.error ? (
                <div className="flex items-center justify-center gap-1 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">Table missing</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs">Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-xs text-gray-400">{product.ctaUrl}</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); window.open(`https://${product.ctaUrl}`, "_blank"); }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); navigate(product.detailRoute); }}
            >
              View Detail
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ServicesAdmin() {
  const navigate = useNavigate();

  // Total MRR query
  const { data: allStats } = useQuery({
    queryKey: ["all-service-stats"],
    queryFn: async () => {
      const results = await Promise.allSettled(PRODUCTS.map(fetchProductStats));
      let totalMrr = 0;
      let totalSubs = 0;
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          totalMrr += (r.value.count ?? 0) * PRODUCTS[i].price;
          totalSubs += r.value.count ?? 0;
        }
      });
      return { totalMrr, totalSubs };
    },
    staleTime: 60_000,
  });

  const paidProducts = PRODUCTS.filter(p => p.price > 0);
  const internalProducts = PRODUCTS.filter(p => p.price === 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dwa-admin")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Services Dashboard</h1>
            <p className="text-sm text-gray-500">All DWA e-commerce products — subscribers, revenue, delivery status</p>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">Total Active Products</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{paidProducts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">Total Subscribers (all products)</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">
                {allStats?.totalSubs ?? "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">Potential MRR</div>
              <div className="text-3xl font-bold text-green-600 mt-1">
                {allStats ? `$${allStats.totalMrr.toLocaleString()}` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-6">
          <Button onClick={() => navigate("/dwa-admin/shorts")} className="bg-green-600 hover:bg-green-700">
            <Video className="w-4 h-4 mr-2" /> YouTube Shorts Manager
          </Button>
          <Button variant="outline" onClick={() => navigate("/dwa-admin/marketing-hub")}>
            <Play className="w-4 h-4 mr-2" /> Marketing Hub
          </Button>
          <Button variant="outline" onClick={() => navigate("/dwa-admin/services/enroll")}>
            <Users className="w-4 h-4 mr-2" /> Enroll Matt in All Products
          </Button>
        </div>

        {/* Paid products */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Paid Products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {paidProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Internal tools */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Internal Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {internalProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Matt enrollment reminder */}
        <Card className="mt-8 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800">Matt's Self-Enrollment Status</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Matt should be enrolled in every product to receive exactly what customers receive.
                  Check each service detail page to verify your enrollment and delivery.
                </p>
                <div className="mt-3 text-xs text-amber-600 font-mono bg-amber-100 p-2 rounded">
                  matt@detroitwebagent.com enrolled in: Ag Price Alerts ✅ · Podcast Show Notes ✅<br />
                  Needs enrollment via primary DB: Social Captions · Church Newsletter
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
