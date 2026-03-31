import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Injects <link rel="preload"> for the LCP hero image so the browser
 * can discover it from the initial HTML without waiting for JS.
 */
function preloadLcpImage(): Plugin {
  return {
    name: "preload-lcp-image",
    enforce: "post",
    transformIndexHtml(html, ctx) {
      const bundle = ctx.bundle;
      if (!bundle) return html;

      let result = html;
      let heroLogoPath = "";

      for (const [fileName] of Object.entries(bundle)) {
        if (
          /m2-logo-[^/]*\.jpg$/.test(fileName) &&
          !fileName.includes("official") &&
          !fileName.includes("placeholder") &&
          !fileName.includes("splash")
        ) {
          heroLogoPath = `/${fileName}`;
        }
      }

      const tags: string[] = [];
      if (heroLogoPath) {
        tags.push(`<link rel="preload" as="image" href="${heroLogoPath}" fetchpriority="high" />`);
        result = result.replace("/assets/m2-logo-placeholder.jpg", heroLogoPath);
      }

      if (tags.length) result = result.replace("</head>", `${tags.join("\n")}\n</head>`);
      return result;
    },
  };
}

function asyncCss(): Plugin {
  return {
    name: "async-css",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        (_match, href) =>
          `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">\n<noscript><link rel="stylesheet" href="${href}"></noscript>`
      );
    },
  };
}

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
    target: ["es2020", "safari14"],
    minify: "esbuild",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": [
            "@tanstack/react-query",
            "@tanstack/react-query-persist-client",
            "@tanstack/query-sync-storage-persister",
          ],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
          ],
          "vendor-motion": ["framer-motion"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
}));
