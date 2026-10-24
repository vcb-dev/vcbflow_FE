// Kho hàng: stock from the warehouse system (OMS) per product, next to its footage and the videos made / posted / views,
// so the team plans videos for what is in stock. The top (title, numbers, tabs, filters) stays put while the table
// scrolls; columns sort; a click on a product opens its card (numbers, posted videos, video plan) in a popup; several
// products can be ticked at once; "Quy tắc lên kế hoạch" makes videos by itself when the stock matches a rule.
import { api, esc, toast } from "./admin-api.js";
import { money as fmtMoney } from "../i18n.js";

const st = { tab: "prio", q: "", group: "", loc: "", op: "", val: "", src: false, sort: { k: "", dir: -1 }, chk: new Set(), shown: 120,
  pop: null, count: 4, fams: new Set(["A4"]), langs: new Set(["vi"]), rulesOpen: false, rsel: null };
const TABS = [["prio", "Ưu tiên làm video"], ["stock", "Còn hàng"], ["aged", "Tồn lâu ≥ 30 ngày"], ["shoot", "Cần quay footage"], ["footage", "Có footage"], ["out", "Hết hàng"], ["all", "Tất cả"]];
const TAGC = { push: "push", hot: "ok", shoot: "info", out: "bad", ok: "", none: "" };
const TAGO = { hot: 0, push: 1, shoot: 2, ok: 3, none: 4, out: 5 };
const LANGS = [["vi", "VN"], ["en", "US"], ["th", "TH"], ["ja", "JP"]];
const FAMS = ["A1", "A2", "A3", "A4", "A5"];
const PF = { tiktok: ["TT", "#E11D48"], facebook: ["FB", "#1877F2"], instagram: ["IG", "#C13584"], youtube: ["YT", "#DC2626"] };
const COLS = [["on_hand", "Tồn", 1], ["age_days", "Thời gian tồn", 1], ["loc", "Kho", 0], ["sold30", "Bán 30 ngày", 1], ["made", "Video SX", 1],
  ["posted", "Đăng", 1], ["views", "Views", 1], ["tag", "Gợi ý", 1]];
