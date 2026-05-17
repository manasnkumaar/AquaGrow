"use client";

import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";

export function Topbar({ title }: { title: string }) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/80 backdrop-blur px-4 md:px-6 py-3">
      <div>
        <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Welcome back, {user?.name ?? "—"}</p>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
