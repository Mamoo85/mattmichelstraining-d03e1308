import posts from "./posts.json";

export type BlogPost = {
  title: string;
  category: string;
  date: string;
  markdown: string;
};

export const BLOG_POSTS = posts as Record<string, BlogPost>;

export const BLOG_ORDER: string[] = [
  "dj-conley-is-moving",
  "wet-and-dry-boiler-storage-august-2021",
  "retrofit-burners-burner-controls-july-2021",
  "combustion-part-3",
  "combustion-part-2",
  "combustion-part-1",
  "boiler-waterside-care-treatment-part-3",
  "boiler-water-treatment-part-2",
  "boiler-water-treatment-part-1-of-3",
];

export function excerpt(md: string, len = 160): string {
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > len ? text.slice(0, len).trim() + "…" : text;
}
