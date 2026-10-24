// Đăng & hiệu quả: Video đã đăng · Lịch đăng theo page · Hiệu quả (AI phân tích từng video, PAAST, dựng, bài học) · Kết nối.
import { api, esc, toast } from "./admin-api.js";
import { moneyShort } from "../i18n.js";
import * as DR from "./date-range.js";
import { downloadXlsx, printReport, hbars, daily, shares, K as KR, fmtN } from "./report-tools.js";

const TABS = { posts: "Video đã đăng", schedule: "Lịch đăng", perf: "Hiệu quả", ads: "Quảng cáo", connect: "Kết nối" };
const PF = { facebook: ["FB", "#1877F2", "Facebook"], instagram: ["IG", "#C13584", "Instagram"], tiktok: ["TT", "#E11D48", "TikTok"],
  youtube: ["YT", "#CC0000", "YouTube"], threads: ["@", "#3A3C42", "Threads"] };
const AREA = { content: ["Content", "a3"], hook: ["Hook", "a5"], template: ["Template", "a4"], length: ["Độ dài", "a4"], schedule: ["Giờ đăng", "a2"], language: ["Ngôn ngữ", "a1"] };
const FAM = { A1: "Thu hút · kiến thức lạ", A2: "Chia sẻ kiến thức nghề", A3: "Câu chuyện thật", A4: "Chế tác · chốt đơn", A5: "Dấu ấn thương hiệu" };
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const ROLE = { hook: "HOOK", product_hero: "HOOK", huyk_talk: "HUYK", craft: "CHẾ TÁC", content_illustration: "NỘI DUNG", product_final: "HOÀN THIỆN", outro: "OUTRO" };
const k = (n) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(".", ",")}K` : String(Math.round(n)));
// VND short: 1,2 tỷ · 45,2tr · 850K
// (in other languages: short USD, e.g. $1.7K — see i18n.moneyShort); vndD adds "đ" in Vietnamese only
const vnd = (n) => moneyShort(n);
const vndD = (n) => moneyShort(n, true);
const num = (n) => (n == null ? "—" : Number(n).toLocaleString(globalThis.VCB_LOC || "vi-VN"));
const hrs = (s) => (s == null ? "—" : s >= 3600 ? `${Math.round(s / 3600).toLocaleString(globalThis.VCB_LOC || "vi-VN")} giờ` : s >= 60 ? `${Math.round(s / 60)} phút` : `${Math.round(s)}s`);
const pf = (p, big) => `<span class="pfchip${big ? " big" : ""}" style="background:${(PF[p] || PF.threads)[1]}">${(PF[p] || PF.threads)[0]}</span>`;
const sc = (s) => (s == null ? "" : s >= 60 ? "ok" : s >= 45 ? "mid" : "bad");
/** Cost warning colours (VND): CPM < 50K green · 50–100K yellow · > 100K red; cost per message ≤ 10K cheap · ≤ 20K average · > 20K expensive. */
const lvCpm = (v) => (!v ? "" : v > 100000 ? "bad" : v < 50000 ? "ok" : "mid");
const lvMsg = (v) => (!v ? "" : v > 20000 ? "bad" : v <= 10000 ? "ok" : "mid");
const lvl = (cls, text, tip) => (cls ? `<span class="lvl ${cls}" title="${tip}">${text}</span>` : text);
const cpmCell = (v) => lvl(lvCpm(v), v ? vnd(v) : "—", "CPM: dưới 50K xanh · 50–100K vàng · trên 100K đỏ");
const msgCell = (v) => lvl(lvMsg(v), v ? vnd(v) : "—", "Chi / tin nhắn: tới 10K rẻ · 10–20K trung bình · trên 20K đắt");
const soldCell = (r) => (r.sold == null ? '<span class="muted">—</span>' : `<b>${num(r.sold)}</b>${r.sold_orders ? `<span class="small muted" style="display:block">${num(r.sold_orders)} đơn</span>` : ""}`);
const s30Cell = (r) => (r.sold30 == null ? '<span class="muted">—</span>' : num(r.sold30));
const dmy = (d) => (d || "").slice(0, 10).split("-").reverse().slice(0, 2).join("/");
const st = { tab: "posts", by: "", pf: "", mk: "", team: "", page: "", q: "", sort: "created", shown: 60, cid: null, plist: "win", postDr: DR.load("posts", "all"), perfDr: DR.load("perf", "30d"), exDr: DR.load("social-exports", "all"), key: null, lessons: false };

/* ---------- Video đã đăng ---------- */
// a video belongs to a product when its caption has #<SKU> (or a sub-code N0017-05-S-WH) or its file name carries the SKU
const skuOf = (r) => {
  const t = ((r.title || "").match(/#[\w-]+/g) || []).map((x) => x.slice(1).toUpperCase());
  const ex = (r.export || "").split("_")[2];
  if (ex) t.push(ex.toUpperCase());
  return t;
};
const famOf = (r) => { const m = (r.title || "").match(/#a([1-5])(?![0-9a-z])/i); return m ? "A" + m[1] : ""; };
const MKN = { vn: "Việt Nam", us: "Mỹ / quốc tế", jp: "Nhật Bản", th: "Thái Lan", id: "Indonesia", tw: "Đài Loan", es: "Tây Ban Nha", it: "Ý" };
// SVG flags: Windows does not draw flag emoji
const FLAG = {
  vn: '<rect width="30" height="20" fill="#DA251D"/><polygon fill="#FFFF00" points="15,4 16.4,8.1 20.7,8.1 17.2,10.7 18.5,14.9 15,12.3 11.5,14.9 12.8,10.7 9.3,8.1 13.6,8.1"/>',
  us: '<rect width="30" height="20" fill="#fff"/>' + [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13}" fill="#B22234"/>`).join("") + '<rect width="13" height="10.8" fill="#3C3B6E"/>',
  jp: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>',
  th: '<rect width="30" height="20" fill="#A51931"/><rect y="3.33" width="30" height="13.34" fill="#F4F5F8"/><rect y="6.67" width="30" height="6.66" fill="#2D2A4A"/>',
  id: '<rect width="30" height="20" fill="#fff"/><rect width="30" height="10" fill="#CE1126"/>',
  tw: '<rect width="30" height="20" fill="#FE0000"/><rect width="15" height="10" fill="#000095"/><circle cx="7.5" cy="5" r="2.6" fill="#fff"/>',
  es: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
  it: '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/><rect x="20" width="10" height="20" fill="#CE2B37"/>',
};
const flag = (m) => `<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">${FLAG[m] || '<rect width="30" height="20" fill="#9AA0A6"/>'}</svg>`;
const hasSku = (r, s) => skuOf(r).some((x) => x === s || x.startsWith(s + "-") || x.startsWith(s + " "));
function postRows(lib) {
  const q = st.q.trim().toLowerCase();
  const rows = baseRows(lib).filter((r) => (!st.mk || r.market === st.mk) && (!st.fam || famOf(r) === (st.fam === "none" ? "" : st.fam)) && (!q || `${r.title} ${r.page}`.toLowerCase().includes(q)));
  const key = st.sort;
  return key === "created" ? rows : rows.slice().sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
}
// rows under the filters other than tuyến / thị trường (those two are what the breakdown boxes show)
function baseRows(lib) {
  const win = DR.resolve(st.postDr);
  return lib.rows.filter((r) => DR.inRange(r.created, win) && (!st.psku || hasSku(r, st.psku)) && (!st.by || r.by === st.by) && (!st.pf || r.platform === st.pf)
    && (!st.team || r.team === st.team) && (!st.page || r.page === st.page));
}

function splitView(lib) {
  const B = baseRows(lib);
  const tot = B.reduce((s, r) => s + (+r.views || 0), 0) || 1;
  const grp = (f) => { const g = {}; B.forEach((r) => { const x = f(r); (g[x] = g[x] || { n: 0, v: 0 }); g[x].n++; g[x].v += +r.views || 0; }); return g; };
  const fam = grp(famOf), mk = grp((r) => r.market || "");
  const row = (attr, id, on, label, o, color) => `<button type="button" class="srow" data-${attr}="${id}" aria-pressed="${on}">
      <span class="sl">${label}</span><span class="mono sn">${num(o.n)}</span><span class="mono sv">${k(o.v)}</span><span class="mono sa muted">${k(o.n ? o.v / o.n : 0)}</span>
      <span class="sbar"><i style="width:${Math.max(1, (o.v / tot) * 100).toFixed(1)}%;background:${color}"></i></span><span class="mono sp muted">${((o.v / tot) * 100).toFixed(1).replace(".", ",")}%</span></button>`;
  const head = '<div class="srow sh"><span class="sl"></span><span class="sn">Video</span><span class="sv">Views</span><span class="sa">TB view / video</span><span class="sbar"></span><span class="sp">% views</span></div>';
  const famRows = ["A1", "A2", "A3", "A4", "A5"].map((a) => row("sfam", a, st.fam === a, `<b class="fchip">${a}</b><span class="ell">${FAM[a]}</span>`, fam[a] || { n: 0, v: 0 }, "var(--accent)")).join("")
    + (fam[""] ? row("sfam", "none", st.fam === "none", '<b class="fchip none">—</b><span class="ell muted">Chưa gắn #a1–#a5</span>', fam[""], "var(--muted)") : "");
  const mkRows = Object.entries(mk).sort((a, b) => b[1].v - a[1].v).map(([m, o]) => row("smk", m || "none", st.mk === m && m !== "", `${flag(m)}<span class="ell">${esc(MKN[m] || (m ? m.toUpperCase() : "Chưa gán thị trường"))}</span>`, o, "var(--ai)")).join("");
  return `<section class="psplit"><div class="box sbox"><div class="sttl">Theo tuyến nội dung<span class="muted small">bấm để lọc video</span></div>${head}${famRows}</div>
    <div class="box sbox"><div class="sttl">Theo thị trường<span class="muted small">bấm để lọc video</span></div>${head}${mkRows}</div></section>`;
}

