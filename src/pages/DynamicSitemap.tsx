import { useEffect } from "react";

const SITEMAP_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate-sitemap`;

const DynamicSitemap = () => {
  useEffect(() => {
    window.location.replace(SITEMAP_URL);
  }, []);

  return null;
};

export default DynamicSitemap;
