"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";

type Device = { id: string; name: string; location: string; type: string; status: string; firmware: string; created_at: string };
type Alert = { id: string; device_id: string | null; device_name: string | null; severity: string; message: string; created_at: string; acknowledged: boolean };
type Log = { id: number; action: string; details: unknown; created_at: string; user_email: string | null; user_name: string | null };
type User = { id: string; email: string; name: string; role: "admin"|"operator"|"viewer"; created_at: string };

type Tab = "devices" | "alerts" | "logs" | "users";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("devices");

  return (
    <AppShell title="Admin Panel" requireAdmin>
      <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--border))] -mt-2">
        {(["devices","alerts","logs","users"] as Tab[]).map(t => (
          <button key={t}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t ? "border-brand-500 font-medium" : "border-transparent text-[rgb(var(--muted))] hover:text-current"}`}
            onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "devices" ? <DevicesPanel/> : null}
      {tab === "alerts"  ? <AlertsPanel/>  : null}
      {tab === "logs"    ? <LogsPanel/>    : null}
      {tab === "users"   ? <UsersPanel/>   : null}
    </AppShell>
  );
}

function DevicesPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ devices: Device[] }>("/api/devices");
    setDevices(r.devices);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !location) return;
    await api("/api/devices", { method: "POST", body: { name, location } });
    setName(""); setLocation("");
    await load();
  }
  async function setStatus(id: string, status: string) {
    await api(`/api/devices/${id}`, { method: "PATCH", body: { status } });
    await load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this device and all its data?")) return;
    await api(`/api/devices/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="space-y-4">
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">New device name</label>
          <input className="input mt-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Greenhouse B - Bay 1"/>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Location</label>
          <input className="input mt-1" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="e.g. Greenhouse B"/>
        </div>
        <button className="btn-primary" type="submit">Add device</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-default">
          <thead><tr><th>Name</th><th>Location</th><th>Status</th><th>Firmware</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td>{d.location}</td>
                <td>
                  <select className="input py-1 text-xs" value={d.status} onChange={(e) => setStatus(d.id, e.target.value)}>
                    <option value="online">online</option>
                    <option value="offline">offline</option>
                    <option value="maintenance">maintenance</option>
                  </select>
                </td>
                <td>{d.firmware}</td>
                <td className="text-xs text-[rgb(var(--muted))]">{fmtDate(d.created_at)}</td>
                <td><button className="btn-ghost text-rose-600" onClick={() => remove(d.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<"all"|"open"|"ack">("all");
  const load = useCallback(async () => {
    const q = filter === "all" ? "" : filter === "ack" ? "?ack=true" : "?ack=false";
    const r = await api<{ alerts: Alert[] }>(`/api/alerts${q}`);
    setAlerts(r.alerts);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  async function ack(id: string) {
    await api(`/api/alerts/${id}/ack`, { method: "PATCH" });
    await load();
  }

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        {(["all","open","ack"] as const).map(f => (
          <button key={f} className={`btn-ghost text-xs ${filter === f ? "ring-2 ring-brand-500" : ""}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table-default">
          <thead><tr><th>Severity</th><th>Device</th><th>Message</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id}>
                <td>
                  <span className={`badge ${a.severity === "critical" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300" : a.severity === "warning" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300"}`}>
                    {a.severity}
                  </span>
                </td>
                <td>{a.device_name ?? "system"}</td>
                <td>{a.message}</td>
                <td className="text-xs text-[rgb(var(--muted))]">{fmtDate(a.created_at)}</td>
                <td>{!a.acknowledged ? <button className="btn-ghost text-xs" onClick={() => ack(a.id)}>Acknowledge</button> : <span className="text-xs text-[rgb(var(--muted))]">ack’d</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LogsPanel() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => { (async () => {
    const r = await api<{ logs: Log[] }>("/api/logs?limit=200");
    setLogs(r.logs);
  })(); }, []);
  return (
    <div className="card overflow-x-auto">
      <table className="table-default">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td className="text-xs text-[rgb(var(--muted))]">{fmtDate(l.created_at)}</td>
              <td>{l.user_email ?? "—"}</td>
              <td><code className="text-xs">{l.action}</code></td>
              <td><code className="text-xs">{l.details ? JSON.stringify(l.details) : ""}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const load = useCallback(async () => {
    const r = await api<{ users: User[] }>("/api/users");
    setUsers(r.users);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setRole(id: string, role: User["role"]) {
    await api(`/api/users/${id}`, { method: "PATCH", body: { role } });
    await load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this user?")) return;
    await api(`/api/users/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="card overflow-x-auto">
      <table className="table-default">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="font-medium">{u.name}</td>
              <td>{u.email}</td>
              <td>
                <select className="input py-1 text-xs" value={u.role} onChange={(e) => setRole(u.id, e.target.value as User["role"])}>
                  <option value="admin">admin</option>
                  <option value="operator">operator</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
              <td className="text-xs text-[rgb(var(--muted))]">{fmtDate(u.created_at)}</td>
              <td><button className="btn-ghost text-rose-600" onClick={() => remove(u.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
