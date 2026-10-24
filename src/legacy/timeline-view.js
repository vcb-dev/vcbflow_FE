// CapCut-style multi-track timeline: track headers with toggles, parts, picture shots, subtitles, VO, music, SFX, logo.
import { actions, run, setUi, store, toast } from "./editor-store.js";
import { openWebSearch } from "./web-search.js";
import { api } from "./api-client.js";
import { esc, fmtTime, media, GEN_LABEL } from "./format-helpers.js";
import { uploadFiles } from "./library-panel.js";

let pxPerSec = 20;
let playheadEl = null;
const HEAD = 132;

function block(cls, start, dur, inner, attrs = "", extraStyle = "") {
  const style = `left:${start * pxPerSec}px;width:${Math.max(dur * pxPerSec - 2, 3)}px;${extraStyle}`;
  return `<div class="tl-block ${cls}" style="${style}" ${attrs}>${inner}</div>`;
}

function shotBlock(job, shot, active) {
  const sel = shot.selected;
  const isActive = active.part === shot.part_id && active.shot === shot.index ? " active" : "";
  const attrs = `data-part="${shot.part_id}" data-shot="${shot.index}" title="${fmtTime(shot.start)} · ${shot.duration.toFixed(1)}s"`;
  if (sel.kind === "clip") {
    const clip = job.clips[sel.clip_id] || {};
    const fx = [sel.speed && Math.abs(sel.speed - 1) > 0.01 ? `${sel.speed}×` : "", sel.zoom ? `⊕${sel.zoom}` : ""].filter(Boolean).join(" ");
    const part = job.parts.find((p) => p.part_id === shot.part_id);
    const trimmable = part && part.shots.length > 1 && part.shots.every((x) => x.selected.kind === "clip");
    const lib = clip.library === "huyk" ? "huyk" : clip.library === "upload" ? "upload" : clip.rights === "collected" ? "collected" : "";
    return block(`shot${lib ? " " + lib : ""}${isActive}`, shot.start, shot.duration,
      `<span class="tag">${esc(lib === "huyk" ? "HUYK" : lib === "upload" ? "TẢI LÊN" : lib === "collected" ? "SƯU TẦM" : clip.product_set || "VCB")}</span>${fx ? `<span class="fx">${fx}</span>` : ""}`
      + (trimmable ? '<i class="tl-trim" data-trim title="Kéo để chỉnh độ dài shot"></i>' : ""),
      `${attrs} draggable="true" data-clip="${esc(sel.clip_id)}"`, `background-image:url('${media(clip.thumb)}')`);
  }
  const gen = job.parts.flatMap((p) => p.gen_options || []).find((g) => g.gen_id === sel.gen_id);
  const label = sel.kind === "gen" ? (gen?.type === "shoot_request" ? "⚑ QUAY BỔ SUNG" : "AI") : "⚠ THIẾU";
  return block(`${sel.kind === "gen" ? "shot gen" : "shot missing"}${isActive}`, shot.start, shot.duration,
    `<b>${label}</b><br><small>${esc(GEN_LABEL[gen?.type] || "")}</small>`, attrs);
}

function head(name, toggle) {
  if (!toggle) return `<div class="tl-head"><span class="name">${name}</span></div>`;
  const [key, on, icons] = toggle;
  return `<div class="tl-head"><span class="name">${name}</span>
    <button class="${on ? "" : "off"}" data-track-toggle="${key}" title="Bật/tắt" ${store.busy ? "disabled" : ""}>${on ? icons[0] : icons[1]}</button></div>`;
}

function row(name, html, cls = "", toggle = null) {
  const muted = toggle && !toggle[1] ? " muted" : "";
  return `<div class="tl-row ${cls}${muted}">${head(name, toggle)}${html}</div>`;
}

