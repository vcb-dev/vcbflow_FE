// Thin fetch wrapper for the MVP FastAPI backend.

async function call(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  if (res.status === 401 && !location.hash.startsWith("#/login")) {
    const next = encodeURIComponent(location.hash.replace(/^#/, "") || "/studio");
    location.hash = `#/login?next=${next}`;
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* non-JSON error body */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

const job = (id) => `/api/jobs/${encodeURIComponent(id)}`;

export const api = {
  bootstrap: (lite = false) => call(lite ? "/api/bootstrap?lite=1" : "/api/bootstrap"),
  createJob: (body) => call("/api/jobs", { method: "POST", body: JSON.stringify(body) }),
  getJob: (id) => call(job(id)),
  jobStatus: (id) => call(`${job(id)}/status`),
  ship: (id, plan) => call(`${job(id)}/ship`, { method: "POST", body: JSON.stringify(plan) }),
  social: () => call("/api/social"),
  telegramStatus: () => call("/api/telegram/status"),
  renderHd: (id) => call(`${job(id)}/render-hd`, { method: "POST" }),
  split: (id, body) => call(`${job(id)}/split`, { method: "POST", body: JSON.stringify(body) }),
  deleteShot: (id, body) => call(`${job(id)}/delete-shot`, { method: "POST", body: JSON.stringify(body) }),
  voiceTrack: (id, audio) => call(`${job(id)}/voice-track`, { method: "POST", body: JSON.stringify({ audio }) }),
  illusOptions: (id, partId) => call(`${job(id)}/parts/${encodeURIComponent(partId)}/illus`),
  fill: (id, partId, clipId) => call(`${job(id)}/parts/${encodeURIComponent(partId)}/fill`, { method: "POST", body: JSON.stringify({ clip_id: clipId }) }),
  sourceOptions: (id) => call(`${job(id)}/source-options`),
  setSource: (id, partId, body) => call(`${job(id)}/parts/${encodeURIComponent(partId)}/source`, { method: "POST", body: JSON.stringify(body) }),
  select: (id, body) => call(`${job(id)}/select`, { method: "POST", body: JSON.stringify(body) }),
  emotion: (id, partId, emotion) => call(`${job(id)}/parts/${encodeURIComponent(partId)}/emotion`, { method: "POST", body: JSON.stringify({ emotion }) }),
  settings: (id, partial) => call(`${job(id)}/settings`, { method: "PATCH", body: JSON.stringify(partial) }),
  undo: (id) => call(`${job(id)}/undo`, { method: "POST" }),
  packageUrl: (id) => `${job(id)}/package`,
  aiModels: () => call("/api/ai-models"),
  outros: () => call("/api/outros"),
  setOutro: (id, clipId) => call(`${job(id)}/outro`, { method: "PUT", body: JSON.stringify({ clip_id: clipId }) }),
  content: () => call("/api/content"),
  contentTranslation: (id, lang) => call(`/api/content/${encodeURIComponent(id)}/translation?lang=${encodeURIComponent(lang)}`),
  voiceStatus: () => call("/api/voice/status"),
  resize: (id, body) => call(`${job(id)}/resize-shot`, { method: "POST", body: JSON.stringify(body) }),
  move: (id, body) => call(`${job(id)}/move-shot`, { method: "POST", body: JSON.stringify(body) }),
  presets: () => call("/api/studio-presets"),
  savePreset: (jobId, name) => call("/api/studio-presets", { method: "POST", body: JSON.stringify({ job_id: jobId, name }) }),
  deletePreset: (pid) => call(`/api/studio-presets/${encodeURIComponent(pid)}`, { method: "DELETE" }),
  deleteUpload: (uid) => call(`/api/uploads/${encodeURIComponent(uid)}`, { method: "DELETE" }),
  /** Upload one file in 32 MB chunks (Cloudflare caps one request at 100 MB). onProgress(0..1). Resolves to the clip. */
  upload: async (file, onProgress = () => {}) => {
    const CHUNK = 32 * 1024 * 1024;
    let uid = "";
    for (let off = 0; off < file.size || off === 0; off += CHUNK) {
      const last = off + CHUNK >= file.size ? 1 : 0;
      const res = await fetch(`/api/uploads?uid=${uid}&last=${last}`, { method: "POST", headers: { "X-Filename": encodeURIComponent(file.name), "Content-Type": "application/octet-stream" },
        body: file.slice(off, off + CHUNK) });
      if (!res.ok) { let d = res.statusText; try { d = (await res.json()).detail || d; } catch { /* */ } throw new Error(d); }
      const r = await res.json();
      uid = r.uid;
      onProgress(Math.min(1, (off + CHUNK) / Math.max(file.size, 1)));
      if (last) return r.clip;
    }
  },
  studioVoice: (body) => call("/api/studio/voice", { method: "POST", body: JSON.stringify(body) }),
};
