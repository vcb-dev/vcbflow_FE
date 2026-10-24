// Kho content: kịch bản (A1–A5 × chủ đề, AI viết hàng loạt, voice), chất liệu thật cho AI kể, chủ đề.
// Layout: list on the left, the selected script's detail on the right (no drawers).
import { api, esc, media, toast } from "./admin-api.js";
import * as DR from "./date-range.js";

const f = { family: "", topic: "", q: "", source: "", dr: DR.load("content", "all") };
const ROLE = { HOOK: "HOOK", HUYK: "HUYK", NOI_DUNG: "NỘI DUNG", CHE_TAC: "KỂ", MONTAGE: "MONTAGE", HOAN_THIEN: "HOÀN THIỆN", CHIA_DOI: "CHIA ĐÔI", OUTRO: "OUTRO" };
const SRC = { ai: "AI viết", manual: "Viết tay", sample: "Mẫu" };
let data = null;
let tab = "scripts";
let openId = null;
let editing = false;            // true = editor in the side panel (new when openId is null)
let storyEdit = null;           // story id, "new" or null
let stFilter = "";              // Content win tab: filter by type
let voicePick = "";
const voicePicks = {};             // language -> chosen MiniMax voice id
let genCount = 5;

const IC = {
  mic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/></svg>',
  film: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>',
  pen: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  play: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z"/></svg>',
};
const famTag = (fam) => `<span class="fam ${esc(fam)}">${esc(fam)}</span>`;

function filtered() {
  const q = f.q.trim().toLowerCase();
  return data.items.filter((c) => c.status !== "archived" && (!f.family || c.family === f.family) && (!f.topic || c.topic === f.topic)
    && (!f.source || c.source === f.source) && DR.inRange(c.created_at, DR.resolve(f.dr)) && (!q || `${c.title} ${c.script} ${c.sku}`.toLowerCase().includes(q)));
}

