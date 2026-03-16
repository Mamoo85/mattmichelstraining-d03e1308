import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import SectionHeader from "./SectionHeader";

import merchTee from "@/assets/merch-classic-tee.png";
import merchLongSleeve from "@/assets/merch-long-sleeve.png";
import merchTank from "@/assets/merch-tank.png";
import merchCrewneck from "@/assets/merch-crewneck.png";
import merchHoodie from "@/assets/merch-hoodie.png";
import merchSnapback from "@/assets/merch-snapback.png";
import merchBeanie from "@/assets/merch-beanie.png";
import merchYouthHoodie from "@/assets/merch-youth-hoodie.png";

const BONFIRE_STORE = "https://www.bonfire.com/store/m2-training/";

const MERCH_ITEMS = [
  { name: "Premium Unisex Tee", price: "$28.49", img: merchTee, url: "https://www.bonfire.com/m2-classics/?productType=bacf6cd6-b53d-469c-ab96-02afe5b15f71" },
  { name: "Premium Long Sleeve Tee", price: "$33.49", img: merchLongSleeve, url: "https://www.bonfire.com/m2-classics/?productType=b65f9374-447d-40a6-a17c-ecbc2c823eda" },
  { name: "Premium Cotton Tank", price: "$29.49", img: merchTank, url: "https://www.bonfire.com/m2-classics/?productType=440c2166-9c34-4487-abf4-fcb388e889cb" },
  { name: "Crewneck Sweatshirt", price: "$38.49", img: merchCrewneck, url: "https://www.bonfire.com/m2-classics/?productType=b2ffe678-62bc-415a-be70-acc2e9b75bbc" },
  { name: "Premium Pullover Hoodie", price: "$66.49", img: merchHoodie, url: "https://www.bonfire.com/m2-classics/?productType=79372160-4724-45ba-b119-518d097bfbe3" },
  { name: "Youth Pullover Hoodie", price: "$39.99", img: merchYouthHoodie, url: "https://www.bonfire.com/m2-classics/?productType=02f7d820-80e5-4fc5-9292-f4eeccd35b55" },
  { name: "Snapback Hat", price: "$28.49", img: merchSnapback, url: "https://www.bonfire.com/m2-hats/?productType=24b76e56-b4e7-4478-babe-7e5cad23dbb9" },
  { name: "Cuffed Beanie", price: "$26.49", img: merchBeanie, url: "https://www.bonfire.com/m2-hats/?productType=f612e17e-71da-49e5-aa7f-f547c501e167" },
];

const MerchSection = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
    className="mb-10"
  >
    <SectionHeader title="M² Merch" timestamp="Rep the brand. Earn the shirt." />

    <div className="bg-primary/5 border border-primary/15 p-4 mb-4">
      <p className="text-sm text-foreground leading-relaxed">
        <span className="font-bold">Official M² Training gear — powered by Bonfire.</span>{" "}
        Every piece ships direct. Tees, hoodies, hats — if you train with Matt, you've earned it.
      </p>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {MERCH_ITEMS.map((item) => (
        <a
          key={item.name}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="bg-card shadow-m2 overflow-hidden hover:bg-m2-surface-hover transition-m2 group flex flex-col"
        >
          <div className="w-full aspect-square bg-secondary/30 flex items-center justify-center overflow-hidden">
            <img
              src={item.img}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <div className="p-3 flex flex-col flex-1">
            <h3 className="text-xs font-bold text-foreground mb-1 leading-snug group-hover:text-primary transition-m2">
              {item.name}
            </h3>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-sm font-mono font-bold text-primary">{item.price}</span>
              <ExternalLink size={12} className="text-muted-foreground group-hover:text-primary transition-m2" />
            </div>
          </div>
        </a>
      ))}
    </div>

    <div className="mt-4 text-center">
      <a
        href={BONFIRE_STORE}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm text-primary font-bold hover:opacity-80 transition-m2"
      >
        Browse Full Store on Bonfire
        <ExternalLink size={14} />
      </a>
    </div>
  </motion.div>
);

export default MerchSection;
