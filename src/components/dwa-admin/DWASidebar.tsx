import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  id: string;
  label: string;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface Props {
  groups: SidebarGroup[];
  active: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function DWASidebar({ groups, active, onSelect, collapsed, onToggleCollapsed }: Props) {
  return (
    <aside
      className={cn(
        "shrink-0 bg-[#0a1628] border-r border-white/10 flex flex-col h-screen sticky top-0 transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-3 border-b border-white/10 gap-2">
        {!collapsed && (
          <span className="font-black text-sm tracking-tight truncate">
            <span className="text-white">DWA</span>{" "}
            <span className="text-[#00d4ff]">Admin</span>
          </span>
        )}
        <button
          onClick={onToggleCollapsed}
          className="ml-auto p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5 px-1.5">
              {group.items.map((it) => {
                const isActive = active === it.id;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => onSelect(it.id)}
                      title={collapsed ? it.label : undefined}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded text-sm transition-colors flex items-center gap-2",
                        isActive
                          ? "bg-[#00d4ff]/15 text-[#00d4ff] font-semibold"
                          : "text-white/65 hover:bg-white/5 hover:text-white",
                        collapsed && "justify-center"
                      )}
                    >
                      <span className={cn(collapsed && "text-base")}>{it.label.split(" ")[0]}</span>
                      {!collapsed && <span className="truncate">{it.label.split(" ").slice(1).join(" ")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-white/10 text-[10px] text-white/30 text-center">
        {!collapsed ? "Detroit Web Agency" : "DWA"}
      </div>
    </aside>
  );
}
