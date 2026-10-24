// Studio controller: bootstrap, wire panes to the store, top-bar tabs, deep links (?job=&part=&shot=&lib=&insp=).
import { api } from "./api-client.js";
import { actions, currentShot, emit, store, subscribe } from "./editor-store.js";
import { initExportMenu, renderExportMenu } from "./export-menu.js";
import { esc } from "./format-helpers.js";
import { refreshRailBadges } from "./shell.js";
import { initInspector, renderInspector } from "./inspector-panel.js";
import { initLibrary, renderLibrary } from "./library-panel.js";
import { initPlayer, renderPlayer } from "./player-controls.js";
import { renderTimeline } from "./timeline-view.js";

const $ = (id) => document.getElementById(id);

let outros = [];

function renderTopbar(s) {
  if (s.job) {
    const sample = s.boot.samples.find((x) => x.script === s.job.script);
    $("project-title").textContent = s.job.content?.title || sample?.title || "Kịch bản tự nhập";
    const r = s.job.render;
    $("q-chip").classList.remove("hidden");
    $("q-chip").textContent = r.status === "rendering" ? "Đang dựng" : r.quality === "preview" ? "Nháp 360p" : "HD";
    $("review-link").classList.toggle("hidden", r.status !== "done");
    $("review-link").href = `#/review/${encodeURIComponent(s.job.id)}`;
  }
  $("undo-btn").disabled = !s.job?.history?.length || !!s.busy;
  const part = s.job?.parts.find((p) => p.part_id === s.sel.part);
  $("tl-split").disabled = !s.job || !!s.busy || (part?.shots.length || 0) >= 8;
  $("tl-delete").disabled = !s.job || !!s.busy;          // last shot of a part: the next suggested clip takes its place
  $("busy-chip").classList.toggle("hidden", !s.busy && s.job?.render.status !== "rendering");
  $("busy-chip").textContent = s.busy ? `${s.busy}…` : "Đang dựng lại video…";
  const sel = $("outro-select");
  const cur = s.job?.settings?.outro === false ? "" : s.job?.outro?.clip_id || "";
  const opts = [["", "Không outro"], ...outros.map((o) => [o.clip_id, o.label])];
  if (s.job?.outro && !outros.some((o) => o.clip_id === s.job.outro.clip_id)) opts.push([s.job.outro.clip_id, s.job.outro.label]);
  const html = opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("");
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  sel.disabled = !s.job || !!s.busy;
}

async function applyDeepLink() {
  const q = new URLSearchParams(location.search);
  if (q.get("lib")) store.libTab = q.get("lib");
  if (q.get("insp")) store.inspTab = q.get("insp");
  if (q.get("part")) store.sel = { part: q.get("part"), shot: Number(q.get("shot") || 0) };
  if (q.get("zoom")) store.zoom = Number(q.get("zoom"));
  if (q.get("job")) await actions.load(q.get("job"));
}

let started = false;

export async function startStudio() {
  if (started) return;
  started = true;
  store.boot = await api.bootstrap();
  initLibrary();
  initInspector();
  initPlayer();
  initExportMenu();
  // phone: the editing panes stack under the player; one switch shows either the build steps or the selected scene
  const setPane = (k) => {
    document.body.dataset.mpane = k;
    document.querySelectorAll("[data-mpane]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mpane === k)));
  };
  setPane("lib");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mpane]");
    if (b) setPane(b.dataset.mpane);
    else if (e.target.closest("#timeline .tl-block[data-shot]") && matchMedia("(max-width: 700px)").matches) setPane("insp");
  });
  refreshRailBadges();
  api.outros().then((r) => { outros = r.items.filter((o) => o.kind === "huyk"); emit(); }).catch(() => {});
  $("outro-select").addEventListener("change", (e) => actions.outro(e.target.value));
  $("undo-btn").addEventListener("click", () => actions.undo());
  $("tl-split").addEventListener("click", () => { const sh = currentShot(); if (sh) actions.split(sh.part_id, sh.index); });
  $("tl-delete").addEventListener("click", () => { const sh = currentShot(); if (sh) actions.deleteShot(sh.part_id, sh.index); });
  $("tl-zoom").addEventListener("input", (e) => { store.zoom = Number(e.target.value); emit(); });
  subscribe((s) => { renderTopbar(s); renderLibrary(s); renderInspector(s); renderTimeline($("timeline"), s); renderPlayer(s); renderExportMenu(s); });
  emit();
  await applyDeepLink();
  window.addEventListener("resize", () => emit());
  document.addEventListener("keydown", (e) => {                 // CapCut shortcuts: Ctrl+B split, Delete removes shot, Ctrl+Z undo
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || store.busy || !store.job) return;
    const shot = currentShot();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && shot) { e.preventDefault(); actions.split(shot.part_id, shot.index); }
    else if (e.key === "Delete" && shot) { e.preventDefault(); actions.deleteShot(shot.part_id, shot.index); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && store.job.history?.length) { e.preventDefault(); actions.undo(); }
  });
}