function header() {
  const n = data.items.filter((c) => c.status !== "archived").length;
  const t = (k, label) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${label}</button>`;
  return `<header class="ph-bar"><h1>Kho content</h1>
    <div class="seg" role="tablist" aria-label="Mục">${t("scripts", `Kịch bản · ${n}`)}${t("stories", `Content win · ${data.stories.length}`)}${t("topics", `Chủ đề · ${data.topics.length}`)}</div>
    <div class="sp"></div>
    ${tab === "scripts" ? `<label class="search" style="width:260px">${IC.search}<span class="sr">Tìm kịch bản</span><input id="c-q" type="search" placeholder="Tìm kịch bản" value="${esc(f.q)}"></label>
      <button class="btn" type="button" id="new-manual">+ Viết tay</button>` : ""}
    ${tab === "stories" ? '<button class="btn" type="button" data-st-new>+ Thêm content win</button>' : ""}
  </header>`;
}

function genbar() {
  const fam = (k) => `<option value="${k}" ${k === "A4" ? "selected" : ""}>${k}</option>`;
  return `<section class="box genbar" aria-label="AI viết hàng loạt">
    <label>Tuyến<select id="g-fam" style="min-width:76px">${Object.keys(data.families).map(fam).join("")}</select></label>
    <label>Chủ đề<select id="g-topic" style="min-width:200px">${data.topics.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
    <label>Content win / chuyện<select id="g-story" style="min-width:160px"><option value="">Tự chọn · ${data.stories.length} mục</option>${data.stories.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join("")}</select></label>
    <label>Sản phẩm<select id="g-sku" style="min-width:130px"><option value="">Không gắn</option>${(data.products || []).map((p) => `<option value="${esc(p.sku)}">${esc(p.sku)}</option>`).join("")}</select></label>
    <div><span class="f">Số bài</span><div class="stepper" role="group" aria-label="Số bài"><button type="button" data-cnt="-1" aria-label="Bớt">−</button><span id="g-count">${genCount}</span><button type="button" data-cnt="1" aria-label="Thêm">+</button></div></div>
    <label style="flex:1;min-width:180px">Ý tưởng thêm<input id="g-brief" type="text" placeholder="tuỳ chọn"></label>
    ${data.ai_available ? "" : '<span class="chip bad">Chưa có khoá AI</span>'}
    <button id="g-run" class="btn pri lg" type="button" ${data.ai_available ? "" : "disabled"}>${IC.pen}Viết ${genCount} bài</button>
  </section>`;
}

function card(c) {
  const voices = Object.keys(c.voices || {});
  const v = c.voices?.[c.language || "vi"];
  return `<button type="button" class="ct-card${openId === c.id ? " sel" : ""}" data-open="${esc(c.id)}">
    <span style="display:flex;align-items:center;gap:8px;width:100%">${famTag(c.family)}<span class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.topic)}</span>
      <span style="flex:1"></span><span class="dot ${c.status === "draft" ? "warn" : "ok"}" title="${c.status === "draft" ? "Nháp" : "Đã duyệt"}"></span></span>
    <span class="ttl">${esc(c.title)}</span>
    <span class="ex">${esc(c.script)}</span>
    <span class="ft"><span>${IC.mic}${v ? `${Math.round(v.duration || 0)}s` : voices.length ? voices.map((l) => l.toUpperCase()).join(" ") : "—"}</span>
      <span>${IC.film}${c.used_in_jobs || 0} video</span><span>${esc(SRC[c.source] || c.source)}</span></span>
  </button>`;
}

function filters() {
  const by = {};
  data.items.forEach((c) => { if (c.status !== "archived") by[c.family] = (by[c.family] || 0) + 1; });
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const pill = (k, label, n) => `<button type="button" class="pill" data-fam="${k}" aria-pressed="${f.family === k}">${label}<span class="n">${n}</span></button>`;
  return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${pill("", "Tất cả", total)}${Object.keys(data.families).map((k) => pill(k, k, by[k] || 0)).join("")}
    <div style="flex:1"></div>
    <select id="c-topic" class="in" style="width:auto;min-height:32px" aria-label="Lọc chủ đề"><option value="">Mọi chủ đề</option>${data.topics.map((t) => `<option ${f.topic === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
    <select id="c-src" class="in" style="width:auto;min-height:32px" aria-label="Lọc nguồn"><option value="">Mọi nguồn</option>${Object.entries(SRC).map(([k, v]) => `<option value="${k}" ${f.source === k ? "selected" : ""}>${v}</option>`).join("")}</select>${DR.html("content", f.dr)}</div>`;
}

function editor(c) {
  const isNew = !c;
  c = c || { title: "", family: "A4", topic: data.topics[0], sku: "", script: "", caption: "" };
  return `<div class="dt-head"><span class="eyebrow">${isNew ? "Kịch bản mới" : "Sửa kịch bản"}</span></div>
    <div class="dt-body">
      <div class="grid2"><div><label class="f" for="e-fam">Tuyến</label><select id="e-fam" class="in">${Object.entries(data.families).map(([k, v]) => `<option value="${k}" ${k === c.family ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
        <div><label class="f" for="e-topic">Chủ đề</label><select id="e-topic" class="in">${data.topics.map((t) => `<option ${t === c.topic ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>
      <div><label class="f" for="e-title">Tiêu đề</label><input id="e-title" class="in" value="${esc(c.title)}"></div>
      <div><label class="f" for="e-sku">Sản phẩm</label><select id="e-sku" class="in"><option value="">Không gắn</option>${(data.products || []).map((p) => `<option value="${esc(p.sku)}" ${p.sku === c.sku ? "selected" : ""}>${esc(p.sku)} · ${esc(p.name)}</option>`).join("")}</select></div>
      <div><label class="f" for="e-script">Lời HuyK · mỗi dòng một nhịp</label><textarea id="e-script" class="in" rows="12">${esc(c.script)}</textarea></div>
      <div><label class="f" for="e-cap">Caption</label><textarea id="e-cap" class="in" rows="3">${esc(c.caption || "")}</textarea></div>
    </div>
    <div class="dt-foot"><div style="display:flex;gap:8px"><button class="btn" type="button" data-cancel style="flex:1">Huỷ</button>
      <button class="btn pri" type="button" data-save="${isNew ? "" : esc(c.id)}" style="flex:2">${isNew ? "Thêm vào kho" : "Lưu"}</button></div></div>`;
}

function detail(c) {
  if (editing) return editor(c);
  if (!c) return '<div class="empty" style="margin:auto">Chọn một kịch bản để xem lời, voice và tạo video.</div>';
  const lines = (c.storyboard || []).length ? c.storyboard.filter((l) => l.vo)
    .map((l) => `<div class="vline"><span class="r">${esc(ROLE[l.role] || l.role)}</span><span>${esc(l.vo)}</span></div>`).join("")
    : (c.lines || c.script.split("\n").filter(Boolean)).map((l, i) => `<div class="vline num"><span class="r">${i + 1}</span><span>${esc(l)}</span></div>`).join("");
  const langs = Object.entries(data.languages);
  const mm = data.minimax?.active ? data.minimax : null;
  // MiniMax: every language row has its own HuyK voice (a Vietnamese voice reading English is not native)
  const vsel = (code) => {
    if (!mm) return "";
    const own = mm.voices.filter((v) => v.lang === code);
    const list = own.length ? own : mm.voices.filter((v) => v.lang === "vi");
    const pick = voicePicks[code] || mm.by_lang[code] || list[0]?.id;
    return `<select class="in" data-vsel="${code}" style="width:150px;min-height:30px;font-size:12.5px" aria-label="Giọng ${esc(code)}" title="${own.length ? "Giọng HuyK cho tiếng này" : "Chưa có giọng HuyK riêng cho tiếng này — dùng giọng Việt"}">
      ${list.map((v) => `<option value="${esc(v.id)}" ${v.id === pick ? "selected" : ""}>${esc(v.label)}${own.length ? "" : " (Việt)"}</option>`).join("")}</select>`;
  };
  const omni = mm ? ""
    : data.omni?.ready ? `<select id="d-omni" class="in" style="width:auto;min-height:32px" aria-label="Giọng mẫu">${(data.omni.voices || []).map((v) => `<option ${v === voicePick ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : "";
  const voiceRows = langs.map(([code, name]) => {
    const v = (c.voices || {})[code];
    if (!v && code !== (c.language || "vi")) return "";
    const tr = code !== (c.language || "vi") ? (c.video_tr?.[code]?.lines || []).filter(Boolean).join(" ") || v?.text || "" : "";
    return `<div class="audio-row" style="flex-wrap:wrap"><strong class="small" style="width:72px">${esc(name)}</strong>
      ${v ? `<audio controls preload="none" src="${esc(media(v.audio))}"></audio><span class="mono small muted">${(v.duration || 0).toFixed(0)}s</span>` : '<span class="muted small" style="flex:1">chưa có voice</span>'}
      ${vsel(code)}
      ${tr ? `<details style="flex-basis:100%"><summary class="small muted">Lời ${esc(name)}</summary><div class="small" style="margin-top:4px">${esc(tr)}</div></details>` : ""}
      <button class="btn sm" type="button" data-voice="${code}" ${data.voice_available ? "" : "disabled"}>${v && !v.uploaded ? "Tạo lại" : "Tạo"}</button>
      <label class="btn sm" style="margin:0">Tải lên<input type="file" accept="audio/*" data-upload="${code}" class="sr"></label></div>`;
  }).join("");
  const otherLangs = langs.filter(([code]) => code !== (c.language || "vi") && !(c.voices || {})[code]);
  return `<div class="dt-head"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${famTag(c.family)}<span class="muted small">${esc(c.topic)}</span>
      ${c.kind ? `<span class="chip">dùng chung · ${esc(c.kind)}</span>` : ""}${c.status === "draft" ? '<span class="chip warn">Nháp</span>' : '<span class="chip ok">Đã duyệt</span>'}</span>
    <h2>${esc(c.title)}</h2></div>
    <div class="dt-body">
      <div>${lines}</div>
      ${c.hooks?.length ? `<details><summary class="small muted">Phương án hook (${c.hooks.length})</summary><ol class="small" style="margin:6px 0 0;padding-left:18px">${c.hooks.map((h) => `<li>${esc(h)}</li>`).join("")}</ol></details>` : ""}
      ${c.caption ? `<details><summary class="small muted">Caption</summary><div class="small" style="white-space:pre-line;margin-top:6px">${esc(c.caption)}</div></details>` : ""}
    </div>
    <div class="dt-foot">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="eyebrow">Voice theo ngôn ngữ</span>${omni}</div>
      ${voiceRows}
      ${otherLangs.length ? `<details><summary class="small muted">Thêm ngôn ngữ</summary><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${otherLangs.map(([code, name]) => `<button class="btn sm" type="button" data-voice="${code}" ${data.voice_available ? "" : "disabled"} title="AI dịch kịch bản rồi HuyK đọc bằng giọng tiếng này">${esc(name)}${mm && !mm.voices.some((v) => v.lang === code) ? ' <span class="muted">· giọng Việt</span>' : ""}</button>`).join("")}</div></details>` : ""}
      <div style="display:flex;gap:8px;align-items:center">
        <select id="d-lang" class="in" style="width:auto" aria-label="Ngôn ngữ video" title="Ngôn ngữ của video (lời + phụ đề)">${langs.map(([code]) =>
          `<option value="${code}" ${code === (c.language || "vi") ? "selected" : ""}>${code.toUpperCase()}</option>`).join("")}</select>
        <select id="d-sku" class="in" style="flex:1;min-width:0" aria-label="Sản phẩm">${(data.products || []).map((p) => `<option value="${esc(p.sku)}" ${p.sku === c.sku ? "selected" : ""}>${esc(p.sku)} · ${esc(p.name)}</option>`).join("")}<option value="">Không gắn sản phẩm</option></select>
        <button class="btn" type="button" data-job="${esc(c.id)}">Tạo video</button></div>
      <div style="display:flex;gap:8px">
        ${c.status === "draft" ? `<button class="btn" type="button" data-approve="${esc(c.id)}" style="flex:1">Duyệt</button>` : ""}
        <button class="btn icon" type="button" data-edit="${esc(c.id)}" aria-label="Sửa">${IC.pen}</button>
        <button class="btn icon danger" type="button" data-delete="${esc(c.id)}" aria-label="Xoá">${IC.trash}</button>
        <a class="btn pri" href="/?content=${encodeURIComponent(c.id)}" style="flex:2">${IC.play}Mở trong Studio</a></div>
    </div>`;
}

function scriptsView() {
  const list = filtered();
  return `<div class="split">
    <section class="list">${genbar()}${filters()}
      <div class="ct-grid">${list.length ? list.map(card).join("") : '<div class="empty">Chưa có kịch bản phù hợp.</div>'}</div></section>
    <aside class="side-r" aria-label="Chi tiết kịch bản" id="detail">${detail(openId ? data.items.find((c) => c.id === openId) : null)}</aside></div>`;
}

function storiesView() {
  const WIN = data.storyWin || "content_win";
  const ed = storyEdit && (storyEdit === "new" ? { type: stFilter || WIN, title: "", facts: "", link: "", views: "", why: "" } : data.stories.find((s) => s.id === storyEdit));
  const counts = {};
  data.stories.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1; });
  const list = data.stories.filter((s) => !stFilter || s.type === stFilter);
  const isWin = ed && ed.type === WIN;
  const custom = (k) => k.startsWith("t_");
  return `<div class="split">
    <section class="list"><p class="muted" style="margin:0">Content win = video đã chạy tốt, AI học cách mở, nhịp, góc kể (không chép). Các loại còn lại là chuyện thật / kiến thức đã xác nhận — AI chỉ kể lại từ đây, không bịa thêm.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="pill" data-st-filter="" aria-pressed="${!stFilter}">Tất cả<span class="n">${data.stories.length}</span></button>
        ${Object.entries(data.storyTypes).filter(([k]) => counts[k] || k === WIN).map(([k, v]) => `<button type="button" class="pill" data-st-filter="${esc(k)}" aria-pressed="${stFilter === k}">${esc(v.split(" · ")[0])}<span class="n">${counts[k] || 0}</span></button>`).join("")}</div>
      ${list.length ? `<div class="ct-grid">${list.map((s) => `<button type="button" class="ct-card${storyEdit === s.id ? " sel" : ""}" data-st-edit="${esc(s.id)}">
        <span style="display:flex;gap:6px;align-items:center"><span class="chip ${s.type === WIN ? "ok" : ""}">${esc((data.storyTypes[s.type] || s.type).split(" · ")[0])}</span>${s.views ? `<span class="small muted">${esc(s.views)}</span>` : ""}</span><span class="ttl">${esc(s.title)}</span>
        <span class="ex" style="-webkit-line-clamp:4">${esc(s.facts)}</span></button>`).join("")}</div>`
        : `<div class="empty">${stFilter === WIN ? "Chưa có content win. Bấm \"+ Thêm content win\" và dán kịch bản / lời của video đã chạy tốt." : "Chưa có mục nào."}</div>`}</section>
    <aside class="side-r" aria-label="Sửa content win / chất liệu">${ed ? `<div class="dt-head"><span class="eyebrow">${storyEdit === "new" ? "Thêm mới" : "Sửa"}</span></div>
      <div class="dt-body">
        <div><label class="f" for="st-type">Loại</label>
          <div style="display:flex;gap:6px"><select id="st-type" class="in" style="flex:1">${Object.entries(data.storyTypes).map(([k, v]) => `<option value="${esc(k)}" ${k === ed.type ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
            <button class="btn" type="button" id="tp-show" title="Thêm loại mới">+ Loại</button>
            ${custom(ed.type) ? `<button class="btn icon danger" type="button" data-tp-del="${esc(ed.type)}" title="Xoá loại tự thêm" aria-label="Xoá loại">${IC.trash}</button>` : ""}</div>
          <div id="tp-new" hidden style="display:flex;gap:6px;margin-top:6px"><input id="tp-label" class="in" placeholder="Tên loại mới, vd: Chuyện cầu hôn" style="flex:1"><button class="btn ink" type="button" id="tp-add">Thêm</button></div></div>
        <div><label class="f" for="st-title">Tên ngắn</label><input id="st-title" class="in" value="${esc(ed.title)}" placeholder="${isWin ? "vd: Nhẫn người bà muốn trả lại · 1,2M view" : "vd: Anh khách đặt nhẫn kỷ niệm giấu vợ"}"></div>
        <div class="win-only" ${isWin ? "" : "hidden"} style="display:grid;grid-template-columns:1fr 140px;gap:8px">
          <div><label class="f" for="st-link">Link video</label><input id="st-link" class="in" value="${esc(ed.link || "")}" placeholder="https://www.tiktok.com/…"></div>
          <div><label class="f" for="st-views">Lượt xem</label><input id="st-views" class="in" value="${esc(ed.views || "")}" placeholder="1,2M view"></div></div>
        <div class="win-only" ${isWin ? "" : "hidden"}><label class="f" for="st-why">Vì sao win · hook, góc kể, cảm xúc</label><input id="st-why" class="in" value="${esc(ed.why || "")}" placeholder="vd: mở bằng câu khách nói, có nút thắt bà muốn trả lại"></div>
        <div><label class="f" for="st-facts" id="st-facts-l">${isWin ? "Kịch bản / lời của video" : "Chuyện thật · ai, chuyện gì, nút thắt, câu nói đáng nhớ, kết quả"}</label><textarea id="st-facts" class="in" rows="12">${esc(ed.facts)}</textarea></div></div>
      <div class="dt-foot"><div style="display:flex;gap:8px">${storyEdit !== "new" ? `<button class="btn icon danger" type="button" data-st-del="${esc(storyEdit)}" aria-label="Xoá">${IC.trash}</button>` : ""}
        <button class="btn" type="button" data-st-cancel style="flex:1">Huỷ</button><button class="btn pri" type="button" data-st-save="${storyEdit === "new" ? "" : esc(storyEdit)}" style="flex:2">Lưu</button></div></div>`
      : '<div class="empty" style="margin:auto">Chọn một mục để sửa, hoặc thêm content win / chuyện thật mới.</div>'}</aside></div>`;
}

function topicsView() {
  const count = (t) => data.items.filter((c) => c.topic === t && c.status !== "archived").length;
  return `<div class="page"><section class="box" style="max-width:720px">
    ${data.topics.map((t) => `<div class="krow" style="padding:12px 16px"><span style="flex:1;font-weight:500">${esc(t)}</span><span class="muted small">${count(t)} kịch bản</span>
      <button class="btn sm danger" type="button" data-tdel="${esc(t)}">Xoá</button></div>`).join("")}
    <div style="display:flex;gap:8px;padding:14px 16px"><input id="c-newtopic" class="in" placeholder="Tên chủ đề mới"><button class="btn pri" id="c-addtopic" type="button">Thêm</button></div>
  </section></div>`;
}

const fileB64 = (file) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(file); });

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  DR.wire(el, (_, r) => { f.dr = r; paint(); });
  const load = async () => {
    const [c, a, st] = await Promise.all([api.content(), api.automation(), api.stories()]);
    data = c; data.products = a.products; data.stories = st.items; data.storyTypes = st.types; data.storyWin = st.win;
  };
  await load();
  const paint = () => {
    el.innerHTML = header() + (tab === "scripts" ? scriptsView() : tab === "stories" ? storiesView() : topicsView());
  };
  paint();
  const reload = async () => { await load(); paint(); ctx.refreshBadges(); };
  const paintDetail = () => { const d = el.querySelector("#detail"); if (d) d.innerHTML = detail(openId ? data.items.find((c) => c.id === openId) : null); };
  const confirmDelete = (btn) => {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1"; btn.title = "Bấm lần nữa để xoá"; btn.classList.add("pri");
    toast("Bấm lần nữa để xoá");
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove("pri"); } }, 4000);
    return false;
  };

  el.addEventListener("input", (e) => {
    if (e.target.id === "c-q") {
      f.q = e.target.value; const pos = e.target.selectionStart; paint();
      const q = el.querySelector("#c-q"); q.focus(); q.setSelectionRange(pos, pos);
    }
  });
  el.addEventListener("change", async (e) => {
    if (e.target.id === "st-type") {                 // content win shows link / views / why fields
      const win = e.target.value === (data.storyWin || "content_win");
      el.querySelectorAll(".win-only").forEach((x) => { x.hidden = !win; });
      el.querySelector("#st-facts-l").textContent = win ? "Kịch bản / lời của video" : "Chuyện thật · ai, chuyện gì, nút thắt, câu nói đáng nhớ, kết quả";
    }
    if (e.target.id === "c-topic") { f.topic = e.target.value; paint(); }
    if (e.target.id === "c-src") { f.source = e.target.value; paint(); }
    if (e.target.id === "d-omni") voicePick = e.target.value;
    if (e.target.dataset?.vsel) voicePicks[e.target.dataset.vsel] = e.target.value;
    const up = e.target.dataset?.upload;
    if (up && e.target.files?.[0]) {
      const file = e.target.files[0];
      try { toast("Đang tải voice lên…"); await api.contentVoiceUpload(openId, { lang: up, filename: file.name, data: await fileB64(file) }); await reload(); toast("Đã lưu voice"); }
      catch (err) { toast(err.message, true); }
    }
  });
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-close]");
    if (!t) return;
    try {
      if (t.dataset.tab) { tab = t.dataset.tab; storyEdit = null; paint(); return; }
      if (t.dataset.fam !== undefined && t.classList.contains("pill")) { f.family = t.dataset.fam; paint(); return; }
      if (t.dataset.cnt) { genCount = Math.max(1, Math.min(10, genCount + Number(t.dataset.cnt))); el.querySelector("#g-count").textContent = genCount; el.querySelector("#g-run").innerHTML = `${IC.pen}Viết ${genCount} bài`; return; }
      if (t.dataset.open) { openId = t.dataset.open; editing = false; el.querySelectorAll(".ct-card").forEach((x) => x.classList.toggle("sel", x.dataset.open === openId)); paintDetail(); return; }
      if (t.id === "new-manual") { openId = null; editing = true; paintDetail(); return; }
      if (t.hasAttribute("data-cancel")) { editing = false; paintDetail(); return; }
      if (t.dataset.edit) { editing = true; paintDetail(); return; }
      if (t.dataset.save !== undefined) {
        const body = { title: el.querySelector("#e-title").value, family: el.querySelector("#e-fam").value, topic: el.querySelector("#e-topic").value,
          sku: el.querySelector("#e-sku").value, script: el.querySelector("#e-script").value, caption: el.querySelector("#e-cap").value };
        const saved = t.dataset.save ? await api.contentUpdate(t.dataset.save, body) : await api.contentCreate(body);
        openId = saved.id; editing = false; await reload(); toast("Đã lưu kịch bản"); return;
      }
      if (t.dataset.delete) { if (!confirmDelete(t)) return; await api.contentDelete(t.dataset.delete); openId = null; await reload(); toast("Đã xoá"); return; }
      if (t.dataset.approve) { await api.contentUpdate(t.dataset.approve, { status: "approved" }); await reload(); toast("Đã duyệt kịch bản"); return; }
      if (t.dataset.voice) {
        t.disabled = true; t.textContent = "Đang tạo…";
        const code = t.dataset.voice;
        voicePick = el.querySelector("#d-omni")?.value || voicePick;
        const chosen = el.querySelector(`[data-vsel="${code}"]`)?.value || voicePicks[code] || (data.minimax?.active ? "" : voicePick);
        await api.contentVoice(openId, code, chosen); await reload(); toast("Đã tạo voice"); return;
      }
      if (t.dataset.job) {
        const sku = el.querySelector("#d-sku").value;
        t.disabled = true; t.textContent = "Đang dựng…";
        const job = await api.createJob({ content_id: t.dataset.job, sku, lang: el.querySelector("#d-lang")?.value || "vi", template_id: "auto", planner: ctx.boot.claude_available ? "claude" : "rules", render: true, preview: true });
        toast("Đã tạo video · đang dựng"); location.hash = `#/review/${job.id}`; return;
      }
      if (t.id === "c-addtopic") { const n = el.querySelector("#c-newtopic").value; await api.topicAdd(n); await reload(); toast("Đã thêm chủ đề"); return; }
      if (t.dataset.tdel) { if (!confirmDelete(t)) return; await api.topicDelete(t.dataset.tdel); await reload(); toast("Đã xoá chủ đề"); return; }
      if (t.hasAttribute("data-st-new")) { storyEdit = "new"; paint(); return; }
      if (t.dataset.stEdit) { storyEdit = t.dataset.stEdit; paint(); return; }
      if (t.hasAttribute("data-st-cancel")) { storyEdit = null; paint(); return; }
      if (t.dataset.stSave !== undefined) {
        const v = (id) => el.querySelector(id)?.value || "";
        const body = { type: v("#st-type"), title: v("#st-title"), facts: v("#st-facts"), link: v("#st-link"), views: v("#st-views"), why: v("#st-why") };
        await api.storySave(t.dataset.stSave, body); storyEdit = null; await reload(); toast("Đã lưu"); return;
      }
      if (t.dataset.stFilter !== undefined) { stFilter = t.dataset.stFilter; paint(); return; }
      if (t.id === "tp-show") { const box = el.querySelector("#tp-new"); box.hidden = !box.hidden; if (!box.hidden) el.querySelector("#tp-label").focus(); return; }
      if (t.id === "tp-add") {
        const label = el.querySelector("#tp-label").value.trim();
        const before = new Set(Object.keys(data.storyTypes));
        const r = await api.storyTypeAdd(label);
        data.storyTypes = r.types;
        const added = Object.keys(r.types).find((k) => !before.has(k));
        const sel = el.querySelector("#st-type");
        sel.innerHTML = Object.entries(r.types).map(([k, val]) => `<option value="${esc(k)}" ${k === added ? "selected" : ""}>${esc(val)}</option>`).join("");
        el.querySelector("#tp-new").hidden = true; el.querySelector("#tp-label").value = "";
        toast(`Đã thêm loại "${label}"`); return;
      }
      if (t.dataset.tpDel) { const r = await api.storyTypeDelete(t.dataset.tpDel); data.storyTypes = r.types; toast("Đã xoá loại"); paint(); return;
      }
      if (t.dataset.stDel) { if (!confirmDelete(t)) return; await api.storyDelete(t.dataset.stDel); storyEdit = null; await reload(); toast("Đã xoá"); return; }
      if (t.id === "g-run") {
        const body = { family: el.querySelector("#g-fam").value, topic: el.querySelector("#g-topic").value, sku: el.querySelector("#g-sku").value,
          brief: el.querySelector("#g-brief").value, count: genCount, story_id: el.querySelector("#g-story").value };
        t.disabled = true; t.textContent = `Đang viết ${body.count} bài…`;
        const t0 = Date.now();
        const out = await api.contentGenerate(body);
        openId = out.items[0]?.id || null; editing = false; f.family = ""; await reload();
        toast(`Đã viết ${out.items.length} bài · ${Math.round((Date.now() - t0) / 1000)} giây${out.errors?.length ? ` · ${out.errors.length} bài lỗi` : ""}`, !!out.errors?.length); return;
      }
    } catch (err) {
      toast(err.message, true);
      paint();
    }
  });
  const onKey = (e) => { if (!el.getClientRects().length) return; /* screen kept alive but hidden */ if (e.key === "Escape" && editing) { editing = false; paintDetail(); } };
  document.addEventListener("keydown", onKey);
  ctx.setShow?.(() => { if (!editing) reload(); });
  ctx.setCleanup(() => document.removeEventListener("keydown", onKey));
}