export function renderTimeline(container, s) {
  const job = s.job;
  if (!job) { container.innerHTML = '<p class="muted pad">Timeline sẽ hiện sau khi dựng video.</p>'; return; }
  const cfg = job.settings || {};
  const T = job.timeline.duration;
  const outro = job.outro && cfg.outro !== false ? job.outro : null;     // HuyK outro appended at render (VN)
  const TT = T + (outro ? outro.duration : 0);
  pxPerSec = Math.max(12, Math.floor((container.clientWidth - HEAD - 20) / Math.max(TT, 1))) * s.zoom;
  const width = TT * pxPerSec;
  const step = s.zoom >= 2 ? 1 : 5;
  const ticks = Array.from({ length: Math.ceil(TT / step) + 1 }, (_, i) => `<span style="left:${i * step * pxPerSec}px">${i * step}s</span>`).join("");
  const parts = job.parts.map((p) => block(`part ${p.status}`, p.start, p.duration,
    `<span class="pt-l"><b>${esc(p.role_label)}</b>${p.craft_step ? " · " + esc(STEP_VI[p.craft_step] || p.craft_step.replace(/_/g, " ")) : ""}</span>${voOf(job, p) && p.duration * pxPerSec > 125 ? `<span class="pt-vo" title="Thời lượng giọng đọc của đoạn">🎙${voOf(job, p).duration.toFixed(1)}s</span>` : ""}<i class="pt-caret" aria-hidden="true">▾</i>`,
    `data-part="${p.part_id}" data-shot="0" data-src="1" title="Bấm để đổi cảnh source của đoạn này"`)).join("");
  const shots = job.timeline.shots.map((sh) => shotBlock(job, sh, s.sel)).join("")
    + (outro ? block("shot outro", T, outro.duration, `<span class="tag">OUTRO · ${esc(outro.label)}</span>`, `title="Outro tự ghép · ${outro.duration.toFixed(1)}s"`,
      `background-image:url('${media(outro.thumb)}')`) : "");
  const subs = job.timeline.subtitles.map((c) => block("sub", c.start, c.end - c.start, esc(c.text))).join("");
  const vo = job.timeline.vo.map((v) => block("voice", v.start, v.duration, `🎙 ${v.direction ? esc(v.direction) : ""} ${v.duration.toFixed(1)}s`)).join("");
  const logo = job.timeline.logo.map((l) => block("logo", l.start, l.end - l.start, "◆ logo HuyK")).join("");
  const music = block("music", 0, T, `♪ ${esc(s.boot.music.find((m) => m.id === cfg.music_track)?.name || "nhạc nền")} · ${Math.round((cfg.music_volume ?? 0.32) * 100)}% · tự hạ khi có giọng`);
  container.innerHTML = `<div class="tl-inner" style="width:${width + HEAD + 20}px">
    <div class="tl-ruler" style="width:${width}px">${ticks}</div>
    ${row(job.web_pending ? '<span class="is-busy" title="AI đang tìm hình trên mạng / vẽ ảnh AI cho các đoạn minh hoạ, xong sẽ tự dựng lại">Đang tìm hình…</span>' : "Phần kịch bản", parts, "parts")}
    ${row("Văn bản", subs, "", ["subtitles", cfg.subtitles !== false, ["👁", "🚫"]])}
    ${row("Hình chính", shots, "main")}
    ${row("Lồng tiếng", vo)}
    ${row("Nhạc nền", music, "", ["music", (cfg.music_volume ?? 0.32) > 0, ["🔊", "🔇"]])}
    ${row("Logo", logo, "", ["logo", cfg.logo !== false, ["👁", "🚫"]])}
    <div class="tl-playhead" style="left:${HEAD}px"></div></div>`;
  playheadEl = container.querySelector(".tl-playhead");
  if (openPid) requestAnimationFrame(placeMenu);
  container.querySelectorAll(".tl-block[data-part]").forEach((el) => el.addEventListener("click", (e) => {
    setUi({ sel: { part: el.dataset.part, shot: Number(el.dataset.shot) }, seekTo: job.parts.find((p) => p.part_id === el.dataset.part).shots[Number(el.dataset.shot)]?.start });
    if (el.dataset.src) openSourceMenu(job, el.dataset.part);
  }));
  // CapCut-style editing on the picture track: drop a library clip / a file from the computer onto a shot,
  // drag a shot onto another (same part = swap places, other part = copy the clip there), drag a shot's right edge to trim.
  const ACCEPT = ["text/vcb-clip", "text/vcb-shot", "Files"];
  container.querySelectorAll(".tl-row.main .tl-block[data-part]").forEach((el) => {
    el.addEventListener("dragstart", (e) => {
      if (store.busy || !el.dataset.clip) { e.preventDefault(); return; }
      e.dataTransfer.setData("text/vcb-shot", JSON.stringify({ part: el.dataset.part, shot: Number(el.dataset.shot) }));
      e.dataTransfer.effectAllowed = "move";
      document.body.classList.add("dragging-clip");
    });
    el.addEventListener("dragend", () => document.body.classList.remove("dragging-clip"));
    el.addEventListener("dragover", (e) => {
      const types = [...e.dataTransfer.types];
      if (!ACCEPT.some((t) => types.includes(t))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = types.includes("text/vcb-shot") ? "move" : "copy";
      el.classList.add("drop-on");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-on"));
    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.classList.remove("drop-on");
      document.body.classList.remove("dragging-clip");
      if (store.busy) return;
      const part = el.dataset.part, shot = Number(el.dataset.shot);
      const moved = e.dataTransfer.getData("text/vcb-shot");
      if (moved) {
        const m = JSON.parse(moved);
        if (m.part === part && m.shot === shot) return;
        setUi({ sel: { part, shot } });
        actions.move(m.part, m.shot, part, shot);
        return;
      }
      let clipId = e.dataTransfer.getData("text/vcb-clip");
      if (!clipId && e.dataTransfer.files.length) {          // a video / photo straight from the computer
        const clips = await uploadFiles([...e.dataTransfer.files].slice(0, 1));
        clipId = clips[0]?.id;
      }
      if (!clipId) return;
      setUi({ sel: { part, shot } });
      actions.choose(part, shot, { kind: "clip", clip_id: clipId, manual: true });
    });
  });
  container.querySelectorAll(".tl-trim").forEach((h) => h.addEventListener("pointerdown", (e) => {
    if (store.busy) return;
    e.preventDefault();
    e.stopPropagation();
    const el = h.closest(".tl-block"), part = el.dataset.part, idx = Number(el.dataset.shot);
    const shotObj = job.parts.find((p) => p.part_id === part).shots[idx];
    const x0 = e.clientX, w0 = el.offsetWidth, d0 = shotObj.duration;
    const tip = document.createElement("span");
    tip.className = "tl-tip";
    el.appendChild(tip);
    el.classList.add("trimming");
    h.setPointerCapture(e.pointerId);
    const dur = (ev) => Math.max(0.4, d0 + (ev.clientX - x0) / pxPerSec);
    const move = (ev) => { el.style.width = `${Math.max(w0 + ev.clientX - x0, 8)}px`; tip.textContent = `${dur(ev).toFixed(1)}s`; };
    const up = (ev) => {
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      el.classList.remove("trimming");
      tip.remove();
      if (Math.abs(ev.clientX - x0) < 3) { el.style.width = `${w0}px`; return; }
      actions.resize(part, idx, Number(dur(ev).toFixed(2)));
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
  }));
  container.querySelector(".tl-ruler").addEventListener("click", (e) => setUi({ seekTo: (e.clientX - e.currentTarget.getBoundingClientRect().left) / pxPerSec }));
  container.querySelectorAll("[data-track-toggle]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.trackToggle;
    actions.settings(key === "music" ? { music_volume: (cfg.music_volume ?? 0.32) > 0 ? 0 : 0.32 } : { [key]: cfg[key] === false });
  }));
}

