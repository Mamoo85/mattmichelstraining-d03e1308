import { motion } from "framer-motion";
import { ExternalLink, ShoppingBag, ArrowRight } from "lucide-react";

import merchTee from "@/assets/merch-classic-tee.png";
import merchLongSleeve from "@/assets/merch-long-sleeve.png";
import merchTank from "@/assets/merch-tank.png";
import merchCrewneck from "@/assets/merch-crewneck.png";
import merchHoodie from "@/assets/merch-hoodie.png";
import merchSnapback from "@/assets/merch-snapback.png";
import merchBeanie from "@/assets/merch-beanie.png";
import merchYouthHoodie from "@/assets/merch-youth-hoodie.png";

const BONFIRE_STORE = "https://www.bonfire.com/store/m2-training/";

const FEATURED = [
  { name: "Premium Pullover Hoodie", price: "$66.49", img: merchHoodie, url: "https://www.bonfire.com/m2-classics/?productType=79372160-4724-45ba-b119-518d097bfbe3", tag: "Best Seller" },
  { name: "Premium Unisex Tee", price: "$28.49", img: merchTee, url: "https://www.bonfire.com/m2-classics/?productType=bacf6cd6-b53d-469c-ab96-02afe5b15f71", tag: "Classic" },
  { name: "Crewneck Sweatshirt", price: "$38.49", img: merchCrewneck, url: "https://www.bonfire.com/m2-classics/?productType=b2ffe678-62bc-415a-be70-acc2e9b75bbc", tag: "New" },
];

const MORE_ITEMS = [
  { name: "Long Sleeve Tee", price: "$33.49", img: merchLongSleeve, url: "https://www.bonfire.com/m2-classics/?productType=b65f9374-447d-40a6-a17c-ecbc2c823eda" },
  { name: "Cotton Tank", price: "$29.49", img: merchTank, url: "https://www.bonfire.com/m2-classics/?productType=440c2166-9c34-4487-abf4-fcb388e889cb" },
  { name: "Youth Hoodie", price: "$39.99", img: merchYouthHoodie, url: "https://www.bonfire.com/m2-classics/?productType=02f7d820-80e5-4fc5-9292-f4eeccd35b55" },
  { name: "Snapback Hat", price: "$28.49", img: merchSnapback, url: "https://www.bonfire.com/m2-hats/?productType=24b76e56-b4e7-4478-babe-7e5cad23dbb9" },
  { name: "Cuffed Beanie", price: "$26.49", img: merchBeanie, url: "https://www.bonfire.com/m2-hats/?productType=f612e17e-71da-49e5-aa7f-f547c501e167" },
];

const MerchSection = () => (
  <section className="py-16 md:py-20">
    <div className="container">
      {/* Section header with CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Official Gear</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-foreground">
            Rep M² Training
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            You earned it in the gym. Now wear it everywhere else. Ships direct from Bonfire.
          </p>
        </div>
        <a
          href={BONFIRE_STORE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 shrink-0"
        >
          Shop All Gear <ArrowRight size={14} />
        </a>
      </motion.div>

      {/* Featured items — large cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {FEATURED.map((item, i) => (
          <motion.a
            key={item.name}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative bg-card border-2 border-border hover:border-primary/40 overflow-hidden transition-all duration-300"
          >
            {/* Tag badge */}
            {item.tag && (
              <span className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-1">
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
            <div className="p-4">
              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
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

      {/* More items — compact strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {MORE_ITEMS.map((item, i) => (
          <motion.a
            key={item.name}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="group bg-card border border-border hover:border-primary/30 overflow-hidden transition-all"
          >
            <div className="aspect-square bg-secondary/10 overflow-hidden">
              <img
                src={item.img}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <div className="p-2.5">
              <h4 className="text-[11px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                {item.name}
              </h4>
              <span className="text-xs font-mono font-bold text-primary mt-0.5 block">{item.price}</span>
            </div>
          </motion.a>
        ))}
      </div>

      {/* Bottom CTA bar */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-6 bg-foreground/5 border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <p className="text-xs text-muted-foreground text-center sm:text-left">
          <span className="text-foreground font-bold">Free shipping on orders over $60.</span>{" "}
          All merch printed & shipped by Bonfire — quality guaranteed.
        </p>
        <a
          href={BONFIRE_STORE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-m2 shrink-0"
        >
          Browse Full Collection <ExternalLink size={12} />
        </a>
      </motion.div>
    </div>
  </section>
);

export default MerchSection;
