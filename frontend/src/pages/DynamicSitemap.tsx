import { useEffect } from "react";

const SITEMAP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sitemap`;

const DynamicSitemap = () => {
  useEffect(() => {
    window.location.replace(SITEMAP_URL);
  }, []);

  return null;
};

export default DynamicSitemap;