const num = (v) => (v == null ? "—" : Number(v).toLocaleString(globalThis.VCB_LOC || "vi-VN"));
const k = (v) => (v == null ? "—" : v >= 1e6 ? `${(v / 1e6).toFixed(2).replace(".", ",")}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v));
const money = (v) => (v ? fmtMoney(Number(v)) : "");
const chip = (on, attr, v, l) => `<button type="button" class="pill" aria-pressed="${on}" ${attr}="${v}">${l}</button>`;
const OPS = { ">=": (a, b) => a >= b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, "<": (a, b) => a < b, "=": (a, b) => a === b };
const OPL = { ">=": "≥", ">": ">", "<=": "≤", "<": "<", "=": "=" };

function match(r, tab = st.tab) {
  const q = st.q.trim().toLowerCase();
  if (q && !`${r.sku} ${r.name || ""}`.toLowerCase().includes(q)) return false;
  if (st.group && !(r.group || "").startsWith(st.group)) return false;
  if (st.loc && !r.locations.some(([l]) => l === st.loc)) return false;
  if (st.src && !r.footage) return false;
  if (st.op && st.val !== "" && !OPS[st.op](r.on_hand || 0, Number(st.val))) return false;
  const oh = r.on_hand || 0;
  return { prio: r.tag !== "out" && r.tag !== "none" || r.footage, stock: oh > 0, aged: oh > 0 && ((r.aged_qty || 0) > 0 || (r.age_days || 0) >= 30),
    shoot: r.tag === "shoot", footage: r.footage, out: r.tag === "out", all: true }[tab];
}

function sorted(rows) {
  const { k: key, dir } = st.sort;
  if (!key) return rows;
  const val = (r) => (key === "tag" ? -(TAGO[r.tag] ?? 9) : r[key] ?? -1);
  return [...rows].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
}

// ---- rules evaluated in the browser too (which rule a product falls under) ----
function ruleHit(rule, r) {
  const s = rule.scope || {};
  if (s.mode === "skus" && !(s.skus || []).includes(r.sku.toUpperCase())) return false;
  if (s.mode === "groups" && !(s.groups || []).some((g) => (r.group || "").toUpperCase().startsWith(g.toUpperCase()))) return false;
  return (rule.conds || []).every((c) => OPS[c.op](Number(r[c.field] ?? 0), Number(c.val)));
}
const condText = (c, F) => `${(F[c.field] || c.field).replace(" (mọi kho)", "").replace(" (ngày)", "")} ${OPL[c.op]} ${num(c.val)}`;
function ruleSummary(r, R) {
  const s = r.scope || {};
  const who = s.mode === "skus" ? `${(s.skus || []).length} mã chọn` : s.mode === "groups" ? (s.groups || []).join(", ") || "nhóm hàng" : "Mọi sản phẩm";
  const a = r.action || {};
  const when = a.every === "week" ? `${R.weekdays[a.weekday || 0]} ${a.time}` : a.every === "once" ? "khi bấm chạy" : `${R.every[a.every]} ${a.time}`;
  return `${who} · ${(r.conds || []).map((c) => condText(c, R.fields)).join(" và ") || "không điều kiện"} → ${a.count ? `${a.count} video ${(a.families || []).join("/")}` : "không làm video"} · ${when}`;
}

function table(rows) {
  if (!rows.length) return '<div class="empty">Không có sản phẩm khớp bộ lọc.</div>';
  const th = ([key, label, sortable]) => {
    const on = st.sort.k === key;
    return `<th class="${key === "loc" || key === "tag" ? "" : "num"}">${sortable ? `<button type="button" class="thsort${on ? " on" : ""}" data-isort="${key}">${label} ${on ? (st.sort.dir < 0 ? "↓" : "↑") : "↕"}</button>` : label}</th>`;
  };
  const all = rows.length && rows.slice(0, st.shown).every((r) => st.chk.has(r.sku));
  return `<table class="ctab itab"><thead><tr><th class="ick"><input type="checkbox" class="chk" data-ichkall ${all ? "checked" : ""} aria-label="Chọn tất cả"></th><th>Mã SP</th><th>Tên sản phẩm</th>${COLS.map(th).join("")}</tr></thead><tbody>
    ${rows.slice(0, st.shown).map((r) => `<tr class="${st.pop === r.sku ? "on" : st.chk.has(r.sku) ? "ck" : ""}" data-isel="${esc(r.sku)}">
      <td class="ick"><input type="checkbox" class="chk" data-ichk="${esc(r.sku)}" ${st.chk.has(r.sku) ? "checked" : ""} aria-label="Chọn ${esc(r.sku)}"></td>
      <td class="mono"><b>${esc(r.sku)}</b><span class="small muted sub">${r.n_variants ? `${r.n_variants} mã con` : "chưa có trong kho"}</span></td>
      <td><span class="iname">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "<i></i>"}<span><b>${esc(r.name || "—")}</b>
        <span class="small muted">${esc(r.group || "")}${r.group ? " · " : ""}${r.footage ? `${num(r.clips)} clip footage` : "chưa có footage"}</span></span></span></td>
      <td class="num mono" style="font-weight:600;color:${r.on_hand == null ? "var(--muted)" : r.on_hand <= 0 ? "var(--bad)" : r.on_hand < 5 ? "var(--warn)" : "var(--ink)"}">${num(r.on_hand)}${r.on_hand > 0 && r.available != null && r.available !== r.on_hand ? `<span class="small muted sub">${num(r.available)} bán được</span>` : ""}</td>
      <td class="num mono" style="color:${(r.age_days || 0) > 90 ? "var(--bad)" : (r.age_days || 0) > 30 ? "var(--warn)" : "var(--muted)"}">${r.age_days != null ? `${r.age_days} ngày${r.aged_qty ? `<span class="small muted sub" title="Số món đã nằm kho từ 30 ngày trở lên">${num(r.aged_qty)} món ≥ 30n</span>` : ""}` : r.status ? `<span class="small">${esc(r.status)}</span>` : "—"}</td>
      <td class="small">${r.locations.length ? esc(r.locations[0][0]) + (r.locations.length > 1 ? ` <span class="muted">+${r.locations.length - 1}</span>` : "") : '<span class="muted">—</span>'}</td>
      <td class="num mono">${num(r.sold30)}</td><td class="num mono">${num(r.made)}</td><td class="num mono">${num(r.posted)}</td>
      <td class="num mono" style="color:var(--accent);font-weight:600">${k(r.views)}</td>
      <td><span class="itag ${TAGC[r.tag]}">${esc(r.tag_label)}</span></td></tr>`).join("")}</tbody></table>
    ${rows.length > st.shown ? `<div class="imore small muted" id="i-more">${num(st.shown)}/${num(rows.length)} · kéo xuống để xem thêm</div>` : ""}`;
}

function popup(r, d, wfs, R, vids) {
  if (!r) return "";
  const hit = (R.rules || []).find((x) => x.on && ruleHit(x, r));
  const pf = (p) => PF[p] || ["·", "#6E6C67"];
  const vlist = vids == null ? '<div class="small muted is-busy" style="padding:8px">Đang tải video đã đăng…</div>'
    : !vids.items.length ? '<div class="small muted" style="padding:8px 4px">Chưa có video đã đăng nào có #mã này trong caption.</div>'
    : vids.items.map((v) => `<a class="ivid" href="#/social/posts/sku/${encodeURIComponent(r.sku)}">
        <img src="/api/social/thumb?k=${encodeURIComponent(v.key)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
        <span class="ivid-t"><b>${esc((v.title || "").split("#")[0].trim() || v.title || "(không caption)")}</b>
          <span class="small muted"><span class="ipf" style="background:${pf(v.platform)[1]}">${pf(v.platform)[0]}</span>${esc(v.page || "")} · ${esc((v.created || "").slice(0, 10))}</span></span>
        <span class="ivid-v"><b class="mono">${k(v.views)}</b><span class="small muted">views</span></span><span class="muted" aria-hidden="true">›</span></a>`).join("");
  return `<div class="iscrim" data-ipclose></div><div class="ipop" role="dialog" aria-label="Chi tiết sản phẩm">
    <div class="ipop-h">${r.image ? `<img src="${esc(r.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : "<i></i>"}
      <div class="ipop-t"><b>${esc(r.name || r.sku)}</b><span class="small muted"><span class="mono" style="color:var(--ink)">${esc(r.sku)}</span>${r.group ? ` · ${esc(r.group)}` : ""}${r.price ? ` · từ ${money(r.price)}` : ""}</span>
        <span class="itag ${TAGC[r.tag]}" style="align-self:flex-start">${esc(r.tag_label)}</span></div>
      <button class="btn icon" type="button" data-ipclose aria-label="Đóng">✕</button></div>
    <div class="ipop-b"><div class="ipop-l">
      <div class="ik5"><div><small>Tồn mọi kho</small><b>${num(r.on_hand)}</b></div><div><small>≥ 30 ngày</small><b>${num(r.aged_qty || 0)}</b></div><div><small>Bán 30 ngày</small><b>${num(r.sold30)}</b></div>
        <div><small>Video SX · đăng</small><b>${num(r.made)} · ${num(r.posted)}</b></div><div><small>Views</small><b style="color:var(--accent)">${k(r.views)}</b></div></div>
      ${r.variants.length ? `<details class="ivwrap"><summary class="small muted">Tồn theo mã con · ${r.variants.length} mã${r.locations.length ? ` · ${r.locations.length} kho` : ""}</summary><div class="ivars">${r.variants.slice(0, 20).map((v) => `<span class="mono ell">${esc(v.sku)}</span><span class="mono" style="text-align:right;color:${v.on_hand <= 0 ? "var(--bad)" : "var(--ink)"}">${num(v.on_hand)}</span>
        <span class="mono muted" style="text-align:right">↓${num(v.sold30)}</span><span class="small muted ell" title="${esc(Object.entries(v.locations || {}).map(([l, q]) => `${l}: ${q}`).join(" · "))}">${v.age_days != null ? `${v.age_days} ngày · ` : ""}${esc(Object.keys(v.locations || {})[0] || v.status || "")}</span>`).join("")}</div></details>` : ""}
      <div class="ivh"><b>Video đã đăng của mã này</b><span class="small muted">${vids ? `${num(vids.total)} video · mới nhất trước` : ""}</span></div>
      <div class="ivids">${vlist}</div>
      ${vids && vids.total ? `<a class="small ivall" href="#/social/posts/sku/${encodeURIComponent(r.sku)}">Xem tất cả ${num(vids.total)} video đã đăng của ${esc(r.sku)} trong Đăng &amp; hiệu quả ›</a>` : ""}</div>
    <form class="ipop-r iplan" data-iplan><b>Kế hoạch video</b>
      <div style="display:flex;align-items:center;gap:8px"><span class="grow muted">Số video</span><button class="btn icon sm" type="button" data-icount="-1" aria-label="Bớt">−</button>
        <strong class="mono" style="min-width:28px;text-align:center;font-size:17px">${st.count}</strong><button class="btn icon sm" type="button" data-icount="1" aria-label="Thêm">+</button></div>
      <div><span class="small muted">Tuyến nội dung</span><div class="pills">${FAMS.map((f) => chip(st.fams.has(f), "data-ifam", f, f)).join("")}</div></div>
      <div><span class="small muted">Ngôn ngữ</span><div class="pills">${LANGS.map(([v, l]) => chip(st.langs.has(v), "data-ilang", v, l)).join("")}</div></div>
      ${hit ? `<div class="irule">Khớp quy tắc <b>“${esc(hit.name)}”</b>: ${esc(ruleSummary(hit, R))}${R.stats?.[hit.id]?.next ? ` · lần tới ${esc(R.stats[hit.id].next.slice(5).replace("-", "/"))}` : ""}</div>` : '<div class="small muted">Chưa khớp quy tắc nào đang bật.</div>'}
      <span class="grow"></span>
      ${r.footage ? `<button class="btn pri" type="button" data-igo>Tạo ${st.count} video ngay</button>
        <div style="display:flex;gap:8px"><select class="in" id="i-wf" aria-label="Workflow" style="flex:1;min-width:0;min-height:36px"><option value="">Đưa vào Workflow…</option>${wfs.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select>
        <button class="btn" type="button" data-iwf>Thêm</button></div>`
        : '<div class="small" style="color:var(--ai)">Sản phẩm chưa có footage: quay source và quét lại Kho footage để làm video.</div>'}
      <label class="small muted" style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="chk" data-ipause ${d.settings.pause_out ? "checked" : ""}> Hết hàng thì tự dừng làm video (mọi lịch tự động)</label></form></div></div>`;
}

function selBar(d, R, wfs) {
  if (!st.chk.size) return "";
  const ok = [...st.chk].filter((s) => d.rows.find((r) => r.sku === s)?.footage).length;
  return `<div class="isel" role="region" aria-label="Sản phẩm đã chọn"><b>Đã chọn ${st.chk.size} sản phẩm</b><span class="muted">· ${ok} có source</span>
    <button class="btn pri sm" type="button" data-imulti ${ok ? "" : "disabled"}>Tạo ${st.count} video × ${ok} SP</button>
    <select class="in" data-iaddrule aria-label="Thêm vào quy tắc"><option value="">Thêm vào quy tắc…</option>${(R.rules || []).map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}<option value="__new">+ Quy tắc mới với các mã này</option></select>
    <select class="in" data-iaddwf aria-label="Đưa vào Workflow"><option value="">Đưa vào Workflow…</option>${wfs.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select>
    <button class="btn sm ghost" type="button" data-iclear>Bỏ chọn</button></div>`;
}

// ---- rules dialog ----
const blankRule = () => ({ id: null, name: "Quy tắc mới", on: true, scope: { mode: "all", groups: [], skus: [] }, conds: [{ field: "on_hand", op: ">=", val: 50 }],
  action: { count: 2, families: ["A4"], langs: ["vi"], template_id: "auto", every: "week", time: "08:00", weekday: 0, max_per_day: 10, auto_render: true } });

function rulesView(R, draft, prev, groups, boot) {
  const F = R.fields || {};
  const list = (R.rules || []).map((x) => { const s = R.stats?.[x.id] || {}; return `<button type="button" class="rcard${st.rsel === x.id ? " on" : ""}" data-rsel="${esc(x.id)}">
      <span class="rc-h"><b>${esc(x.name)}</b><span class="chip ${x.on ? "ok" : ""}">${x.on ? "Đang bật" : "Tắt"}</span></span>
      <span class="small muted">${esc(ruleSummary(x, R))}</span>
      <span class="small mono" style="color:var(--ok)">${s.n != null ? `${num(s.n)} mã · ${num(s.ok)} lên kế hoạch${s.need ? ` · ${num(s.need)} cần quay` : ""}` : ""}</span></button>`; }).join("");
  const log = (R.log || []).slice(0, 6).map((l) => `<div class="small muted">${esc(l.at.slice(5))} · ${esc(l.name)}: ${l.videos ? `${l.videos} video cho ${l.skus.length} mã` : "không có mã mới"}</div>`).join("");
  const d = draft;
  const sc = d.scope;
  const a = d.action;
  const sel = (attr, opts, v) => `<select class="in" ${attr}>${opts.map(([k2, l]) => `<option value="${esc(k2)}" ${String(v) === String(k2) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  return `<div class="iscrim" data-rclose></div><div class="rdlg" role="dialog" aria-label="Quy tắc lên kế hoạch sản phẩm">
    <div class="rdlg-h"><h2>Quy tắc lên kế hoạch sản phẩm</h2><span class="small muted">Chạy theo giờ đặt của từng quy tắc · hôm nay đã tạo ${num(R.today?.videos || 0)} video</span>
      <button class="btn icon" type="button" data-rclose aria-label="Đóng">✕</button></div>
    <div class="rdlg-b"><aside class="rlist">${list || '<div class="small muted" style="padding:6px">Chưa có quy tắc nào.</div>'}
      <button class="btn rnew" type="button" data-rnew>+ Thêm quy tắc</button>${log ? `<div class="rlog"><b class="small">Lần chạy gần đây</b>${log}</div>` : ""}</aside>
    <section class="redit">
      <div class="rrow"><input class="in rname" data-rf="name" value="${esc(d.name)}" aria-label="Tên quy tắc"><label class="rtgl"><input type="checkbox" class="chk" data-rf="on" ${d.on ? "checked" : ""}> Đang bật</label></div>
      <div class="rsec"><b class="rlab">1 · Áp dụng cho</b>
        <div class="pills">${[["all", "Mọi sản phẩm"], ["groups", "Theo nhóm hàng"], ["skus", "Chọn mã SP"]].map(([v, l]) => chip(sc.mode === v, "data-rmode", v, l)).join("")}</div>
        ${sc.mode === "skus" ? `<div class="rchips">${sc.skus.map((s) => `<span class="rchip mono">${esc(s)}<button type="button" data-rskudel="${esc(s)}" aria-label="Bỏ ${esc(s)}">✕</button></span>`).join("")}
          <input class="rchip-in" id="r-skuin" list="r-skulist" placeholder="Gõ mã hoặc tên SP rồi Enter" aria-label="Thêm mã SP"></div>` : ""}
        ${sc.mode === "groups" ? `<div class="pills">${groups.map((g) => chip(sc.groups.includes(g), "data-rgroup", esc(g), esc(g))).join("")}</div>` : ""}</div>
      <div class="rsec"><b class="rlab">2 · Khi (tất cả điều kiện đều đúng)</b>
        ${d.conds.map((c, i) => `<div class="rcond" data-ci="${i}">${sel(`data-cf="field" aria-label="Chỉ số"`, Object.entries(F), c.field)}${sel(`data-cf="op" aria-label="So sánh"`, (R.ops || []).map((o) => [o, OPL[o]]), c.op)}
          <input class="in mono" data-cf="val" type="number" value="${esc(c.val)}" aria-label="Giá trị"><button class="btn icon sm" type="button" data-cdel="${i}" aria-label="Bỏ điều kiện">✕</button></div>`).join("")}
        <button class="btn sm ghost" type="button" data-cadd style="align-self:flex-start">+ Thêm điều kiện</button>
        <div class="rmust"><b>Phải có source trong Kho footage</b> · mã chưa có source không lên kế hoạch, vào danh sách “Cần quay footage”.</div></div>
      <div class="rsec"><b class="rlab">3 · Thì làm video</b>
        <div class="rgrid"><label>Số video mỗi mã<input class="in mono" type="number" min="0" max="20" data-ra="count" value="${a.count}"></label>
          <label>Lặp lại${sel('data-ra="every"', Object.entries(R.every || {}), a.every)}</label>
          ${a.every === "week" ? `<label>Thứ${sel('data-ra="weekday"', (R.weekdays || []).map((w, i) => [i, w]), a.weekday)}</label>` : ""}
          ${a.every !== "once" ? `<label>Giờ chạy<input class="in mono" type="time" data-ra="time" value="${esc(a.time)}"></label>` : ""}
          <label>Tối đa mỗi ngày<input class="in mono" type="number" min="1" max="200" data-ra="max_per_day" value="${a.max_per_day}"></label></div>
        <div class="rline"><span class="small muted">Tuyến</span><div class="pills">${FAMS.map((f) => chip(a.families.includes(f), "data-rfam", f, f)).join("")}</div>
          <span class="small muted">Ngôn ngữ</span><div class="pills">${LANGS.map(([v, l]) => chip(a.langs.includes(v), "data-rlang", v, l)).join("")}</div></div>
        <div class="rline"><span class="small muted">Template</span>${sel('data-ra="template_id" style="max-width:320px"', [["auto", "Tự chọn theo tuyến"], ...(boot.templates || []).map((t) => [t.id, t.label])], a.template_id)}
          <label class="rtgl"><input type="checkbox" class="chk" data-ra="auto_render" ${a.auto_render ? "checked" : ""}> Render HD xong tự xếp lịch đăng (theo kế hoạch kênh)</label></div></div>
      <div class="rprev"><div class="rprev-h"><b>Đang khớp</b>${prev ? `<span class="mono">${num(prev.n)} mã</span><span style="color:var(--ok)">${num(prev.ok)} có source → ${num(prev.videos)} video</span><span style="color:var(--warn)">${num(prev.need)} cần quay</span>${prev.next ? `<span class="small muted">lần tới ${esc(prev.next.slice(5))}</span>` : ""}` : '<span class="small muted is-busy">Đang tính…</span>'}</div>
        ${prev ? prev.rows.slice(0, 12).map((x) => `<div class="rprev-r"><span class="mono">${esc(x.sku)}</span><span class="ell">${esc(x.name || "")}</span><span class="mono" style="text-align:right">${num(x.on_hand)}</span>
          <span class="small muted" style="text-align:right">${x.footage ? `${num(x.clips)} clip` : "0 clip"}</span><span class="small" style="font-weight:600;color:${x.footage ? "var(--ok)" : "var(--warn)"}">${x.footage ? `${a.count * a.langs.length} video` : "Cần quay footage"}</span></div>`).join("") + (prev.n > 12 ? `<div class="small muted" style="padding:6px 12px">và ${num(prev.n - 12)} mã khác</div>` : "") : ""}</div>
    </section></div>
    <div class="rdlg-f">${d.id ? '<button class="btn danger" type="button" data-rdel>Xoá quy tắc</button>' : ""}<span class="grow"></span>
      ${d.id ? '<button class="btn" type="button" data-rrun>Chạy ngay</button>' : ""}<button class="btn pri" type="button" data-rsave>Lưu quy tắc</button></div></div>
    <datalist id="r-skulist"></datalist>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.className = "fscreen inv2";
  view.replaceChildren(el);
  let [d, R] = await Promise.all([api.inventory(), api.planRules().catch(() => ({ rules: [], stats: {}, fields: {}, ops: [], every: {}, weekdays: [] }))]);
  let wfs = [];
  let vids = null, draft = null, prev = null, prevT = 0;
  api.workflows().then((x) => { wfs = x.workflows || []; }).catch(() => {});
  if (ctx.params[0]) { st.pop = ctx.params[0].toUpperCase(); st.tab = "all"; st.q = st.pop; }
  const rowsNow = () => sorted(d.rows.filter((r) => match(r)));
  const groups = () => [...new Set(d.rows.map((r) => (r.group || "").split(">>")[0].trim()).filter(Boolean))].sort();
  let io = null;
  const watchMore = () => {
    io?.disconnect();
    const m = el.querySelector("#i-more");
    if (!m) return;
    io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { st.shown += 200; paintTable(); } }, { root: el.querySelector(".inv-body"), rootMargin: "400px" });
    io.observe(m);
  };
  const paintTable = () => { const b = el.querySelector(".inv-body"); const top = b.scrollTop; b.innerHTML = table(rowsNow()); b.scrollTop = top; watchMore(); };
  const paintSel = () => { el.querySelector("#i-sel").innerHTML = selBar(d, R, wfs); };
  const paintPop = () => { el.querySelector("#i-pop").innerHTML = st.pop ? popup(d.rows.find((r) => r.sku === st.pop), d, wfs, R, vids) : ""; };
  const paintRules = () => { el.querySelector("#i-rules").innerHTML = st.rulesOpen && draft ? rulesView(R, draft, prev, groups(), ctx.boot) : ""; };
  const openPop = async (sku) => {
    st.pop = sku; vids = null; paintPop();
    el.querySelectorAll("[data-isel]").forEach((x) => x.classList.toggle("on", x.dataset.isel === sku));
    try { const v = await api.inventoryVideos(sku); if (st.pop === sku) { vids = v; paintPop(); } } catch { if (st.pop === sku) { vids = { items: [], total: 0 }; paintPop(); } }
  };
  const preview = () => {
    clearTimeout(prevT);
    prevT = setTimeout(async () => { try { prev = await api.planRulePreview(draft); } catch (err) { prev = null; toast(err.message, true); } if (st.rulesOpen) { const sc = el.querySelector(".redit")?.scrollTop || 0; paintRules(); const e2 = el.querySelector(".redit"); if (e2) e2.scrollTop = sc; } }, 300);
  };
  const openRule = (id) => { st.rsel = id; const x = (R.rules || []).find((r) => r.id === id); draft = JSON.parse(JSON.stringify(x || blankRule())); prev = null; paintRules(); preview(); };
  const repaintRules = () => { const sc = el.querySelector(".redit")?.scrollTop || 0; paintRules(); const e2 = el.querySelector(".redit"); if (e2) e2.scrollTop = sc; preview(); };
  const paint = () => {
    const s = d.status;
    const rows = rowsNow();
    const counts = Object.fromEntries(TABS.map(([t]) => [t, d.rows.filter((r) => match(r, t)).length]));
    const nOn = (R.rules || []).filter((x) => x.on).length;
    el.innerHTML = `<header class="ph-bar"><h1>Kho hàng</h1><span class="small muted hide-m">đối chiếu tồn kho với footage để lên kế hoạch video</span><div class="sp"></div>
        <span class="small muted">${s.running ? `Đang đồng bộ · ${esc(s.step)}…` : s.at ? `Đồng bộ ${esc(s.at)}${s.snapshot ? ` · số liệu kho ngày ${esc(s.snapshot)}` : ""}` : "Chưa đồng bộ"}</span>
        <button class="btn" type="button" data-irefresh ${s.running ? "disabled" : ""}>Làm mới tồn kho</button>
        <button class="btn pri" type="button" data-irules>Quy tắc lên kế hoạch${nOn ? ` · ${nOn} đang bật` : ""}</button></header>
      <div class="inv-top">
        ${!s.configured ? '<div class="cost-alert">Chưa kết nối hệ thống kho. Điền <b>OMS API key</b> ở <a href="#/ai">Cài đặt › Khoá kết nối</a>.</div>' : ""}
        ${s.error ? `<div class="cost-alert">Lần đồng bộ gần nhất lỗi: ${esc(s.error)}</div>` : ""}
        <section class="kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))">
          <div class="kpi"><span class="kl">Sản phẩm có footage</span><strong class="kv">${num(d.kpis.footage)}</strong><span class="ks">${num(d.kpis.footage_in_oms)} khớp mã kho</span></div>
          <div class="kpi"><span class="kl">Còn hàng</span><strong class="kv" style="color:var(--ok)">${num(d.kpis.in_stock)}</strong><span class="ks">tồn > 0</span></div>
          <div class="kpi"><span class="kl">Tồn ≥ 30 ngày</span><strong class="kv" style="color:var(--warn)">${num(d.kpis.aged)}</strong><span class="ks">nên đẩy bằng video</span></div>
          <div class="kpi"><span class="kl">Có footage, hết hàng</span><strong class="kv" style="color:var(--bad)">${num(d.kpis.out)}</strong><span class="ks">${d.settings.pause_out ? "đang tự dừng làm video" : "chưa bật tự dừng"}</span></div>
          <div class="kpi"><span class="kl">Còn hàng, chưa có footage</span><strong class="kv" style="color:var(--ai)">${num(d.kpis.need_footage)}</strong><span class="ks">cần quay source</span></div></section>
        <section class="fbar"><div class="seg" role="group" aria-label="Lọc">${TABS.map(([t, l]) => `<button type="button" aria-pressed="${st.tab === t}" data-itab="${t}">${l}<span class="mono n">${num(counts[t])}</span></button>`).join("")}</div>
          <select class="in" data-igroup aria-label="Nhóm hàng"><option value="">Mọi nhóm hàng</option>${groups().map((g) => `<option ${st.group === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
          <select class="in" data-iloc aria-label="Kho"><option value="">Mọi kho</option>${(d.locations || []).map((l) => `<option ${st.loc === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
          <span class="ifl">Tồn<select data-iop aria-label="So sánh tồn"><option value="">—</option>${[">=", ">", "<=", "<", "="].map((o) => `<option value="${o}" ${st.op === o ? "selected" : ""}>${OPL[o]}</option>`).join("")}</select><input data-ival type="number" value="${esc(st.val)}" placeholder="số" aria-label="Số lượng tồn"></span>
          <label class="ifl"><input type="checkbox" class="chk" data-isrc ${st.src ? "checked" : ""}> Có source footage</label>
          <input class="in" id="i-q" type="search" placeholder="Tìm mã SP, tên sản phẩm" value="${esc(st.q)}" aria-label="Tìm"></section></div>
      <div class="inv-body noscroll">${table(rows)}</div>
      <div id="i-sel">${selBar(d, R, wfs)}</div><div id="i-pop"></div><div id="i-rules"></div>`;
    watchMore();
    if (st.pop) paintPop();
    if (st.rulesOpen) paintRules();
  };
  paint();
  if (st.pop) openPop(st.pop);
  let poll = null;
  const watch = () => { clearTimeout(poll); poll = setTimeout(async () => { d = await api.inventory(); paint(); if (d.status.running) watch(); else toast(d.status.error ? "Đồng bộ kho lỗi" : "Đã cập nhật tồn kho"); }, 3000); };
  if (d.status.running) watch();
  const reloadRules = async () => { R = await api.planRules(); };
  let qT = 0;
  el.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "i-q") { clearTimeout(qT); qT = setTimeout(() => { st.q = t.value; st.shown = 120; paintTable(); }, 150); return; }
    if (t.hasAttribute("data-ival")) { clearTimeout(qT); qT = setTimeout(() => { st.val = t.value; st.shown = 120; paintTable(); }, 200); return; }
    if (t.id === "r-skuin") {
      const q = t.value.trim().toLowerCase();
      const dl = el.querySelector("#r-skulist");
      if (dl) dl.innerHTML = q.length < 2 ? "" : d.rows.filter((r) => `${r.sku} ${r.name || ""}`.toLowerCase().includes(q)).slice(0, 20).map((r) => `<option value="${esc(r.sku)}">${esc(r.name || "")}</option>`).join("");
      return;
    }
    if (draft && t.dataset.rf === "name") { draft.name = t.value; return; }
  });
  el.addEventListener("keydown", (e) => {
    if (e.target.id === "r-skuin" && e.key === "Enter") {
      e.preventDefault();
      const v = e.target.value.trim().toUpperCase();
      const row = d.rows.find((r) => r.sku === v) || d.rows.find((r) => `${r.sku} ${r.name || ""}`.toUpperCase().includes(v));
      if (row && !draft.scope.skus.includes(row.sku)) { draft.scope.skus.push(row.sku); repaintRules(); el.querySelector("#r-skuin")?.focus(); }
      else if (!row) toast("Không thấy mã này trong kho", true);
    }
    if (e.key === "Escape") { if (st.rulesOpen) { st.rulesOpen = false; paintRules(); } else if (st.pop) { st.pop = null; paintPop(); el.querySelectorAll("tr.on").forEach((x) => x.classList.remove("on")); } }
  });
  el.addEventListener("change", async (e) => {
    const t = e.target;
    try {
      if (t.dataset.ichk) { if (t.checked) st.chk.add(t.dataset.ichk); else st.chk.delete(t.dataset.ichk); t.closest("tr")?.classList.toggle("ck", t.checked); paintSel(); return; }
      if (t.hasAttribute("data-ichkall")) { rowsNow().slice(0, st.shown).forEach((r) => (t.checked ? st.chk.add(r.sku) : st.chk.delete(r.sku))); paintTable(); paintSel(); return; }
      if (t.hasAttribute("data-igroup")) { st.group = t.value; st.shown = 120; paint(); return; }
      if (t.hasAttribute("data-iloc")) { st.loc = t.value; st.shown = 120; paint(); return; }
      if (t.hasAttribute("data-iop")) { st.op = t.value; st.shown = 120; paint(); return; }
      if (t.hasAttribute("data-isrc")) { st.src = t.checked; st.shown = 120; paint(); return; }
      if (t.hasAttribute("data-ipause")) { d.settings = await api.inventorySettings({ pause_out: t.checked }); toast(t.checked ? "Hết hàng sẽ tự dừng làm video" : "Đã tắt tự dừng khi hết hàng"); return; }
      if (t.hasAttribute("data-iaddrule") && t.value) {
        const skus = [...st.chk];
        if (t.value === "__new") { st.rulesOpen = true; st.rsel = null; draft = blankRule(); draft.scope = { mode: "skus", groups: [], skus }; draft.name = `Kế hoạch ${skus.length} SP`; prev = null; paintRules(); preview(); t.value = ""; return; }
        const r = await api.planRuleAddSkus(t.value, skus); toast(`Đã thêm ${skus.length} mã vào quy tắc “${r.name}”`); await reloadRules(); paintSel(); t.value = ""; return;
      }
      if (t.hasAttribute("data-iaddwf") && t.value) {
        const skus = [...st.chk].filter((s) => d.rows.find((r) => r.sku === s)?.footage);
        if (!skus.length) { toast("Các sản phẩm đã chọn chưa có footage", true); t.value = ""; return; }
        const r = await api.inventoryPlan({ skus, count: st.count, families: [...st.fams], langs: [...st.langs], workflow: t.value });
        toast(`Đã thêm ${skus.length} mã vào workflow “${r.workflow}”`); t.value = ""; return;
      }
      if (draft && t.dataset.rf === "on") { draft.on = t.checked; return; }
      const ci = t.closest("[data-ci]");
      if (draft && ci && t.dataset.cf) { const c = draft.conds[Number(ci.dataset.ci)]; c[t.dataset.cf] = t.dataset.cf === "val" ? Number(t.value) : t.value; preview(); return; }
      if (draft && t.dataset.ra) {
        const f = t.dataset.ra;
        draft.action[f] = f === "auto_render" ? t.checked : ["count", "weekday", "max_per_day"].includes(f) ? Number(t.value) : t.value;
        repaintRules(); return;
      }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("click", async (e) => {
    if (e.target.closest("[data-ipclose]")) { st.pop = null; paintPop(); el.querySelectorAll("tr.on").forEach((x) => x.classList.remove("on")); return; }
    if (e.target.closest("[data-rclose]")) { st.rulesOpen = false; paintRules(); return; }
    const tr = e.target.closest("[data-isel]");
    if (tr && !e.target.closest("input,button,a,label,.ick")) { openPop(tr.dataset.isel); return; }
    if (e.target.closest(".ivid, .ivall")) { st.pop = null; return; }          // the link opens Đăng & hiệu quả › Video đã đăng
    const b = e.target.closest("button");
    if (!b) return;
    try {
      if (b.dataset.itab) { st.tab = b.dataset.itab; st.shown = 120; paint(); return; }
      if (b.dataset.isort) { const key = b.dataset.isort; st.sort = st.sort.k === key ? { k: key, dir: -st.sort.dir } : { k: key, dir: -1 }; st.shown = 120; paintTable(); return; }
      if (b.hasAttribute("data-iclear")) { st.chk.clear(); paintTable(); paintSel(); return; }
      if (b.dataset.icount) { st.count = Math.max(1, Math.min(50, st.count + +b.dataset.icount)); paintPop(); paintSel(); return; }
      if (b.dataset.ifam) { if (st.fams.has(b.dataset.ifam) && st.fams.size > 1) st.fams.delete(b.dataset.ifam); else st.fams.add(b.dataset.ifam); paintPop(); return; }
      if (b.dataset.ilang) { if (st.langs.has(b.dataset.ilang) && st.langs.size > 1) st.langs.delete(b.dataset.ilang); else st.langs.add(b.dataset.ilang); paintPop(); return; }
      if (b.hasAttribute("data-irefresh")) { d.status = await api.inventoryRefresh(); d.status.running = true; paint(); watch(); return; }
      const plan = async (skus, workflow) => {
        const r = await api.inventoryPlan({ skus, count: st.count, families: [...st.fams], langs: [...st.langs], ...(workflow ? { workflow } : {}) });
        toast(workflow ? `Đã thêm vào workflow “${r.workflow}”` : `Đang tạo ${r.count} video cho ${r.skus.join(", ")} · xem ở tab Job`);
      };
      if (b.hasAttribute("data-igo")) { b.disabled = true; await plan([st.pop]); return; }
      if (b.hasAttribute("data-iwf")) { const w = el.querySelector("#i-wf").value; if (!w) { toast("Chọn workflow trước", true); return; } await plan([st.pop], w); return; }
      if (b.hasAttribute("data-imulti")) {
        const skus = [...st.chk].filter((s) => d.rows.find((r) => r.sku === s)?.footage);
        if (!skus.length) { toast("Các sản phẩm đã chọn chưa có footage", true); return; }
        b.disabled = true; await plan(skus); st.chk.clear(); paintTable(); paintSel(); return;
      }
      // rules dialog
      if (b.hasAttribute("data-irules")) { st.rulesOpen = true; await reloadRules(); openRule(st.rsel && (R.rules || []).some((x) => x.id === st.rsel) ? st.rsel : (R.rules || [])[0]?.id || null); return; }
      if (b.dataset.rsel) { openRule(b.dataset.rsel); return; }
      if (b.hasAttribute("data-rnew")) { openRule(null); return; }
      if (!draft) return;
      if (b.dataset.rmode) { draft.scope.mode = b.dataset.rmode; repaintRules(); return; }
      if (b.dataset.rgroup) { const g = b.dataset.rgroup; draft.scope.groups = draft.scope.groups.includes(g) ? draft.scope.groups.filter((x) => x !== g) : [...draft.scope.groups, g]; repaintRules(); return; }
      if (b.dataset.rskudel) { draft.scope.skus = draft.scope.skus.filter((x) => x !== b.dataset.rskudel); repaintRules(); return; }
      if (b.hasAttribute("data-cadd")) { draft.conds.push({ field: "sold30", op: ">=", val: 10 }); repaintRules(); return; }
      if (b.dataset.cdel) { draft.conds.splice(Number(b.dataset.cdel), 1); repaintRules(); return; }
      if (b.dataset.rfam) { const f = b.dataset.rfam; const a = draft.action; a.families = a.families.includes(f) ? (a.families.length > 1 ? a.families.filter((x) => x !== f) : a.families) : [...a.families, f]; repaintRules(); return; }
      if (b.dataset.rlang) { const f = b.dataset.rlang; const a = draft.action; a.langs = a.langs.includes(f) ? (a.langs.length > 1 ? a.langs.filter((x) => x !== f) : a.langs) : [...a.langs, f]; repaintRules(); return; }
      if (b.hasAttribute("data-rsave")) { draft.name = el.querySelector("[data-rf=name]")?.value || draft.name; const r = await api.planRuleSave(draft); toast("Đã lưu quy tắc"); await reloadRules(); openRule(r.id); paint(); return; }
      if (b.hasAttribute("data-rdel")) {
        if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Bấm lần nữa để xoá"; return; }
        await api.planRuleDelete(draft.id); toast("Đã xoá quy tắc"); await reloadRules(); openRule((R.rules || [])[0]?.id || null); paint(); return;
      }
      if (b.hasAttribute("data-rrun")) {
        if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = `Bấm lần nữa · tạo ${prev?.videos ?? "?"} video`; return; }
        b.disabled = true;
        const r = await api.planRuleRun(draft.id);
        const x = r.started[0];
        toast(x && x.videos ? `Đang tạo ${x.videos} video cho ${x.skus.length} mã · xem ở tab Job` : "Không có mã nào để làm (thiếu source hoặc đã đủ giới hạn ngày)");
        await reloadRules(); openRule(draft.id); return;
      }
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
  ctx.setShow?.(async () => { [d, R] = await Promise.all([api.inventory(), api.planRules().catch(() => R)]); paint(); });
  ctx.setUpdate?.(async (params) => { if (params[0]) { st.tab = "all"; st.q = params[0].toUpperCase(); paint(); openPop(params[0].toUpperCase()); } return true; });
  ctx.setCleanup(() => { clearTimeout(poll); io?.disconnect(); });
}
