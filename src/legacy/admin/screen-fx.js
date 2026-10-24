// FX: Template dựng · Nhạc nền (nghe thử) · Chữ & hiệu ứng (phụ đề, chuyển cảnh, màu, mặc định, quy tắc).
import { api, esc, toast } from "./admin-api.js";

const ROLE_VI = { hook: "Hook", product_hero: "Sản phẩm", product_final: "Hoàn thiện", huyk_talk: "HuyK nói", craft: "Chế tác",
  content_illustration: "Minh họa", outro: "Outro", huyk_silent: "HuyK im", hook_visual: "Hook hình", stock: "Stock" };
const RULES = [
  ["Logo", "Chỉ ở outro · không gắn logo lên cảnh chế tác"], ["Bộ footage", "Sản phẩm chỉ lấy đúng mã · không dùng chéo"],
  ["Outro VN", "Tự ghép outro HuyK (voice tiếng Việt) cuối mỗi video"], ["Thứ tự công đoạn", "Không đảo công đoạn trong một video"],
  ["Âm lượng", "−14 LUFS · nhạc tự hạ khi có giọng"],
];
let tab = "tpl";

// ---- Template: a sequence of blocks (drag to order), shown as a coloured bar on each card ----
const BLK = {
  hook: ["Hook", "#D4AF5A"], product_hero: ["Ảnh sản phẩm", "#E3C98A"], huyk_talk: ["HuyK nói", "#B0643A"],
  craft: ["Chế tác", "#3F6E9E"], content_illustration: ["Minh hoạ", "#6A8FB8"], product_final: ["Hoàn thiện", "#3E9E6A"],
  outro: ["Outro", "#5C5C62"],
};
const FAM_LINES = { A4: ["A4"], A1_A3: ["A1", "A2", "A3"] };
let draft = null;         // the template being edited: {id, label, family, lines, description, alt_roles, sequence}
let dragFrom = -1;

const blkName = (b, steps) => (b.role === "craft" && b.step ? `${BLK.craft[0]} · ${(steps.find((x) => x.key === b.step) || {}).label || b.step}` : (BLK[b.role] || [b.role])[0]);
const total = (seq) => Math.round(seq.reduce((n, b) => n + (Number(b.sec) || 0), 0));
const linesOf = (t) => (t.lines && t.lines.length ? t.lines : FAM_LINES[t.family] || []);

function bar(seq) {
  if (!seq?.length) return '<div class="tbar auto"><span>Tự động theo kịch bản</span></div>';
  return `<div class="tbar">${seq.map((b) => `<i style="flex:${Math.max(Number(b.sec) || 1, 1)};background:${(BLK[b.role] || BLK.outro)[1]}" title="${esc((BLK[b.role] || [b.role])[0])} · ${b.sec}s"></i>`).join("")}</div>`;
}

function defaultSeq(family) {
  return family === "A4"
    ? [{ role: "hook", sec: 3 }, { role: "huyk_talk", sec: 4 }, { role: "craft", sec: 5, loop: true }, { role: "huyk_talk", sec: 4, loop: true }, { role: "product_final", sec: 4, silent: true }, { role: "outro", sec: 4 }]
    : [{ role: "hook", sec: 3 }, { role: "huyk_talk", sec: 5, loop: true }, { role: "content_illustration", sec: 5, loop: true }, { role: "huyk_talk", sec: 5 }, { role: "outro", sec: 4 }];
}

function startEdit(info, id) {
  const t = id === "" ? { id: "", label: "", family: "A4", lines: ["A4"], description: "", alt_roles: {}, sequence: defaultSeq("A4") }
    : info.templates.find((x) => x.id === id);
  draft = t ? JSON.parse(JSON.stringify({ ...t, lines: linesOf(t), sequence: t.sequence || [] })) : null;
}

