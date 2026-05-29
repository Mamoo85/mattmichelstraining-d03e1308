import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

/**
 * Routes to brand-correct static demo (DJ Conley navy #1B4F8A + orange #E07B39).
 * Replaced the prior dark-slate/red React build that triggered the "we want our colors" objection.
 */
const DJConleyDemo1 = () => {
  useEffect(() => {
    window.location.replace("/demo-djconley-v2/index.html");
  }, []);

  return (
    <>
      <Helmet>
        <title>D.J. Conley Associates — Demo</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF5E6" }}>
        <p style={{ color: "#1B4F8A" }} className="text-sm font-medium">Loading D.J. Conley demo…</p>
      </div>
    </>
  );
};

export default DJConleyDemo1;
