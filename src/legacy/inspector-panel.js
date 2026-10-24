// Right pane (CapCut "properties"): tabs Cảnh | Giọng | Tốc độ & khung for the selected part/shot.
import { actions, currentPart, currentShot, setUi, store } from "./editor-store.js";
import { isVi } from "./i18n.js";
const ZERO = () => (isVi() ? "0đ" : "$0");
import { esc, fmtTime, media, money, GEN_LABEL, STATUS_CHIP, STATUS_LABEL } from "./format-helpers.js";
import { renderSpeedTab, renderVoiceTab, wireSpeedTab, wireVoiceTab } from "./inspector-voice-speed.js";
import { ensureMiniMaxVoices, mountVoiceStudio } from "./script-panel.js";
import { openWebSearch } from "./web-search.js";

const TABS = [["scene", "Cảnh"], ["voice", "Giọng"], ["speed", "Cắt & khung"]];
const SCOPE_BADGE = { product: "ĐÚNG SPU", shared: "CHUNG VCB", collected: "SƯU TẦM", web: "TỪ MẠNG" };
const $ = (id) => document.getElementById(id);

function clipCard(job, cand, selectedId) {
  const clip = job.clips[cand.clip_id] || {};
  return `<div class="card${cand.clip_id === selectedId ? " selected" : ""}" data-clip="${cand.clip_id}" title="${esc(clip.description_vi)}">
    <span class="badge">${clip.library === "web" ? "TỪ MẠNG" : cand.manual ? "THỦ CÔNG" : SCOPE_BADGE[cand.scope] || ""}</span>${clip.web?.copyright ? '<span class="badge cr">BẢN QUYỀN</span>' : ""}
    <img class="thumb" src="${media(clip.thumb)}" data-proxy="${media(clip.proxy)}" data-t="${clip.best_moment_s || 0}" alt="">
    <div class="meta"><b>${esc(clip.name || "")}</b><div class="score"><i style="width:${Math.round(Math.min(cand.score, 1) * 100)}%"></i></div>${esc(cand.reason)}</div></div>`;
}

function genCard(gen, selected) {
  const shoot = gen.type === "shoot_request";
  return `<div class="gen-card${shoot ? " shoot" : ""}"><div class="row"><b>${esc(GEN_LABEL[gen.type] || gen.type)}</b>
      <span class="chip ${shoot ? "warn" : "ai"}">${shoot ? ZERO() : "≈ " + money(gen.est_cost_usd)}</span></div>
    <p>${esc(gen.provider)} · ${gen.duration}s</p><p>${esc(gen.prompt)}</p><div class="guard">⚑ ${esc(gen.guardrail)}</div>
    <div class="row" style="margin-top:7px"><span></span><button class="small-btn" data-gen="${gen.gen_id}" ${store.busy ? "disabled" : ""}>
      ${selected ? "✓ Đang dùng" : shoot ? "Dùng khung phiếu quay" : "Dùng phương án AI"}</button></div></div>`;
}

function currentBlock(job, part, shot) {
  const sel = shot.selected;
  if (sel.kind !== "clip") {
    const gen = (part.gen_options || []).find((g) => g.gen_id === sel.gen_id);
    return `<div class="gen-card"><b>${esc(GEN_LABEL[gen?.type] || "Thiếu footage")}</b><p>Trong video hiển thị khung chờ ghi rõ prompt & chi phí; production sẽ gọi API generate.</p></div>`;
  }
  const clip = job.clips[sel.clip_id] || {};
  const end = sel.src_in + shot.duration * sel.speed;
  return `<div class="current"><video src="${media(clip.proxy)}#t=${sel.src_in},${end.toFixed(2)}" poster="${media(clip.thumb)}" preload="auto" muted loop playsinline></video>
    <div class="hint"><b style="color:var(--ink)">${esc(clip.name)}</b><br>Nguồn ${sel.src_in.toFixed(1)}s → ${end.toFixed(1)}s · ${sel.speed}×${sel.zoom ? ` · zoom ${sel.zoom}×` : ""}<br>
      ${clip.library === "web" ? webInfo(clip) : `${esc(clip.folder)} · ${esc(clip.product_set || "footage chung")}<br><i>${esc(clip.description_vi || "")}</i>`}</div></div>`;
}

function webInfo(clip) {
  const w = clip.web || {};
  return `Minh hoạ từ mạng · <b>${esc(w.via || w.source || "")}</b>${w.score != null ? ` · khớp ${w.score}%` : ""}${w.license ? ` · ${esc(w.license)}` : ""}<br>
    ${w.page ? `<a href="${esc(w.page)}" target="_blank" rel="noopener">Mở trang nguồn</a>` : ""}${w.copyright ? ' <span class="ws-cr">Có bản quyền · cân nhắc trước khi chạy ads</span>' : ""}`;
}

