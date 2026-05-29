import { Link } from "react-router-dom";
import { PAGES, Block } from "./content";
import { djPath } from "./links";

function isInternal(href: string) {
  return href.startsWith("/sandbox/djconley");
}

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case "h1":
      return (
        <h1 key={i} className="mb-8 mt-12 text-center text-3xl font-light uppercase tracking-[0.08em] text-[#222] md:text-4xl">
          {b.text}
        </h1>
      );
    case "h2":
      return (
        <h2 key={i} className="mb-6 mt-12 text-center text-2xl font-semibold text-[#222] md:text-3xl">
          {b.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} className="mb-3 mt-8 text-xl font-semibold text-[#222]">
          {b.text}
        </h3>
      );
    case "h4":
      return (
        <h4 key={i} className="mb-2 mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-[#222]">
          {b.text}
        </h4>
      );
    case "p":
      return (
        <p key={i} className="mb-5 text-[15px] leading-[1.85] text-[#555] md:text-[16px]">
          {b.text}
        </p>
      );
    case "li":
      return (
        <li key={i} className="mb-2 list-disc pl-2 text-[#555] marker:text-[#e30613]">
          {b.text}
        </li>
      );
    case "a": {
      const href = b.href;
      if (isInternal(href)) {
        return (
          <Link
            key={i}
            to={djPath(href.replace("/sandbox/djconley", "") || "/")}
            className="my-4 inline-block rounded-full border-2 border-[#e30613] bg-[#e30613] px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-transparent hover:text-[#e30613]"
          >
            {b.text}
          </Link>
        );
      }
      return (
        <a
          key={i}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="my-4 inline-block rounded-full border-2 border-[#e30613] px-7 py-3 text-sm font-bold uppercase tracking-wider text-[#e30613] transition hover:bg-[#e30613] hover:text-white"
        >
          {b.text}
        </a>
      );
    }
    case "img":
      if (!b.src) return null;
      return (
        <img
          key={i}
          src={b.src}
          alt={b.alt || ""}
          loading="lazy"
          className="my-6 h-auto max-w-full rounded shadow-sm"
        />
      );
  }
}

export default function PageRenderer({ slug, title }: { slug: string; title?: string }) {
  let blocks = PAGES[slug] || [];
  const norm = (s: string) => s.trim().toLowerCase();
  // Strip leading H1/H2 that duplicate the hero title
  while (
    blocks.length &&
    (blocks[0].t === "h1" || blocks[0].t === "h2") &&
    title &&
    norm((blocks[0] as { text: string }).text) === norm(title)
  ) {
    blocks = blocks.slice(1);
  }
  const out: React.ReactNode[] = [];
  let liBuffer: Block[] = [];
  const flushLis = () => {
    if (liBuffer.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="mb-6 ml-6 space-y-2">
          {liBuffer.map((b, j) => renderBlock(b, j))}
        </ul>
      );
      liBuffer = [];
    }
  };
  blocks.forEach((b, i) => {
    if (b.t === "li") {
      liBuffer.push(b);
    } else {
      flushLis();
      out.push(renderBlock(b, i));
    }
  });
  flushLis();
  return <div className="mx-auto max-w-[1100px] px-6 py-12 md:px-8">{out}</div>;
}
