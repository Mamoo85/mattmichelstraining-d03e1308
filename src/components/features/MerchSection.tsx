import { motion } from "framer-motion";
import { ExternalLink, ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import merchTee from "@/assets/merch-classic-tee.png";
import merchHoodie from "@/assets/merch-hoodie.png";
import merchCrewneck from "@/assets/merch-crewneck.png";

const FEATURED = [
  { name: "Premium Pullover Hoodie", price: "$66.49", img: merchHoodie, url: "https://www.bonfire.com/m2-classics/?productType=79372160-4724-45ba-b119-518d097bfbe3", tag: "Best Seller" },
  { name: "Premium Unisex Tee", price: "$28.49", img: merchTee, url: "https://www.bonfire.com/m2-classics/?productType=bacf6cd6-b53d-469c-ab96-02afe5b15f71", tag: "Classic" },
  { name: "Crewneck Sweatshirt", price: "$38.49", img: merchCrewneck, url: "https://www.bonfire.com/m2-classics/?productType=b2ffe678-62bc-415a-be70-acc2e9b75bbc", tag: "New" },
];

const MerchSection = () => (
  <section className="py-16 md:py-20">
    <div className="container">
      {/* Header */}
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
            You earned it in the gym. Now wear it everywhere else.
          </p>
        </div>
        <Link
          to="/merch"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shrink-0"
        >
          Shop All Gear <ArrowRight size={14} />
        </Link>
      </motion.div>

      {/* Featured 3 items */}
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

      {/* CTA to full merch page */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="bg-foreground/5 border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <p className="text-xs text-muted-foreground text-center sm:text-left">
          <span className="text-foreground font-bold">8+ styles available</span>{" "}
          — hoodies, tees, tanks, hats & youth sizes. Free shipping over $60.
        </p>
        <Link
          to="/merch"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-all shrink-0"
        >
          View All Merch <ArrowRight size={12} />
        </Link>
      </motion.div>
    </div>
  </section>
);

export default MerchSection;
