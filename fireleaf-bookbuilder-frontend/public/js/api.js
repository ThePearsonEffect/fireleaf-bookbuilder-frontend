const BASE =
  (typeof window !== "undefined" && window.BACKEND_BASE_URL) ||
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_BASE_URL) ||
  "";

async function api(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body?.error || res.statusText || "Request failed");
  return body;
}

export const Api = {
  health: () => api("/api/health"),
  ingest: (payload) => api("/api/ingest", { method: "POST", body: JSON.stringify(payload) }),
  generate: (prompt, model = "gpt-4o-mini") =>
    api("/api/generate", { method: "POST", body: JSON.stringify({ prompt, model }) }),
  exportDocx: () => fetch(`${BASE}/api/export-docx`, { method: "POST" }),
  exportEpub: () => fetch(`${BASE}/api/export-epub`, { method: "POST" }),
  exportPdf: () => fetch(`${BASE}/api/export-pdf`, { method: "POST" }),
};

console.log("[frontend] API base:", BASE || "(empty)");
