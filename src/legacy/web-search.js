// "Tìm hình trên mạng": pictures / video cuts from news, YouTube, web image search, Wikimedia, Openverse, Pixabay,
// Pexels for one shot of an A1/A2 video. The AI writes the keywords from the line and scores each result by looking
// at it; the chosen one is downloaded, made 9:16 and placed on the shot.
import { api } from "./api-client.js";
import { actions, store, toast } from "./editor-store.js";
import { esc, fmtTime, media } from "./format-helpers.js";

const TABS = [["all", "Tất cả"], ["news", "Báo"], ["youtube", "YouTube"], ["images", "Ảnh web"], ["link", "Từ link"], ["wikimedia", "Wikimedia"],
  ["openverse", "Openverse"], ["pixabay", "Pixabay"], ["pexels", "Pexels"], ["kho", "Kho đã tải"]];
let S = null;          // dialog state

const kwText = (kw) => [...(kw?.vi || []), ...(kw?.en || [])].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ");

export function openWebSearch(job, part, shot) {
  S = { job, part, shot, items: (part.web?.alts || []).slice(), kw: part.web?.kw || null, tab: "all", sel: 0, busy: "", err: "", start: "" };
  let el = document.getElementById("ws-dlg");
  if (!el) {
    el = document.createElement("div");
    el.id = "ws-dlg";
    el.className = "ws";
    document.body.append(el);
    el.addEventListener("click", onClick);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Enter" && e.target.id === "ws-q") search();
      if (e.key === "Enter" && e.target.id === "ws-link") fromLink();
    });
  }
  el.classList.remove("hidden");
  paint();
  if (!S.items.length) search();
}

function close() { document.getElementById("ws-dlg")?.classList.add("hidden"); S = null; }

function kho() {
  return (store.boot.library || []).filter((c) => c.library === "web").slice(0, 60).map((c) => ({
    clip_id: c.id, kind: c.upload_kind || "image", thumb: media(c.thumb), title: c.name, via: c.web?.via || "Kho minh hoạ", page: c.web?.page,
    copyright: c.web?.copyright, score: c.web?.score, source: "kho", local: true }));
}

function list() {
  const all = S.tab === "kho" ? kho() : S.items;
  return S.tab === "all" || S.tab === "kho" ? all : all.filter((x) => x.source === S.tab);
}

