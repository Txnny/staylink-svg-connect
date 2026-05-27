import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  ArrowRightLeft,
  Users,
  Receipt,
  Settings,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/properties", label: "Properties", icon: Building2 },
  { to: "/admin/redirects", label: "Redirects", icon: ArrowRightLeft },
  { to: "/admin/partners", label: "Partners", icon: Users },
  { to: "/admin/earnings", label: "Earnings", icon: Receipt },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminShell() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-mint-foreground">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg leading-tight">StayLink</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">SVG · Admin</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          St. Vincent &amp; the Grenadines
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
