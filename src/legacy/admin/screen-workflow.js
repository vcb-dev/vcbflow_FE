// Workflow: nối các khâu tự động (lịch → content → dịch → dựng → AI chấm → duyệt → lên lịch → đăng → số liệu → bài học)
// thành một sơ đồ kiểu n8n. Bấm khối để sửa cài đặt bên phải; khối tuỳ chọn bật / tắt từ kho khối bên trái.
import { api, esc, toast } from "./admin-api.js";

const G = { trig: "g-trig", content: "g-content", build: "g-build", check: "g-check", out: "g-out", learn: "g-learn", warn: "g-warn" };
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const PFC = { facebook: ["FB", "#1877F2"], instagram: ["IG", "#C13584"], tiktok: ["TT", "#E11D48"] };
const MODE = { library: "Lấy từ Kho content", ai: "AI viết mới", mix: "Kho content, thiếu thì AI viết thêm" };
const NODES = {
  trig: { g: "trig", code: "T", title: "Theo lịch", kind: "Kích hoạt" },
  content: { g: "content", code: "C", title: "Chọn content", kind: "Nội dung" },
  translate: { g: "content", code: "D", title: "Dịch đa ngôn ngữ", kind: "Nội dung", opt: true },
  build: { g: "build", code: "J", title: "Tạo job dựng", kind: "Dựng video" },
  check: { g: "check", code: "AI", title: "AI chấm điểm", kind: "Kiểm duyệt · rẽ nhánh", opt: true },
  editor: { g: "warn", code: "TG", title: "Gửi Editor duyệt", kind: "Kiểm duyệt", opt: true },
  publish: { g: "out", code: "L", title: "Lên lịch đăng", kind: "Phân phối" },
  post: { g: "out", code: "Đ", title: "Đăng bài", kind: "Phân phối" },
  stats: { g: "learn", code: "S", title: "Kéo số liệu", kind: "Học" },
  learn: { g: "learn", code: "B", title: "Rút bài học", kind: "Học", opt: true },
};
const PALETTE = [
  ["Kích hoạt", "trig", [["trig", "Theo lịch"]]],
  ["Nội dung", "content", [["content", "Chọn content"], ["translate", "Dịch đa ngôn ngữ"]]],
  ["Dựng video", "build", [["build", "Tạo job dựng"]]],
  ["Kiểm duyệt", "check", [["check", "AI chấm điểm + điều kiện"], ["editor", "Editor duyệt (Telegram)"]]],
  ["Phân phối", "out", [["publish", "Lên lịch đăng"], ["post", "Đăng bài"]]],
  ["Học", "learn", [["stats", "Kéo số liệu"], ["learn", "Rút bài học"]]],
];
const on = (w, id) => (NODES[id].opt ? !!w[id === "translate" ? "translate" : id]?.on : true);
let S = { wid: null, sel: "publish", view: "flow", chq: "" };

function layout(w) {
  const main = ["trig", "content", ...(on(w, "translate") ? ["translate"] : []), "build", ...(on(w, "check") ? ["check"] : []), "publish", "post", "stats"];
  const pos = {};
  main.forEach((id, i) => { pos[id] = { x: 30 + i * 230, y: 150 }; });
  if (on(w, "check") && on(w, "editor")) pos.editor = { x: pos.check.x + 115, y: 380 };
  if (on(w, "learn")) pos.learn = { x: pos.stats.x - 230, y: 380 };
  return { main, pos, width: 30 + main.length * 230 + 60 };
}

