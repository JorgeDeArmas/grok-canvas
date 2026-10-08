import { apiBaseOk, previewUrlOk, TOKEN_RE } from "./core.js";

function headers(token) {
  const h = { "content-type": "application/json" };
  if (token) h.authorization = "Bearer " + token;
  return h;
}

export async function api(base, path, { token, method = "GET", body } = {}) {
  const origin = apiBaseOk(base);
  if (!origin) throw Object.assign(new Error("api"), { status: 0 });
  if (token && !TOKEN_RE.test(token)) throw Object.assign(new Error("token"), { status: 0 });
  const res = await fetch(origin + path, {
    method,
    headers: headers(token),
    body: body != null ? JSON.stringify(body) : undefined,
    referrerPolicy: "no-referrer",
    credentials: "omit",
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || String(res.status));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function sessions(base, token, { includeOwner = false } = {}) {
  return api(base, "/manager/sessions" + (includeOwner ? "?include=owner" : ""), { token });
}

export function extendSession(base, token, id, days = 3) {
  return api(base, `/manager/sessions/${encodeURIComponent(id)}/extend`, { token, method: "POST", body: { days } });
}

export function revokeSession(base, token, id) {
  return api(base, `/manager/sessions/${encodeURIComponent(id)}/revoke`, { token, method: "POST", body: {} });
}

export function takeUrl(base, token, id) {
  return api(base, `/manager/takes/${encodeURIComponent(id)}/url`, { token }).then((d) => {
    const url = previewUrlOk(d && d.url);
    if (!url) throw Object.assign(new Error("preview"), { status: 0 });
    return { ...d, url };
  });
}

export function approveTake(base, token, id) {
  return api(base, `/manager/takes/${encodeURIComponent(id)}/approve`, { token, method: "POST", body: {} });
}

export function redoTake(base, token, id, reason) {
  return api(base, `/manager/takes/${encodeURIComponent(id)}/redo`, { token, method: "POST", body: { reason: String(reason || "").slice(0, 200) } });
}

export function getSession(base, token) {
  return api(base, "/s/" + encodeURIComponent(token), { token });
}

export function validateSessions(data) {
  if (!data || !Array.isArray(data.sessions)) return [];
  return data.sessions.map((s) => ({
    id: s.id,
    kind: s.kind || "creator",
    creator_name: s.creator_name,
    shoot_date: s.shoot_date,
    expires_at: s.expires_at,
    revoked_at: s.revoked_at,
    jobs: s.jobs || [],
    takes: (s.takes || []).map((t) => ({
      id: t.id, job_id: t.job_id, shot: t.shot, take: t.take,
      status: t.status, redo_reason: t.redo_reason,
      uploaded_at: t.uploaded_at, pulled_at: t.pulled_at, size: t.size,
    })),
  }));
}
