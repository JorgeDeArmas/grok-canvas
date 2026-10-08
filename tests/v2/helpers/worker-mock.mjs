export function installWorkerMock(page, { sessions = [], sessionByToken = {}, partSize = 1024 * 1024 } = {}) {
  const state = { sessions: structuredClone(sessions), sessionByToken: { ...sessionByToken }, uploads: {}, parts: {}, events: [] };

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const auth = req.headers().authorization || "";
    const body = req.postDataJSON?.() || (req.postData() ? JSON.parse(req.postData()) : {});
    const p = url.pathname;

    if (req.method() === "GET" && p.startsWith("/s/")) {
      const tok = decodeURIComponent(p.slice(3));
      const s = state.sessionByToken[tok];
      if (!s || s.revoked || (s.expires_at && Date.parse(s.expires_at) < Date.now())) {
        return route.fulfill({ status: 403, body: JSON.stringify({ error: "inactive" }) });
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(s) });
    }
    if (p === "/manager/sessions") {
      const include = url.searchParams.get("include") === "owner";
      const list = state.sessions.filter((s) => include || s.kind !== "owner");
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ sessions: list }) });
    }
    const ext = p.match(/^\/manager\/sessions\/([^/]+)\/extend$/);
    if (ext && req.method() === "POST") {
      const s = state.sessions.find((x) => x.id === ext[1]);
      if (!s) return route.fulfill({ status: 404, body: "{}" });
      s.expires_at = new Date(Date.now() + (body.days || 3) * 86400000).toISOString();
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(s) });
    }
    const rev = p.match(/^\/manager\/sessions\/([^/]+)\/revoke$/);
    if (rev && req.method() === "POST") {
      const s = state.sessions.find((x) => x.id === rev[1]);
      if (!s) return route.fulfill({ status: 404, body: "{}" });
      s.revoked = true; s.status = "revoked";
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(s) });
    }
    const takeUrl = p.match(/^\/manager\/takes\/([^/]+)\/url$/);
    if (takeUrl) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ url: `https://creator-portal-api.example.workers.dev/manager/takes/${takeUrl[1]}/file?ticket=abc` }),
      });
    }
    const approve = p.match(/^\/manager\/takes\/([^/]+)\/approve$/);
    if (approve) {
      for (const s of state.sessions) {
        const tk = (s.takes || []).find((t) => t.id === approve[1]);
        if (tk) tk.status = "approved";
      }
      return route.fulfill({ contentType: "application/json", body: "{}" });
    }
    const redo = p.match(/^\/manager\/takes\/([^/]+)\/redo$/);
    if (redo) {
      for (const s of state.sessions) {
        const tk = (s.takes || []).find((t) => t.id === redo[1]);
        if (tk) { tk.status = "redo"; tk.redo_reason = body.reason || ""; }
      }
      return route.fulfill({ contentType: "application/json", body: "{}" });
    }
    if (p === "/upload/init") {
      const id = "upl_" + Math.random().toString(36).slice(2);
      state.uploads[id] = { ...body, parts: [] };
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ uploadId: id, partSize, key: `${body.job}/${body.shot}/${body.take}` }),
      });
    }
    if (p === "/upload/sign") {
      const n = body.partNumber || 1;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ url: `https://bucket.r2.cloudflarestorage.com/part/${n}`, partNumber: n }),
      });
    }
    if (p === "/upload/complete") {
      state.events.push("owner_upload_completed");
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (p === "/upload/abort") {
      return route.fulfill({ contentType: "application/json", body: "{}" });
    }
    return route.fulfill({ status: 404, body: "{}" });
  }

  return { state, handle };
}

export function defaultLive() {
  return {
    sessions: [{
      id: "sess-ana",
      kind: "creator",
      creator_name: "Ana",
      expires_at: "2026-10-13T16:00:00.000Z",
      shoot_date: "2026-10-10",
      status: "active",
      takes: [
        { id: "tk1", job_id: "ff-020", shot: 1, take: 1, status: "uploaded", redo_reason: "", uploaded_at: "2026-10-08T12:00:00.000Z", pulled_at: null, size: 1000 },
      ],
      jobs: [{ job_id: "ff-020", status: "uploaded" }],
    }],
    sessionByToken: {
      creatortokensynth01: {
        id: "sess-ana", kind: "creator", jobs: [{ job_id: "ff-020", status: "sent" }], takes: [],
        expires_at: "2026-10-13T16:00:00.000Z",
      },
      ownertokensynthetic1: {
        id: "sess-owner", kind: "owner", jobs: [{ job_id: "ff-010", status: "sent" }], takes: [],
        expires_at: "2026-10-22T16:00:00.000Z",
      },
    },
  };
}
