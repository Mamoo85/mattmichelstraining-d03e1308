import { Instagram, ExternalLink, Heart, MessageCircle, Play } from "lucide-react";
import athleteFootball from "@/assets/athlete-football.jpg";
import athleteSoccer from "@/assets/athlete-soccer.jpg";
import athleteBaseball from "@/assets/athlete-baseball.jpg";
import athleteLacrosse from "@/assets/athlete-lacrosse.jpg";
import mattTraining from "@/assets/matt-training.jpg";
import mattFamily from "@/assets/matt-family.jpg";

const INSTAGRAM_URL = "https://instagram.com/mattmichelstraining";

const posts = [
  { img: athleteFootball, likes: "127", comments: "14", caption: "Game-day prep ✊ Nothing beats real strength" },
  { img: mattTraining, likes: "203", comments: "31", caption: "20+ years. 50+ college athletes. 0 injuries." },
  { img: athleteSoccer, likes: "89", comments: "8", caption: "Speed comes from the ground up 🔥" },
  { img: athleteBaseball, likes: "156", comments: "19", caption: "Rotational power starts with the hips" },
  { img: athleteLacrosse, likes: "94", comments: "11", caption: "Building athletes who dominate, not just compete" },
  { img: mattFamily, likes: "312", comments: "47", caption: "Why I do this 💪" },
];

const InstagramSocialBox = () => (
  <div className="relative overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[hsl(330,100%,50%)] via-[hsl(18,82%,50%)] to-[hsl(50,100%,50%)] p-[2px] rounded-full">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
            <Instagram size={16} className="text-primary" />
          </div>
        </div>
        <div>
          <span className="text-sm font-bold text-foreground block leading-tight">@mattmichelstraining</span>
          <span className="text-[10px] text-muted-foreground">Follow for daily training content</span>
        </div>
      </div>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 bg-gradient-to-r from-[hsl(330,100%,50%)] via-[hsl(18,82%,50%)] to-[hsl(50,100%,50%)] text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
      >
        Follow
        <ExternalLink size={10} />
      </a>
    </div>

    {/* Grid — 3×2 masonry-style */}
    <div className="grid grid-cols-3 gap-1">
      {posts.map((post, i) => (
        <a
          key={i}
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-square overflow-hidden bg-muted"
        >
          <img
            src={post.img}
            alt={post.caption}
            width={432}
            height={432}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            decoding="async"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-white text-xs font-bold">
                <Heart size={12} fill="white" /> {post.likes}
              </span>
              <span className="flex items-center gap-1 text-white text-xs font-bold">
                <MessageCircle size={12} fill="white" /> {post.comments}
              </span>
            </div>
            <p className="text-white/80 text-[9px] text-center px-2 leading-tight line-clamp-2 max-w-[120px]">
              {post.caption}
            </p>
          </div>

          {/* Video indicator on some posts */}
          {(i === 1 || i === 4) && (
            <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm p-1 rounded-sm">
              <Play size={10} fill="white" className="text-white" />
            </div>
          )}
        </a>
      ))}
    </div>

    {/* Footer CTA */}
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center justify-center gap-2 py-3 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all text-xs font-bold uppercase tracking-widest"
    >
      <Instagram size={14} />
      View More on Instagram
    </a>
  </div>
);

export default InstagramSocialBox;
