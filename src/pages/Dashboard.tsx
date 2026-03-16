import AppNavbar from "@/components/AppNavbar";
import ProtocolTable from "@/components/ProtocolTable";
import { Activity, TrendingUp, Target } from "lucide-react";

const stats = [
  { label: "TOTAL VOLUME", value: "12,450", unit: "kg", icon: Activity },
  { label: "SESSIONS THIS WEEK", value: "4", unit: "/5", icon: Target },
  { label: "STREAK", value: "23", unit: "days", icon: TrendingUp },
];

const Dashboard = () => (
  <div className="min-h-screen bg-background">
    <AppNavbar />
    <div className="container pt-20 pb-12">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map(({ label, value, unit, icon: Icon }) => (
          <div key={label} className="bg-card shadow-m2 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
            </div>
            <span className="text-xl font-mono font-bold text-foreground">{value}<span className="text-xs text-muted-foreground">{unit}</span></span>
          </div>
        ))}
      </div>
      <ProtocolTable />
    </div>
  </div>
);

export default Dashboard;
