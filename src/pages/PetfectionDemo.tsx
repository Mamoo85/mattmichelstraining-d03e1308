import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const PetfectionDemo = () => {
  useEffect(() => {
    // Redirect to static HTML demo
    window.location.replace("/demo-petfection/index.html");
  }, []);

  return (
    <>
      <Helmet>
        <title>PETfection Demo — M² Development</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <p className="text-[#3D2B1F] text-sm">Loading PETfection demo…</p>
      </div>
    </>
  );
};

export default PetfectionDemo;
