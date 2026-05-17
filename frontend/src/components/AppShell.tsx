"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  title,
  children,
  requireAdmin,
}: {
  title: string;
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (requireAdmin && user.role !== "admin") router.replace("/dashboard");
  }, [user, loading, requireAdmin, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[rgb(var(--muted))]">
        Loading…
      </div>
    );
  }
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="flex-1 p-4 md:p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
