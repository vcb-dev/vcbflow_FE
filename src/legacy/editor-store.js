// Central editor state + actions. Views subscribe and re-render on every change.
import { api } from "./api-client.js";

export const store = {
  boot: null, job: null, sel: { part: "p1", shot: 0 }, libTab: "script", inspTab: "scene", zoom: 1, busy: "",
};
const listeners = [];
let poller = null;

export const subscribe = (fn) => listeners.push(fn);
export const emit = () => listeners.forEach((fn) => fn(store));

export function setUi(patch) {
  Object.assign(store, patch);
  emit();
}

export const currentPart = () => store.job?.parts.find((p) => p.part_id === store.sel.part) || store.job?.parts[0];
export const currentShot = () => {
  const part = currentPart();
  return part ? part.shots[Math.min(store.sel.shot, part.shots.length - 1)] : null;
};

function setJob(job) {
  if (store.job && job.id === store.job.id && job.render.revision < store.job.render.revision) return;  // stale
  store.job = job;
  if (!job.parts.some((p) => p.part_id === store.sel.part)) store.sel = { part: job.parts[0]?.part_id, shot: 0 };
  emit();
}

function poll() {
  clearInterval(poller);
  const id = store.job.id;
  let busy = false;
  poller = setInterval(async () => {
    if (busy) return;                                                  // never stack requests on a slow tick
    busy = true;
    try {
      const st = await api.jobStatus(id);                               // tiny payload; full job only on change
      if (!store.job || store.job.id !== id) return clearInterval(poller);
      if (st.revision !== store.job.render.revision || st.status !== store.job.render.status) setJob(await api.getJob(id));
      if (st.status !== "rendering") clearInterval(poller);
    } catch { /* transient: retry next tick */ } finally { busy = false; }
  }, 1000);
}

/** Apply a job returned by the server and follow its re-render. */
export function applyJob(job) {
  setJob(job);
  poll();
}

/** A short message at the bottom of the Studio (instead of a blocking browser alert). */
export function toast(msg, bad = true) {
  let t = document.getElementById("st-toast");
  if (!t) { t = document.createElement("div"); t.id = "st-toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.className = bad ? "bad on" : "on";
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.className = bad ? "bad" : ""; }, 4200);
}

/** Run an editor action: shows a busy label, applies the returned job, then follows the re-render. */
export async function run(label, action) {
  store.busy = label;
  emit();
  try {
    setJob(await action());
    poll();
  } catch (err) {
    toast(`${label.replace(/^Đang /, "Không ")}: ${err.message}`);
  } finally {
    store.busy = "";
    emit();
  }
}

export const actions = {
  build: (body) => run("Đang lập kế hoạch, lồng tiếng giọng HuyK, chọn footage", () => api.createJob(body)),
  load: (id) => run("Đang mở dự án", () => api.getJob(id)),
  choose: (partId, shotIndex, option) => run("Đang thay cảnh", () => api.select(store.job.id, { part_id: partId, shot_index: shotIndex, option })),
  emotion: (partId, emotion) => run("Đang đọc lại giọng HuyK với cảm xúc mới", () => api.emotion(store.job.id, partId, emotion)),
  settings: (partial) => run(partial.voice ? "Đang đổi giọng đọc" : "Đang áp dụng tùy chọn", () => api.settings(store.job.id, partial)),
  undo: () => run("Đang hoàn tác", () => api.undo(store.job.id)),
  source: (partId, role, craftStep, huykAction) => run("Đang đổi cảnh source", () => api.setSource(store.job.id, partId, { role, craft_step: craftStep || null, huyk_action: huykAction || null })),
  renderHd: () => run("Đang render bản HD 720×1280", () => api.renderHd(store.job.id)),
  split: (partId, shotIndex) => run("Đang tách shot", () => api.split(store.job.id, { part_id: partId, shot_index: shotIndex })),
  deleteShot: (partId, shotIndex) => run("Đang xoá shot", () => api.deleteShot(store.job.id, { part_id: partId, shot_index: shotIndex })),
  outro: (clipId) => run(clipId ? "Đang đổi outro" : "Đang bỏ outro", () => api.setOutro(store.job.id, clipId)),
  resize: (partId, shotIndex, duration) => run("Đang chỉnh độ dài shot", () => api.resize(store.job.id, { part_id: partId, shot_index: shotIndex, duration })),
  move: (partId, shotIndex, toPart, toIndex) => run(partId === toPart ? "Đang đổi chỗ shot" : "Đang chép clip sang phần khác",
    () => api.move(store.job.id, { part_id: partId, shot_index: shotIndex, to_part: toPart, to_index: toIndex })),
  voiceTrack: (audio) => run("Đang đưa voice vào timeline, cắt ghép footage theo độ dài voice", () => api.voiceTrack(store.job.id, audio)),
};
