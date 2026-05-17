"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <div className="text-2xl font-semibold">Create account</div>
          <div className="text-sm text-[rgb(var(--muted))]">Operators get access by default. Ask an admin to promote.</div>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input mt-1" value={name} onChange={(e)=>setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input mt-1" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password (min 8)</label>
          <input className="input mt-1" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={8}/>
        </div>
        {error ? <div className="text-sm text-rose-500">{error}</div> : null}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating…" : "Create account"}</button>
        <div className="text-xs text-[rgb(var(--muted))]">
          Already have an account? <Link href="/login" className="text-brand-600 dark:text-brand-300 hover:underline">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
