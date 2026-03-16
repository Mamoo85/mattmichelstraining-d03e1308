import AppNavbar from "@/components/AppNavbar";
import ProgressCharts from "@/components/ProgressCharts";

const Progress = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12">
      <ProgressCharts />
    </div>
  </div>
);

export default Progress;
