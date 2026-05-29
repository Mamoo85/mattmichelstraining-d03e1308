import SiteLayout from "../SiteLayout";
import { Link } from "react-router-dom";
import { djPath } from "../links";

const products = [
  "/demo-djconley-current/img/1.-CFH_Skid.png",
  "/demo-djconley-current/img/2.-spraymaster-1000x1000-1.jpg",
  "/demo-djconley-current/img/3.-C1X-econ2.jpg",
];

export default function DJHome() {
  return (
    <SiteLayout>
      <section className="relative flex min-h-[320px] items-center bg-[url('/demo-djconley-current/main-cover-photo.jpg')] bg-cover bg-center pt-[120px] text-white md:min-h-[620px] md:pt-[180px]">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative mx-auto w-full max-w-[1100px] px-8 pb-12 md:pb-28">
          <p className="mb-8 text-[42px] leading-[0.45] md:text-[50px]">A name you can</p>
          <h1 className="mb-9 text-[54px] font-bold leading-[0.65] md:text-[60px]">TRUST.</h1>
          <a href="tel:2485898220" className="rounded-full border border-white/80 px-5 py-2 text-xs text-white hover:bg-white hover:text-black">248-589-8220</a>
        </div>
      </section>

      <section className="relative bg-[#e9e9e9] pb-16 pt-16 md:pt-24">
        <a href="#homeabout" className="absolute -top-[45px] right-[24%] grid h-[90px] w-[90px] place-items-center rounded-full bg-[#e31b23] shadow-sm">
          <img src="/demo-djconley-current/img/bright-red-small.png" alt="Scroll down" className="h-[90px] w-[90px]" />
        </a>
        <div id="homeabout" className="mx-auto grid max-w-[1100px] gap-12 px-8 md:grid-cols-2">
          <div>
            <h2 className="mb-8 text-[28px] font-semibold text-[#444]">D.J. Conley Associates, Inc.</h2>
            <p className="mb-10 text-[15px] leading-8 text-[#666]">D. J. Conley Associates, Inc. is a Manufacturer’s Rep/Distributor engaged in energy conversion and conservation as it relates to the production of steam, hot water and heat recovery. Our commitment to providing quality products and comprehensive solutions, backed by our reputation for excellence, has allowed us to sustain trusted relationships with the businesses we serve.</p>
            <Link to={djPath("/service")} className="mb-4 block w-fit rounded-full border border-[#d52121] px-5 py-3 text-xs text-[#d52121] hover:bg-[#d52121] hover:text-white">Get Service</Link>
            <Link to={djPath("/products")} className="block w-fit rounded-full border border-[#c12a3b] px-5 py-3 text-xs text-[#c12a3b] hover:bg-[#c12a3b] hover:text-white">Products</Link>
          </div>
          <div className="aspect-video overflow-hidden bg-black shadow-sm">
            <iframe className="h-full w-full" src="https://www.youtube.com/embed/L4hK8ftpbp0" title="The DJ Conley Story" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </div>
      </section>

      <section className="bg-[#e9e9e9] pb-20">
        <div className="mx-auto max-w-[1100px] px-8 text-center">
          <div className="grid gap-8 md:grid-cols-3">
            {products.map((src) => <img key={src} src={src} alt="D.J. Conley boiler product" className="mx-auto h-[300px] w-full object-contain" loading="lazy" />)}
          </div>
          <Link to={djPath("/products")} className="mt-8 inline-block rounded-full border border-[#d52121] px-5 py-3 text-xs text-[#d52121] hover:bg-[#d52121] hover:text-white">All Products</Link>
        </div>
      </section>

      <section className="bg-[#e9e9e9] py-16">
        <div className="mx-auto grid max-w-[1100px] items-center gap-16 px-8 md:grid-cols-[1fr_0.85fr]">
          <img src="/demo-djconley-current/img/Since-1974-photo.jpg" alt="D.J. Conley since 1974" className="w-full shadow-lg" loading="lazy" />
          <div>
            <h2 className="mb-6 text-[34px] font-semibold text-[#333]">2024</h2>
            <p className="mb-8 text-[15px] leading-8 text-[#555]">For the past 50 years, D.J. Conley Associates Inc. has proudly served our community, building a legacy of quality, reliability, and unwavering commitment to customer satisfaction. Through dedication to innovation and a deep understanding of our customers' needs, we've navigated evolving markets and remained a trusted partner, consistently delivering exceptional products/services.</p>
            <Link to={djPath("/about")} className="rounded-full border border-[#d52121] px-5 py-3 text-xs text-[#d52121] hover:bg-[#d52121] hover:text-white">About</Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0b1622] py-16 text-white">
        <div className="mx-auto max-w-[1100px] px-8">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#d52121] mb-3">Service Territory</p>
            <h2 className="text-[34px] font-semibold">Serving Michigan & the Great Lakes Region</h2>
            <p className="text-[14px] text-white/70 mt-3 max-w-[640px] mx-auto">From our Warren, MI headquarters we provide sales, service, and parts distribution across Michigan, Ohio, Indiana, and beyond.</p>
          </div>
          <div className="aspect-[16/9] overflow-hidden rounded-lg border border-white/10 shadow-xl">
            <iframe
              title="D.J. Conley Service Area"
              src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2913280!2d-85.5!3d43.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000"
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-6 text-center">
            <a href="https://maps.google.com/?q=24650+Dequindre+Rd,+Warren,+MI+48091" target="_blank" rel="noreferrer" className="inline-block rounded-full border border-[#d52121] px-5 py-3 text-xs text-[#d52121] hover:bg-[#d52121] hover:text-white">
              📍 24650 Dequindre Rd, Warren, MI 48091
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#e9e9e9] pb-10 pt-4">
        <h2 className="mb-12 text-center text-[34px] font-semibold text-[#333]">Service and Parts</h2>
        <div className="grid md:grid-cols-2">
          <Link to={djPath("/service")} className="relative grid min-h-[360px] place-items-center bg-[url('/demo-djconley-current/img/Get-Service-Photos-1.jpg')] bg-cover bg-center text-white">
            <span className="absolute inset-0 bg-black/50" /><span className="relative text-[34px] font-semibold">Get Service</span>
          </Link>
          <Link to={djPath("/parts")} className="relative grid min-h-[360px] place-items-center bg-[url('/demo-djconley-current/img/Get-Parts-photo-1.jpg')] bg-cover bg-center text-white">
            <span className="absolute inset-0 bg-black/50" /><span className="relative text-[34px] font-semibold">Get Parts</span>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
