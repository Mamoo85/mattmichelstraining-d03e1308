import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

/**
 * Legacy demo route — superseded by the live sandbox.
 * Redirects to the current D.J. Conley sandbox experience.
 */
const DJConleyDemo2 = () => {
  useEffect(() => {
    window.location.replace("/sandbox/djconley");
  }, []);

  return (
    <>
      <Helmet>
        <title>D.J. Conley Associates — Demo</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ color: "#1B4F8A" }} className="text-sm font-medium">Loading D.J. Conley sandbox…</p>
      </div>
    </>
  );
};

export default DJConleyDemo2;
