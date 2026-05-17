"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@aquagrow.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-500 to-emerald-400 text-white p-12">
        <div className="m-auto max-w-md">
          <div className="text-5xl">🌱</div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight">AquaGrow Smart Farming</h1>
          <p className="mt-3 text-white/85">
            Real-time aquaponic monitoring, adaptive LED control, and research-grade analytics — all in one dashboard.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            <li>• Multi-sensor dashboards with Recharts</li>
            <li>• Adaptive growth-mode LED tuning</li>
            <li>• CSV / PDF analytics export</li>
            <li>• IEEE-style research report module</li>
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <div>
            <div className="text-2xl font-semibold">Sign in</div>
            <div className="text-sm text-[rgb(var(--muted))]">to your AquaGrow workspace</div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input mt-1" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input mt-1" type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </div>
          {error ? <div className="text-sm text-rose-500">{error}</div> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Signing in…" : "Sign in"}</button>
          <div className="text-xs text-[rgb(var(--muted))]">
            No account? <Link href="/register" className="text-brand-600 dark:text-brand-300 hover:underline">Create one</Link>
          </div>
          <div className="text-xs text-[rgb(var(--muted))] border-t pt-3 mt-4">
            Demo credentials:<br/>
            <code>admin@aquagrow.local / admin123</code><br/>
            <code>operator@aquagrow.local / operator123</code><br/>
            <code>viewer@aquagrow.local / viewer123</code>
          </div>
        </form>
      </div>
    </div>
  );
}
