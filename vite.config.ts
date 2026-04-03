import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const SUPABASE_URL_FALLBACK = "https://eauvubfpanpeuxsrqesu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw";

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK;
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY_FALLBACK;

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
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
        includeAssets: ["favicon.ico", "favicon.png", "apple-touch-icon.png", "robots.txt"],
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
              src: "/app-icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/app-icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/app-icon-512.png",
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
  };
});
