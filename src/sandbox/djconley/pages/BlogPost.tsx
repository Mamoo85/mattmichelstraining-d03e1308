import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SiteLayout from "../SiteLayout";
import { BLOG_POSTS, BLOG_ORDER } from "../blog";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const post = BLOG_POSTS[slug];

  if (!post) {
    return (
      <SiteLayout title="Post Not Found">
        <div className="mx-auto max-w-[1100px] px-6 py-16">
          <p className="mb-6 text-[#555]">We couldn't find that post.</p>
          <Link to="/sandbox/djconley/blog" className="text-[#e30613] underline">
            Back to the blog
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const idx = BLOG_ORDER.indexOf(slug);
  const prev = idx > 0 ? BLOG_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < BLOG_ORDER.length - 1 ? BLOG_ORDER[idx + 1] : null;

  return (
    <SiteLayout title={post.title}>
      <article className="mx-auto max-w-[860px] px-6 py-12 md:px-8">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#e30613]">
          {post.category}
        </div>
        <div className="mb-10 text-sm text-[#888]">Pat Michaels · {post.date}</div>
        <div
          className="prose prose-slate max-w-none
            prose-headings:font-semibold prose-headings:text-[#222]
            prose-h1:mt-8 prose-h1:text-3xl
            prose-h2:mt-8 prose-h2:text-2xl
            prose-h3:mt-6 prose-h3:text-xl
            prose-p:text-[#555] prose-p:leading-relaxed
            prose-li:text-[#555]
            prose-strong:text-[#222]
            prose-a:text-[#e30613] prose-a:no-underline hover:prose-a:underline
            prose-img:rounded prose-img:shadow-sm"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children, ...rest }) => {
                const h = href || "";
                if (h.startsWith("https://djconley.com/") || h.startsWith("http://djconley.com/")) {
                  // Rewrite to sandbox: best-effort; unknown routes fall back to home
                  return <span {...rest}>{children}</span>;
                }
                return (
                  <a href={h} target="_blank" rel="noopener noreferrer" {...rest}>
                    {children}
                  </a>
                );
              },
            }}
          >
            {post.markdown}
          </ReactMarkdown>
        </div>

        <div className="mt-16 flex items-center justify-between border-t border-[#ccc] pt-8 text-sm">
          {prev ? (
            <Link to={`/sandbox/djconley/blog/${prev}`} className="text-[#e30613] hover:underline">
              ← {BLOG_POSTS[prev].title}
            </Link>
          ) : <span />}
          {next ? (
            <Link to={`/sandbox/djconley/blog/${next}`} className="text-right text-[#e30613] hover:underline">
              {BLOG_POSTS[next].title} →
            </Link>
          ) : <span />}
        </div>

        <div className="mt-10">
          <Link to="/sandbox/djconley/blog" className="text-sm font-bold uppercase tracking-wider text-[#e30613] hover:underline">
            ← Back to all posts
          </Link>
        </div>
      </article>
    </SiteLayout>
  );
}
