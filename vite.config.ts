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
        if (/m2-logo-[^/]*\.jpg$/.test(fileName) && !fileName.includes("official") && !fileName.includes("placeholder")) {
          const hashedPath = `/${fileName}`;
          const tag = `<link rel="preload" as="image" href="${hashedPath}" fetchpriority="high" />`;
          // Also replace the static hero shell placeholder src with the hashed asset
          let result = html.replace("</head>", `${tag}\n</head>`);
          result = result.replace("/assets/m2-logo-placeholder.jpg", hashedPath);
          return result;
        }
      }
      return html;
    },
  };
}

/**
 * Converts render-blocking CSS <link rel="stylesheet"> tags into
 * non-blocking preload links with an onload swap, so the browser
 * can paint the inlined critical CSS first.
 */
function asyncCss(): Plugin {
  return {
    name: "async-css",
    enforce: "post",
    transformIndexHtml(html) {
      // Match Vite-injected stylesheet links (hashed assets only)
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        (_match, href) =>
          `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">\n<noscript><link rel="stylesheet" href="${href}"></noscript>`
      );
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
    asyncCss(),
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
        navigateFallbackDenylist: [/^\/~oauth/, /[?#].*access_token/, /[?#].*type=recovery/],
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
          supa: ["@supabase/supabase-js"],
        },
      },
    },
    target: "esnext",
    minify: "esbuild",
  },
}));
