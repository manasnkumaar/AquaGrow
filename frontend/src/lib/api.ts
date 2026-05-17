export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiInit = Omit<RequestInit, "headers" | "body"> & {
  headers?: Record<string, string>;
  body?: unknown;
  token?: string | null;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("aquagrow_token");
}

export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem("aquagrow_token", t);
  else window.localStorage.removeItem("aquagrow_token");
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const token = init.token ?? getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg = isJson
      ? (payload && (payload.error ?? "Request failed")) || `HTTP ${res.status}`
      : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }
  return payload as T;
}

export function downloadUrl(path: string): string {
  const t = getToken();
  // For downloads, we cannot easily attach an Authorization header for native nav,
  // so we use a token query (the backend also accepts header). Here we open via
  // fetch+blob so the auth header is sent.
  return `${API_BASE}${path}`;
}

export async function fetchAndDownload(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
