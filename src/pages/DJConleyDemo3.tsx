import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const DJConleyDemo3 = () => {
  useEffect(() => {
    window.location.replace("/demo-djconley-v5/index.html");
  }, []);

  return (
    <>
      <Helmet>
        <title>D.J. Conley Associates — Authority & Scale</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f1923" }}>
        <p style={{ color: "#27CCC0" }} className="text-sm font-medium">Loading D.J. Conley demo…</p>
      </div>
    </>
  );
};

export default DJConleyDemo3;
