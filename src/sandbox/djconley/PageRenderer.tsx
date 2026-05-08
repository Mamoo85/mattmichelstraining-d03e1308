import { Link } from "react-router-dom";
import { PAGES, Block } from "./content";

function isInternal(href: string) {
  return href.startsWith("/sandbox/djconley");
}

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case "h1":
      return (
        <h1 key={i} className="mb-6 mt-10 text-4xl font-semibold leading-tight text-[#222] md:text-5xl">
          {b.text}
        </h1>
      );
    case "h2":
      return (
        <h2 key={i} className="mb-4 mt-10 text-3xl font-semibold leading-tight text-[#222] md:text-4xl">
          {b.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} className="mb-3 mt-8 text-2xl font-semibold text-[#222]">
          {b.text}
        </h3>
      );
    case "h4":
      return (
        <h4 key={i} className="mb-2 mt-6 text-lg font-semibold uppercase tracking-wider text-white">
          {b.text}
        </h4>
      );
    case "p":
      return (
        <p key={i} className="mb-5 text-base leading-relaxed text-[#555] md:text-[17px]">
          {b.text}
        </p>
      );
    case "li":
      return (
        <li key={i} className="mb-2 list-disc pl-2 text-[#555] marker:text-[#21bfb2]">
          {b.text}
        </li>
      );
    case "a": {
      const href = b.href;
      if (isInternal(href)) {
        return (
          <Link
            key={i}
            to={href}
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

export default function PageRenderer({ slug }: { slug: string }) {
  const blocks = PAGES[slug] || [];
  // Group consecutive <li> into <ul>
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