function sceneTab(job, part, shot) {
  const selClip = shot.selected.kind === "clip" ? shot.selected.clip_id : null;
  const selGen = shot.selected.kind === "gen" ? shot.selected.gen_id : null;
  const shotTabs = part.shots.length > 1 ? `<div class="chips" style="margin-top:8px">${part.shots.map((s) =>
    `<button class="small-btn ${s.index === shot.index ? "on" : ""}" data-shot-tab="${s.index}">Shot ${s.index + 1}</button>`).join("")}</div>` : "";
  return `<div class="part-head"><h3>${esc(part.role_label)}${part.craft_step ? " · " + esc(part.craft_step.replace(/_/g, " ")) : ""}</h3>
      <span class="chip ${STATUS_CHIP[part.status] || ""}">${STATUS_LABEL[part.status] || part.status}</span></div>
    <div class="hint">${part.part_id.toUpperCase()} · ${fmtTime(part.start)} → ${fmtTime(part.start + part.duration)} (${part.duration.toFixed(1)}s)${part.alt_roles?.length ? ` · "X" thay thế: ${part.alt_roles.join(", ")}` : ""}</div>
    ${part.vo_text ? `<div class="vo">${esc(part.vo_text)}</div>` : ""}${shotTabs}
    <div class="sec-title" style="margin-top:12px">Đang dùng · shot ${shot.index + 1}/${part.shots.length}</div>${currentBlock(job, part, shot)}
    <button type="button" class="small-btn ws-open" data-websearch style="margin-top:10px;width:100%">Tìm hình trên mạng…</button>
    <div class="sec-title" style="margin-top:14px">Phương án footage thay thế (${(part.candidates || []).length}) <span class="hint">rê chuột để xem</span></div>
    <div class="cards">${(part.candidates || []).map((c) => clipCard(job, c, selClip)).join("") || '<p class="hint">Kho chưa có footage phù hợp — xem đề xuất bên dưới hoặc chọn từ tab Footage.</p>'}</div>
    <div class="sec-title" style="margin-top:14px">Đề xuất generate / bổ sung</div>
    ${(part.gen_options || []).map((g) => genCard(g, g.gen_id === selGen)).join("") || '<p class="hint">Không cần — phần này dùng footage thư viện.</p>'}`;
}

function wireScene(el, part, shot) {
  el.querySelectorAll("[data-shot-tab]").forEach((b) => b.addEventListener("click", () => setUi({ sel: { part: part.part_id, shot: Number(b.dataset.shotTab) } })));
  el.querySelectorAll(".card[data-clip]").forEach((card) => {
    card.addEventListener("click", () => !store.busy && actions.choose(part.part_id, shot.index, { kind: "clip", clip_id: card.dataset.clip }));
    const img = card.querySelector("img");
    card.addEventListener("mouseenter", () => {          // hover preview: play the proxy from its best moment
      const v = Object.assign(document.createElement("video"), { src: `${img.dataset.proxy}#t=${img.dataset.t}`, muted: true, autoplay: true, loop: true, playsInline: true, className: "thumb" });
      card.replaceChild(v, card.querySelector(".thumb"));
    });
    card.addEventListener("mouseleave", () => card.replaceChild(img, card.querySelector(".thumb")));
  });
  el.querySelector("[data-websearch]")?.addEventListener("click", () => !store.busy && openWebSearch(store.job, part, shot));
  el.querySelectorAll("[data-gen]").forEach((b) => b.addEventListener("click", () => actions.choose(part.part_id, shot.index, { kind: "gen", gen_id: b.dataset.gen })));
  const cur = el.querySelector(".current video");   // keep the poster until a real frame is decoded (no black box)
  cur?.addEventListener("loadeddata", () => cur.play().catch(() => {}), { once: true });
}

export function initInspector() {
  $("insp-tabs").innerHTML = TABS.map(([id, label]) => `<button class="insp-tab" data-insp="${id}">${label}</button>`).join("");
  $("insp-tabs").querySelectorAll("[data-insp]").forEach((b) => b.addEventListener("click", () => setUi({ inspTab: b.dataset.insp })));
}

let lastKey = "";
function renderVoiceStudio(s) {
  const el = $("inspector");
  if (!el.querySelector("#voice-studio")) {
    el.innerHTML = `<div id="voice-studio"></div><div id="voice-part"></div>`;
    mountVoiceStudio(el.querySelector("#voice-studio"));
  }
  ensureMiniMaxVoices();
  const part = currentPart();
  const partEl = el.querySelector("#voice-part");
  const html = s.job && part?.vo ? renderVoiceTab(s, part) : "";
  if (partEl.dataset.html !== html) {
    partEl.innerHTML = html;
    partEl.dataset.html = html;
    if (html) wireVoiceTab(partEl, part);
  }
}

export function renderInspector(s) {
  document.querySelectorAll(".insp-tab").forEach((b) => b.classList.toggle("active", b.dataset.insp === s.inspTab));
  const el = $("inspector"), part = currentPart(), shot = currentShot();
  if (s.inspTab === "voice") {
    renderVoiceStudio(s);
    lastKey = "voice";
    return;
  }
  if (!s.job || !part || !shot) {
    if (el.querySelector("#voice-studio") || !el.querySelector("p")) {
      el.innerHTML = '<p class="muted pad">Chọn một cảnh trên timeline để chỉnh.</p>';
    }
    lastKey = "";
    return;
  }
  const key = JSON.stringify([s.inspTab, s.sel, s.job.id, s.job.render.revision, s.busy, part.shots.map((x) => x.selected)]);
  if (key === lastKey) return;                // avoid restarting preview videos on unrelated updates
  lastKey = key;
  const tabs = { scene: () => sceneTab(s.job, part, shot), voice: () => renderVoiceTab(s, part), speed: () => renderSpeedTab(s, part, shot) };
  el.innerHTML = tabs[s.inspTab]();
  if (s.inspTab === "scene") wireScene(el, part, shot);
  if (s.inspTab === "voice") wireVoiceTab(el, part);
  if (s.inspTab === "speed") wireSpeedTab(el, part, shot);
}
