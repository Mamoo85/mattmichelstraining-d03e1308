import { Link } from "react-router-dom";
import SiteLayout from "../SiteLayout";
import { BLOG_POSTS, BLOG_ORDER, excerpt } from "../blog";

export default function Blog() {
  return (
    <SiteLayout title="Blog">
      <div className="mx-auto max-w-[1100px] px-6 py-12 md:px-8">
        <p className="mb-10 text-lg text-[#555]">
          Tips, deep dives, and field-tested guidance from our expert team.
        </p>
        <div className="grid gap-8 md:grid-cols-2">
          {BLOG_ORDER.map((slug) => {
            const p = BLOG_POSTS[slug];
            if (!p) return null;
            return (
              <article key={slug} className="rounded-md bg-white p-6 shadow-sm">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#e30613]">
                  {p.category}
                </div>
                <h2 className="mb-2 text-2xl font-semibold leading-tight text-[#222]">
                  <Link to={`/sandbox/djconley/blog/${slug}`} className="hover:text-[#e30613]">
                    {p.title}
                  </Link>
                </h2>
                <div className="mb-3 text-sm text-[#888]">
                  Pat Michaels · {p.date}
                </div>
                <p className="mb-4 text-[15px] leading-relaxed text-[#555]">{excerpt(p.markdown)}</p>
                <Link
                  to={`/sandbox/djconley/blog/${slug}`}
                  className="text-sm font-bold uppercase tracking-wider text-[#e30613] hover:underline"
                >
                  Read more →
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </SiteLayout>
  );
}
