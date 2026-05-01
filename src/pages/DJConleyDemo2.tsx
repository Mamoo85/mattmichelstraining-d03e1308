import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

/**
 * Routes to the v4 static demo built in DJ Conley's actual brand palette
 * (teal #27CCC0 + red #c12a3b on white) — no orange, matches djconley.com.
 */
const DJConleyDemo2 = () => {
  useEffect(() => {
    window.location.replace("/demo-djconley-v4/index.html");
  }, []);

  return (
    <>
      <Helmet>
        <title>D.J. Conley Associates — Demo</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ color: "#27CCC0" }} className="text-sm font-medium">Loading D.J. Conley demo…</p>
      </div>
    </>
  );
};

export default DJConleyDemo2;
