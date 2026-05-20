import { Routes, Route } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { GuildGrainProvider } from "./state/CartContext";
import SiteShell from "./layout/SiteShell";
import GGHome from "./pages/Home";
import GGShop from "./pages/Shop";
import GGProductDetail from "./pages/ProductDetail";
import GGCheckout from "./pages/Checkout";
import GGSeller from "./pages/SellerDashboard";
import "./theme.css";

export default function GuildGrain() {
  return (
    <GuildGrainProvider>
      <Helmet>
        <title>Guild & Grain — Personalized Gifts & Artisan Home Decor</title>
        <meta name="description" content="A vetted guild of artisans crafting personalized gifts and aesthetic home goods. Made to last, ready to gift." />
      </Helmet>
      <SiteShell>
        <Routes>
          <Route index element={<GGHome />} />
          <Route path="shop" element={<GGShop />} />
          <Route path="product/:slug" element={<GGProductDetail />} />
          <Route path="checkout" element={<GGCheckout />} />
          <Route path="seller" element={<GGSeller />} />
        </Routes>
      </SiteShell>
    </GuildGrainProvider>
  );
}