function rowHtml(b, i, steps) {
  const c = (BLK[b.role] || BLK.outro)[1];
  return `<div class="tblk" draggable="true" data-bi="${i}">
    <span class="tgrip" aria-hidden="true">⠿</span><span class="tdot" style="background:${c}"></span>
    <div class="tblk-main"><div class="tblk-top">
      <select class="tsel" data-bf="role" aria-label="Loại khối">${Object.entries(BLK).map(([k, [l]]) => `<option value="${k}" ${b.role === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      ${b.role === "craft" ? `<select class="tsel" data-bf="step" aria-label="Công đoạn"><option value="">Công đoạn tự chọn</option>${steps.map((x) => `<option value="${x.key}" ${b.step === x.key ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select>` : ""}
      <span class="tsp"></span><input class="tsec mono" data-bf="sec" type="number" min="1" max="30" step="0.5" value="${esc(b.sec)}" aria-label="Giây"><span class="small muted">s</span></div>
      ${b.role === "outro" ? "" : `<div class="tblk-flags"><label><input type="checkbox" data-bf="silent" ${b.silent ? "checked" : ""}> không lời</label>
        <label><input type="checkbox" data-bf="loop" ${b.loop ? "checked" : ""}> lặp đến hết</label></div>`}</div>
    <button class="tx" type="button" data-bdel="${i}" aria-label="Bỏ khối">✕</button></div>`;
}

function tplView(info) {
  const steps = info.steps || [];
  const cards = info.templates.map((x) => `<button type="button" class="tplcard${draft && draft.id === x.id ? " sel" : ""}" data-tsel="${esc(x.id)}">
      <span class="tc-h"><strong>${esc(x.label)}</strong><span class="mono small muted">${x.sequence?.length ? `~${total(x.sequence)}s` : "tự động"}</span></span>
      ${bar(x.sequence)}
      <span class="tc-tags">${linesOf(x).map((l) => `<span class="tline">${esc(l)}</span>`).join("")}</span></button>`).join("");
  const d = draft;
  const side = d ? `<div class="dt-head tpl-hd"><input class="tname" id="t-label" value="${esc(d.label)}" placeholder="Tên template" aria-label="Tên template"></div>
    <div class="dt-body tpl-body">
      <div class="tmeta"><select id="t-fam" class="in" aria-label="Kiểu dựng">${Object.entries(info.families).map(([k, v]) => `<option value="${k}" ${d.family === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
        <span class="tlines">${(info.lines || ["A1", "A2", "A3", "A4", "A5"]).map((l) => `<button type="button" class="tline${d.lines.includes(l) ? " on" : ""}" data-tline="${l}">${l}</button>`).join("")}</span></div>
      ${d.sequence.length ? `${bar(d.sequence)}<div class="small muted">~${total(d.sequence)} giây · kéo ⠿ để đổi thứ tự · khối "lặp đến hết" lặp lại theo thứ tự cho tới khi hết lời đọc</div>
        <div class="tblks" id="tblks">${d.sequence.map((b, i) => rowHtml(b, i, steps)).join("")}</div>`
      : `<div class="empty" style="padding:18px">Template này để AI tự xếp cảnh theo kịch bản.<br><br><button class="btn sm" type="button" data-tseq>Tự xếp trình tự cảnh</button></div>`}
      ${d.sequence.length ? `<div class="tadd"><span class="small muted">Thêm khối</span>${Object.entries(BLK).map(([k, [l, c]]) => `<button type="button" class="tadd-b" data-badd="${k}"><span class="tdot" style="background:${c}"></span>${l}</button>`).join("")}</div>` : ""}
      <details class="tadv"><summary class="small muted">Mô tả · nguồn thay thế</summary>
        <label class="f" for="t-desc">Mô tả</label><input id="t-desc" class="in" value="${esc(d.description || "")}">
        <label class="f" for="t-alt">Nguồn thay thế · mỗi dòng "vai trò: vai trò thay"</label><textarea id="t-alt" class="in mono" rows="3" placeholder="huyk_talk: craft">${esc(Object.entries(d.alt_roles || {}).map(([r, a]) => `${r}: ${a.join(", ")}`).join("\n"))}</textarea></details></div>
    <div class="dt-foot"><div style="display:flex;gap:8px">${d.id ? `<button class="btn danger" type="button" data-tdel="${esc(d.id)}" style="flex:1">Xoá</button>` : `<button class="btn" type="button" data-tcancel style="flex:1">Huỷ</button>`}
      <button class="btn ink" type="button" data-tsave style="flex:2">Lưu</button></div></div>`
    : `<div class="empty" style="margin:auto">Chọn một template để sửa trình tự cảnh.<br><br><button class="btn sm" type="button" data-treset>Khôi phục mặc định</button></div>`;
  return `<div class="split tpl-split"><section class="list"><div class="tplgrid">${cards}</div></section><aside class="side-r tpl-side" aria-label="Sửa template">${side}</aside></div>`;
}

function parseAlt(text) {
  const out = {};
  text.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
    const [r, rest = ""] = l.split(":");
    const alts = rest.split(",").map((x) => x.trim()).filter(Boolean);
    if (r.trim() && alts.length) out[r.trim()] = alts;
  });
  return out;
}

function musicView(b) {
  const d = b.settings_defaults;
  return `<div class="page"><section class="box" style="overflow:hidden">${b.music.map((m) => `<div class="trk">
      <span style="width:240px;font-weight:500">${esc(m.name)}</span>
      <audio controls preload="none" src="/api/music/${encodeURIComponent(m.id)}/audio"></audio>
      <span class="mono small muted" style="width:52px;text-align:right">${Math.floor(m.duration / 60)}:${String(Math.round(m.duration % 60)).padStart(2, "0")}</span>
      ${m.id === d.music_track ? '<span class="chip ok">mặc định</span>' : '<span style="width:70px"></span>'}</div>`).join("") || '<div class="empty">Chưa có nhạc. Bỏ file vào SOURCE\\Nhac nen.</div>'}</section>
    <p class="muted small" style="margin:0">Nhạc lấy từ SOURCE\\Nhac nen. Nhạc tự hạ khi có giọng đọc.</p></div>`;
}

function textView(b) {
  const d = b.settings_defaults;
  const yes = (v) => `<span class="chip ${v ? "ok" : ""}">${v ? "bật" : "tắt"}</span>`;
  const sample = (name, use, css) => `<div class="box" style="overflow:hidden"><div style="height:140px;background:#1b1916;display:grid;place-items:center;padding:16px">
      <span style="${css};font-size:17px;text-align:center">Bà nói muốn trả lại</span></div>
      <div style="padding:10px 12px;display:flex;justify-content:space-between"><strong style="font-weight:600">${name}</strong><span class="muted small">${use}</span></div></div>`;
  return `<div class="page">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${sample("Phụ đề khung", d.subtitle_style === "box" ? "đang dùng" : "", "color:#fff;background:rgba(0,0,0,.6);padding:6px 10px;border-radius:6px;font-weight:600")}
      ${sample("Phụ đề viền", d.subtitle_style === "outline" ? "đang dùng" : "", "color:#fff;font-weight:700;text-shadow:0 0 3px #000,0 2px 8px rgba(0,0,0,.8)")}
      ${sample("Chữ hook", "0–5 giây đầu", "color:#D4AF5A;font-weight:800;text-shadow:0 2px 8px rgba(0,0,0,.7)")}
    </div>
    <div class="row"><section class="box pad grow"><h2>Mặc định khi dựng</h2><div class="kv">
        <span class="muted">Chuyển cảnh</span><span>${d.transition === "dip" ? "Mờ qua đen" : "Cắt thẳng"}</span>
        <span class="muted">Màu</span><span>${{ none: "Gốc", warm: "Trang sức ấm", cool: "Bạc lạnh" }[d.color] || d.color}</span>
        <span class="muted">Âm lượng nhạc</span><span class="mono">${Math.round(d.music_volume * 100)}%</span>
        <span class="muted">Phụ đề</span><span>${yes(d.subtitles)}</span><span class="muted">Chữ hook</span><span>${yes(d.hook_text)}</span>
        <span class="muted">SFX</span><span>${yes(d.sfx)}</span><span class="muted">Logo</span><span>${yes(d.logo)}</span>
        <span class="muted">Outro VN</span><span>${yes(d.outro !== false)}</span></div></section>
      <section class="box pad side-col"><h2>Quy tắc cứng</h2><div class="kv" style="grid-template-columns:120px 1fr">${RULES.map(([k, v]) => `<span class="muted">${esc(k)}</span><span>${esc(v)}</span>`).join("")}</div></section></div></div>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  let info = await api.templates();
  const paint = () => {
    const t = (k, l) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`;
    el.className = tab === "tpl" ? "fscreen" : "";        // template tab: one screen high, grid and side panel scroll on their own
    el.style.cssText = tab === "tpl" ? "" : "display:flex;flex-direction:column;min-height:100vh";
    el.innerHTML = `<header class="ph-bar"><h1>FX</h1><div class="seg" role="tablist" aria-label="Mục">${t("tpl", `Template · ${info.templates.length}`)}${t("music", `Nhạc · ${ctx.boot.music.length}`)}${t("text", "Chữ & hiệu ứng")}</div>
      <div class="sp"></div>${tab === "tpl" ? '<button class="btn pri" type="button" data-tnew>+ Thêm</button>' : ""}</header>
      ${tab === "tpl" ? tplView(info) : tab === "music" ? musicView(ctx.boot) : textView(ctx.boot)}`;
  };
  paint();
  const reload = async () => { info = await api.templates(); ctx.boot.templates = info.templates; paint(); };
  // keep what is typed in the side panel when it re-renders
  const grab = () => {
    if (!draft) return;
    const v = (id) => el.querySelector(id)?.value;
    if (v("#t-label") != null) draft.label = v("#t-label");
    if (v("#t-desc") != null) draft.description = v("#t-desc");
    if (v("#t-alt") != null) draft.alt_roles = parseAlt(v("#t-alt"));
  };
  const redraw = () => { const sc = el.querySelector(".tpl-body")?.scrollTop || 0; grab(); paint(); const b = el.querySelector(".tpl-body"); if (b) b.scrollTop = sc; };
  const slug = (t) => (t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "tpl") + "_" + Math.random().toString(36).slice(2, 6);
  el.addEventListener("change", (e) => {
    const t = e.target;
    if (!draft) return;
    if (t.id === "t-fam") { grab(); draft.family = t.value; paint(); return; }
    const row = t.closest("[data-bi]");
    if (row && t.dataset.bf) {
      const b = draft.sequence[Number(row.dataset.bi)];
      const f = t.dataset.bf;
      if (f === "sec") b.sec = Math.min(30, Math.max(1, Number(t.value) || 4));
      else if (f === "silent" || f === "loop") b[f] = t.checked;
      else if (f === "step") b.step = t.value || null;
      else if (f === "role") { b.role = t.value; if (b.role !== "craft") b.step = null; if (b.role === "outro") { b.silent = false; b.loop = false; } }
      redraw();
    }
  });
  // drag ⠿ to reorder blocks (mouse); on touch the same rows can be dragged with a long press in most browsers
  el.addEventListener("dragstart", (e) => { const r = e.target.closest?.("[data-bi]"); if (!r) return; dragFrom = Number(r.dataset.bi); r.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(dragFrom)); });
  el.addEventListener("dragover", (e) => { const r = e.target.closest?.("[data-bi]"); if (!r || dragFrom < 0) return; e.preventDefault();
    el.querySelectorAll(".tblk.over").forEach((x) => x.classList.remove("over")); r.classList.add("over"); });
  el.addEventListener("dragend", () => { dragFrom = -1; el.querySelectorAll(".tblk.over,.tblk.drag").forEach((x) => x.classList.remove("over", "drag")); });
  el.addEventListener("drop", (e) => {
    const r = e.target.closest?.("[data-bi]");
    if (!r || dragFrom < 0 || !draft) return;
    e.preventDefault();
    const to = Number(r.dataset.bi);
    const [m] = draft.sequence.splice(dragFrom, 1);
    draft.sequence.splice(to, 0, m);
    dragFrom = -1;
    redraw();
  });
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    try {
      if (b.dataset.tab) { tab = b.dataset.tab; paint(); }
      else if (b.hasAttribute("data-tnew")) { startEdit(info, ""); paint(); }
      else if (b.dataset.tsel !== undefined) { startEdit(info, b.dataset.tsel); paint(); }
      else if (b.hasAttribute("data-tcancel")) { draft = null; paint(); }
      else if (b.dataset.tline && draft) { grab(); const l = b.dataset.tline; draft.lines = draft.lines.includes(l) ? draft.lines.filter((x) => x !== l) : [...draft.lines, l].sort(); paint(); }
      else if (b.hasAttribute("data-tseq") && draft) { grab(); draft.sequence = defaultSeq(draft.family); paint(); }
      else if (b.dataset.badd && draft) {
        grab();
        const nb = { role: b.dataset.badd, sec: b.dataset.badd === "hook" ? 3 : 4 };
        const oi = draft.sequence.findIndex((x) => x.role === "outro");
        if (nb.role === "outro") { if (oi < 0) draft.sequence.push(nb); }
        else draft.sequence.splice(oi < 0 ? draft.sequence.length : oi, 0, nb);       // new blocks go before the outro
        redraw();
        el.querySelector(".tblks .tblk:last-child")?.scrollIntoView({ block: "nearest" });
      } else if (b.dataset.bdel && draft) { grab(); draft.sequence.splice(Number(b.dataset.bdel), 1); redraw(); }
      else if (b.hasAttribute("data-tsave") && draft) {
        grab();
        if (!draft.label.trim()) { toast("Đặt tên cho template", true); return; }
        const oi = draft.sequence.findIndex((x) => x.role === "outro");
        if (oi >= 0 && oi !== draft.sequence.length - 1) { draft.sequence.push(...draft.sequence.splice(oi, 1)); }   // outro always last
        const id = draft.id || slug(draft.label);
        await api.templateSave(id, { label: draft.label.trim(), family: draft.family, description: draft.description || "", alt_roles: draft.alt_roles || {},
          sequence: draft.sequence, lines: draft.lines });
        toast("Đã lưu template"); await reload(); startEdit(info, id); paint();
      } else if (b.dataset.tdel) {
        if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Bấm lần nữa để xoá"; return; }
        await api.templateDelete(b.dataset.tdel); draft = null; toast("Đã xoá template"); await reload();
      } else if (b.hasAttribute("data-treset")) {
        if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Bấm lần nữa để khôi phục"; return; }
        await api.templateReset(); toast("Đã khôi phục template mặc định"); await reload();
      }
    } catch (err) { toast(err.message, true); }
  });
}