function paint() {
  const el = document.getElementById("ws-dlg");
  if (!el || !S) return;
  const { part, shot } = S;
  const items = list();
  const cur = items[S.sel] || null;
  const count = (k) => (k === "all" ? S.items.length : k === "kho" ? kho().length : S.items.filter((x) => x.source === k).length);
  el.innerHTML = `<div class="ws-scrim" data-wsclose></div>
  <section class="ws-dlg" role="dialog" aria-label="Tìm hình trên mạng">
    <header class="ws-head"><div class="ws-ht"><small>${esc(part.role_label || part.role)} · shot ${shot.index + 1} · ${fmtTime(part.start)} · ${(shot.duration || part.duration || 0).toFixed(1)}s</small>
      <h2>${part.vo_text ? `“${esc(part.vo_text.trim().replace(/^["“”']+|["“”']+$/g, ""))}”` : "Tìm hình minh hoạ"}</h2></div><button type="button" class="ws-x" data-wsclose aria-label="Đóng">✕</button></header>
    <div class="ws-bar">
      <label class="ws-row"><span>Từ khoá AI</span><input id="ws-q" class="ws-in" value="${esc(kwText(S.kw))}" placeholder="AI tự viết từ khoá từ câu thoại"><button type="button" class="export-btn" data-wssearch ${S.busy ? "disabled" : ""}>Tìm lại</button></label>
      <label class="ws-row"><span>Hoặc dán link</span><input id="ws-link" class="ws-in" placeholder="Link bài báo, YouTube, TikTok, Facebook… AI lấy hình / cắt đoạn"><button type="button" class="xp-cancel" data-wslink ${S.busy ? "disabled" : ""}>Lấy hình</button></label>
      <div class="ws-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" class="ws-tab${S.tab === k ? " on" : ""}" data-wstab="${k}">${l} <i>${count(k)}</i></button>`).join("")}</div>
    </div>
    <div class="ws-body">${S.busy ? `<div class="ws-busy"><span class="vbot"></span><b>${esc(S.busy)}</b><small>AI đang tìm trên báo, YouTube, Google… rồi xem từng hình để chấm độ khớp</small></div>`
      : S.err ? `<div class="ws-busy"><b class="bad">${esc(S.err)}</b></div>`
      : items.length ? `<div class="ws-grid">${items.map((x, i) => card(x, i)).join("")}</div>` : '<div class="ws-busy"><b>Chưa có hình</b><small>Sửa từ khoá rồi bấm Tìm lại, hoặc dán link.</small></div>'}</div>
    <footer class="ws-foot">${cur ? `<div class="ws-cur"><b>${esc(cur.title || cur.via)}</b><small>${esc(cur.via || "")}${cur.license ? " · " + esc(cur.license) : ""}${cur.page ? ` · <a href="${esc(cur.page)}" target="_blank" rel="noopener">mở trang nguồn</a>` : ""}</small>${cur.why ? `<small class="ws-why">${esc(cur.why)}</small>` : ""}</div>
      ${cur.kind === "video" && !cur.local ? `<label class="ws-start">Bắt đầu từ giây<input id="ws-start" class="ws-in" inputmode="decimal" placeholder="tự chọn" value="${esc(S.start)}"></label>` : ""}` : '<div class="ws-cur"></div>'}
      <button type="button" class="xp-cancel" data-wsgen ${S.busy ? "disabled" : ""} title="Gemini vẽ một ảnh minh hoạ đúng câu thoại này">Tạo ảnh bằng AI</button>
      <button type="button" class="xp-cancel" data-wsclose>Huỷ</button>
      <button type="button" class="export-btn" data-wsuse ${cur && !S.busy ? "" : "disabled"}>Dùng hình này</button></footer>
  </section>`;
}

function card(x, i) {
  return `<button type="button" class="ws-card${i === S.sel ? " on" : ""}" data-wspick="${i}" title="${esc(x.why || x.title || "")}">
    <span class="ws-th"><img src="${esc(x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">
      <span class="ws-tags"><em>${x.kind === "video" ? "Video" + (x.dur ? " " + Math.round(x.dur) + "s" : "") : "Ảnh"}</em>${x.watermark ? "<em class=\"w\">Có logo</em>" : ""}</span></span>
    <span class="ws-meta"><span class="ws-m1"><b>${esc((x.via || "").split(" · ").slice(-1)[0] || x.source)}</b>${x.score != null ? `<span class="ws-sc">${x.score}%</span>` : ""}</span>
      <small>${esc(x.title || "")}</small>${x.copyright ? '<span class="ws-cr">Có bản quyền</span>' : ""}</span></button>`;
}

async function search() {
  if (!S) return;
  const q = document.getElementById("ws-q")?.value.trim() || "";
  const typed = q && q !== kwText(S.kw);
  S.busy = "Đang tìm hình trên mạng"; S.err = ""; paint();
  try {
    const r = await callJson("/api/web-media/search", { text: S.part.vo_text || "", query: typed ? q : "", title: S.job.content?.title || "", video: S.part.role === "hook" });
    if (!S) return;
    S.kw = r.kw; S.items = r.items; S.sel = 0; S.tab = "all";
  } catch (err) { if (S) S.err = err.message; }
  if (S) { S.busy = ""; paint(); }
}

async function fromLink() {
  const url = document.getElementById("ws-link")?.value.trim();
  if (!S || !url) return;
  S.busy = "Đang lấy hình từ link"; S.err = ""; paint();
  try {
    const r = await callJson("/api/web-media/link", { url });
    if (!S) return;
    S.items = [...r.items, ...S.items.filter((x) => x.source !== "link")];
    S.tab = "link"; S.sel = 0;
    if (!r.items.length) S.err = "Không thấy hình nào trong link này";
  } catch (err) { if (S) S.err = err.message; }
  if (S) { S.busy = ""; paint(); }
}

/** Gemini draws one picture for this line; it goes on the shot straight away. */
async function genAi() {
  const { part, shot } = S;
  S.busy = "AI đang vẽ ảnh minh hoạ cho câu này"; S.err = ""; paint();
  try {
    const q = document.getElementById("ws-q")?.value.trim() || "";
    const r = await callJson("/api/web-media/generate", { line: part.vo_text || "", see: q && q !== kwText(S.kw) ? q : (S.kw?.see || ""), title: S.job.content?.title || "" });
    if (!store.boot.library.some((c) => c.id === r.clip.id)) store.boot.library.unshift(r.clip);
    close();
    actions.choose(part.part_id, shot.index, { kind: "clip", clip_id: r.clip.id, manual: true });
  } catch (err) { if (S) { S.busy = ""; S.err = err.message; paint(); } }
}

async function use() {
  const x = list()[S.sel];
  if (!x) return;
  const { part, shot } = S;
  let clipId = x.clip_id;
  if (!x.local) {
    const st = document.getElementById("ws-start")?.value.trim();
    S.start = st || "";
    S.busy = x.kind === "video" ? "Đang tải và cắt đoạn video" : "Đang tải hình"; paint();
    try {
      const r = await callJson("/api/web-media/fetch", { cand: x, line: part.vo_text || "", start: st ? Number(st.replace(",", ".")) : null });
      clipId = r.clip.id;
      if (!store.boot.library.some((c) => c.id === clipId)) store.boot.library.unshift(r.clip);
    } catch (err) {
      if (S) { S.busy = ""; S.err = ""; paint(); }
      toast(err.message);
      return;
    }
  }
  close();
  actions.choose(part.part_id, shot.index, { kind: "clip", clip_id: clipId, manual: true });
}

function onClick(e) {
  const t = e.target.closest("[data-wsclose], [data-wssearch], [data-wslink], [data-wstab], [data-wspick], [data-wsuse], [data-wsgen]");
  if (!t || !S) return;
  if (t.hasAttribute("data-wsclose")) return close();
  if (t.hasAttribute("data-wssearch")) return search();
  if (t.hasAttribute("data-wslink")) return fromLink();
  if (t.dataset.wstab) { S.tab = t.dataset.wstab; S.sel = 0; return paint(); }
  if (t.dataset.wspick) { S.sel = Number(t.dataset.wspick); S.start = document.getElementById("ws-start")?.value || ""; return paint(); }
  if (t.hasAttribute("data-wsuse")) return use();
  if (t.hasAttribute("data-wsgen")) return genAi();
}

async function callJson(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let d = res.statusText;
    try { d = (await res.json()).detail || d; } catch { /* */ }
    throw new Error(typeof d === "string" ? d : JSON.stringify(d));
  }
  return res.json();
}