function postsView(lib) {
  const win = DR.resolve(st.postDr);
  const R = lib.rows.filter((r) => DR.inRange(r.created, win));
  const sum = (rs, f) => rs.reduce((s, r) => s + (+r[f] || 0), 0);
  const avg = (rs) => { const v = rs.filter((r) => r.score != null); return v.length ? Math.round(v.reduce((s, r) => s + r.score, 0) / v.length) : "—"; };
  const ai = R.filter((r) => r.by === "ai"), ed = R.filter((r) => r.by === "editor");
  const inter = sum(R, "likes") + sum(R, "comments") + sum(R, "shares") + sum(R, "saves");
  const pages = new Set(R.map((r) => r.page_id)).size;
  const kpi = (l, v, sub, cls = "") => `<div class="kpi"><span class="kl">${l}</span><strong class="kv">${v}</strong><span class="ks ${cls}">${sub}</span></div>`;
  const opts = (list, cur, all) => `<option value="">${all}</option>` + list.map((x) => `<option value="${esc(x[0])}" ${cur === x[0] ? "selected" : ""}>${esc(x[1])}</option>`).join("");
  const markets = [...new Set(R.map((r) => r.market).filter(Boolean))].map((m) => [m, m.toUpperCase()]);
  const pageList = [...new Set(R.map((r) => r.page).filter(Boolean))].sort().map((p) => [p, p]);
  const tab = (id, l, n) => `<button type="button" aria-pressed="${st.by === id}" data-by="${id}">${l}<span class="mono n">${n}</span></button>`;
  return `<section class="kpis">
      ${kpi("Video đã đăng", num(R.length), `${pages} page · ${new Set(R.map((r) => r.platform)).size} nền tảng`)}
      ${kpi("Lượt xem", k(sum(R, "views")), DR.label(st.postDr))}
      ${kpi("Thời gian xem", hrs(sum(R, "view_time_s")), "tổng các video")}
      ${kpi("Tương tác", sum(R, "views") ? ((inter / sum(R, "views")) * 100).toFixed(1).replace(".", ",") + "%" : "—", "thích + bình luận + chia sẻ")}
      ${kpi("AI đăng", num(ai.length), `điểm TB ${avg(ai)}`, "gold")}
      ${kpi("Editor đăng", num(ed.length), `điểm TB ${avg(ed)}`, "blue")}</section>
    <div id="p-split">${splitView(lib)}</div>
    <section class="fbar">
      <div class="seg" role="group" aria-label="Ai đăng">${tab("", "Tất cả", R.length)}${tab("ai", "AI đăng", ai.length)}${tab("editor", "Editor đăng", ed.length)}</div>
      <span class="vsep"></span>
      ${Object.keys(PF).filter((p) => R.some((r) => r.platform === p)).map((p) => `<button type="button" class="pill" data-fpf="${p}" aria-pressed="${st.pf === p}">${pf(p)} ${PF[p][2]}</button>`).join("")}
      ${DR.html("posts", st.postDr)}
      <div style="flex:1"></div>
      <label class="small muted">Thị trường <select class="in" data-f="mk">${opts(markets, st.mk, "Tất cả")}</select></label>
      <label class="small muted">Team <select class="in" data-f="team">${opts(lib.teams.map((t) => [t, t]), st.team, "Tất cả")}</select></label>
      <label class="small muted">Page <select class="in" data-f="page" style="max-width:180px">${opts(pageList, st.page, "Tất cả")}</select></label>
      <label class="small muted">Sắp xếp <select class="in" data-f="sort">${[["created", "Mới nhất"], ["views", "Lượt xem"], ["score", "Điểm hiệu quả"], ["view_time_s", "Thời gian xem"], ["er", "Tương tác"], ["comments", "Bình luận"], ["shares", "Chia sẻ"]]
        .map(([v, l]) => `<option value="${v}" ${st.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <input class="in" id="p-q" type="search" placeholder="Tìm mô tả, page" value="${esc(st.q)}" style="width:200px" aria-label="Tìm video">
      ${st.fam ? `<button class="chip ok" type="button" data-sfam="${st.fam}" title="Bỏ lọc tuyến" style="border:0;cursor:pointer">Tuyến: <b class="mono">${st.fam === "none" ? "chưa gắn" : st.fam}</b> ✕</button>` : ""}
      ${st.psku ? `<button class="chip ok" type="button" data-clearsku title="Bỏ lọc mã sản phẩm" style="border:0;cursor:pointer">Mã SP: <b class="mono">${esc(st.psku)}</b> ✕</button>` : ""}</section>
    <div id="p-grid">${postGrid(lib)}</div>`;
}

function postGrid(lib) {
  const rows = postRows(lib);
  if (!rows.length) return `<div class="empty">${lib.rows.length ? "Không có video khớp bộ lọc." : 'Chưa có dữ liệu. Vào tab <a href="#/social/connect">Kết nối</a>, kết nối page rồi bấm "Cào tất cả".'}</div>`;
  return `<div class="vgrid">${rows.slice(0, st.shown).map((r) => `<a class="vcard${r.win ? " win" : ""}" href="#/social/perf/${encodeURIComponent(r.key)}">
      <span class="vth">${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <span class="vb tl ${r.by}">${r.by === "ai" ? "AI đăng" : "Editor đăng"}</span><span class="vb tr">${pf(r.platform)}</span>
        ${r.win ? '<span class="vb wn">CONTENT WIN</span>' : ""}${r.ads ? `<span class="vb ads${r.ads.active ? " on" : ""}" title="${r.ads.ads} quảng cáo${r.ads.active ? ` · ${r.ads.active} đang chạy` : ""} · chi ${vndD(r.ads.spend)}">ADS · ${vnd(r.ads.spend)}</span>` : ""}
        <span class="vb bl mono">${esc((r.market || "").toUpperCase())}</span>${r.duration ? `<span class="vb br mono">${Math.floor(r.duration / 60)}:${String(Math.round(r.duration % 60)).padStart(2, "0")}</span>` : ""}</span>
      <span class="vbody"><span class="vt">${esc(r.title || "(không có mô tả)")}</span>
        <span class="small muted ell">${esc(r.page || "")} · ${dmy(r.created)}</span>
        <span class="vm mono"><span title="Lượt xem">${k(r.views)}</span><span class="muted" title="Xem trung bình">${r.avg_watch_s != null ? String(r.avg_watch_s).replace(".", ",") + "s" : "—"}</span>
          <span class="muted" title="Tương tác">${r.er != null ? String(r.er).replace(".", ",") + "%" : "—"}</span><span style="flex:1"></span>${r.score != null ? `<span class="score ${sc(r.score)}">${r.score}</span>` : ""}</span></span></a>`).join("")}</div>
    ${rows.length > st.shown ? `<div style="text-align:center"><button class="btn" type="button" data-more>Xem thêm (${rows.length - st.shown})</button></div>` : ""}`;
}

/* ---------- Lịch đăng ---------- */
const STATUS = { scheduled: "chờ đăng", pending: "chờ duyệt", published: "đã đăng", draft_sent: "ở hộp thư", error: "lỗi", publishing: "đang đăng" };
function scheduleView(lib, d, ex) {
  if (!lib.channels.length) return '<div class="empty">Chưa có kênh nào. Vào tab <a href="#/social/connect">Kết nối</a> để kết nối Facebook / Instagram / TikTok.</div>';
  const chs = lib.channels.filter((c) => (!st.team || c.team === st.team) && (!st.chq || c.name.toLowerCase().includes(st.chq.toLowerCase())));
  if (!lib.channels.some((c) => c.cid === st.cid)) st.cid = (chs[0] || lib.channels[0]).cid;
  st.upc = {}; d.posts.forEach((x) => { if (["scheduled", "pending"].includes(x.status)) st.upc[x.cid] = (st.upc[x.cid] || 0) + 1; });
  return `<div class="split fix"><button type="button" class="chscrim" data-chclose aria-label="Đóng danh sách kênh"></button><section class="box side" id="s-side">
      <div class="sq-day" style="display:grid;gap:8px"><div style="display:flex;gap:8px;align-items:center">Kênh <span class="mono muted">${chs.length}</span><div style="flex:1"></div>
        <select class="in" data-f="team" aria-label="Lọc team" style="width:auto;min-height:30px"><option value="">Mọi team</option>${lib.teams.map((t) => `<option ${st.team === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><button type="button" class="btn icon sm mob" data-chclose aria-label="Đóng">✕</button></div>
        <input class="in" id="ch-q" type="search" placeholder="Tìm kênh" value="${esc(st.chq || "")}" style="min-height:30px" aria-label="Tìm kênh"></div>
      <div id="ch-list">${chList(chs)}</div></section>
    <div class="main" id="s-main">${scheduleMain(lib, d, ex)}</div></div>`;
}

function chList(chs) {
  return chs.map((c) => `<button type="button" class="chrow" aria-pressed="${c.cid === st.cid}" data-cid="${esc(c.cid)}">${pf(c.platform)}
      <span class="chn"><b class="ell">${esc(c.name)}</b><span class="small muted">${esc(c.team || "Chưa gán team")} · ${c.plan.auto ? `${c.plan.per_day} bài/ngày${c.plan.auto_pick ? " · tự bốc" : ""}` : "tắt tự đăng"}${st.upc?.[c.cid] ? ` · <b style="color:var(--accent)">${st.upc[c.cid]} bài chờ</b>` : ""}</span></span>
      <span class="chip mono">${esc((c.market || "").toUpperCase())}</span><span class="dot ${c.plan.auto && c.track ? "on" : ""}"></span></button>`).join("") || '<div class="empty small">Không có kênh khớp.</div>';
}

// Board card state: green = posted, yellow = waiting, red = failed (with the reason), blue = uploading now.
function wstate(m) {
  const k = { published: "ok", draft_sent: "ok", error: "bad", publishing: "info" }[m.status] || "wait";
  const label = { published: "✓ Đã đăng", draft_sent: "✓ Đã gửi hộp thư TikTok", error: "✕ Lỗi", publishing: "Đang đăng…", pending: "Chờ duyệt" }[m.status] || "Chờ đăng";
  return `<span class="wst ${k}">${label}</span>${m.status === "error" && m.error ? `<span class="werr">${esc(m.error)}</span>` : ""}`;
}

function scheduleMain(lib, d, ex) {
  const cur = lib.channels.find((c) => c.cid === st.cid) || lib.channels[0];
  const p = cur.plan;
  const pending = d.posts.filter((x) => x.status === "pending").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const total = Object.values(p.mix).reduce((s, v) => s + v, 0) || 1;
  const mix = Object.keys(FAM).map((f) => `<div class="mixrow"><span class="fam ${f.toLowerCase()}">${f}</span><span>${FAM[f]}</span>
      <input type="range" min="0" max="60" step="5" value="${p.mix[f] || 0}" data-mix="${f}" aria-label="Tỉ lệ ${f}"><span class="mono">${Math.round(((p.mix[f] || 0) / total) * 100)}%</span></div>`).join("");
  const now = new Date();
  const week = [...Array(7)].map((_, i) => { const x = new Date(now); x.setDate(now.getDate() + i); return x; });
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const mine = d.posts.filter((x) => x.cid === cur.cid && x.status !== "cancelled");
  const slots = (p.slots || []).slice(0, Math.max(p.per_day, 0));
  const board = week.map((x) => {
    const day = iso(x), wd = (x.getDay() + 6) % 7;
    const posts = mine.filter((m) => m.scheduled_at.startsWith(day));
    const free = p.auto && p.days.includes(wd) ? slots.filter((t) => !posts.some((m) => m.scheduled_at.endsWith(t))) : [];
    return `<div class="wcol"><span class="wd">${DAYS[wd]} ${dmy(day)}</span>
      ${posts.map((m) => `<button type="button" class="witem ${m.status}${st.editPost === m.id ? " sel" : ""}" data-editpost="${esc(m.id)}" title="Bấm để đổi giờ / đăng ngay / bỏ"><span class="mono small">${m.scheduled_at.slice(11)} · <span class="fam-t ${(m.meta?.family || "").toLowerCase()}">${esc(m.meta?.family || "")}</span></span>
        <span class="wt">${esc(m.meta?.title || m.export)}</span>${wstate(m)}</button>`).join("")}
      ${free.map((t) => `<span class="witem empty-slot"><span class="mono small">${t}</span><span class="small muted">Trống · ${p.auto_pick ? "AI sẽ bốc video" : "chọn video bên dưới"}</span></span>`).join("")}</div>`;
  }).join("");
  const sel = (v, l) => `<option value="${v}" ${p.approve === v ? "selected" : ""}>${l}</option>`;
  const wday = Math.min(st.wday || 0, 6);
  const DOT = { published: "ok", draft_sent: "ok", error: "bad", publishing: "info" };
  const strip = `<nav class="wdays mob" aria-label="Chọn ngày">${week.map((x, i) => { const day = iso(x); const ps = mine.filter((m) => m.scheduled_at.startsWith(day));
    return `<button type="button" data-wday="${i}" aria-pressed="${i === wday}"><span class="small">${DAYS[(x.getDay() + 6) % 7]}</span><b class="mono">${x.getDate()}</b>
      <span class="wdots">${ps.slice(0, 4).map((m) => `<i class="${DOT[m.status] || "wait"}"></i>`).join("")}</span></button>`; }).join("")}</nav>`;
  const chBtn = `<button type="button" class="chpick mob" data-chopen>${pf(cur.platform)}<span class="chn"><b class="ell">${esc(cur.name)}</b><span class="small muted">${esc((cur.market || "").toUpperCase())} · ${esc(cur.team || "Chưa gán team")}${st.upc?.[cur.cid] ? ` · ${st.upc[cur.cid]} bài chờ` : ""}</span></span><span class="small muted">Đổi kênh</span></button>`;
  return `${chBtn}${pending.length ? `<section class="box"><div class="sq-day">Chờ duyệt · ${pending.length} bài <span class="muted small" style="font-weight:400">AI đã xếp lịch, Editor duyệt thì mới đăng</span></div>
        ${pending.slice(0, 12).map((x) => `<div class="sq">${pf(x.platform)}<span class="mono small" style="width:96px">${dmy(x.scheduled_at)} ${x.scheduled_at.slice(11)}</span>
          <span class="sq-t"><b>${esc(x.meta?.title || x.export)}</b><span class="small muted">${esc(x.channel || "")} · ${esc(x.meta?.family || "")}</span></span>
          <a class="btn sm" href="#/exports/${encodeURIComponent(x.export)}">Xem</a><button class="btn sm pri" type="button" data-approve="${esc(x.id)}">Duyệt</button>
          <button class="btn sm danger" type="button" data-cancel="${esc(x.id)}">Bỏ</button></div>`).join("")}</section>` : ""}
      <section class="box plansum mob"><span class="chn"><b>${p.auto ? `${p.per_day} bài/ngày · tự đăng` : "Tắt tự đăng"}</b><span class="small muted mono">${(p.slots || []).slice(0, p.per_day).join(" · ")}${p.approve === "editor" ? " · cần Editor duyệt" : ""}</span></span>
        <button class="btn sm" type="button" data-planopen>${st.planOpen ? "Thu gọn" : "Sửa lịch"}</button></section>
      <section class="box pad plan${st.planOpen ? " open" : ""}">
        <div class="plan-h">${pf(cur.platform, true)}<strong style="font-size:16px">${esc(cur.name)}</strong><span class="chip mono">${esc((cur.market || "").toUpperCase())}</span>
          ${cur.team ? `<span class="chip blue">${esc(cur.team)}</span>` : '<span class="chip">Chưa gán team</span>'}${cur.via ? `<span class="small muted">qua ${esc(cur.via)}</span>` : ""}
          <div style="flex:1"></div><span class="muted">Tự đăng</span><button class="switch" type="button" role="switch" aria-checked="${p.auto}" data-pauto aria-label="Tự đăng cho kênh này"></button></div>
        <div class="plan-g">
          <div><span class="lbl">Số bài mỗi ngày</span><div class="stepper"><button class="btn icon" type="button" data-per="-1" aria-label="Bớt một bài">−</button><strong class="mono">${p.per_day}</strong><button class="btn icon" type="button" data-per="1" aria-label="Thêm một bài">+</button></div></div>
          <div><span class="lbl">Ngày đăng</span><div class="days">${DAYS.map((l, i) => `<button type="button" class="dbtn" aria-pressed="${p.days.includes(i)}" data-day="${i}">${l}</button>`).join("")}</div></div>
          <div><span class="lbl">Trước khi đăng</span><select class="in" data-approve-mode>${sel("editor", "Cần Editor duyệt")}${sel("ai60", "AI tự đăng khi điểm dự đoán ≥ 60")}${sel("ai_all", "AI tự đăng tất cả")}</select></div></div>
        <div><span class="lbl">Khung giờ đăng <span class="muted" style="font-weight:400">· dùng ${Math.min(p.per_day, p.slots.length)} giờ đầu cho ${p.per_day} bài/ngày</span></span>
          <div class="slots">${p.slots.map((t) => `<span class="slot mono">${t}<button type="button" data-rmslot="${t}" aria-label="Bỏ khung giờ ${t}">✕</button></span>`).join("")}
            <input class="in mono" type="time" id="s-new" style="width:auto;min-height:32px" aria-label="Giờ mới"><button class="btn sm" type="button" data-addslot>+ Thêm giờ</button>
            <button class="btn sm gold" type="button" data-golden>Dùng giờ vàng AI gợi ý</button></div></div>
        <div><span class="lbl">Loại nội dung đăng <span class="muted" style="font-weight:400">· tỉ lệ trong tuần</span></span>${mix}
          <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" class="chk" data-aimix ${p.ai_mix ? "checked" : ""}> Để AI tự điều chỉnh tỉ lệ theo bài học hiệu quả</label></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="small muted">Video ${esc((cur.lang || "vi").toUpperCase())} xuất xong sẽ tự vào khung giờ trống của kênh này khi bật Tự đăng.</span><div style="flex:1"></div>
          <button class="btn pri" type="button" data-saveplan>Lưu lịch</button></div></section>
      <section class="box wkbox"><div class="sq-day" style="display:flex;gap:10px;align-items:center">7 ngày tới · ${esc(cur.name)}<div style="flex:1"></div>
        <span class="small muted">Bấm một bài để đổi giờ</span><span class="small muted"><span class="lgd ok"></span>Đã đăng</span><span class="small muted"><span class="lgd wait"></span>Chờ đăng</span><span class="small muted"><span class="lgd bad"></span>Lỗi</span><span class="small muted"><span class="lgd dash"></span>Trống</span></div>
        ${strip}${postEditor(mine)}<div class="week" data-day="${wday}">${board}</div></section>
      ${exportsPicker(cur, d, ex)}`;
}

function postEditor(mine) {
  const m = mine.find((x) => x.id === st.editPost);
  if (!m) return "";
  const editable = ["scheduled", "pending", "error"].includes(m.status);
  return `<div class="pedit"><img src="/api/exports/thumb?name=${encodeURIComponent(m.export)}" alt="" onerror="this.style.visibility='hidden'">
    <div class="chn"><b>${esc(m.meta?.title || m.export)}</b><span class="small muted">${esc(m.meta?.family || "")} · ${esc((m.meta?.lang || "vi").toUpperCase())} · ${STATUS[m.status] || m.status}${m.error ? ` · <span style="color:var(--bad)">${esc(m.error)}</span>` : ""}</span>
      ${editable ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
        <label class="small muted" style="display:flex;gap:6px;align-items:center">Giờ đăng <input class="in mono" type="datetime-local" id="pe-when" value="${esc(m.scheduled_at.replace(" ", "T"))}" style="width:auto;min-height:32px"></label>
        <button class="btn sm pri" type="button" data-pesave="${esc(m.id)}">Lưu giờ</button>
        ${m.status === "pending" ? `<button class="btn sm" type="button" data-approve="${esc(m.id)}">Duyệt</button>` : ""}
        <button class="btn sm" type="button" data-penow="${esc(m.id)}">${m.status === "error" ? "Đăng lại ngay" : "Đăng ngay"}</button>
        <button class="btn sm danger" type="button" data-cancel="${esc(m.id)}">Bỏ khỏi lịch</button>
        <a class="btn sm" href="#/exports/${encodeURIComponent(m.export)}">Xem video</a></div>` : `<div class="small muted" style="margin-top:6px">${m.status === "publishing" ? "Đang tải video lên, xong sẽ chuyển xanh." : m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Mở bài đã đăng ↗</a>` : "Bài đã đăng, không đổi giờ được."}</div>`}</div>
    <button class="btn icon sm" type="button" data-peclose aria-label="Đóng">✕</button></div>`;
}

const LANGS = { vi: "VN", en: "US", ja: "JP", th: "TH", es: "ES", id: "ID", zh: "TW", it: "IT" };
function exportsPicker(cur, d, ex) {
  const p = cur.plan;
  const head = `<div class="sq-day" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Video đã xuất · chọn để lên lịch<div style="flex:1"></div>
      <span class="small muted" style="font-weight:400">Tự bốc ngẫu nhiên đủ ${p.per_day} bài/ngày</span><button class="switch" type="button" role="switch" aria-checked="${!!p.auto_pick}" data-autopick aria-label="Tự bốc video"></button>
      <button class="btn sm" type="button" data-fillnow ${p.auto && p.auto_pick ? "" : "disabled"} title="${p.auto ? "" : "Bật Tự đăng trước"}">Bốc ngay</button></div>`;
  if (!ex) return `<section class="box">${head}<div class="empty small">Đang tải danh sách video…</div></section>`;
  const used = {};
  d.posts.filter((x) => x.status !== "cancelled").forEach((x) => { (used[x.export] ||= new Set()).add(x.cid); });
  const lang = st.exLang ?? (cur.lang || "vi");
  const langs = [...new Set(ex.map((x) => x.lang || "vi"))];
  const days = [...new Set(ex.map((x) => x.made))].sort().reverse();
  const items = ex.filter((x) => (!lang || (x.lang || "vi") === lang) && DR.inRange(x.made, DR.resolve(st.exDr)) && (!st.exFam || x.family === st.exFam)
    && ((st.exState || "new") !== "new" || !(used[x.name] || new Set()).has(cur.cid)) && (!st.exQ || `${x.title} ${x.sku}`.toLowerCase().includes(st.exQ.toLowerCase())));
  const fams = [...new Set(ex.map((x) => x.family).filter(Boolean))].sort();
  const cards = items.slice(0, st.exShown || 48).map((x) => {
    const u = used[x.name] || new Set(), here = u.has(cur.cid), others = [...u].filter((c) => c !== cur.cid).length;
    return `<label class="vcard pick${here ? " done" : ""}">
      <span class="vth"><img src="/api/exports/thumb?name=${encodeURIComponent(x.name)}" alt="" loading="lazy" onerror="this.remove()">
        <span class="vb tl" style="background:rgba(0,0,0,.6);color:#fff">${esc(x.family || "—")}</span><span class="vb tr mono" style="background:rgba(0,0,0,.6);color:#fff;padding:3px 7px">${esc(LANGS[x.lang || "vi"] || (x.lang || "").toUpperCase())}</span>
        <input type="checkbox" class="chk pickbox" data-expick="${esc(x.name)}" ${here ? "disabled" : ""} aria-label="Chọn ${esc(x.title)}">
        <span class="vb bl mono">${dmy(x.made)}</span>
        ${here ? '<span class="vb wn" style="background:var(--ok);color:#fff">ĐÃ CÓ TRÊN KÊNH</span>' : others ? `<span class="vb wn" style="background:#2B4A6B;color:#DCEBFA">ĐÃ DÙNG ${others} KÊNH</span>` : ""}</span>
      <span class="vbody"><span class="vt">${esc(x.title)}</span><span class="small muted ell">${esc(x.sku || "")}</span></span></label>`;
  }).join("");
  const opt = (v, l, cur2) => `<option value="${esc(v)}" ${cur2 === v ? "selected" : ""}>${esc(l)}</option>`;
  return `<section class="box">${head}
    <div class="fbar" style="padding:0 16px 12px">
      <div class="seg" role="group" aria-label="Quốc gia">${[["", "Mọi nước"], ...langs.map((l) => [l, LANGS[l] || l.toUpperCase()])].map(([v, l]) => `<button type="button" aria-pressed="${lang === v}" data-exlang="${v}">${l}${v === (cur.lang || "vi") ? " ·kênh" : ""}</button>`).join("")}</div>
      ${DR.html("social-exports", st.exDr)}
      <select class="in" data-exfam aria-label="Tuyến" style="width:auto;min-height:32px">${opt("", "Mọi tuyến", st.exFam || "")}${fams.map((x) => opt(x, x, st.exFam || "")).join("")}</select>
      <select class="in" data-exstate aria-label="Trạng thái" style="width:auto;min-height:32px">${opt("new", "Chưa có trên kênh này", st.exState || "new")}${opt("all", "Tất cả", st.exState || "new")}</select>
      <input class="in" id="ex-q" type="search" placeholder="Tìm tên, mã SP" value="${esc(st.exQ || "")}" style="width:180px;min-height:32px" aria-label="Tìm video">
      <div style="flex:1"></div><span class="small muted">${items.length} video</span>
      <button class="btn sm" type="button" data-expickall>Chọn tất cả</button><button class="btn sm" type="button" data-expicknone>Bỏ chọn</button>
      <button class="btn sm pri" type="button" data-exsched>Lên lịch video đã chọn</button></div>
    ${cards ? `<div class="vgrid" style="padding:0 16px 16px">${cards}</div>` : '<div class="empty small">Không có video khớp bộ lọc.</div>'}
    ${items.length > (st.exShown || 48) ? `<div style="text-align:center;padding:0 0 14px"><button class="btn sm" type="button" data-exmore>Xem thêm (${items.length - (st.exShown || 48)})</button></div>` : ""}</section>`;
}

/* ---------- Hiệu quả ---------- */
function perfList(lib) {
  const win = DR.resolve(st.perfDr);
  let rows = lib.rows.filter((r) => r.views != null && DR.inRange(r.created, win) && (!st.ppf || r.platform === st.ppf) && (!st.pmk || r.market === st.pmk));
  rows = st.plist === "win" ? rows.filter((r) => r.win).sort((a, b) => b.views - a.views)
    : st.plist === "lose" ? rows.filter((r) => r.score != null && r.score < 40).sort((a, b) => a.score - b.score) : rows.sort((a, b) => b.views - a.views);
  return rows;
}

function perfTools(lib, winViews) {
  const mks = [...new Set(lib.rows.map((r) => r.market).filter(Boolean))];
  return `<div class="seg" role="group" aria-label="Nhóm">${[["win", "Content win"], ["lose", "Kém"], ["all", "Tất cả"]].map(([v, l]) => `<button type="button" aria-pressed="${st.plist === v}" data-plist="${v}">${l}</button>`).join("")}</div>
    <label class="small muted" style="display:flex;gap:6px;align-items:center">Content win từ <input class="in mono" id="win-v" type="number" min="1000" step="10000" value="${winViews}" style="width:110px;min-height:32px"> view
      <button class="btn sm" type="button" data-savewin>Áp dụng</button></label>
    ${DR.html("perf", st.perfDr)}
    <select class="in" data-pf2 aria-label="Nền tảng" style="width:auto;min-height:32px"><option value="">Mọi nền tảng</option>${["facebook", "instagram", "tiktok"].map((x) => `<option value="${x}" ${st.ppf === x ? "selected" : ""}>${PF[x][2]}</option>`).join("")}</select>
    <select class="in" data-pmk aria-label="Thị trường" style="width:auto;min-height:32px"><option value="">Mọi thị trường</option>${mks.map((m) => `<option value="${m}" ${st.pmk === m ? "selected" : ""}>${m.toUpperCase()}</option>`).join("")}</select>`;
}

// ---------- Hiệu quả theo SKU / nhân viên / content (from caption hashtags + the system's jobs) ----------
const BD = {};
let bdPaint = null;
const PMODES = [["video", "Từng video"], ["sku", "Theo SPU"], ["staff", "Theo nhân viên"], ["content", "Theo content"]];
const pmodeSeg = () => `<div class="seg" role="group" aria-label="Xem theo">${PMODES.map(([v, l]) => `<button type="button" aria-pressed="${(st.pmode || "video") === v}" data-pmode="${v}">${l}</button>`).join("")}</div>`;
function breakdownView(lib) {
  const by = st.pmode;
  const [df, dt] = DR.resolve(st.perfDr);
  const q = { date_from: df, date_to: dt, market: st.pmk || "", source: st.psrc || "" };
  const key = `${by}|${df}|${dt}|${q.market}|${q.source}`;
  const d = BD[key];
  const mks = [...new Set(lib.rows.map((r) => r.market).filter(Boolean))];
  const tools = `<section class="fbar">${pmodeSeg()}
    ${DR.html("perf", st.perfDr)}
    <select class="in" data-pmk aria-label="Thị trường" style="width:auto;min-height:32px"><option value="">Mọi thị trường</option>${mks.map((m) => `<option value="${m}" ${st.pmk === m ? "selected" : ""}>${m.toUpperCase()}</option>`).join("")}</select>
    <select class="in" data-psrc aria-label="Nguồn video" style="width:auto;min-height:32px">${[["", "AI + Editor"], ["ai", "AI đăng"], ["editor", "Editor đăng"]].map(([v, l]) => `<option value="${v}" ${(st.psrc || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    <input class="in" id="b-q" type="search" placeholder="${by === "sku" ? "Tìm SPU, tên sản phẩm" : by === "staff" ? "Tìm mã nhân viên" : "Tìm content"}" value="${esc(st.bq || "")}" style="width:210px;min-height:32px" aria-label="Tìm">
    <div style="flex:1"></div><span class="small muted">${d ? `${num(d.videos)} video · ${num(d.tagged)} có mã trong caption` : ""}</span>
    <button class="btn sm" type="button" data-bxlsx ${d ? "" : "disabled"}>Xuất Excel</button><button class="btn sm" type="button" data-report>Báo cáo PDF</button></section>`;
  if (!d) {
    if (!BD["_" + key]) {
      BD["_" + key] = 1;
      api.socialBreakdown(by, q).then((x) => { BD[key] = x; bdPaint?.(); }).catch((err) => { delete BD["_" + key]; toast(err.message, true); });
    }
    return `${tools}<div class="empty is-busy">Đang tổng hợp…</div>`;
  }
  const H = { sku: ["SPU", "Sản phẩm", "Video SX"], staff: ["Nhân viên", "", "Video"], content: ["", "Content", "Số bản"] }[by];
  const sk = st.bsort || "views", dir = st.bdir || -1, PER = 30;
  const bq = (st.bq || "").trim().toLowerCase();
  const all = d.rows.filter((r) => !bq || `${r.code || ""} ${r.name || ""}`.toLowerCase().includes(bq))
    .sort((a, b) => sk === "name" ? dir * String(a.name || a.code).localeCompare(String(b.name || b.code)) : dir * ((a[sk] || 0) - (b[sk] || 0)));
  const T = all.reduce((t, r) => ({ made: t.made + (r.made || 0), posted: t.posted + (r.posted || 0), views: t.views + (r.views || 0), ads: t.ads + (r.ads_spend || 0), act: t.act + (r.ads_active || 0), sold: t.sold + (r.sold || 0), so: t.so + (r.sold_orders || 0), s30: t.s30 + (r.sold30 || 0) }),
    { made: 0, posted: 0, views: 0, ads: 0, act: 0, sold: 0, so: 0, s30: 0 });
  const totRow = all.length ? `<tr class="btot">${H[0] ? `<td><b>Tổng${H[1] ? "" : ` · ${num(all.length)}`}</b></td>` : ""}${H[1] ? `<td><b>${H[0] ? "" : "Tổng · "}${num(all.length)} ${by === "sku" ? "SPU" : by === "staff" ? "nhân viên" : "content"}</b>${bq ? '<span class="small muted"> · theo ô tìm</span>' : ""}</td>` : `<td style="display:none"></td>`}
      <td class="num mono"><b>${num(T.made)}</b></td><td class="num mono"><b>${num(T.posted)}</b></td><td class="num mono muted">—</td><td class="num mono" style="color:var(--accent)"><b>${k(T.views)}</b></td>
      <td class="num mono"><b>${k(T.posted ? T.views / T.posted : 0)}</b></td>${by === "sku" ? `<td class="num mono"><b>${T.ads ? vnd(T.ads) : "—"}</b>${T.act ? `<span class="small" style="color:var(--ok);display:block">${num(T.act)} đang chạy</span>` : ""}</td>${d.sales_range ? `<td class="num mono">${soldCell({ sold: T.sold, sold_orders: T.so })}</td>` : ""}<td class="num mono"><b>${num(T.s30)}</b></td>` : ""}<td></td></tr>` : "";
  BD._last = { by, all, label: DR.label(st.perfDr) };
  const pages = Math.max(1, Math.ceil(all.length / PER));
  const page = Math.min(st.bpage || 0, pages - 1);
  const rows = all.slice(page * PER, page * PER + PER);
  const sel = rows[Math.min(st.bsel || 0, Math.max(rows.length - 1, 0))];
  const th = (key, label, num) => `<th class="${num ? "num" : ""}"><button type="button" class="thsort${sk === key ? " on" : ""}" data-bsort="${key}">${label}${sk === key ? (dir < 0 ? " ↓" : " ↑") : ""}</button></th>`;
  const pager = pages > 1 ? `<div class="bpager"><button class="btn sm" type="button" data-bpage="${page - 1}" ${page ? "" : "disabled"}>‹ Trước</button>
    <span class="small muted">Trang <b>${page + 1}</b> / ${pages} · ${num(all.length)} dòng</span><button class="btn sm" type="button" data-bpage="${page + 1}" ${page < pages - 1 ? "" : "disabled"}>Sau ›</button></div>` : "";
  const sub = (r) => by === "sku" ? (r.made > r.posted ? `${r.made - r.posted} video chưa đăng` : "")
    : by === "staff" ? `${r.old} content cũ · ${r.new} content mới${Object.keys(r.families).length ? " · " + Object.entries(r.families).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${f} ${n}`).join(" ") : ""}`
    : `${r.kind === "Kho content" ? "Kho content" : "cùng caption"} · làm lại ${r.remakes} lần`;
  const table = rows.length ? `<div class="tscroll"><table class="ctab btab"><thead><tr>${H[0] ? `<th>${H[0]}</th>` : ""}${H[1] ? th("name", H[1]) : ""}${th("made", H[2], 1)}${th("posted", "Đã đăng", 1)}${th("pages", "Page", 1)}${th("views", "Tổng views", 1)}${th("avg", "TB view / video", 1)}${by === "sku" ? th("ads_spend", "Chi tiêu ads", 1) + (d.sales_range ? th("sold", "Đã bán", 1) : "") + th("sold30", "Bán 30 ngày", 1) : ""}<th>Video tốt nhất</th></tr></thead>
    <tbody>${totRow}${rows.map((r, i) => `<tr class="${r === sel ? "on" : ""}" data-bsel="${i}" tabindex="0">${H[0] ? `<td class="mono"><b>${esc(r.code)}</b></td>` : ""}${H[1] ? `<td><b class="ell" style="max-width:340px;display:block">${esc(r.name || (by === "sku" ? "—" : ""))}</b><span class="small muted">${sub(r)}</span></td>` : `<td class="small muted" style="display:none"></td>`}
      <td class="num mono">${num(r.made)}</td><td class="num mono">${num(r.posted)}</td><td class="num mono muted">${r.pages}</td><td class="num mono" style="color:var(--accent)"><b>${k(r.views)}</b></td><td class="num mono">${k(r.avg)}</td>${by === "sku" ? `<td class="num mono">${r.ads_spend ? `<b>${vnd(r.ads_spend)}</b>${r.ads_active ? `<span class="small" style="color:var(--ok);display:block">${r.ads_active} đang chạy</span>` : ""}` : '<span class="muted">—</span>'}</td>${d.sales_range ? `<td class="num mono">${soldCell(r)}</td>` : ""}<td class="num mono">${s30Cell(r)}</td>` : ""}
      <td>${r.best ? `<span class="chip mono">${esc((r.best.market || "").toUpperCase())}</span> <span class="mono">${k(r.best.views)}</span>` : "—"}</td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">Chưa có video nào có mã này trong khoảng đã chọn.</div>';
  const tableAndPager = table + pager;
  const max = sel ? Math.max(...sel.markets.map((m) => m[1]), 1) : 1;
  const detail = sel ? `<aside class="box bdet"><div class="pad" style="display:flex;flex-direction:column;gap:4px;border-bottom:1px solid var(--line)">
      ${sel.code ? `<span class="mono" style="color:var(--accent);font-weight:600">${esc(sel.code)}</span>` : ""}${sel.name || !sel.code ? `<b style="font-size:15px;line-height:1.35">${esc(sel.name || "")}</b>` : ""}<span class="small muted">${sub(sel)}</span></div>
    <div class="pad bdk"><div><small>${H[2]}</small><b>${num(sel.made)}</b></div><div><small>Tổng views</small><b style="color:var(--accent)">${k(sel.views)}</b></div><div><small>TB view / video</small><b>${k(sel.avg)}</b></div></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line)"><span class="small muted" style="font-weight:600">Theo thị trường</span>
      ${sel.markets.map(([m, v]) => `<div class="bmk"><span class="mono">${esc(m)}</span><span class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></span><span class="mono">${k(v)}</span></div>`).join("")}</div>
    <div class="pad" style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line)"><span class="small muted" style="font-weight:600">Video nhiều view nhất</span>
      ${sel.top.map((t) => `<a class="btop" href="${esc(t.url || "#")}" target="_blank" rel="noopener">${t.thumb ? `<img src="${esc(t.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "<span></span>"}<span class="grow"><span class="ell2">${esc(t.title || "(không mô tả)")}</span><span class="small muted">${esc(t.page || "")} · ${t.by === "ai" ? "AI" : "Editor"}</span></span><b class="mono">${k(t.views)}</b></a>`).join("")}
      ${by === "sku" ? `<a class="btn" href="#/social/posts/sku/${encodeURIComponent(sel.code)}">Xem các video của ${esc(sel.code)}</a><a class="btn pri" href="#/inventory/${encodeURIComponent(sel.code)}">Lên kế hoạch video cho ${esc(sel.code)}</a>` : by === "content" && sel.kind === "Kho content" ? '<a class="btn" href="#/content">Làm lại content này cho SKU khác</a>' : ""}</div></aside>` : "";
  return `${tools}<div class="bwrap"><section class="box" style="flex:999 1 600px;min-width:0;overflow:hidden">${tableAndPager}
      <div class="small muted" style="padding:10px 14px;border-top:1px solid var(--line)">${by === "sku" ? `SPU = mã sản phẩm khi hệ thống dựng video + hashtag mã sản phẩm trong caption (#N0017, #D0058…), mã con gom về mã gốc.<br>Bán 30 ngày = số sản phẩm bán ra trong 30 ngày tới ngày chốt tồn OMS${d.oms_snapshot ? " " + dmy(d.oms_snapshot) : ""}, <b>gồm cả đơn từ ads và đơn tự nhiên</b> (mọi kênh, đã trừ huỷ / hoàn).${d.sales_range ? " Đã bán = số bán ra trong khoảng ngày đang chọn, từ đơn hàng OMS." : ""}`
        : by === "staff" ? "Nhân viên = hashtag mã nhân viên trong caption (#K202, #TL501…). #c = content cũ, #m = content mới. Video AI đăng gom vào “AI”."
        : "Content = bài trong Kho content (video hệ thống dựng) hoặc cùng một caption đăng trên nhiều page / nhiều lần."}</div></section>${detail}</div>`;
}

/* ---------- Quảng cáo (Meta Ads) ---------- */
const AD = {};
let adPaint = null;
const AMODES = [["sku", "Theo SPU"], ["video", "Theo video"], ["ad", "Theo quảng cáo"], ["campaign", "Theo chiến dịch"], ["family", "Theo tuyến"]];
const AST = { ACTIVE: ["đang chạy", "ok"], PAUSED: ["tạm dừng", ""], CAMPAIGN_PAUSED: ["chiến dịch dừng", ""], ADSET_PAUSED: ["nhóm dừng", ""],
  WITH_ISSUES: ["có lỗi", "bad"], DISAPPROVED: ["bị từ chối", "bad"], PENDING_REVIEW: ["chờ duyệt", "warn"], ARCHIVED: ["lưu trữ", ""], DELETED: ["đã xoá", ""] };
function adsView() {
  const by = st.amode || "sku";
  const key = `${by}|${st.aacc || ""}|${st.aactive ? 1 : 0}`;
  const d = AD[key];
  if (!d) {
    if (!AD["_" + key]) {
      AD["_" + key] = 1;
      api.ads(by, { account: st.aacc || "", active: st.aactive ? "true" : "false" }).then((x) => {
        AD[key] = x; delete AD["_" + key]; adPaint?.();
        // fetch the other views quietly so switching mode is instant
        AMODES.forEach(([m]) => { const k2 = `${m}|${st.aacc || ""}|${st.aactive ? 1 : 0}`;
          if (!AD[k2] && !AD["_" + k2]) { AD["_" + k2] = 1; api.ads(m, { account: st.aacc || "", active: st.aactive ? "true" : "false" }).then((y) => { AD[k2] = y; delete AD["_" + k2]; }).catch(() => delete AD["_" + k2]); } });
      })
        .catch((err) => { delete AD["_" + key]; toast(err.message, true); });
    }
    return '<div class="empty is-busy">Đang tải số liệu quảng cáo…</div>';
  }
  const s = d.status;
  if (!s.configured) return `<div class="empty">Chưa có Meta Ads token. Vào <a href="#/settings">Cài đặt › Khoá kết nối</a>, dán <b>META_ADS_TOKEN</b> (quyền ads_read) rồi quay lại.</div>`;
  if (!d.at) return `<div class="empty">${s.running ? `Đang lấy số liệu quảng cáo · ${esc(s.step || "")}… (khoảng 30 giây mỗi tài khoản)` : s.error ? `Lỗi: ${esc(s.error)}` : 'Chưa có số liệu. Bấm "Làm mới".'}</div>`;
  const T = d.total;
  const kpi = (l, v, sub, cls = "") => `<div class="kpi"><span class="kl">${l}</span><strong class="kv">${v}</strong><span class="ks ${cls}">${sub}</span></div>`;
  const kpis = `<section class="kpis">
    ${kpi(`Chi tiêu ${d.days || ""} ngày`, vndD(T.spend), `${dmy(d.since)} – ${dmy(d.until)} · ${d.accounts.filter((a) => !a.off).length} tài khoản`, "gold")}
    ${kpi("Quảng cáo đang chạy", `${num(T.active)}<span class="muted" style="font-size:14px"> / ${num(T.ads)}</span>`, "có chi tiêu trong khoảng")}
    ${kpi("Video chạy ads", num(T.videos), `${num(d.matched)} khớp video đã đăng`)}
    ${kpi("SPU có ads", num(new Set((AD[`sku|${st.aacc || ""}|${st.aactive ? 1 : 0}`]?.rows || []).filter((r) => !r.code.startsWith("(")).map((r) => r.code)).size || (by === "sku" ? d.rows.filter((r) => !r.code.startsWith("(")).length : "…")), `${num(d.sku_ads)} quảng cáo có mã SP`)}
    ${kpi("Tin nhắn", num(T.messages), T.per_msg ? `${lvl(lvMsg(T.per_msg), vndD(T.per_msg), "Chi / tin nhắn: tới 10K rẻ · 10–20K trung bình · trên 20K đắt")} / tin nhắn` : "—")}
    ${kpi("CPM", lvl(lvCpm(T.cpm), vndD(T.cpm), "CPM: dưới 50K xanh · 50–100K vàng · trên 100K đỏ"), `${k(T.impressions)} hiển thị · ${k(T.reach)} tiếp cận`)}</section>`;
  const tools = `<section class="fbar"><div class="seg" role="group" aria-label="Xem theo">${AMODES.map(([v, l]) => `<button type="button" aria-pressed="${by === v}" data-amode="${v}">${l}</button>`).join("")}</div>
    <select class="in" data-aacc aria-label="Tài khoản quảng cáo" style="width:auto;min-height:32px"><option value="">Mọi tài khoản</option>${d.accounts.filter((a) => !a.off).map((a) => `<option value="${esc(a.id)}" ${st.aacc === a.id ? "selected" : ""}>${esc(a.name || a.id)} · ${esc(a.currency || "")}</option>`).join("")}</select>
    <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-aactive ${st.aactive ? "checked" : ""}> Chỉ ads đang chạy</label>
    <input class="in" id="a-q" type="search" placeholder="Tìm SPU, quảng cáo, chiến dịch" value="${esc(st.aq || "")}" style="width:220px;min-height:32px" aria-label="Tìm">
    <div style="flex:1"></div>
    <button class="btn sm" type="button" data-axlsx>Xuất Excel</button><button class="btn sm" type="button" data-report>Báo cáo PDF</button>
    ${DR.html("ads", { p: d.settings.preset || ({ 7: "7d", 30: "30d", 60: "60d", 90: "90d" }[d.settings.days] || "30d"), from: d.settings.date_from || "", to: d.settings.date_to || "" })}</section>`;
  const sk = st.asort || "spend", dir = st.adir || -1, PER = 30;
  const val = (r, f) => (f === "spend" && by === "ad" ? r.spend_vnd : f === "name" ? String(r.name || r.code || "") : r[f] ?? -1);
  const aq = (st.aq || "").trim().toLowerCase();
  const all = d.rows.filter((r) => !aq || [r.code, r.name, r.caption, r.campaign, ...(r.skus || [])].join(" ").toLowerCase().includes(aq))
    .sort((a, b) => (sk === "name" ? dir * val(a, sk).localeCompare(val(b, sk)) : dir * (val(a, sk) - val(b, sk))));
  AD._last = { by, all, d };
  const S = all.reduce((t, r) => ({ ads: t.ads + (r.ads || 0), active: t.active + (r.active || 0), spend: t.spend + ((by === "ad" ? r.spend_vnd : r.spend) || 0),
    imp: t.imp + (r.impressions || 0), clicks: t.clicks + (r.clicks || 0), msg: t.msg + (r.messages || 0), videos: t.videos + (r.videos || 0), sold: t.sold + (r.sold || 0), so: t.so + (r.sold_orders || 0), s30: t.s30 + (r.sold30 || 0) }),
    { ads: 0, active: 0, spend: 0, imp: 0, clicks: 0, msg: 0, videos: 0, sold: 0, so: 0, s30: 0 });
  const pages = Math.max(1, Math.ceil(all.length / PER));
  const page = Math.min(st.apage || 0, pages - 1);
  const rows = all.slice(page * PER, page * PER + PER);
  const th = (f, l, n) => `<th class="${n ? "num" : ""}"><button type="button" class="thsort${sk === f ? " on" : ""}" data-asort="${f}">${l}${sk === f ? (dir < 0 ? " ↓" : " ↑") : ""}</button></th>`;
  const skus = (list) => (list || []).slice(0, 4).map((x) => `<a class="chip mono" href="#/social/posts/sku/${encodeURIComponent(x)}">${esc(x)}</a>`).join(" ") || '<span class="muted small">chưa gắn mã</span>';
  const thumb = (r) => `<span class="athumb">${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>`;
  const perMsg = (r) => (r.messages ? vnd(r.spend / r.messages) : "—");
  let head, body;
  if (by === "ad") {
    head = `<th>Quảng cáo</th>${th("spend", "Chi tiêu", 1)}${th("impressions", "Hiển thị", 1)}<th class="num">CPM</th>${th("clicks", "Click", 1)}${th("messages", "Tin nhắn", 1)}<th class="num">Chi / tin</th><th>SPU</th>`;
    body = rows.map((r) => { const [l, c] = AST[r.status] || [r.status || "—", ""];
      return `<tr><td><div class="arow">${thumb(r)}<span class="grow"><b class="ell2">${esc(r.name || "")}</b><span class="small muted ell">${esc(r.campaign || "")} · ${esc(r.account_name || "")}</span>
        <span class="small"><span class="dot ${c}"></span> ${l}${r.key ? ` · <a href="#/social/perf/${encodeURIComponent(r.key)}">video đã đăng${r.organic_views != null ? " · " + k(r.organic_views) + " view tự nhiên" : ""}</a>` : ""}</span></span></div></td>
        <td class="num mono"><b>${vnd(r.spend_vnd)}</b>${r.currency && r.currency !== "VND" ? `<span class="small muted" style="display:block">${num(Math.round(r.spend))} ${esc(r.currency)}</span>` : ""}</td><td class="num mono">${k(r.impressions)}</td><td class="num mono">${cpmCell(r.impressions ? (r.spend_vnd / r.impressions) * 1000 : 0)}</td><td class="num mono">${k(r.clicks)}</td>
        <td class="num mono">${num(r.messages)}</td><td class="num mono">${msgCell(r.messages ? r.spend_vnd / r.messages : 0)}</td><td>${skus(r.skus)}</td></tr>`; }).join("");
  } else {
    const L = { sku: "Mã SP", video: "Video", campaign: "Chiến dịch", family: "Tuyến" }[by];
    head = `${th("name", L)}${th("ads", "Ads", 1)}${th("spend", "Chi tiêu", 1)}${th("impressions", "Hiển thị", 1)}${th("cpm", "CPM", 1)}${th("messages", "Tin nhắn", 1)}${th("per_msg", "Chi / tin", 1)}${by === "sku" ? (d.sales_range ? th("sold", "Đã bán", 1) : "") + th("sold30", "Bán 30 ngày", 1) : ""}${by === "video" ? "<th>SPU</th>" : th("videos", "Video", 1)}`;
    body = rows.map((r) => {
      const name = by === "video" ? `<div class="arow">${thumb(r)}<span class="grow"><b class="ell2">${esc((r.caption || r.name || "").split("#")[0].trim() || r.name || "(không caption)")}</b><span class="small muted ell">${esc(r.accounts.join(", "))}${r.key ? ` · <a href="#/social/perf/${encodeURIComponent(r.key)}">${esc(r.page || "video đã đăng")}</a>` : ""}</span></span></div>`
        : by === "sku" ? (r.code.startsWith("(") ? `<span class="muted">${esc(r.code)}</span>` : `<a class="mono" href="#/social/posts/sku/${encodeURIComponent(r.code)}"><b>${esc(r.code)}</b></a>`)
        : by === "family" ? `<b>${esc(r.code)}</b> <span class="small muted">${esc(FAM[r.code] || "")}</span>` : `<b class="ell2">${esc(r.code)}</b><span class="small muted">${esc(r.accounts.join(", "))}</span>`;
      return `<tr><td>${name}</td><td class="num mono">${r.active ? `<b style="color:var(--ok)">${r.active}</b><span class="muted"> / ${r.ads}</span>` : `<span class="muted">0 / ${r.ads}</span>`}</td>
        <td class="num mono"><b>${vnd(r.spend)}</b></td><td class="num mono">${k(r.impressions)}</td><td class="num mono">${cpmCell(r.cpm)}</td><td class="num mono">${num(r.messages)}</td><td class="num mono">${msgCell(r.per_msg)}</td>${by === "sku" ? `${d.sales_range ? `<td class="num mono">${soldCell(r)}</td>` : ""}<td class="num mono">${s30Cell(r)}</td>` : ""}
        <td${by === "video" ? "" : ' class="num mono"'}>${by === "video" ? skus(r.skus) : num(r.videos)}</td></tr>`; }).join("");
  }
  const atot = !all.length ? "" : by === "ad"
    ? `<tr class="btot"><td><b>Tổng · ${num(all.length)} quảng cáo</b></td><td class="num mono"><b>${vnd(S.spend)}</b></td><td class="num mono"><b>${k(S.imp)}</b></td><td class="num mono"><b>${cpmCell(S.imp ? (S.spend / S.imp) * 1000 : 0)}</b></td><td class="num mono"><b>${k(S.clicks)}</b></td>
      <td class="num mono"><b>${num(S.msg)}</b></td><td class="num mono"><b>${msgCell(S.msg ? S.spend / S.msg : 0)}</b></td><td></td></tr>`
    : `<tr class="btot"><td><b>Tổng · ${num(all.length)} dòng</b></td><td class="num mono"><b style="color:var(--ok)">${num(S.active)}</b><span class="muted"> / ${num(S.ads)}</span></td><td class="num mono"><b>${vnd(S.spend)}</b></td>
      <td class="num mono"><b>${k(S.imp)}</b></td><td class="num mono"><b>${cpmCell(S.imp ? (S.spend / S.imp) * 1000 : 0)}</b></td><td class="num mono"><b>${num(S.msg)}</b></td><td class="num mono"><b>${msgCell(S.msg ? S.spend / S.msg : 0)}</b></td>
      ${by === "sku" ? `${d.sales_range ? `<td class="num mono">${soldCell({ sold: S.sold, sold_orders: S.so })}</td>` : ""}<td class="num mono"><b>${num(S.s30)}</b></td>` : ""}<td${by === "video" ? "" : ' class="num mono"'}>${by === "video" ? "" : `<b>${num(S.videos)}</b>`}</td></tr>`;
  body = atot + body;
  const pager = pages > 1 ? `<div class="bpager"><button class="btn sm" type="button" data-apage="${page - 1}" ${page ? "" : "disabled"}>‹ Trước</button>
    <span class="small muted">Trang <b>${page + 1}</b> / ${pages} · ${num(all.length)} dòng</span><button class="btn sm" type="button" data-apage="${page + 1}" ${page < pages - 1 ? "" : "disabled"}>Sau ›</button></div>` : "";
  const errs = d.accounts.filter((a) => a.error).map((a) => `${esc(a.name || a.id)}: ${esc(a.error)}`).join(" · ");
  return `${kpis}${tools}<section class="box" style="overflow:hidden">${rows.length ? `<div class="tscroll"><table class="ctab atab"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}` : '<div class="empty">Không có quảng cáo nào trong khoảng này.</div>'}
    <div class="small muted" style="padding:10px 14px;border-top:1px solid var(--line)">Số liệu Meta Ads ${d.days} ngày, quy ra VNĐ (JPY ×${d.settings.rates.JPY}, USD ×${num(d.settings.rates.USD)}). SPU / tuyến lấy từ hashtag trong caption + tên quảng cáo (#D0058, #MD400544 → mã D400544, #A4). Khớp video đã đăng theo video ID hoặc cùng caption.<br><span class="lvl-key">Màu cảnh báo · CPM: ${lvl("ok", "dưới 50K", "")} ${lvl("mid", "50K–100K", "")} ${lvl("bad", "trên 100K", "")} · Chi / tin nhắn: ${lvl("ok", "tới 10K rẻ", "")} ${lvl("mid", "10K–20K trung bình", "")} ${lvl("bad", "trên 20K đắt", "")}</span>${by === "sku" ? `<br>Bán 30 ngày = số sản phẩm bán ra trong 30 ngày tới ngày chốt tồn OMS${d.oms_snapshot ? " " + esc(dmy(d.oms_snapshot)) : ""}, <b>gồm cả đơn từ ads và đơn tự nhiên</b> (mọi kênh, đã trừ huỷ / hoàn).${d.sales_range ? ` Đã bán = cùng khoảng ngày của số liệu ads (${esc(dmy(d.since))} – ${esc(dmy(d.until))}), từ đơn hàng OMS.` : ""}` : ""}${errs ? `<br><span style="color:var(--bad)">${errs}</span>` : ""}</div></section>`;
}

function perfView(lib, item, lessons, winViews) {
  if (st.pmode && st.pmode !== "video" && !st.key) return breakdownView(lib);
  const rows = perfList(lib);
  if (!st.key) {
    return `<section class="fbar">${pmodeSeg()}${perfTools(lib, winViews)}<div style="flex:1"></div><span class="small muted">${rows.length} video · bấm một video để AI phân tích</span></section>
      ${rows.length ? `<div class="vgrid">${rows.slice(0, st.pshown || 60).map((r, i) => `<button type="button" class="vcard${r.win ? " win" : ""}" data-open="${esc(r.key)}">
        <span class="vth">${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
          <span class="vb tl ${r.by}">${r.by === "ai" ? "AI đăng" : "Editor đăng"}</span><span class="vb tr">${pf(r.platform)}</span>
          <span class="vb bl mono">#${i + 1} · ${esc((r.market || "").toUpperCase())}</span>${r.analyzed ? '<span class="vb br">đã phân tích</span>' : ""}</span>
        <span class="vbody"><span class="vt">${esc(r.title || "(không có mô tả)")}</span><span class="small muted ell">${esc(r.page || "")} · ${dmy(r.created)}</span>
          <span class="vm mono"><b style="font-size:13px">${k(r.views)}</b><span class="muted">view</span><span class="muted">${r.er != null ? String(r.er).replace(".", ",") + "%" : ""}</span><span style="flex:1"></span>${r.score != null ? `<span class="score ${sc(r.score)}">${r.score}</span>` : ""}</span></span></button>`).join("")}</div>
        ${rows.length > (st.pshown || 60) ? `<div style="text-align:center"><button class="btn" type="button" data-pmore>Xem thêm (${rows.length - (st.pshown || 60)})</button></div>` : ""}`
        : `<div class="empty">${st.plist === "win" ? `Chưa có video nào đạt ${num(winViews)} view trong khoảng này. Hạ tiêu chuẩn hoặc chọn khoảng dài hơn.` : "Chưa có video có số liệu."}</div>`}
      ${st.lessons ? lessonsDrawer(lessons) : ""}`;
  }
  return `<button class="btn sm mob" type="button" data-back style="align-self:flex-start">← ${st.plist === "win" ? "Content win" : "Danh sách"}</button><div class="split fix"><section class="box side" id="p-side">
      <div style="padding:10px 12px;border-bottom:1px solid var(--line)"><button class="btn sm" type="button" data-back>← ${st.plist === "win" ? "Tất cả Content win" : "Danh sách"}</button></div>
      ${perfSide(rows)}</section>
    <div class="main" id="perf-main">${item ? perfItem(item) : '<div class="empty is-busy">Đang tải…</div>'}</div></div>
    ${st.lessons ? lessonsDrawer(lessons) : ""}`;
}

function perfSide(rows) {
  return rows.slice(0, 150).map((r, i) => `<button type="button" class="rk${r.key === st.key ? " on" : ""}" data-open="${esc(r.key)}"><span class="mono small muted">${i + 1}</span>
      <span class="rth">${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>
      <span class="chn"><b class="clamp2">${esc(r.title || "(không có mô tả)")}</b><span class="small muted">${PF[r.platform][0]} · ${esc((r.market || "").toUpperCase())} · ${k(r.views)} view</span></span>
      ${r.score != null ? `<span class="score ${sc(r.score)}">${r.score}</span>` : ""}</button>`).join("") || '<div class="empty small">Không có video.</div>';
}

function retentionSvg(pts, dur) {
  if (!pts || pts.length < 3) return "";
  const maxX = Math.max(...pts.map((p) => p[0])) || 1;
  const secs = maxX > 1.5;                              // points in seconds, else in share of the video length
  const W = 600, H = 120;
  const xy = pts.map(([x, y]) => [(x / maxX) * W, H - 8 - Math.min(1, y) * (H - 16)]);
  const at3 = (pts.find((q) => (secs ? q[0] : q[0] * (dur || 40)) >= 3) || pts[pts.length - 1])[1];
  let drop = 0, di = 0;
  for (let i = 3; i < pts.length; i++) { const dd = pts[i - 1][1] - pts[i][1]; if (dd > drop) { drop = dd; di = i; } }
  const label = (x) => (secs ? `${Math.round(x)}s` : dur ? `${Math.round(x * dur)}s` : `${Math.round(x * 100)}% video`);
  return `<figure class="ret"><figcaption><b>Giữ chân người xem</b><span class="muted small">3 giây: ${Math.round(at3 * 100)}% còn xem · cuối video: ${Math.round(pts[pts.length - 1][1] * 100)}%</span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Đường giữ chân người xem" preserveAspectRatio="none"><path d="M0 ${H * 0.25} H${W} M0 ${H * 0.5} H${W} M0 ${H * 0.75} H${W}" stroke="var(--line)" stroke-width="1"></path>
      <polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"></polyline>
      ${di ? `<circle cx="${xy[di][0]}" cy="${xy[di][1]}" r="4" fill="var(--warn)"></circle>` : ""}</svg>
    ${di ? `<span class="small" style="color:var(--warn)">Rơi nhiều nhất ở ${label(pts[di][0])} (−${Math.round(drop * 100)}%)</span>` : ""}</figure>`;
}

function perfItem(it) {
  const med = it.page_median || {};
  const m = (l, f, fmt = num) => {
    const v = it[f], md = med[f];
    const r = v != null && md ? v / md : null;
    return `<div class="mt"><span class="small muted">${l}</span><strong class="mono">${fmt(v)}</strong><span class="small ${r == null ? "muted" : r >= 1 ? "up" : "down"}">${r == null ? (v == null ? "không có" : "") : `${r >= 1 ? "x" + r.toFixed(1).replace(".", ",") : Math.round((r - 1) * 100) + "%"} so với page`}</span></div>`;
  };
  const a = it.analysis;
  const segs = it.segs || [];
  const tot = segs.reduce((s, x) => s + (x.sec || 0), 0) || 1;
  const strip = segs.length ? `<div class="segs">${segs.map((x) => `<span class="sg r-${(x.role || "").replace(/_/g, "-")}" style="flex:${x.sec || 1}" title="${esc(ROLE[x.role] || x.role)} ${x.sec}s">${esc(ROLE[x.role] || x.role)}<span>${x.sec}s</span></span>`).join("")}</div>` : "";
  const huyk = segs.length ? Math.round((segs.filter((x) => x.role === "huyk_talk").reduce((s, x) => s + x.sec, 0) / tot) * 100) : null;
  return `<section class="box pad vhead">
      <a class="vpl" href="${esc(it.url || "#")}" target="_blank" rel="noopener" aria-label="Mở bài gốc">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <span class="play" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"></path></svg></span>
        <span class="vb tl ${it.by}">${it.by === "ai" ? "AI đăng" : "Editor đăng"}</span>${it.win ? '<span class="vb wn" style="bottom:10px">CONTENT WIN</span>' : ""}</a>
      <div class="vinfo">
        <div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1;min-width:0;display:grid;gap:6px">
          <h1 class="vtitle">${esc(it.title || "(không có mô tả)")}</h1>
          <span class="muted">${esc(it.page || "")} · ${PF[it.platform][2]} · ${esc((it.market || "").toUpperCase())} · đăng ${esc(it.created || "")}${it.meta?.family ? ` · ${esc(it.meta.family)} ${esc(FAM[it.meta.family] || "")}` : ""}${it.meta?.template ? ` · template ${esc(it.meta.template)}` : ""}</span></div>
          <div style="text-align:right"><strong class="mono big ${sc(it.score)}">${it.score ?? "—"}</strong><div class="small muted">${it.rel != null ? `x${String(it.rel).replace(".", ",")} trung vị page` : ""}</div></div></div>
        <div class="mgrid">${m("Lượt xem", "views")}${m("Xem 3 giây", "views_3s")}${m("Tổng thời gian xem", "view_time_s", hrs)}${m("Xem trung bình", "avg_watch_s", (v) => (v == null ? "—" : String(v).replace(".", ",") + "s"))}
          ${m("Tiếp cận", "reach")}${m("Follow mới", "followers")}${m("Thích", "likes")}${m("Bình luận", "comments")}${m("Chia sẻ", "shares")}${m("Lưu", "saves")}
          <div class="mt"><span class="small muted">Tương tác</span><strong class="mono">${it.er != null ? String(it.er).replace(".", ",") + "%" : "—"}</strong><span class="small muted">trên lượt xem</span></div>
          <div class="mt"><span class="small muted">Page có</span><strong class="mono">${it.page_n || 0}</strong><span class="small muted">video để so sánh</span></div></div>
        ${retentionSvg(it.retention, it.duration) || '<div class="small muted">Nền tảng không trả đường giữ chân cho video này.</div>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${it.url ? `<a class="btn sm" href="${esc(it.url)}" target="_blank" rel="noopener">Mở bài gốc ↗</a>` : ""}${it.export ? `<a class="btn sm" href="#/exports/${encodeURIComponent(it.export)}">Video trong hệ thống</a>` : ""}</div>
      </div></section>
    ${a ? `<div class="g2">
      <section class="box pad"><div class="ch"><b>Hook · 3 giây đầu</b><span class="chip ${a.hook.strength === "mạnh" ? "ok" : a.hook.strength === "vừa" ? "warn" : "bad"}">${esc(a.hook.strength)}</span></div>
        <blockquote class="quote">${esc(a.hook.text)}</blockquote>
        <div class="g3 small"><span><span class="muted">Kiểu hook</span><b>${esc(a.hook.type)}</b></span><span><span class="muted">Hình mở đầu</span><b>${esc(a.hook.visual)}</b></span>
          <span><span class="muted">Đánh giá chung</span><b>${{ win: "Content win", ok: "Ổn", weak: "Kém" }[a.verdict] || ""}</b></span></div>
        <p class="note">${esc(a.hook.note)}</p></section>
      <section class="box pad"><div class="ch"><b>Chấm PAAST</b><span class="small muted">· ${a.paast_total}/30 tiêu chí</span></div>
        ${a.paast.map((p) => `<div class="pa"><span><b>${p.name}</b><span class="small muted">${p.vi}</span></span>
          <span class="pc">${p.criteria.map((c, i) => `<span class="${p.hits[i] ? "hit" : ""}" title="${esc(c)}${p.hits[i] ? " · đạt" : " · chưa đạt"}">${esc(c.split(" ")[0][0])}</span>`).join("")}</span>
          <span class="mono small">${p.hits.filter(Boolean).length}/6</span></div>${p.note ? `<div class="small muted pn">${esc(p.note)}</div>` : ""}`).join("")}</section></div>
    <section class="box pad"><div class="ch"><b>Kỹ thuật dựng${it.meta?.template ? " · " + esc(it.meta.template) : ""}</b>${it.duration ? `<span class="small muted">· ${it.duration} giây${segs.length ? ` · ${segs.length} cảnh` : ""}</span>` : ""}</div>
      ${strip}${segs.length ? `<div class="g3 small"><span><span class="muted">Nhịp cắt</span><b class="mono">${((segs.length / tot) * 10).toFixed(1).replace(".", ",")} cảnh / 10s</b></span>
        <span><span class="muted">HuyK lên hình</span><b class="mono">${huyk}%</b></span><span><span class="muted">Nhạc nền</span><b>${esc(it.meta?.music || "—")}</b></span></div>` : ""}
      <p class="note">${esc(a.template.notes)}</p>${a.template.drop ? `<p class="note" style="color:var(--warn)">${esc(a.template.drop)}</p>` : ""}</section>
    <section class="box"><div class="sq-day" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">AI nhận xét · rút bài học<div style="flex:1"></div>
      <span class="small muted" style="font-weight:400">Phân tích ${esc(a.at)} · Content/Hook vào AI viết, Template/Độ dài vào AI chia cảnh</span>
      <button class="btn sm" type="button" data-analyze>Phân tích lại</button></div>
      <p class="note" style="padding:0 16px">${esc(a.summary)}</p>
      ${a.tips.map((t, i) => `<div class="tip"><span class="area ${(AREA[t.area] || AREA.content)[1]}">${(AREA[t.area] || AREA.content)[0]}</span>
        <span class="chn"><span style="font-weight:500;line-height:1.45">${esc(t.text)}</span><span class="small muted">${esc(t.evidence)}</span></span>
        ${t.lesson_id ? '<span class="btn sm added">Đã thêm vào bài học</span>' : `<button class="btn sm gold" type="button" data-tip="${i}">+ Thêm vào bài học</button>`}</div>`).join("")}</section>`
    : `<section class="box pad" style="text-align:center;display:grid;gap:10px;justify-items:center;padding:32px">
      <b style="font-size:15px">Chưa phân tích video này</b>
      <span class="muted" style="max-width:520px">AI đọc số liệu so với trung vị page, câu mở, ${it.export ? "kịch bản và phân cảnh của video," : "mô tả bài (video Editor đăng tay chưa có kịch bản trong hệ thống),"} chấm PAAST 30 tiêu chí, nhận xét kỹ thuật dựng và đề xuất bài học.</span>
      <button class="btn pri" type="button" data-analyze>AI phân tích video này</button></section>`}`;
}

function lessonsDrawer(L) {
  return `<div class="scrim" data-closeless></div><aside class="drawer" aria-label="Bài học" style="width:min(520px,100vw)">
    <div style="display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line)"><b style="font-size:15px">Bài học hệ thống đang áp dụng</b><div style="flex:1"></div>
      <button class="btn icon" type="button" data-closeless aria-label="Đóng">✕</button></div>
    <div style="padding:14px 16px;display:grid;gap:12px;overflow:auto">
      ${L.summary ? `<p class="note" style="margin:0">${esc(L.summary)}</p>` : ""}
      <div style="display:flex;gap:6px"><select class="in" id="ls-area" style="width:auto">${Object.entries(AREA).map(([a, l]) => `<option value="${a}">${l[0]}</option>`).join("")}</select>
        <input class="in" id="ls-new" placeholder="Thêm bài học của anh"><button class="btn" type="button" data-ladd>Thêm</button></div>
      ${L.lessons.map((l) => `<div class="tip${l.active ? "" : " off"}" style="padding:10px 0"><button class="switch" type="button" role="switch" aria-checked="${!!l.active}" data-lact="${esc(l.id)}" aria-label="Áp dụng"></button>
        <span class="chn"><span><span class="area ${(AREA[l.area] || AREA.content)[1]}">${(AREA[l.area] || AREA.content)[0]}</span> ${esc(l.text)}</span><span class="small muted">${esc(l.source || l.evidence || "")}</span></span>
        <button class="btn sm${l.pinned ? " ink" : ""}" type="button" data-lpin="${esc(l.id)}">${l.pinned ? "Đã ghim" : "Ghim"}</button><button class="btn sm icon danger" type="button" data-ldel="${esc(l.id)}" aria-label="Xoá">✕</button></div>`).join("") || '<div class="empty small">Chưa có bài học.</div>'}
      <button class="btn pri" type="button" data-learn>AI rút bài học từ toàn kênh</button></div></aside>`;
}

/* ---------- Kết nối ---------- */
function connectView(lib, d, msg) {
  const fb = d.accounts.facebook, ig = d.accounts.instagram, tt = d.accounts.tiktok;
  const igN = lib.pages.filter((p) => p.ig_id).length;
  const card = (code, title, status, ok, detail, warn, btn) => `<div class="pcard"><div style="display:flex;gap:10px;align-items:center">${pf(code, true)}
      <span class="chn"><b>${title}</b><span class="small" style="color:${ok ? "var(--ok)" : "var(--muted)"}">${status}</span></span></div>
      <span class="small muted" style="min-height:34px;line-height:1.45">${detail}</span>${warn ? `<span class="warnbox small">${warn}</span>` : ""}${btn}</div>`;
  const link = (href, l, pri) => `<a class="btn${pri ? " pri" : ""}" href="${href}">${l}</a>`;
  const stats = lib.stats || {};
  const mkSel = (id, cur, auto) => `<span class="mkw"><select class="in" data-mk="${esc(id)}" aria-label="Thị trường" style="min-height:30px">${Object.entries(lib.markets).map(([m, l]) => `<option value="${m}" ${cur === m ? "selected" : ""}>${m.toUpperCase()} · ${esc(l)}</option>`).join("")}</select>${auto ? '<span class="small muted auto-h" title="Tự đoán theo tên page — chọn lại để cố định">tự đoán</span>' : ""}</span>`;
  const tmSel = (id, cur) => `<select class="in" data-tm="${esc(id)}" aria-label="Team" style="min-height:30px"><option value="">Chưa gán</option>${lib.teams.map((t) => `<option ${cur === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  const s = lib.status;
  const rows = lib.pages.map((p) => {
    const a = stats[`facebook:${p.id}`] || {}, b = stats[`instagram:${p.id}`] || {};
    return `<tr class="${p.track ? "" : "off"}" data-row="${esc((p.name + " " + (p.ig_name || "")).toLowerCase())}"><td><input type="checkbox" class="chk" data-track="${esc(p.id)}" ${p.track ? "checked" : ""} aria-label="Cào ${esc(p.name)}"></td>
      <td><span class="chn"><span>${pf("facebook")} <b>${esc(p.name)}</b></span>${p.ig_id ? `<span class="small muted">${pf("instagram")} @${esc(p.ig_name || p.ig_id)}</span>` : ""}</span></td>
      <td>${mkSel(p.id, p.market, p.market_auto)}</td><td>${tmSel(p.id, (lib.channels.find((c) => c.page_id === p.id) || {}).team || "")}</td>
      <td class="num mono">${(a.videos || 0) + (b.videos || 0) || "—"}</td><td class="num mono">${k((a.views30 || 0) + (b.views30 || 0))}</td>
      <td class="small muted">${p.track ? esc((a.last || b.last || "chưa cào").slice(5)) : "Không cào"}</td>
      <td><button class="btn sm" type="button" data-syncone="${esc(p.id)}" ${p.track && !s.running ? "" : "disabled"}>Cào</button></td></tr>`;
  }).join("") + (tt.connected ? (() => { const a = stats["tiktok:tiktok"] || {}; const ch = lib.channels.find((c) => c.platform === "tiktok") || {};
    return `<tr><td><input type="checkbox" class="chk" checked disabled aria-label="Cào TikTok"></td><td><span>${pf("tiktok")} <b>${esc(tt.name)}</b></span></td>
      <td>${mkSel("tiktok", lib.tiktok_market)}</td><td>${tmSel("tiktok", ch.team || "")}</td><td class="num mono">${a.videos || "—"}</td><td class="num mono">${k(a.views30 || 0)}</td>
      <td class="small muted">${esc((a.last || "chưa cào").slice(5))}</td><td><button class="btn sm" type="button" data-syncone="tiktok" ${s.running ? "disabled" : ""}>Cào</button></td></tr>`; })() : "");
  return `${msg ? `<div class="box pad" style="border-color:${msg.startsWith("error") ? "var(--bad)" : "var(--ok)"}">${msg.startsWith("error") ? "Kết nối lỗi: " + esc(msg.slice(6)) : "Đã kết nối thành công."}</div>` : ""}
    <section class="pcards">
      ${card("facebook", "Facebook", fb.connected ? `Đã kết nối · ${lib.pages.length} page` : "Chưa kết nối", fb.connected, fb.connected ? "Reels của các Fanpage đã cấp quyền" : "Đăng Reels và cào số liệu các Fanpage",
        fb.connected && (fb.missing || []).length ? `Facebook chưa cấp quyền: <b class="mono">${fb.missing.map(esc).join(", ")}</b>. Thêm các quyền này trong app Meta › Trường hợp sử dụng, rồi bấm Kết nối lại và cho phép tất cả.` : "",
        (d.apps.meta ? link("/api/social/meta/connect", fb.connected ? "Kết nối lại" : "Kết nối", !fb.connected || (fb.missing || []).length) : '<span class="chip warn">Thiếu khoá app Meta</span>')
        + (fb.connected ? '<button class="btn sm" type="button" data-refreshpages>Làm mới danh sách page</button>' : ""))}
      ${card("instagram", "Instagram", ig.connected || igN ? `Đã kết nối · ${igN} tài khoản` : "Chưa kết nối", ig.connected || igN, "Qua Facebook · tài khoản Business nối với Fanpage", "",
        fb.connected ? '<span class="small muted">Quản lý qua kết nối Facebook</span>' : '<span class="small muted">Kết nối Facebook trước</span>')}
      ${card("tiktok", "TikTok", tt.connected ? "Đã kết nối · 1 kênh" : "Chưa kết nối", tt.connected, tt.connected ? `${esc(tt.name)} · gửi video vào hộp thư, bấm đăng trong app` : "Đăng vào hộp thư TikTok và kéo số liệu",
        "", d.apps.tiktok ? link("/api/social/tiktok/connect", tt.connected ? "Kết nối lại" : "Kết nối", !tt.connected) : '<span class="chip warn">Thiếu khoá app TikTok</span>')}
      ${card("youtube", "YouTube", "Sắp có", false, "Shorts · cần tạo app Google (YouTube Data API)", "", '<button class="btn" type="button" disabled>Sắp có</button>')}
      ${card("threads", "Threads", "Sắp có", false, "Cần app Threads API của Meta", "", '<button class="btn" type="button" disabled>Sắp có</button>')}</section>
    ${fb.connected ? `<details class="box pad"><summary><b>Thiếu page?</b> <span class="small muted">Facebook chỉ cho app thấy những page anh tích lúc đăng nhập</span></summary>
      <ol class="small" style="line-height:1.7;margin:8px 0;padding-left:18px"><li>Bấm <b>Kết nối lại</b> ở thẻ Facebook, ở bước chọn trang bấm <b>"Chọn tất cả"</b> (hoặc "Tất cả trang hiện tại và trong tương lai"), cả với Instagram.</li>
        <li>Nếu page nằm trong nhiều Business Manager: vào business.facebook.com › Cài đặt doanh nghiệp › Người dùng › <b>Người dùng hệ thống</b> › thêm tài sản (tất cả page) › <b>Tạo mã truy cập</b> cho app này với các quyền pages_show_list, pages_read_engagement, read_insights, pages_manage_posts, instagram_basic, instagram_manage_insights, instagram_content_publish, rồi dán mã vào đây:</li></ol>
      <div style="display:flex;gap:8px"><input class="in mono" id="sys-tok" type="password" placeholder="Mã truy cập người dùng hệ thống" autocomplete="off"><button class="btn" type="button" data-systoken>Dùng mã này</button></div></details>` : ""}
    <section class="box pad rowbox" style="gap:8px"><b style="margin-right:6px">Team</b>
      ${lib.teams.map((t, i) => `<span class="tchip t${i % 5}">${esc(t)}<span class="mono">${lib.channels.filter((c) => c.team === t && c.platform !== "instagram").length}</span><button type="button" data-rmteam="${esc(t)}" aria-label="Xoá team ${esc(t)}">✕</button></span>`).join("")}
      <input class="in" id="t-new" placeholder="Tên team mới" style="width:170px;min-height:32px" aria-label="Tên team mới"><button class="btn sm gold" type="button" data-addteam>Thêm</button></section>
    <section class="box"><div class="sq-day" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Page &amp; kênh <span class="small muted" style="font-weight:400">${lib.pages.length + (tt.connected ? 1 : 0)} kênh · ${num(lib.rows.length)} video đã cào${lib.synced_at ? " · lần cuối " + esc(lib.synced_at) : ""}</span><input class="in" id="pg-q" type="search" placeholder="Tìm page" style="width:180px;min-height:32px" aria-label="Tìm page"><div style="flex:1"></div>
      ${s.running ? `<span class="small muted">${esc(s.step)} · ${s.done}/${s.total || "?"}</span><span class="prog"><i style="width:${s.total ? (s.done / s.total) * 100 : 5}%"></i></span>` : ""}
      <select class="in" id="l-days" style="width:auto;min-height:32px" aria-label="Khoảng thời gian cào">${[[30, "30 ngày"], [90, "90 ngày"], [180, "6 tháng"], [365, "1 năm"], [730, "2 năm"]].map(([v, l]) => `<option value="${v}" ${+d.settings.library_days === v ? "selected" : ""}>${l} gần nhất</option>`).join("")}</select>
      <button class="btn pri" type="button" data-syncall ${s.running ? "disabled" : ""}>${s.running ? "Đang cào…" : "Cào tất cả page đã chọn"}</button></div>
      ${s.errors.length ? `<details style="padding:0 16px 10px"><summary class="small" style="color:var(--warn)">${s.errors.length} lỗi lần cào gần nhất</summary><div class="small mono muted">${s.errors.map(esc).join("<br>")}</div></details>` : ""}
      ${rows ? `<div class="tscroll"><table class="ctab"><thead><tr><th>Cào</th><th>Page / kênh</th><th>Thị trường</th><th>Team</th><th class="num">Video</th><th class="num">View 30 ngày</th><th>Cào lần cuối</th><th><span class="sr">Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<div class="empty">Kết nối Facebook hoặc TikTok để hiện danh sách page.</div>'}</section>
    <details class="box pad"><summary><b>Hướng dẫn tạo app</b></summary><ol class="small" style="line-height:1.7;margin:8px 0 0;padding-left:18px">
      <li><b>Meta:</b> developers.facebook.com › app loại Business › thêm Facebook Login for Business. Use cases: thêm pages_show_list, pages_read_engagement, read_insights, pages_manage_posts, instagram_basic, instagram_manage_insights, instagram_content_publish. Redirect URI: <code class="mono">${esc(d.redirects.meta)}</code>. App ID / Secret vào Cài đặt › Khoá kết nối.</li>
      <li><b>TikTok:</b> developers.tiktok.com › Login Kit + Content Posting API, scopes user.info.basic, video.upload, video.publish, video.list. Redirect URI: <code class="mono">${esc(d.redirects.tiktok)}</code>.</li></ol>
      ${fb.connected || tt.connected ? `<div style="display:flex;gap:8px;margin-top:10px">${fb.connected ? '<button class="btn sm danger" type="button" data-disc="meta">Ngắt Facebook / Instagram</button>' : ""}${tt.connected ? '<button class="btn sm danger" type="button" data-disc="tiktok">Ngắt TikTok</button>' : ""}</div>` : ""}</details>`;
}

/** Báo cáo PDF: posting + performance (current date range / market) and Meta Ads, with charts and short findings. */
async function makeReport(lib) {
  const [df, dt] = DR.resolve(st.perfDr);
  const q = { date_from: df, date_to: dt, market: st.pmk || "", source: st.psrc || "" };
  const bd = async (by) => BD[`${by}|${df}|${dt}|${q.market}|${q.source}`] || api.socialBreakdown(by, q);
  const ad = async (by) => AD[`${by}|${st.aacc || ""}|0`] || api.ads(by, { account: st.aacc || "", active: "false" }).catch(() => null);
  const [S, E, C, A, F] = await Promise.all([bd("sku"), bd("staff"), bd("content"), ad("sku"), ad("family")]);
  const win = [df, dt];
  const rows = lib.rows.filter((r) => r.views != null && DR.inRange(r.created, win) && (!st.pmk || r.market === st.pmk) && (!st.psrc || r.by === st.psrc));
  const views = rows.reduce((s, r) => s + (r.views || 0), 0);
  const wins = rows.filter((r) => r.win).length;
  const by = (f) => { const m = {}; rows.forEach((r) => { const key = f(r) || "?"; m[key] = (m[key] || 0) + (r.views || 0); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const cnt = (f) => { const m = {}; rows.forEach((r) => { const key = f(r) || "?"; m[key] = (m[key] || 0) + 1; }); return m; };
  const dayMap = {};
  rows.forEach((r) => { const d0 = (r.created || "").slice(0, 10); if (!d0) return; const x = dayMap[d0] || (dayMap[d0] = [0, 0]); x[0] += r.views || 0; x[1] += 1; });
  const days = Object.keys(dayMap).sort().slice(-60).map((d0) => [d0.slice(8, 10) + "/" + d0.slice(5, 7), dayMap[d0][0], dayMap[d0][1]]);
  const top = (d, n = 10) => (d?.rows || []).slice().sort((a, b) => b.views - a.views).slice(0, n);
  const skuTop = top(S), staffTop = top(E), contTop = top(C);
  const AT = A?.total || {};
  const adSku = (A?.rows || []).filter((r) => !String(r.code).startsWith("(")).sort((a, b) => b.spend - a.spend);
  const nByAi = cnt((r) => (r.by === "ai" ? "AI đăng" : "Editor đăng"));
  // findings
  const F1 = [];
  if (rows.length) F1.push(`Đăng <b>${fmtN(rows.length)}</b> video, tổng <b>${KR(views)}</b> views, trung bình <b>${KR(views / rows.length)}</b> views/video; <b>${fmtN(wins)}</b> video đạt Content win.`);
  const sv = (S?.rows || []).reduce((s, r) => s + r.views, 0);
  if (skuTop.length && sv) { const t3 = skuTop.slice(0, 3).reduce((s, r) => s + r.views, 0); F1.push(`3 SPU dẫn đầu (${skuTop.slice(0, 3).map((r) => esc(r.code)).join(", ")}) chiếm <b>${Math.round((t3 / sv) * 100)}%</b> views có gắn mã.`); }
  const mk = by((r) => (r.market || "").toUpperCase());
  if (mk.length) F1.push(`Thị trường nhiều views nhất: <b>${esc(mk[0][0])}</b> (${Math.round((mk[0][1] / Math.max(views, 1)) * 100)}%).`);
  const bestAvg = (E?.rows || []).filter((r) => r.posted >= 5).sort((a, b) => b.avg - a.avg)[0];
  if (bestAvg) F1.push(`Nhân viên có TB views/video cao nhất (từ 5 video): <b>${esc(bestAvg.code)}</b> · ${KR(bestAvg.avg)} views/video.`);
  const noAds = (S?.rows || []).filter((r) => r.views >= 10000 && !r.ads_spend).sort((a, b) => b.views - a.views).slice(0, 5);
  if (noAds.length) F1.push(`SPU nhiều views nhưng chưa chạy ads, nên cân nhắc đẩy: ${noAds.map((r) => `<b>${esc(r.code)}</b> (${KR(r.views)})`).join(", ")}.`);
  if (AT.spend) {
    F1.push(`Quảng cáo ${A.days} ngày: chi <b>${vnd(AT.spend)}đ</b>, <b>${fmtN(AT.messages)}</b> tin nhắn, chi/tin <b>${AT.per_msg ? vnd(AT.per_msg) + "đ" : "—"}</b>, CPM <b>${vnd(AT.cpm)}đ</b>.`);
    const avgMsg = AT.messages ? AT.spend / AT.messages : 0;
    const costly = adSku.filter((r) => r.spend > AT.spend * 0.03 && (!r.messages || (avgMsg && r.spend / r.messages > avgMsg * 1.8))).slice(0, 4);
    if (costly.length) F1.push(`SPU tốn tiền ads nhưng ít tin nhắn (chi/tin gấp ~2 lần trung bình): ${costly.map((r) => `<b>${esc(r.code)}</b> ${r.messages ? vnd(r.spend / r.messages) + "đ/tin" : "0 tin"}`).join(", ")}.`);
  }
  const range = DR.label(st.perfDr);
  const html = `<h1>Báo cáo Đăng &amp; hiệu quả · Quảng cáo</h1>
    <div class="sub">HuyK · Viễn Chí Bảo · ${esc(range)}${st.pmk ? ` · thị trường ${esc(st.pmk.toUpperCase())}` : ""}${st.psrc ? ` · ${st.psrc === "ai" ? "AI đăng" : "Editor đăng"}` : ""} · lập lúc ${new Date().toLocaleString("vi-VN")}</div>
    <div class="kpis"><div class="kpi"><small>Video đã đăng</small><b>${fmtN(rows.length)}</b><span>AI ${fmtN(nByAi["AI đăng"] || 0)} · Editor ${fmtN(nByAi["Editor đăng"] || 0)}</span></div>
      <div class="kpi"><small>Tổng views</small><b>${KR(views)}</b><span>TB ${KR(rows.length ? views / rows.length : 0)} / video</span></div>
      <div class="kpi"><small>Content win</small><b>${fmtN(wins)}</b><span>${rows.length ? Math.round((wins / rows.length) * 100) : 0}% số video</span></div>
      <div class="kpi"><small>Chi tiêu ads${A ? ` · ${A.days} ngày` : ""}</small><b>${AT.spend ? vnd(AT.spend) + "đ" : "—"}</b><span>${fmtN(AT.messages || 0)} tin nhắn · ${AT.per_msg ? vnd(AT.per_msg) + "đ/tin" : "—"}</span></div></div>
    <h2>Nhận xét nhanh</h2><ul class="find">${F1.map((x) => `<li>${x}</li>`).join("") || "<li>Chưa đủ số liệu.</li>"}</ul>
    <h2>Views và số video đăng theo ngày</h2>${daily(days)}
    <div class="two"><div class="card"><h2>Views theo thị trường</h2>${shares(mk.slice(0, 6))}</div><div class="card"><h2>Views theo nền tảng</h2>${shares(by((r) => ({ tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram" }[r.platform] || r.platform)))}</div></div>
    <h2>Top 10 SPU theo views</h2>${hbars(skuTop.map((r) => [`${r.code} ${r.name ? "· " + r.name : ""}`, r.views, `· ${fmtN(r.posted)} video`]))}
    <div class="two"><div class="card"><h2>Top nhân viên theo views</h2>${hbars(staffTop.map((r) => [r.code, r.views, `· ${fmtN(r.posted)} video`]), { color: "#3F6E9B", width: 440 })}</div>
      <div class="card"><h2>Top content theo views</h2>${hbars(contTop.map((r) => [r.name || r.code, r.views, `· ${fmtN(r.posted)}`]), { color: "#B4642B", width: 440 })}</div></div>
    ${A && AT.spend ? `<h2>Quảng cáo · chi tiêu theo SPU (${esc(dmy(A.since))} – ${esc(dmy(A.until))})</h2>${hbars(adSku.slice(0, 10).map((r) => [r.code, r.spend, `· ${fmtN(r.messages)} tin`]), { fmt: (v) => vnd(v) + "đ", color: "#2E7D4F" })}
      <div class="two"><div class="card"><h2>Chi tiêu theo tuyến</h2>${shares((F?.rows || []).map((r) => [r.code, r.spend]))}</div>
        <div class="card"><h2>Chi phí mỗi tin nhắn theo SPU</h2>${hbars(adSku.filter((r) => r.messages >= 3).sort((a, b) => a.spend / a.messages - b.spend / b.messages).slice(0, 10).map((r) => [r.code, r.spend / r.messages]), { fmt: (v) => vnd(v) + "đ", color: "#6B4FA0", width: 440 })}</div></div>` : ""}
    <h2>15 video nhiều views nhất</h2><table><thead><tr><th>#</th><th>Video</th><th>Page</th><th>Ngày</th><th class="n">Views</th></tr></thead><tbody>
      ${rows.slice().sort((a, b) => b.views - a.views).slice(0, 15).map((r, i) => `<tr><td>${i + 1}</td><td>${esc((r.title || "").split("#")[0].trim().slice(0, 80) || "(không mô tả)")}</td><td>${esc(r.page || "")}</td><td>${esc(dmy(r.created))}</td><td class="n">${KR(r.views)}</td></tr>`).join("")}</tbody></table>
    <h2>Bảng SPU (top 30)</h2><table><thead><tr><th>SPU</th><th>Sản phẩm</th><th class="n">Video SX</th><th class="n">Đã đăng</th><th class="n">Views</th><th class="n">TB/video</th><th class="n">Chi ads</th>${S?.sales_range ? '<th class="n">Đã bán</th>' : ""}<th class="n">Bán 30 ngày</th></tr></thead><tbody>
      ${top(S, 30).map((r) => `<tr><td>${esc(r.code)}</td><td>${esc((r.name || "").slice(0, 60))}</td><td class="n">${fmtN(r.made)}</td><td class="n">${fmtN(r.posted)}</td><td class="n">${KR(r.views)}</td><td class="n">${KR(r.avg)}</td><td class="n">${r.ads_spend ? vnd(r.ads_spend) + "đ" : "—"}</td>${S?.sales_range ? `<td class="n">${r.sold == null ? "—" : fmtN(r.sold)}</td>` : ""}<td class="n">${r.sold30 == null ? "—" : fmtN(r.sold30)}</td></tr>`).join("")}</tbody></table>
    <div class="foot">Nguồn: thư viện video đã đăng (TikTok · Facebook · Instagram), hashtag mã SPU / nhân viên trong caption, Meta Ads. Views tính tới lần cào gần nhất. Đã bán / Bán 30 ngày lấy từ OMS, gồm cả đơn từ ads và đơn tự nhiên.</div>`;
  printReport(`Bao-cao-dang-hieu-qua-${df || "toan-bo"}_${dt || ""}`, html);
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  let msg = "";
  const p0 = ctx.params?.[0];
  if (p0 === "connect") { st.tab = "connect"; msg = ctx.params[2] || ""; }
  else if (p0 === "perf") { st.tab = "perf"; st.key = ctx.params[1] || null; }
  else if (TABS[p0]) st.tab = p0;
  st.psku = p0 === "posts" && ctx.params[1] === "sku" ? (ctx.params[2] || "").toUpperCase() : "";
  let [d, lib] = await Promise.all([api.social(), api.socialLibrary()]);
  let item = null, lessons = null, ex = null;
  const winViews = () => d.settings.win_views || 100000;
  const loadItem = async () => { item = st.key ? await api.socialItem(st.key).catch(() => null) : null; };
  if (st.tab === "perf") {
    await loadItem();
    lessons = await api.socialInsights().then((x) => x.lessons).catch(() => ({ lessons: [] }));
  }
  const loadEx = () => api.exports().then((r) => { ex = r.items; const m = el.querySelector("#s-main"); if (m && st.tab === "schedule") m.innerHTML = scheduleMain(lib, d, ex); }).catch(() => {});
  if (st.tab === "schedule") loadEx();
  const adsSync = () => { const x = Object.values(AD).find((v) => v && v.status); return x ? (x.status.running ? `Đang lấy · ${esc(x.status.step || "")}` : x.at ? `Cập nhật ${esc(x.at.slice(5))} · tự làm mới mỗi 3 giờ` : "") : ""; };
  const syncText = () => (lib.status.running ? `Đang cào ${lib.status.done}/${lib.status.total || "?"} · số liệu hiện dần`
    : lib.synced_at ? "Cào lần cuối " + esc(lib.synced_at.slice(5)) + " · tự cào mỗi 6 giờ" : "Chưa cào dữ liệu");
  const body = () => (st.tab === "posts" ? postsView(lib) : st.tab === "schedule" ? scheduleView(lib, d, ex) : st.tab === "perf" ? perfView(lib, item, lessons, winViews()) : st.tab === "ads" ? adsView() : connectView(lib, d, msg));
  const right = () => (st.tab === "perf" ? `<span class="small muted">Bài học đang áp dụng · <b>${lessons ? lessons.lessons.filter((l) => l.active).length : "…"}</b></span><button class="btn" type="button" data-showless>Xem bài học</button>`
    : st.tab === "ads" ? `<span class="small muted" id="a-sync">${adsSync()}</span><button class="btn" type="button" data-adsrefresh>Làm mới</button>`
    : st.tab === "posts" ? `<span class="small muted" id="p-sync">${syncText()}</span><button class="btn" type="button" data-csv>Tải CSV</button>`
    : st.tab === "schedule" ? `<span class="small muted">${lib.channels.filter((c) => c.plan.auto).length} kênh đang tự đăng · ${lib.channels.filter((c) => c.plan.auto).reduce((s, c) => s + c.plan.per_day, 0)} bài / ngày</span>` : "");
  const paint = () => {
    el.innerHTML = `<header class="ph-bar"><h1>Đăng &amp; hiệu quả</h1><nav class="seg" aria-label="Mục con">${Object.entries(TABS).map(([t, l]) => `<a href="#/social/${t}" ${st.tab === t ? 'aria-current="page" class="on"' : ""}>${l}</a>`).join("")}</nav>
      <div class="sp"></div>${right()}</header><div class="page social">${body()}</div>`;
  };
  paint();
  DR.wire(el, async (id, r) => {
    if (id === "posts") { st.postDr = r; st.shown = 60; paint(); }
    else if (id === "perf") { st.perfDr = r; st.bpage = 0; paint(); }
    else if (id === "social-exports") { st.exDr = r; st.exShown = 48; paintMain(); }
    else if (id === "ads") {
      const [a, b] = DR.resolve(r);
      try { await api.adsSettings({ preset: r.p, date_from: a, date_to: b }); toast(`Đang lấy lại số liệu quảng cáo ${DR.label(r)}`); adsWatch(); }
      catch (err) { toast(err.message, true); }
    }
  });
  bdPaint = () => { if (st.tab === "perf") paint(); };
  adPaint = () => { if (st.tab === "ads") paint(); };
  let adT = null;
  const adsWatch = () => { clearTimeout(adT); adT = setTimeout(async () => {
    const x = await api.ads("ad", { account: "", active: "false" }).catch(() => null);   // status rides along
    if (!x) return;
    if (x.status.running) { const sEl = el.querySelector("#a-sync"); if (sEl) sEl.textContent = `Đang lấy · ${x.status.step || ""}`; adsWatch(); return; }
    Object.keys(AD).forEach((k2) => delete AD[k2]); AD["ad||0"] = x; toast("Đã cập nhật số liệu quảng cáo"); paint(); }, 4000); };
  el.addEventListener("click", (e) => {
    const tr = e.target.closest("[data-bsel]");
    if (tr && !e.target.closest("a,button")) { st.bsel = +tr.dataset.bsel; paint(); }
  });
  ctx.setUpdate?.(async (params) => {                    // sub-tab links switch in place: data kept, no reload flash
    const t = params[0];
    if (t === "connect") { st.tab = "connect"; msg = params[2] || ""; }
    else if (t === "perf") { st.tab = "perf"; if (params[1] !== undefined) st.key = params[1] || null; }
    else if (TABS[t]) st.tab = t;
    else return false;
    st.psku = t === "posts" && params[1] === "sku" ? (params[2] || "").toUpperCase() : (t === "posts" ? "" : st.psku);
    if (st.tab === "perf" && !lessons) {
      await loadItem();
      lessons = await api.socialInsights().then((x) => x.lessons).catch(() => ({ lessons: [] }));
    }
    if (st.tab === "schedule" && !ex) loadEx();
    paint();
    window.scrollTo(0, 0);
    return true;
  });
  const paintMain = () => { const m = el.querySelector("#s-main"); if (m) m.innerHTML = scheduleMain(lib, d, ex); else paint(); };
  const paintChs = () => { const l = el.querySelector("#ch-list"); if (l) l.innerHTML = chList(lib.channels.filter((c) => (!st.team || c.team === st.team) && (!st.chq || c.name.toLowerCase().includes(st.chq.toLowerCase())))); };
  const reload = async () => { [d, lib] = await Promise.all([api.social(), api.socialLibrary()]); if (st.tab === "perf") await loadItem(); paint(); };
  const refreshPosts = async () => { d = await api.social(); paintMain(); };
  let syncT = null;
  const watch = () => { clearTimeout(syncT); syncT = setTimeout(async () => { lib = await api.socialLibrary(); if (st.tab === "connect") paint(); else if (st.tab === "posts") { const x = el.querySelector("#p-sync"); if (x) x.textContent = syncText(); if (lib.status.done % 100 < 8) el.querySelector("#p-grid").innerHTML = postGrid(lib); } if (lib.status.running) watch(); else { toast(`Cào xong · ${lib.rows.length} video`); paint(); } }, 2500); };
  if (lib.status.running) watch();
  const plan = () => lib.channels.find((c) => c.cid === st.cid)?.plan;
  const savePlan = async (patch, quiet) => {
    const p = await api.socialPlan(st.cid, patch);
    const c = lib.channels.find((x) => x.cid === st.cid); if (c) c.plan = p;
    if (!quiet) toast("Đã lưu lịch");
    paintMain(); paintChs();
  };
  const openItem = async (key) => {                      // swap only the analysis panel: no page reload, no flicker
    st.key = key;
    history.replaceState(null, "", `#/social/perf/${encodeURIComponent(key)}`);
    const main = el.querySelector("#perf-main");
    if (!main) { item = null; paint(); }
    else {
      el.querySelectorAll("#p-side .rk").forEach((b) => b.classList.toggle("on", b.dataset.open === key));
      main.style.opacity = ".5";
    }
    await loadItem();
    const m2 = el.querySelector("#perf-main");
    if (m2) { m2.innerHTML = item ? perfItem(item) : '<div class="empty">Không tải được video.</div>'; m2.style.opacity = "1"; m2.scrollTop = 0; }
  };
  const paintItem = () => { const m = el.querySelector("#perf-main"); if (m && item) m.innerHTML = perfItem(item); };
  const val = (s) => el.querySelector(s)?.value;
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-closeless]");
    if (!t) return;
    try {
      if (t.dataset.by !== undefined) { st.by = t.dataset.by; st.shown = 60; paint(); return; }
      if (t.dataset.sfam) { st.fam = st.fam === t.dataset.sfam ? "" : t.dataset.sfam; st.shown = 60; paint(); return; }
      if (t.dataset.smk) { const m = t.dataset.smk === "none" ? "" : t.dataset.smk; st.mk = st.mk === m ? "" : m; st.shown = 60; paint(); return; }
      if (t.dataset.fpf) { st.pf = st.pf === t.dataset.fpf ? "" : t.dataset.fpf; st.shown = 60; paint(); return; }
      if (t.hasAttribute("data-more")) { st.shown += 120; el.querySelector("#p-grid").innerHTML = postGrid(lib); return; }
      if (t.hasAttribute("data-csv")) { csv(postRows(lib)); return; }
      // schedule
      if (t.dataset.cid) { el.querySelector(".split.fix")?.classList.remove("chsheet"); st.cid = t.dataset.cid; st.exLang = undefined; st.editPost = null; el.querySelectorAll("#ch-list .chrow").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cid === st.cid)); paintMain(); el.querySelector("#s-main").scrollTop = 0; return; }
      if (t.hasAttribute("data-pauto")) { await savePlan({ auto: !plan().auto }); return; }
      if (t.hasAttribute("data-autopick")) { await savePlan({ auto_pick: !plan().auto_pick, ...(plan().auto ? {} : { auto: true }) }); return; }
      if (t.hasAttribute("data-fillnow")) { t.disabled = true; const r = await api.socialAutofill(); toast(r.queued ? `Đã bốc ${r.queued} video vào lịch` : "Không còn khung giờ trống hoặc hết video chưa đăng"); await refreshPosts(); return; }
      if (t.dataset.per) { await savePlan({ per_day: plan().per_day + +t.dataset.per }, true); return; }
      if (t.dataset.day) { const ds = new Set(plan().days); const i = +t.dataset.day; ds.has(i) ? ds.delete(i) : ds.add(i); await savePlan({ days: [...ds] }, true); return; }
      if (t.dataset.rmslot) { await savePlan({ slots: plan().slots.filter((x) => x !== t.dataset.rmslot) }, true); return; }
      if (t.hasAttribute("data-addslot")) { const v = val("#s-new"); if (!v) { toast("Chọn giờ trước", true); return; } await savePlan({ slots: [...plan().slots, v] }, true); return; }
      if (t.hasAttribute("data-golden")) {
        const r = await api.socialHours(st.cid);
        if (!r.hours.length) { toast("Chưa đủ số liệu page này (cần ≥ 3 video mỗi khung giờ) — cào dữ liệu trước", true); return; }
        await savePlan({ slots: r.hours }, true); toast("Đã dùng giờ có lượt xem cao nhất: " + r.hours.join(", ")); return;
      }
      if (t.hasAttribute("data-saveplan")) {
        const mix = {}; el.querySelectorAll("[data-mix]").forEach((i) => { mix[i.dataset.mix] = +i.value; });
        await savePlan({ mix, approve: val("[data-approve-mode]"), ai_mix: el.querySelector("[data-aimix]").checked }); return;
      }
      if (t.hasAttribute("data-expickall")) { el.querySelectorAll("[data-expick]:not(:disabled)").forEach((i) => { i.checked = true; }); return; }
      if (t.hasAttribute("data-expicknone")) { el.querySelectorAll("[data-expick]").forEach((i) => { i.checked = false; }); return; }
      if (t.dataset.exlang !== undefined) { st.exLang = t.dataset.exlang; st.exShown = 48; paintMain(); return; }
      if (t.hasAttribute("data-exmore")) { st.exShown = (st.exShown || 48) + 96; paintMain(); return; }
      if (t.dataset.editpost) { st.editPost = st.editPost === t.dataset.editpost ? null : t.dataset.editpost; paintMain(); return; }
      if (t.hasAttribute("data-planopen")) { st.planOpen = !st.planOpen; paintMain(); return; }
      if (t.hasAttribute("data-chopen")) { el.querySelector(".split.fix")?.classList.add("chsheet"); return; }
      if (t.hasAttribute("data-chclose")) { el.querySelector(".split.fix")?.classList.remove("chsheet"); return; }
      if (t.dataset.wday !== undefined) { st.wday = +t.dataset.wday; st.editPost = null; paintMain(); return; }
      if (t.hasAttribute("data-peclose")) { st.editPost = null; paintMain(); return; }
      if (t.dataset.pesave) { const v = val("#pe-when"); if (!v) return; await api.socialPost(t.dataset.pesave, { scheduled_at: v.replace("T", " ").slice(0, 16) }); toast("Đã đổi giờ đăng"); await refreshPosts(); return; }
      if (t.dataset.penow) { await api.socialPublish(t.dataset.penow); toast("Đang đăng…"); st.editPost = null; setTimeout(refreshPosts, 2500); return; }
      if (t.hasAttribute("data-exsched")) {
        const names = [...el.querySelectorAll("[data-expick]:checked")].map((i) => i.dataset.expick);
        if (!names.length) { toast("Chọn ít nhất một video", true); return; }
        const r = await api.socialSchedule({ names, channels: [st.cid] });
        toast(`Đã xếp ${r.created.length} video vào khung giờ trống`); await refreshPosts(); return;
      }
      if (t.dataset.approve) { await api.socialPost(t.dataset.approve, { approve: true }); toast("Đã duyệt · sẽ đăng đúng giờ"); await refreshPosts(); return; }
      if (t.dataset.cancel) { await api.socialPost(t.dataset.cancel, { cancel: true }); toast("Đã bỏ"); await refreshPosts(); return; }
      // perf
      if (t.dataset.plist) { st.plist = t.dataset.plist; st.pshown = 60; paint(); return; }
      if (t.hasAttribute("data-bxlsx")) {
        const L = BD._last; if (!L) return;
        const H = { sku: ["SPU", "Sản phẩm"], staff: ["Nhân viên", "Ghi chú"], content: ["Mã", "Content"] }[L.by];
        const cols = [H[0], H[1], L.by === "sku" ? "Video SX" : "Video", "Đã đăng", "Page", "Tổng views", "TB view / video", ...(L.by === "sku" ? ["Chi tiêu ads (VND)", "Ads đang chạy", "Đã bán (SL, đơn OMS gồm ads + tự nhiên)", "Số đơn", "Bán 30 ngày (OMS)"] : []),
          ...(L.by === "staff" ? ["Content cũ", "Content mới"] : []), ...(L.by === "content" ? ["Loại", "Làm lại"] : []), "Thị trường tốt nhất", "Views video tốt nhất"];
        const rows = L.all.map((r) => [r.code || "", r.name || "", r.made, r.posted, r.pages, r.views, Math.round(r.avg || 0), ...(L.by === "sku" ? [Math.round(r.ads_spend || 0), r.ads_active || 0, r.sold ?? "", r.sold_orders ?? "", r.sold30 ?? ""] : []),
          ...(L.by === "staff" ? [r.old || 0, r.new || 0] : []), ...(L.by === "content" ? [r.kind || "", r.remakes || 0] : []), (r.best?.market || "").toUpperCase(), r.best?.views || 0]);
        await downloadXlsx(`hieu-qua-${L.by}-${DR.resolve(st.perfDr).join("_") || "toan-bo"}.xlsx`, [{ name: { sku: "Theo SPU", staff: "Theo nhân viên", content: "Theo content" }[L.by], columns: cols, rows }]);
        return;
      }
      if (t.hasAttribute("data-axlsx")) {
        const L = AD._last; if (!L) return;
        const cols = L.by === "ad" ? ["Quảng cáo", "Chiến dịch", "Tài khoản", "Trạng thái", "Chi tiêu (VND)", "Hiển thị", "CPM (VND)", "Click", "Tin nhắn", "Chi / tin (VND)", "SPU"]
          : [{ sku: "SPU", video: "Video", campaign: "Chiến dịch", family: "Tuyến" }[L.by], "Ads", "Đang chạy", "Chi tiêu (VND)", "Hiển thị", "CPM (VND)", "Tin nhắn", "Chi / tin (VND)", ...(L.by === "sku" ? ["Đã bán (SL, đơn OMS gồm ads + tự nhiên)", "Số đơn", "Bán 30 ngày (OMS)"] : []), L.by === "video" ? "SPU" : "Video"];
        const rows = L.all.map((r) => L.by === "ad"
          ? [r.name || "", r.campaign || "", r.account_name || "", r.status || "", Math.round(r.spend_vnd || 0), r.impressions || 0, r.impressions ? Math.round((r.spend_vnd / r.impressions) * 1000) : "", r.clicks || 0, r.messages || 0, r.messages ? Math.round(r.spend_vnd / r.messages) : "", (r.skus || []).join(", ")]
          : [L.by === "video" ? ((r.caption || r.name || "").split("#")[0].trim() || r.name || "") : r.code, r.ads || 0, r.active || 0, Math.round(r.spend || 0), r.impressions || 0, Math.round(r.cpm || 0), r.messages || 0,
            r.per_msg ? Math.round(r.per_msg) : "", ...(L.by === "sku" ? [r.sold ?? "", r.sold_orders ?? "", r.sold30 ?? ""] : []), L.by === "video" ? (r.skus || []).join(", ") : r.videos || 0]);
        await downloadXlsx(`quang-cao-${L.by}-${L.d.since || ""}_${L.d.until || ""}.xlsx`, [{ name: "Quảng cáo", columns: cols, rows }]);
        return;
      }
      if (t.hasAttribute("data-report")) { t.disabled = true; t.textContent = "Đang lập báo cáo…"; try { await makeReport(lib); } finally { t.disabled = false; t.textContent = "Báo cáo PDF"; } return; }
      if (t.dataset.amode) { st.amode = t.dataset.amode; st.apage = 0; st.asort = ""; paint(); return; }
      if (t.dataset.asort) { st.adir = st.asort === t.dataset.asort ? -(st.adir || -1) : (t.dataset.asort === "name" ? 1 : -1); st.asort = t.dataset.asort; st.apage = 0; paint(); return; }
      if (t.dataset.apage !== undefined) { st.apage = Math.max(0, +t.dataset.apage); paint(); return; }
      if (t.hasAttribute("data-adsrefresh")) { await api.adsRefresh(); toast("Đang lấy số liệu quảng cáo · khoảng 30 giây mỗi tài khoản"); const sEl = el.querySelector("#a-sync"); if (sEl) sEl.textContent = "Đang lấy…"; adsWatch(); return; }
      if (t.hasAttribute("data-clearsku")) { st.psku = ""; history.replaceState(null, "", "#/social/posts"); paint(); return; }
      if (t.dataset.pmode) { st.pmode = t.dataset.pmode; st.bsel = 0; st.bpage = 0; paint(); return; }
      if (t.dataset.bsort) { st.bdir = st.bsort === t.dataset.bsort ? -(st.bdir || -1) : (t.dataset.bsort === "name" ? 1 : -1); st.bsort = t.dataset.bsort; st.bpage = 0; st.bsel = 0; paint(); return; }
      if (t.dataset.bpage !== undefined) { st.bpage = Math.max(0, +t.dataset.bpage); st.bsel = 0; paint(); el.querySelector(".bwrap")?.scrollIntoView({ block: "start" }); return; }
      if (t.dataset.open) { await openItem(t.dataset.open); return; }
      if (t.hasAttribute("data-back")) { st.key = null; item = null; history.replaceState(null, "", "#/social/perf"); paint(); return; }
      if (t.hasAttribute("data-pmore")) { st.pshown = (st.pshown || 60) + 120; paint(); return; }
      if (t.hasAttribute("data-savewin")) { d.settings = await api.socialSettings({ win_views: Math.max(1000, +val("#win-v") || 100000) }); lib = await api.socialLibrary(); toast("Đã đổi tiêu chuẩn Content win"); paint(); return; }
      if (t.hasAttribute("data-analyze")) {
        t.disabled = true; t.textContent = "AI đang phân tích… (20–60 giây)";
        await api.socialAnalyze(st.key); await loadItem(); toast("Đã phân tích xong"); paintItem(); return;
      }
      if (t.dataset.tip) { lessons = await api.socialTip(st.key, +t.dataset.tip); await loadItem(); toast("Đã thêm vào bài học"); paintItem(); return; }
      if (t.hasAttribute("data-showless")) { st.lessons = true; lessons = await api.socialInsights().then((x) => x.lessons); paint(); return; }
      if (t.hasAttribute("data-closeless")) { st.lessons = false; paint(); return; }
      if (t.hasAttribute("data-ladd")) { lessons = await api.socialLesson("new", { text: val("#ls-new"), area: val("#ls-area") }); paint(); return; }
      if (t.dataset.lact) { const l = lessons.lessons.find((x) => x.id === t.dataset.lact); lessons = await api.socialLesson(l.id, { active: !l.active }); paint(); return; }
      if (t.dataset.lpin) { const l = lessons.lessons.find((x) => x.id === t.dataset.lpin); lessons = await api.socialLesson(l.id, { pinned: !l.pinned }); paint(); return; }
      if (t.dataset.ldel) { lessons = await api.socialLesson(t.dataset.ldel, { delete: true }); paint(); return; }
      if (t.hasAttribute("data-learn")) { t.disabled = true; t.textContent = "Đang phân tích toàn kênh…"; const r = await api.socialLearn(); toast(r.skipped || `Đã rút ${r.lessons} bài học`, !!r.skipped); lessons = await api.socialInsights().then((x) => x.lessons); paint(); return; }
      // connect
      if (t.hasAttribute("data-syncall")) { lib.status = await api.socialLibrarySync(+val("#l-days")); paint(); watch(); return; }
      if (t.dataset.syncone) { lib.status = await api.socialLibrarySync(+val("#l-days"), [t.dataset.syncone]); paint(); watch(); return; }
      if (t.hasAttribute("data-refreshpages")) { t.disabled = true; t.textContent = "Đang đọc page…"; await api.socialRefreshPages(); await reload(); toast(`Có ${lib.pages.length} page`); return; }
      if (t.hasAttribute("data-systoken")) { await api.socialSysToken(val("#sys-tok")); await reload(); toast(`Đã dùng mã hệ thống · ${lib.pages.length} page`); return; }
      if (t.hasAttribute("data-addteam")) { const v = (val("#t-new") || "").trim(); if (!v) return; await api.socialTeams([...lib.teams, v]); toast("Đã thêm team"); await reload(); return; }
      if (t.dataset.rmteam) { await api.socialTeams(lib.teams.filter((x) => x !== t.dataset.rmteam)); await reload(); return; }
      if (t.dataset.disc) { await api.socialDisconnect(t.dataset.disc); toast("Đã ngắt kết nối"); await reload(); return; }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("input", (e) => {
    if (e.target.id === "p-q") { st.q = e.target.value; st.shown = 60; el.querySelector("#p-grid").innerHTML = postGrid(lib); }
    if (e.target.id === "ch-q") { st.chq = e.target.value; paintChs(); }
    if (e.target.id === "b-q" || e.target.id === "a-q") {
      const id = e.target.id, v = e.target.value;
      if (id === "b-q") { st.bq = v; st.bpage = 0; st.bsel = 0; } else { st.aq = v; st.apage = 0; }
      clearTimeout(st._qT);
      st._qT = setTimeout(() => { paint(); const q = el.querySelector("#" + id); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250);
    }
    if (e.target.id === "ex-q") { st.exQ = e.target.value; clearTimeout(st._exT); st._exT = setTimeout(() => { paintMain(); const q = el.querySelector("#ex-q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 300); }
    if (e.target.id === "pg-q") { const q = e.target.value.trim().toLowerCase(); el.querySelectorAll("tr[data-row]").forEach((r) => { r.style.display = !q || r.dataset.row.includes(q) ? "" : "none"; }); }
    if (e.target.dataset.mix) { const tot = [...el.querySelectorAll("[data-mix]")].reduce((s, i) => s + +i.value, 0) || 1;
      el.querySelectorAll("[data-mix]").forEach((i) => { i.nextElementSibling.textContent = Math.round((+i.value / tot) * 100) + "%"; }); }
  });
  el.addEventListener("change", async (e) => {
    const t = e.target;
    try {
      if (t.dataset.f === "team" && st.tab === "schedule") { st.team = t.value; paintChs(); return; }
      if (t.dataset.f) { st[t.dataset.f] = t.value; st.shown = 60; paint(); return; }
      if (t.hasAttribute("data-aacc")) { st.aacc = t.value; st.apage = 0; paint(); return; }
      if (t.hasAttribute("data-aactive")) { st.aactive = t.checked; st.apage = 0; paint(); return; }
      if (t.hasAttribute("data-adays")) { await api.adsSettings({ days: +t.value }); toast(`Đang lấy lại số liệu ${t.value} ngày`); adsWatch(); return; }
      if (t.hasAttribute("data-pdays")) { st.pdays = +t.value; st.bpage = 0; paint(); return; }
      if (t.hasAttribute("data-pf2")) { st.ppf = t.value; paint(); return; }
      if (t.hasAttribute("data-pmk")) { st.pmk = t.value; st.bsel = 0; st.bpage = 0; paint(); return; }
      if (t.hasAttribute("data-psrc")) { st.psrc = t.value; st.bsel = 0; st.bpage = 0; paint(); return; }
      if (t.hasAttribute("data-exday")) { st.exDay = t.value; st.exShown = 48; paintMain(); return; }
      if (t.hasAttribute("data-exfam")) { st.exFam = t.value; st.exShown = 48; paintMain(); return; }
      if (t.hasAttribute("data-exstate")) { st.exState = t.value; st.exShown = 48; paintMain(); return; }
      // connect: save in place — the table does not redraw or jump
      if (t.dataset.mk) {
        await api.socialPageMarket(t.dataset.mk, { market: t.value });
        t.parentElement.querySelector(".auto-h")?.remove();
        const pg = lib.pages.find((x) => x.id === t.dataset.mk); if (pg) { pg.market = t.value; pg.market_auto = false; }
        lib.channels.filter((c) => c.page_id === t.dataset.mk).forEach((c) => { c.market = t.value; });
        toast(`Đã gán thị trường ${t.value.toUpperCase()}`); return;
      }
      if (t.dataset.tm !== undefined) {
        await api.socialPageMarket(t.dataset.tm, { team: t.value });
        lib.channels.filter((c) => c.page_id === t.dataset.tm).forEach((c) => { c.team = t.value; });
        toast(t.value ? `Đã gắn ${t.value}` : "Đã bỏ team"); return;
      }
      if (t.dataset.track) { await api.socialPageMarket(t.dataset.track, { track: t.checked }); t.closest("tr").classList.toggle("off", !t.checked); const pg = lib.pages.find((x) => x.id === t.dataset.track); if (pg) pg.track = t.checked; return; }
    } catch (err) { toast(err.message, true); }
  });
  ctx.setShow?.(() => { if (st.tab === "schedule" && !st.editPost) refreshPosts(); });
  ctx.setCleanup(() => clearTimeout(syncT));
}

function csv(rows) {
  const cols = [["platform", "Nền tảng"], ["page", "Trang"], ["market", "Thị trường"], ["team", "Team"], ["by", "Ai đăng"], ["created", "Ngày đăng"], ["title", "Mô tả"], ["url", "Link"],
    ["duration", "Độ dài (s)"], ["views", "Lượt xem"], ["views_3s", "Xem 3s"], ["view_time_s", "Tổng thời gian xem (s)"], ["avg_watch_s", "Xem TB (s)"], ["likes", "Thích"],
    ["comments", "Bình luận"], ["shares", "Chia sẻ"], ["saves", "Lưu"], ["reach", "Tiếp cận"], ["er", "Tương tác %"], ["score", "Điểm"], ["export", "File hệ thống"]];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(["﻿" + [cols.map((c) => q(c[1])).join(","), ...rows.map((r) => cols.map(([f]) => q(r[f])).join(","))].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `video-da-dang-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