export function updatePlayhead(seconds) {
  if (playheadEl) playheadEl.style.left = `${HEAD + seconds * pxPerSec}px`;
}

const STEP_VI = { thiet_ke: "thiết kế", chuan_bi_nguyen_lieu: "nguyên liệu", nung_nau: "nung · khò", do_khuon: "đổ khuôn", dap_can: "đập cán",
  cua_cat: "cưa cắt", han: "hàn", dua_mai: "giũa mài", khoan: "khoan", gan_da_chu: "gắn đá chủ", dinh_da: "đính đá", danh_bong: "đánh bóng", hoan_thien: "hoàn thiện" };
const srcCache = {};
const voOf = (job, p) => (job.timeline.vo || []).find((v) => v.part_id === p.part_id);

/** "Phần kịch bản" picker (like the Outro select): a list that opens UPWARD, attached to the clicked part block. */
let openPid = null;
function anchorOf(pid) { return document.querySelector(`.tl-row.parts .tl-block[data-part="${CSS.escape(pid)}"]`); }
function placeMenu() {
  const menu = document.getElementById("tl-src"), a = openPid && anchorOf(openPid);
  if (!menu || !a) return;
  const r = a.getBoundingClientRect(), w = Number(menu.dataset.w) || Math.max(r.width, 270);
  menu.style.width = `${w}px`;
  menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  const room = r.top - 10;                                   // space above the block
  if (room >= 160 || room >= innerHeight - r.bottom - 10) {
    menu.style.maxHeight = `${Math.min(340, room)}px`;
    menu.style.top = "";
    menu.style.bottom = `${innerHeight - r.top + 2}px`;
  } else {
    menu.style.maxHeight = `${Math.min(340, innerHeight - r.bottom - 10)}px`;
    menu.style.bottom = "";
    menu.style.top = `${r.bottom + 2}px`;
  }
  document.querySelectorAll(".tl-row.parts .tl-block.src-open").forEach((b) => b.classList.remove("src-open"));
  a.classList.add("src-open");
}

const ILLUS_FAMS = ["A1", "A2", "A3"];

