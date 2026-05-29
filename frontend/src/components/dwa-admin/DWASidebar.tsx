import { Link } from "react-router-dom";

export interface SidebarGroup {
  label: string;
  items: { label: string; href: string }[];
}

interface DWASidebarProps {
  groups?: SidebarGroup[];
  active?: string;
}

const DWASidebar = ({ groups = [], active }: DWASidebarProps) => (
  <nav className="w-56 shrink-0 border-r min-h-screen p-4 space-y-4">
    {groups.map((g) => (
      <div key={g.label}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{g.label}</p>
        {g.items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`block px-2 py-1.5 rounded text-sm ${active === item.href ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    ))}
  </nav>
);
export default DWASidebar;
