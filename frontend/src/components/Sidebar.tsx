"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",      icon: "📊" },
  { href: "/led",        label: "LED Control",    icon: "💡" },
  { href: "/analytics",  label: "Analytics",      icon: "📈" },
  { href: "/research",   label: "Research",       icon: "🧪" },
  { href: "/admin",      label: "Admin",          icon: "🛠️", adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-[rgb(var(--border))] bg-[rgb(var(--card))]">
      <div className="px-5 py-5 flex items-center gap-2">
        <span className="text-2xl">🌱</span>
        <div>
          <div className="font-semibold leading-tight">AquaGrow</div>
          <div className="text-xs text-[rgb(var(--muted))]">Smart Farming</div>
        </div>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {NAV.filter(n => !n.adminOnly || user?.role === "admin").map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                active
                  ? "bg-brand-600/10 text-brand-700 dark:text-brand-300"
                  : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
            >
              <span aria-hidden>{n.icon}</span> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[rgb(var(--border))] text-xs">
        <div className="font-medium">{user?.name}</div>
        <div className="text-[rgb(var(--muted))] capitalize">{user?.role}</div>
        <button className="btn-ghost mt-2 w-full" onClick={logout}>Log out</button>
      </div>
    </aside>
  );
}
