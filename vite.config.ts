import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

/**
 * Injects <link rel="preload"> for the LCP hero image so the browser
 * can discover it from the initial HTML without waiting for JS.
 */
function preloadLcpImage(): Plugin {
  return {
    name: "preload-lcp-image",
    enforce: "post",
    transformIndexHtml(html, ctx) {
      // In build mode, find the hashed m2-logo asset in the bundle
      const bundle = ctx.bundle;
      if (!bundle) return html; // dev mode — skip

      for (const [fileName] of Object.entries(bundle)) {
        if (/m2-logo-[^/]*\.jpg$/.test(fileName) && !fileName.includes("official")) {
          const tag = `<link rel="preload" as="image" href="/${fileName}" fetchpriority="high" />`;
          return html.replace("</head>", `${tag}\n</head>`);
        }
      }
      return html;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    preloadLcpImage(),
    react(),
    mode === "development" && componentTagger(),
    ViteImageOptimizer({
      jpg: { quality: 75 },
      jpeg: { quality: 75 },
      png: { quality: 80 },
    }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "robots.txt"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"],
      },
      manifest: {
        name: "M² Training — Youth Strength Coach",
        short_name: "M² Training",
        description: "Youth strength training programs & coaching from Coach Matt Michels.",
        theme_color: "#0d0d0d",
        background_color: "#0d0d0d",
        display: "standalone",
        orientation: "portrait",
        start_url: "/dashboard",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          ui: ["framer-motion"],
          charts: ["recharts"],
          supabase: ["@supabase/supabase-js"],
          dates: ["date-fns"],
        },
      },
    },
    target: "esnext",
    minify: "esbuild",
  },
}));
