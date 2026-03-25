import { motion } from "framer-motion";
import SEOHead from "@/components/layout/SEOHead";
import { ExternalLink, ShoppingBag, ArrowRight, Ruler, Truck, RotateCcw, Star } from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import { Link } from "react-router-dom";


import merchTee from "@/assets/merch-classic-tee.png";
import merchLongSleeve from "@/assets/merch-long-sleeve.png";
import merchTank from "@/assets/merch-tank.png";
import merchCrewneck from "@/assets/merch-crewneck.png";
import merchHoodie from "@/assets/merch-hoodie.png";
import merchSnapback from "@/assets/merch-snapback.png";
import merchBeanie from "@/assets/merch-beanie.png";
import merchYouthHoodie from "@/assets/merch-youth-hoodie.png";

const BONFIRE_STORE = "https://www.bonfire.com/store/m2-training/";

const ALL_PRODUCTS = [
  { name: "Premium Pullover Hoodie", price: "$66.49", img: merchHoodie, url: "https://www.bonfire.com/m2-classics/?productType=79372160-4724-45ba-b119-518d097bfbe3", tag: "Best Seller", category: "Tops" },
  { name: "Premium Unisex Tee", price: "$28.49", img: merchTee, url: "https://www.bonfire.com/m2-classics/?productType=bacf6cd6-b53d-469c-ab96-02afe5b15f71", tag: "Classic", category: "Tops" },
  { name: "Crewneck Sweatshirt", price: "$38.49", img: merchCrewneck, url: "https://www.bonfire.com/m2-classics/?productType=b2ffe678-62bc-415a-be70-acc2e9b75bbc", tag: "New", category: "Tops" },
  { name: "Long Sleeve Tee", price: "$33.49", img: merchLongSleeve, url: "https://www.bonfire.com/m2-classics/?productType=b65f9374-447d-40a6-a17c-ecbc2c823eda", category: "Tops" },
  { name: "Cotton Tank", price: "$29.49", img: merchTank, url: "https://www.bonfire.com/m2-classics/?productType=440c2166-9c34-4487-abf4-fcb388e889cb", category: "Tops" },
  { name: "Youth Hoodie", price: "$39.99", img: merchYouthHoodie, url: "https://www.bonfire.com/m2-classics/?productType=02f7d820-80e5-4fc5-9292-f4eeccd35b55", tag: "Youth", category: "Tops" },
  { name: "Snapback Hat", price: "$28.49", img: merchSnapback, url: "https://www.bonfire.com/m2-hats/?productType=24b76e56-b4e7-4478-babe-7e5cad23dbb9", category: "Accessories" },
  { name: "Cuffed Beanie", price: "$26.49", img: merchBeanie, url: "https://www.bonfire.com/m2-hats/?productType=f612e17e-71da-49e5-aa7f-f547c501e167", category: "Accessories" },
];

const SIZE_CHART = [
  { size: "S", chest: '34-36"', waist: '28-30"' },
  { size: "M", chest: '38-40"', waist: '32-34"' },
  { size: "L", chest: '42-44"', waist: '36-38"' },
  { size: "XL", chest: '46-48"', waist: '40-42"' },
  { size: "2XL", chest: '50-52"', waist: '44-46"' },
  { size: "3XL", chest: '54-56"', waist: '48-50"' },
];

const Merch = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="M² Merch — Training Apparel"
      description="Official M² Training gear. Premium hoodies, tees, tanks, and hats. Rep the brand that keeps athletes moving right."
      path="/merch"
    />
    <AppNavbar />
    <div className="pt-14">
      {/* Hero banner */}
      <section className="bg-card border-b border-border">
        <div className="container py-10 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <ShoppingBag size={20} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                Official M² Gear
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground mb-3">
              Rep M² Training
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto mb-6">
              You earned it in the gym. Now wear it everywhere else. Premium quality gear printed and shipped direct from Bonfire.
            </p>
            <a
              href={BONFIRE_STORE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
            >
              Shop Full Collection <ArrowRight size={14} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Info strip */}
      <div className="border-b border-border bg-secondary/30">
        <div className="container flex flex-wrap justify-center gap-6 md:gap-12 py-4">
          {[
            { icon: Truck, text: "Free shipping over $60" },
            { icon: Star, text: "Premium quality prints" },
            { icon: RotateCcw, text: "Easy returns via Bonfire" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon size={14} className="text-primary" />
              <span className="font-semibold uppercase tracking-wider">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <section className="container py-10 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {ALL_PRODUCTS.map((item, i) => (
            <motion.a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group relative bg-card border-2 border-border hover:border-primary/40 overflow-hidden transition-all duration-300"
            >
              {item.tag && (
                <span className="absolute top-2.5 left-2.5 z-10 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-1">
                  {item.tag}
                </span>
              )}
              <div className="aspect-square bg-secondary/20 overflow-hidden">
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-3 md:p-4">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {item.category}
                </span>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors mt-0.5">
                  {item.name}
                </h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-mono font-black text-primary">{item.price}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    Shop <ExternalLink size={10} />
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </section>

      {/* Size Guide */}
      <section className="border-t border-border bg-card">
        <div className="container py-10 md:py-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Ruler size={18} className="text-primary" />
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
                Size Guide
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-6 max-w-md">
              Measurements are approximate. For the most accurate sizing, check each product's page on Bonfire. All shirts are unisex fit.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full max-w-lg text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/30">
                    <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-primary">Size</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-primary">Chest</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-primary">Waist</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_CHART.map((row) => (
                    <tr key={row.size} className="border-b border-border hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-foreground">{row.size}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">{row.chest}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">{row.waist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-muted-foreground mt-4">
              Youth sizes available on select items. See individual product pages for youth sizing.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border">
        <div className="container py-10 md:py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-foreground mb-3">
            Don't See What You Need?
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Browse the full Bonfire collection for additional styles, colors, and sizes. New designs drop regularly.
          </p>
          <a
            href={BONFIRE_STORE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            Browse Full Collection <ExternalLink size={14} />
          </a>
        </div>
      </section>

      {/* Footer spacing */}
      
      <div className="h-8" />
    </div>
  </div>
);

export default Merch;
