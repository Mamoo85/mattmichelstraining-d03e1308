import SiteLayout from "../SiteLayout";

export default function DJHome() {
  return (
    <SiteLayout>
      <section className="relative min-h-[620px] overflow-hidden bg-black text-white md:min-h-[720px]">
        <img
          src="/demo-djconley-current/main-cover-photo.jpg"
          alt="Industrial boiler room with D.J. Conley boiler systems"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative mx-auto flex min-h-[620px] max-w-[1200px] items-center px-6 pt-24 md:min-h-[720px] md:pt-28">
          <div className="max-w-[520px] md:ml-[70px]">
            <p className="mb-8 text-[34px] font-light leading-none md:text-[50px]">A name you can</p>
            <h1 className="mb-10 text-[48px] font-bold leading-none tracking-[0.02em] md:text-[60px]">TRUST.</h1>
            <a
              href="tel:2485898220"
              className="inline-flex rounded-full border-2 border-white/80 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
            >
              248-589-8220
            </a>
          </div>
        </div>

        <div className="absolute bottom-[-42px] left-1/2 hidden h-[90px] w-[90px] -translate-x-1/2 items-center justify-center rounded-full bg-[#e31b23] md:flex">
          <span className="block h-6 w-6 rotate-45 border-b-[8px] border-r-[8px] border-white" />
        </div>
      </section>

      <section className="bg-[#e9e9e9] px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-[1100px] gap-12 md:grid-cols-[1fr_1fr] md:items-start">
          <div>
            <h2 className="mb-8 text-[30px] font-semibold leading-tight text-[#4a4a4a] md:text-[34px]">
              D.J. Conley Associates, Inc.
            </h2>
            <p className="mb-10 max-w-[620px] text-[15px] leading-[2] text-[#666]">
              D. J. Conley Associates, Inc. is a Manufacturer’s Rep/Distributor engaged in energy conversion
              and conservation as it relates to the production of steam, hot water and heat recovery. Our
              commitment to providing quality products and comprehensive solutions, backed by our reputation
              for excellence, has allowed us to sustain trusted relationships with the businesses we serve.
            </p>
            <div className="flex flex-col items-start gap-5">
              <a href="/sandbox/djconley/service" className="rounded-full border-2 border-[#e31b23] px-7 py-3 text-sm text-[#e31b23] transition hover:bg-[#e31b23] hover:text-white">
                Get Service
              </a>
              <a href="/sandbox/djconley/products" className="rounded-full border-2 border-[#e31b23] px-7 py-3 text-sm text-[#e31b23] transition hover:bg-[#e31b23] hover:text-white">
                Products
              </a>
            </div>
          </div>

          <a
            href="https://www.youtube.com/watch?v=L4hK8ftpbp0"
            target="_blank"
            rel="noreferrer"
            className="group relative block overflow-hidden bg-black shadow-sm"
            aria-label="Watch The DJ Conley Story on YouTube"
          >
            <img src="/demo-djconley-current/story-thumb.jpg" alt="The DJ Conley Story video thumbnail" className="aspect-video w-full object-cover" />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute left-6 top-5 flex items-center gap-3 text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <img src="/demo-djconley-current/favicon-32.png" alt="" className="h-8 w-8" />
              </div>
              <div>
                <div className="text-xl font-bold leading-tight">The DJ Conley Story</div>
                <div className="text-sm">DJ Conley</div>
              </div>
            </div>
            <div className="absolute left-1/2 top-1/2 flex h-[74px] w-[104px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#ff0000] transition group-hover:scale-105">
              <span className="ml-1 h-0 w-0 border-y-[16px] border-l-[25px] border-y-transparent border-l-white" />
            </div>
            <div className="absolute bottom-5 right-5 rounded-full bg-black/50 px-5 py-3 text-lg text-white">Watch on YouTube</div>
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}