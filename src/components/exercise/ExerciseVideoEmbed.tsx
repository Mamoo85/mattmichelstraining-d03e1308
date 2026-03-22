import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ExternalLink } from "lucide-react";

interface ExerciseVideoEmbedProps {
  videoUrl: string | null;
  exerciseTitle: string;
}

/** Extracts YouTube video ID from various URL formats */
const getYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

/** Extracts Vimeo video ID */
const getVimeoId = (url: string): string | null => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

const ExerciseVideoEmbed = ({ videoUrl, exerciseTitle }: ExerciseVideoEmbedProps) => {
  const [showVideo, setShowVideo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!videoUrl) return null;

  const youtubeId = getYouTubeId(videoUrl);
  const vimeoId = getVimeoId(videoUrl);
  const isDirectVideo = !youtubeId && !vimeoId;

  // If it's not YouTube, Vimeo, or a direct video URL, don't render
  if (!youtubeId && !vimeoId && !videoUrl.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) && !videoUrl.includes("/storage/")) return null;

  const thumbnailUrl = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    : null;

  const embedUrl = youtubeId
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3`
    : vimeoId
    ? `https://player.vimeo.com/video/${vimeoId}?byline=0&portrait=0&title=0`
    : null;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden"
    >
      <div className="pt-3">
        <div className="flex items-center gap-1 mb-2">
          <Play size={10} className="text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
            Form Video
          </span>
        </div>

        {isDirectVideo ? (
          /* Direct video file (uploaded by admin) */
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="relative w-full aspect-video bg-black"
          >
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="w-full h-full object-contain"
              playsInline
            />
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {!showVideo ? (
              <motion.button
                key="thumbnail"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                onClick={() => setShowVideo(true)}
                className="relative w-full aspect-video bg-muted overflow-hidden group cursor-pointer"
                aria-label={`Play form video for ${exerciseTitle}`}
              >
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={`${exerciseTitle} form video thumbnail`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg"
                  >
                    <Play size={20} className="text-primary-foreground ml-0.5" fill="currentColor" />
                  </motion.div>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/80 bg-black/50 px-2 py-1 backdrop-blur-sm">
                    Watch: Proper Form
                  </span>
                </div>
              </motion.button>
            ) : (
              <motion.div
                key="player"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="relative w-full aspect-video bg-black"
              >
                <iframe
                  src={embedUrl!}
                  title={`${exerciseTitle} form video`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!isDirectVideo && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 mt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink size={9} />
            Open on {youtubeId ? "YouTube" : "Vimeo"}
          </a>
        )}
      </div>
    </motion.div>
  );
};

export default ExerciseVideoEmbed;