async function openSourceMenu(job, partId) {
  if (openPid === partId) { closeSourceMenu(); return; }   // second click on the same block closes it
  closeSourceMenu();
  if (store.busy) return;
  if (ILLUS_FAMS.includes(job.family)) return openIllusMenu(job, partId);
  const part = job.parts.find((p) => p.part_id === partId);
  openPid = partId;
  const menu = document.createElement("div");
  menu.id = "tl-src";
  menu.className = "tl-src";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Đổi cảnh source");
  menu.innerHTML = '<div class="tl-src-h">Đang tải…</div>';
  document.body.append(menu);
  requestAnimationFrame(placeMenu);                          // after the timeline re-render triggered by the click
  setTimeout(() => { document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", escKey); }, 0);
  let opts = srcCache[job.id];
  try {
    if (!opts) opts = srcCache[job.id] = (await api.sourceOptions(job.id)).options;
  } catch (err) { menu.innerHTML = `<div class="tl-src-h bad">${esc(err.message)}</div>`; return; }
  if (!document.getElementById("tl-src") || openPid !== partId) return;
  const cur = (o) => o.role === part.role && (o.role !== "craft" || o.craft_step === part.craft_step);
  const vo = voOf(job, part);
  const head = `<div class="tl-src-vo"><span>🎙 Giọng đoạn này <b>${vo ? vo.duration.toFixed(1) : "—"}s</b> · ${fmtTime(part.start)} → ${fmtTime(part.start + part.duration)}</span>
    <span class="tl-src-bar"><i style="left:${vo ? Math.max(0, ((vo.start - part.start) / part.duration) * 100) : 0}%;width:${vo ? Math.min(100, (vo.duration / part.duration) * 100) : 0}%"></i></span>
    <small>Cảnh mới tự cắt đúng ${part.duration.toFixed(1)}s theo giọng, không lệch</small></div>`;
  menu.innerHTML = head + opts.map((o, i) => `<button type="button" role="option" class="tl-src-o${cur(o) ? " on" : ""}" data-o="${i}" aria-selected="${cur(o)}"
      title="${esc(o.sub || "")}"><span>${esc(o.label)}</span>${o.n != null ? `<i>${o.n} clip</i>` : ""}</button>`).join("");
  placeMenu();
  menu.querySelector(".tl-src-o.on")?.scrollIntoView({ block: "nearest" });
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-o]");
    if (!b) return;
    const o = opts[Number(b.dataset.o)];
    closeSourceMenu();
    if (!cur(o)) actions.source(partId, o.role, o.craft_step);
  });
}
/** A1–A3: picture source of a part — scene type, AI library topic, web pictures found, Gemini picture. Opens upward. */
async function openIllusMenu(job, partId) {
  const part = job.parts.find((p) => p.part_id === partId);
  const shot = part.shots[0];
  openPid = partId;
  const menu = document.createElement("div");
  menu.id = "tl-src";
  menu.className = "tl-src ill";
  menu.dataset.w = Math.min(460, innerWidth - 16);
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Nguồn hình cho đoạn");
  const vo = voOf(job, part);
  const headHtml = `<div class="tl-src-vo"><span>🎙 Giọng đoạn này <b>${vo ? vo.duration.toFixed(1) : "—"}s</b> · ${fmtTime(part.start)} → ${fmtTime(part.start + part.duration)}</span>
    <span class="tl-src-bar"><i style="left:${vo ? Math.max(0, ((vo.start - part.start) / part.duration) * 100) : 0}%;width:${vo ? Math.min(100, (vo.duration / part.duration) * 100) : 0}%"></i></span>
    ${part.vo_text ? `<small class="ill-line">“${esc(part.vo_text.trim().replace(/^["“”']+|["“”']+$/g, ""))}”</small>` : ""}</div>
    <div class="ill-roles" role="tablist" aria-label="Loại cảnh">${[["content_illustration", "Minh hoạ"], ["huyk_talk", "HuyK nói"], ["hook", "Hook"]].map(([r, l]) =>
      `<button type="button" role="tab" class="ill-role${part.role === r || (r === "content_illustration" && !["huyk_talk", "hook"].includes(part.role)) ? " on" : ""}" data-role="${r}">${l}</button>`).join("")}</div>`;
  menu.innerHTML = headHtml + '<div class="ill-body"><div class="tl-src-h">Đang tải hình…</div></div>';
  document.body.append(menu);
  requestAnimationFrame(placeMenu);
  setTimeout(() => { document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", escKey); }, 0);
  let d;
  try { d = await api.illusOptions(job.id, partId); }
  catch (err) { menu.querySelector(".ill-body").innerHTML = `<div class="tl-src-h bad">${esc(err.message)}</div>`; return; }
  if (!document.getElementById("tl-src") || openPid !== partId) return;
  const cur = new Set(d.current || []);
  const tile = (x, i, grp) => `<button type="button" class="ill-t${x.clip_id && cur.has(x.clip_id) ? " on" : ""}" data-g="${grp}" data-i="${i}" title="${esc(x.title || x.via || "")}">
      <img src="${esc(x.clip_id ? media(x.thumb) : x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
      <span class="ill-tags">${x.kind === "video" ? "<em>Video</em>" : ""}${x.copyright ? '<em class="cr">©</em>' : ""}</span>
      ${grp === "web" ? `<span class="ill-cap">${esc((x.via || "").split(" · ").slice(-1)[0])}${x.score != null ? ` · <b>${x.score}%</b>` : ""}</span>` : `<span class="ill-cap">${esc(x.title || "")}</span>`}</button>`;
  const see = d.kw?.see || "";
  menu.querySelector(".ill-body").innerHTML = `<div class="ill-scroll">
      <div class="ill-sec"><span class="ill-st"><b>Kho Minh hoạ AI${d.topic ? " · " + esc(d.topic) : ""}</b><small>${d.topic ? "khớp chủ đề" : "chưa có chủ đề khớp · ảnh mới nhất"}</small></span>
        <div class="ill-grid">${d.kho.map((x, i) => tile(x, i, "kho")).join("") || '<small class="ill-empty">Kho Minh hoạ AI chưa có ảnh</small>'}</div></div>
      <div class="ill-sec"><span class="ill-st"><b>Hình trên mạng AI đã tìm</b><small>xếp theo độ khớp</small></span>
        <div class="ill-grid">${d.web.map((x, i) => tile(x, i, "web")).join("") || '<small class="ill-empty">Chưa có · bấm “Tìm thêm trên mạng”</small>'}</div></div></div>
    <div class="ill-gen"><div class="ill-genrow"><input id="ill-prompt" class="ill-in" aria-label="Mô tả ảnh AI" value="${esc(see)}" placeholder="Mô tả ảnh cần vẽ (để trống: AI tự đọc câu thoại)">
      <button type="button" class="export-btn" data-gen>✦ Tạo ảnh AI</button></div>
      <span class="ill-foot"><small>Ảnh AI Gemini ~1.000đ · không bản quyền</small><button type="button" class="ill-link" data-more>Tìm thêm trên mạng / dán link…</button></span></div>`;
  placeMenu();
  const fill = (clipId, label) => { closeSourceMenu(); run(label || "Đang thay hình", () => api.fill(job.id, partId, clipId)); };
  menu.addEventListener("click", async (e) => {
    const r = e.target.closest("[data-role]");
    if (r) { closeSourceMenu(); if (r.dataset.role !== part.role) actions.source(partId, r.dataset.role, null); return; }
    if (e.target.closest("[data-more]")) { closeSourceMenu(); openWebSearch(job, part, shot); return; }
    const g = e.target.closest("[data-gen]");
    if (g) {
      const prompt = menu.querySelector("#ill-prompt").value.trim();
      g.disabled = true; g.textContent = "Đang vẽ…";
      try {
        const res = await callJson("/api/web-media/generate", { line: part.vo_text || "", see: prompt, title: job.content?.title || "" });
        fill(res.clip.id, "Đang đặt ảnh AI vào đoạn");
      } catch (err) { g.disabled = false; g.textContent = "✦ Tạo ảnh AI"; toast(err.message); }
      return;
    }
    const t = e.target.closest(".ill-t");
    if (!t) return;
    const x = d[t.dataset.g][Number(t.dataset.i)];
    if (x.clip_id) return fill(x.clip_id);
    t.classList.add("busy");
    try {
      const res = await callJson("/api/web-media/fetch", { cand: x, line: part.vo_text || "" });
      fill(res.clip.id);
    } catch (err) { t.classList.remove("busy"); toast(err.message); }
  });
}

async function callJson(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { let m = res.statusText; try { m = (await res.json()).detail || m; } catch { /* */ } throw new Error(typeof m === "string" ? m : JSON.stringify(m)); }
  return res.json();
}

function outside(e) { if (!e.target.closest("#tl-src") && !e.target.closest(".tl-row.parts .tl-block")) closeSourceMenu(); }
function escKey(e) { if (e.key === "Escape") closeSourceMenu(); }
function closeSourceMenu() {
  openPid = null;
  document.querySelectorAll(".tl-row.parts .tl-block.src-open").forEach((b) => b.classList.remove("src-open"));
  document.getElementById("tl-src")?.remove(); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escKey); }
