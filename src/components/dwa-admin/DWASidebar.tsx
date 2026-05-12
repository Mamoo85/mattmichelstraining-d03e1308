import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  id: string;
  label: string;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
  collapsed?: boolean;
}

interface Props {
  groups: SidebarGroup[];
  active: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function DWASidebar({ groups, active, onSelect, collapsed, onToggleCollapsed }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    groups.forEach((g) => { o[g.label] = !g.collapsed; });
    return o;
  });

  return (
    <aside
      className={cn(
        "shrink-0 bg-[#0a1628] border-r border-white/10 flex flex-col h-screen sticky top-0 transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
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

      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => {
          const isOpen = openGroups[group.label] ?? true;
          return (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <button
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !isOpen }))}
                  className="w-full px-3 mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60"
                >
                  <span>{group.label}</span>
                  <ChevronDown size={10} className={cn("transition-transform", !isOpen && "-rotate-90")} />
                </button>
              )}
              {(collapsed || isOpen) && (
                <ul className="space-y-0.5 px-1.5">
                  {group.items.map((it) => {
                    const isActive = active === it.id;
                    return (
                      <li key={`${group.label}-${it.id}`}>
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
                          {collapsed ? (
                            <span className="text-xs">{it.label.slice(0, 2)}</span>
                          ) : (
                            <span className="truncate">{it.label}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10 text-[10px] text-white/30 text-center">
        {!collapsed ? "Detroit Web Agency" : "DWA"}
      </div>
    </aside>
  );
}

