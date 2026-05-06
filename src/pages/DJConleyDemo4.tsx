import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const DJConleyDemo4 = () => {
  useEffect(() => {
    window.location.replace("/demo-djconley-v6/index.html");
  }, []);

  return (
    <>
      <Helmet>
        <title>D.J. Conley Associates — Digital Command</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1622" }}>
        <p style={{ color: "#27CCC0" }} className="text-sm font-medium">Loading D.J. Conley demo…</p>
      </div>
    </>
  );
};

export default DJConleyDemo4;
