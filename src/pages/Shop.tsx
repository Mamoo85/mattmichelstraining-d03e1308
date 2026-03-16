import AppNavbar from "@/components/AppNavbar";
import ShopGrid from "@/components/ShopGrid";

const Shop = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12">
      <ShopGrid />
    </div>
  </div>
);

export default Shop;