function status(w, id) {
  const r = (w.runs || [])[0], st = w.stats || {};
  const v = (t, cls = "ok") => [t, cls];
  if (id === "trig") return r ? v(`Chạy ${r.started_at.slice(5, 16)}`) : v(w.enabled ? "Chờ lần chạy đầu" : "Đang tắt", "wait");
  if (id === "content") return r ? v(`${r.requested || 0} video yêu cầu`) : v("—", "wait");
  if (id === "translate") return v((w.translate.langs || []).map((l) => l.toUpperCase()).join(" · "), "ok");
  if (id === "build") return r ? v(`${r.jobs?.length ?? r.jobs ?? 0} job · ${(r.errors || []).length || 0} lỗi`, (r.errors || []).length ? "warn" : "ok") : v("—", "wait");
  if (id === "check") return v(`Điểm dự đoán ≥ ${w.check.threshold}`, "ok");
  if (id === "editor") return v(`${st.pending || 0} chờ duyệt`, st.pending ? "warn" : "ok");
  if (id === "publish") return v(`${st.scheduled || 0} chờ giờ đăng`, "ok");
  if (id === "post") return v(`${st.published || 0} đã đăng${st.error ? ` · ${st.error} lỗi` : ""}`, st.error ? "warn" : "ok");
  if (id === "stats") return v("Mỗi 6 giờ", "wait");
  if (id === "learn") return v("Sau mỗi lần kéo số liệu", "wait");
  return v("", "wait");
}

function sub(w, id, D) {
  const c = w.content;
  if (id === "trig") return `${w.trigger.times.join(", ") || "chưa có giờ"} · ${w.trigger.days.length === 7 ? "hằng ngày" : w.trigger.days.map((d) => DAYS[d]).join(" ")}`;
  if (id === "content") return `${c.count} bài · ${c.families.join(" ")} · ${c.mode === "ai" ? "AI viết" : c.mode === "library" ? "Kho content" : "Kho + AI"}`;
  if (id === "translate") return `${(w.translate.langs || []).length} ngôn ngữ · giọng HuyK từng nước`;
  if (id === "build") return `${w.build.auto_render ? "Dựng + xuất HD ngay" : "Tạo nháp, chờ duyệt"} · template theo hiệu quả`;
  if (id === "check") return "Đúng: lên lịch · Sai: chờ Editor";
  if (id === "editor") return w.editor.telegram ? "Gửi video vào nhóm Telegram" : "Chờ duyệt trong Lịch đăng";
  if (id === "publish") return w.publish.target === "market" ? "Mọi kênh cùng ngôn ngữ video" : `${(w.publish.channels || []).length} kênh đã chọn`;
  if (id === "post") return "FB Reels · Instagram · TikTok hộp thư";
  if (id === "stats") return `Content win ≥ ${(D.win || 100000).toLocaleString(globalThis.VCB_LOC || "vi-VN")} view`;
  if (id === "learn") return "Bài học → AI viết & AI chia cảnh";
  return "";
}

function canvas(w, D) {
  const { main, pos, width } = layout(w);
  const W = 196, PY = 45;
  const curve = (a, b) => { const x1 = a.x + W, y1 = a.y + PY, x2 = b.x, y2 = b.y + PY, dx = Math.max(50, Math.abs(x2 - x1) / 2); return `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`; };
  const edges = main.slice(1).map((id, i) => `<path d="${curve(pos[main[i]], pos[id])}" class="wf-e"></path>`);
  const labels = [];
  if (pos.editor) {
    const c = pos.check, e = pos.editor, p = pos.publish;
    edges.push(`<path d="M${c.x + W / 2} ${c.y + 118} C${c.x + W / 2} ${c.y + 200}, ${e.x + W / 2} ${e.y - 60}, ${e.x + W / 2} ${e.y}" class="wf-e warn"></path>`);
    edges.push(`<path d="M${e.x + W} ${e.y + PY} C${e.x + W + 80} ${e.y + PY}, ${p.x + W / 2} ${p.y + 200}, ${p.x + W / 2} ${p.y + 118}" class="wf-e warn"></path>`);
    labels.push(`<span class="wf-l ok" style="left:${c.x + W + 6}px;top:${c.y + 20}px">Đúng</span>`, `<span class="wf-l warn" style="left:${c.x + W / 2 + 8}px;top:${c.y + 150}px">Sai</span>`);
  }
  if (pos.learn) {
    const s = pos.stats, l = pos.learn, c = pos.content;
    edges.push(`<path d="M${s.x + W / 2} ${s.y + 118} C${s.x + W / 2} ${l.y + PY}, ${l.x + W + 60} ${l.y + PY}, ${l.x + W} ${l.y + PY}" class="wf-e loop"></path>`);
    edges.push(`<path d="M${l.x} ${l.y + PY + 20} C${l.x - 400} ${l.y + 150}, ${c.x + W / 2} ${c.y + 330}, ${c.x + W / 2} ${c.y + 118}" class="wf-e loop"></path>`);
    labels.push(`<span class="wf-l ok" style="left:${c.x + 140}px;top:${l.y + 110}px">Vòng học: bài học quay lại khâu chọn &amp; viết content</span>`);
  }
  const nodes = Object.keys(pos).map((id) => {
    const n = NODES[id], [stt, cls] = status(w, id);
    return `<button type="button" class="wf-n${S.sel === id ? " on" : ""}" data-node="${id}" style="left:${pos[id].x}px;top:${pos[id].y}px">
      <span class="wf-h"><span class="wf-c ${G[n.g]}">${n.code}</span><b>${n.title}</b></span>
      <span class="wf-s">${esc(sub(w, id, D))}</span><span class="wf-st ${cls}"><i></i>${esc(stt)}</span>
      <span class="wf-p pin"></span><span class="wf-p out"></span></button>`;
  }).join("");
  return `<section class="wf-canvas" aria-label="Sơ đồ workflow"><div class="wf-inner" style="width:${width}px">
      <svg width="${width}" height="560" aria-hidden="true">${edges.join("")}</svg>${labels.join("")}${nodes}</div></section>`;
}

function chips(list, cur, attr) {
  return `<span class="wf-chips">${list.map(([v, l]) => `<button type="button" class="wf-chip" aria-pressed="${cur.includes(v)}" ${attr}="${esc(v)}">${esc(l)}</button>`).join("")}</span>`;
}

function inspector(w, D) {
  const id = S.sel, n = NODES[id];
  const f = (label, body, hint) => `<div class="wf-f"><span class="lbl">${label}</span>${body}${hint ? `<span class="small muted">${hint}</span>` : ""}</div>`;
  let body = "";
  if (id === "trig") body = f("Giờ chạy", `<input class="in mono" data-k="trigger.times" value="${esc(w.trigger.times.join(", "))}" placeholder="08:00, 14:00">`, "Nhiều giờ cách nhau dấu phẩy")
    + f("Ngày trong tuần", chips(DAYS.map((d, i) => [String(i), d]), w.trigger.days.map(String), "data-day"));
  if (id === "content") body = f("Số video mỗi lần", `<input class="in mono" type="number" min="1" max="50" data-k="content.count" value="${w.content.count}" style="width:100px">`, "Mỗi ngôn ngữ thêm một bản")
    + f("Tuyến content", chips(Object.keys(D.families).map((k) => [k, k]), w.content.families, "data-fam"))
    + f("Nguồn", `<select class="in" data-k="content.mode">${Object.entries(MODE).map(([k, l]) => `<option value="${k}" ${w.content.mode === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)
    + f("Chủ đề", `<span class="wf-list">${D.topics.map((t) => `<label class="small"><input type="checkbox" class="chk" data-topic="${esc(t)}" ${w.content.topics.includes(t) ? "checked" : ""}> ${esc(t)}</label>`).join("")}</span>`, "Không chọn = mọi chủ đề");
  if (id === "translate") body = f("Ngôn ngữ xuất", chips(D.languages.map((l) => [l.code, l.label]), w.translate.langs, "data-lang"), "Mỗi content ra một video cho từng ngôn ngữ, giọng HuyK của nước đó, footage khác nhau");
  if (id === "build") body = f("Sau khi tạo job", `<label class="small"><input type="checkbox" class="chk" data-b="build.auto_render" ${w.build.auto_render ? "checked" : ""}> Dựng và xuất HD ngay (không chờ Duyệt)</label>`, "Tắt = job ở dạng nháp, phải bấm Duyệt · xuất HD; khi đó các khâu sau chờ tới lúc anh duyệt")
    + f("Chữ đầu video", `<label class="small"><input type="checkbox" class="chk" data-b="build.hook_text" ${w.build.hook_text ? "checked" : ""}> Hiện câu hook trên màn hình</label>`)
    + f("Template", '<span class="small">Tự chọn template thắng theo số liệu (30% thử template khác)</span>');
  if (id === "check") body = f("Điều kiện", `<span style="display:flex;gap:8px;align-items:center">Điểm dự đoán ≥ <input class="in mono" type="number" min="0" max="100" data-k="check.threshold" value="${w.check.threshold}" style="width:80px"></span>`,
    "Điểm dự đoán = điểm trung bình các video cùng tuyến và template trên kênh (cần ≥ 3 video có số liệu, chưa đủ thì tính là Sai)")
    + f("Đúng", '<span class="small">Lên lịch đăng ngay theo giờ từng kênh</span>') + f("Sai", `<span class="small">${on(w, "editor") ? "Chờ Editor duyệt" : "Vẫn lên lịch (khối Editor duyệt đang tắt)"}</span>`);
  if (id === "editor") body = f("Thông báo", `<label class="small"><input type="checkbox" class="chk" data-b="editor.telegram" ${w.editor.telegram ? "checked" : ""}> Gửi video vào nhóm Telegram</label>`, "Editor xem trên Telegram rồi bấm Duyệt ở Đăng & hiệu quả › Lịch đăng");
  if (id === "publish") {
    const chs = D.channels.filter((c) => !S.chq || c.name.toLowerCase().includes(S.chq.toLowerCase()));
    body = f("Đăng lên", `<span class="wf-chips"><button type="button" class="wf-chip" aria-pressed="${w.publish.target === "market"}" data-target="market">Mọi kênh cùng ngôn ngữ</button><button type="button" class="wf-chip" aria-pressed="${w.publish.target === "channels"}" data-target="channels">Chọn kênh</button></span>`,
      "Video tiếng nào chỉ lên kênh có thị trường nói tiếng đó")
      + (w.publish.target === "channels" ? f(`Kênh · ${w.publish.channels.length} đã chọn`, `<input class="in" id="wf-chq" type="search" placeholder="Tìm kênh" value="${esc(S.chq)}">
        <span style="display:flex;gap:6px"><button class="btn sm" type="button" data-chall>Chọn tất cả</button><button class="btn sm" type="button" data-chnone>Bỏ chọn</button></span>
        <span class="wf-list">${chs.map((c) => `<label class="small"><input type="checkbox" class="chk" data-ch="${esc(c.cid)}" ${w.publish.channels.includes(c.cid) ? "checked" : ""}> <span class="pfchip" style="background:${(PFC[c.platform] || PFC.facebook)[1]}">${(PFC[c.platform] || PFC.facebook)[0]}</span> ${esc(c.name)} <span class="muted mono">${esc((c.market || "").toUpperCase())}</span></label>`).join("") || '<span class="small muted">Chưa có kênh — vào Đăng &amp; hiệu quả › Kết nối</span>'}</span>`) : "")
      + f("Giờ đăng", '<span class="small">Khung giờ trống tiếp theo theo lịch từng kênh (Đăng &amp; hiệu quả › Lịch đăng), không đăng lại video đã có trên kênh</span>');
  }
  if (id === "post") body = f("Cách đăng", '<span class="small">Facebook Reels và Instagram đăng thẳng đúng giờ. TikTok gửi vào hộp thư, anh bấm đăng trong app. Caption lấy từ content + hashtag theo ngôn ngữ.</span>');
  if (id === "stats") body = f("Kéo số liệu", '<span class="small">Tự kéo mỗi 6 giờ cho mọi page đã kết nối (lượt xem, thời gian xem, tương tác).</span>')
    + f("Content win", `<span class="small">Từ ${(D.win || 100000).toLocaleString(globalThis.VCB_LOC || "vi-VN")} view · đổi ở Đăng &amp; hiệu quả › Hiệu quả</span>`);
  if (id === "learn") body = f("Áp dụng vào", '<span class="small">AI rút bài học sau mỗi lần kéo số liệu: bài học Content / Hook vào AI viết content, Template / Độ dài vào AI chia cảnh, template thắng được chọn nhiều hơn.</span>');
  const [stt, cls] = status(w, id);
  return `<div class="wf-ih"><span class="wf-c ${G[n.g]}">${n.code}</span><span class="chn"><b>${n.title}</b><span class="small muted">${n.kind}</span></span>
      ${n.opt ? `<button class="btn sm danger" type="button" data-off="${id}" title="Bỏ khối này khỏi sơ đồ">Bỏ khối</button>` : ""}</div>
    <div class="wf-ib">${body}<div class="wf-last"><span class="lbl">Lần chạy gần nhất</span><span class="wf-st ${cls}"><i></i>${esc(stt)}</span></div></div>`;
}

function runsView(w) {
  const rs = w.runs || [];
  return `<section class="wf-runs">${rs.length ? rs.map((r) => `<div class="box wf-run"><span class="mono small" style="width:120px">${esc((r.started_at || "").slice(5, 16))}</span>
      <span class="chip ${r.state === "done" ? "ok" : r.state === "running" ? "run" : "bad"}">${r.state === "done" ? "Xong" : r.state === "running" ? "Đang chạy" : "Lỗi"}</span>
      <span class="chn"><span>${r.requested || 0} video yêu cầu · ${(r.jobs?.length ?? r.jobs) || 0} job tạo${r.stats?.done != null ? ` · ${r.stats.done} xong` : ""}</span>
        ${(r.errors || []).length ? `<span class="small" style="color:var(--warn)">${esc(String((r.errors || [])[0]).slice(0, 160))}${r.errors.length > 1 ? ` · +${r.errors.length - 1} lỗi` : ""}</span>` : ""}</span>
      <span class="mono small muted">${r.stats?.elapsed_s ? Math.round(r.stats.elapsed_s / 60) + " phút" : ""}</span><a class="btn sm" href="#/jobs">Xem job</a></div>`).join("")
    : '<div class="empty">Workflow này chưa chạy lần nào. Bấm "Chạy thử" để chạy ngay.</div>'}</section>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;height:100vh";
  view.replaceChildren(el);
  let D = await api.workflows();
  try { D.win = (await api.social()).settings.win_views; } catch { D.win = 100000; }
  let w = null, dirty = false;
  const pick = () => {
    if (!D.workflows.length) { w = null; return; }
    const cur = D.workflows.find((x) => x.id === S.wid) || D.workflows[0];
    S.wid = cur.id;
    w = JSON.parse(JSON.stringify(cur));
  };
  pick();
  const header = () => `<header class="ph-bar"><h1>Workflow</h1>
    ${D.workflows.length ? `<select class="in" id="wf-pick" style="width:auto;min-height:34px;font-weight:600" aria-label="Chọn workflow">${D.workflows.map((x) => `<option value="${x.id}" ${x.id === S.wid ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <input class="in" id="wf-name" value="${esc(w.name)}" aria-label="Tên workflow" style="width:220px;min-height:34px">` : ""}
    <button class="btn" type="button" data-new>+ Workflow mới</button>
    ${w ? `<nav class="seg" aria-label="Chế độ xem"><button type="button" aria-pressed="${S.view === "flow"}" data-view="flow">Sơ đồ</button><button type="button" aria-pressed="${S.view === "runs"}" data-view="runs">Lịch sử chạy · ${(w.runs || []).length}</button></nav>` : ""}
    <div class="sp"></div>
    ${w ? `<span class="small muted">${w.enabled ? `Chạy lúc ${esc(w.trigger.times.join(", "))}` : "Đang tắt"}</span>
      <span class="small muted" style="display:flex;gap:8px;align-items:center">Đang chạy <button class="switch" type="button" role="switch" aria-checked="${w.enabled}" data-enable aria-label="Bật workflow"></button></span>
      <button class="btn" type="button" data-run>▶ Chạy thử</button><button class="btn pri" type="button" data-save>${dirty ? "Lưu thay đổi" : "Đã lưu"}</button>
      <button class="btn icon danger" type="button" data-del aria-label="Xoá workflow" title="Xoá workflow">✕</button>` : ""}</header>`;
  const palette = () => `<aside class="wf-pal" aria-label="Kho khối">${PALETTE.map(([name, g, list]) => `<div class="wf-pg"><span class="wf-pgt">${name}</span>
      ${list.map(([id, l]) => { const has = on(w, id); return `<button type="button" class="wf-pi${has ? " has" : ""}" data-add="${id}" title="${has ? "Đã có trong sơ đồ — bấm để mở" : "Bấm để thêm vào sơ đồ"}">
        <span class="wf-c ${G[g]}">${NODES[id].code}</span><span class="ell">${l}</span><span class="small">${has ? "✓" : "+"}</span></button>`; }).join("")}</div>`).join("")}
      <p class="small muted" style="margin:4px 2px 0;line-height:1.5">Khối có dấu + là tuỳ chọn: bấm để thêm vào sơ đồ, bấm "Bỏ khối" để bỏ ra.</p></aside>`;
  const paint = () => {
    if (!w) {
      el.innerHTML = header() + `<div class="page"><div class="empty" style="display:grid;gap:12px;justify-items:center;padding:60px">
        <b style="font-size:16px">Chưa có workflow nào</b><span class="muted">Một workflow nối lịch chạy → content → dựng → AI chấm → duyệt → lên lịch đăng → số liệu → bài học.</span>
        <button class="btn pri" type="button" data-new>+ Tạo workflow đầu tiên</button></div></div>`;
      return;
    }
    el.innerHTML = header() + `<div class="wf">${palette()}${S.view === "flow" ? canvas(w, D) : runsView(w)}<aside class="wf-insp" id="wf-insp">${inspector(w, D)}</aside></div>`;
  };
  const repaintSoft = () => {                 // keep canvas scroll + inspector focus: redraw pieces, not the page
    const cv = el.querySelector(".wf-canvas"), sl = cv?.scrollLeft;
    el.querySelector("header").outerHTML = header();
    const pal = el.querySelector(".wf-pal"); if (pal) pal.outerHTML = palette();
    if (cv) { cv.outerHTML = canvas(w, D); el.querySelector(".wf-canvas").scrollLeft = sl; }
    const ins = el.querySelector("#wf-insp"); if (ins) ins.innerHTML = inspector(w, D);
  };
  const touch = () => { dirty = true; repaintSoft(); };
  const setK = (path, v) => { const [a, b] = path.split("."); w[a][b] = v; };
  paint();
  const reloadAll = async (keepSel) => { D = await api.workflows(); D.win = D.win || 100000; pick(); dirty = false; if (!keepSel) S.sel = "publish"; paint(); };
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    try {
      if (t.hasAttribute("data-new")) {
        const r = await api.workflowSave(null, { name: `Workflow ${D.workflows.length + 1}` });
        S.wid = r.id; await reloadAll(); toast("Đã tạo workflow — chỉnh từng khối rồi bật Đang chạy"); return;
      }
      if (t.dataset.view) { S.view = t.dataset.view; paint(); return; }
      if (t.dataset.node) { S.sel = t.dataset.node; el.querySelectorAll(".wf-n").forEach((b) => b.classList.toggle("on", b.dataset.node === S.sel)); el.querySelector("#wf-insp").innerHTML = inspector(w, D); return; }
      if (t.dataset.add) {
        const id = t.dataset.add;
        if (NODES[id].opt && !on(w, id)) { w[id].on = true; if (id === "editor") w.check.on = true; if (id === "translate" && w.translate.langs.length < 2) w.translate.langs = ["vi", "en"]; dirty = true; }
        S.sel = id; S.view = "flow"; paint(); return;
      }
      if (t.dataset.off) { const id = t.dataset.off; w[id].on = false; if (id === "check") w.editor.on = false; S.sel = "publish"; touch(); return; }
      if (t.hasAttribute("data-enable")) { w.enabled = !w.enabled; touch(); return; }
      if (t.dataset.day !== undefined) { const d = +t.dataset.day, s = new Set(w.trigger.days); s.has(d) ? s.delete(d) : s.add(d); w.trigger.days = [...s].sort(); touch(); return; }
      if (t.dataset.fam) { const s = new Set(w.content.families); s.has(t.dataset.fam) ? s.delete(t.dataset.fam) : s.add(t.dataset.fam); w.content.families = [...s]; touch(); return; }
      if (t.dataset.lang) { const s = new Set(w.translate.langs); s.has(t.dataset.lang) ? s.delete(t.dataset.lang) : s.add(t.dataset.lang); w.translate.langs = [...s]; touch(); return; }
      if (t.dataset.target) { w.publish.target = t.dataset.target; touch(); return; }
      if (t.hasAttribute("data-chall") || t.hasAttribute("data-chnone")) {
        const vis = D.channels.filter((c) => !S.chq || c.name.toLowerCase().includes(S.chq.toLowerCase())).map((c) => c.cid);
        const s = new Set(w.publish.channels); vis.forEach((c) => (t.hasAttribute("data-chall") ? s.add(c) : s.delete(c))); w.publish.channels = [...s]; touch(); return;
      }
      if (t.hasAttribute("data-save")) {
        const r = await api.workflowSave(w.id, w); S.wid = r.id; await reloadAll(true); toast("Đã lưu workflow"); return;
      }
      if (t.hasAttribute("data-run")) {
        if (dirty) { await api.workflowSave(w.id, w); }
        await api.workflowRun(w.id); toast("Đang chạy workflow — xem tiến độ ở Lịch sử chạy hoặc Job"); setTimeout(() => reloadAll(true), 3000); return;
      }
      if (t.hasAttribute("data-del")) {
        if (!confirm(`Xoá workflow "${w.name}"? Lịch chạy của nó cũng bị xoá.`)) return;
        await api.workflowDelete(w.id); S.wid = null; await reloadAll(); toast("Đã xoá workflow"); return;
      }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "wf-pick") { if (dirty && !confirm("Bỏ thay đổi chưa lưu?")) { t.value = S.wid; return; } S.wid = t.value; pick(); dirty = false; paint(); return; }
    if (t.dataset.k) {
      let v = t.value;
      if (t.dataset.k === "trigger.times") v = v.split(",").map((x) => x.trim()).filter(Boolean);
      if (t.type === "number") v = +v;
      setK(t.dataset.k, v); touch(); return;
    }
    if (t.dataset.b) { setK(t.dataset.b, t.checked); touch(); return; }
    if (t.dataset.topic) { const s = new Set(w.content.topics); t.checked ? s.add(t.dataset.topic) : s.delete(t.dataset.topic); w.content.topics = [...s]; dirty = true; el.querySelector("header").outerHTML = header(); return; }
    if (t.dataset.ch) { const s = new Set(w.publish.channels); t.checked ? s.add(t.dataset.ch) : s.delete(t.dataset.ch); w.publish.channels = [...s]; dirty = true; el.querySelector("header").outerHTML = header(); return; }
  });
  el.addEventListener("input", (e) => {
    if (e.target.id === "wf-name") { w.name = e.target.value; dirty = true; const b = el.querySelector("[data-save]"); if (b) b.textContent = "Lưu thay đổi"; }
    if (e.target.id === "wf-chq") { S.chq = e.target.value; const ins = el.querySelector("#wf-insp"); ins.innerHTML = inspector(w, D); const q = ins.querySelector("#wf-chq"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  });
  ctx.setCleanup(() => {});
}
