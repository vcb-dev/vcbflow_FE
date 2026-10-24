// Kho footage: 3 kho — Sản phẩm (chia mục theo thư mục SOURCE: Nhẫn / Lắc tay / Dây chuyền / Product; bộ theo mã SP + độ phủ công đoạn),
// HuyK (nhân vật), Outro (ghép cuối video VN). Quét từng mục, hủy quét giữa chừng.
import { api, esc, media, thumbImg, toast } from "./admin-api.js";

const st = { lib: "product", cat: "", group: "", q: "", shown: 60, picked: null };
const LIBS = { product: "Sản phẩm", huyk: "HuyK", illus: "Minh hoạ AI", outro: "Outro" };
const libOf = (c) => (c.library === "huyk" ? "huyk" : c.library === "outro" ? "outro" : c.library === "illus" ? "illus" : "product");
/** group key of a clip: HuyK Talk by shirt-colour stock, AI illustrations by topic folder, other HuyK clips by kind */
const gkey = (c) => (c.library === "illus" ? `topic:${c.topic || ""}` : c.huyk_kind === "talk" ? `talk:${c.huyk_stock || "Chung"}` : c.huyk_kind || "craft");
const catOf = (c) => c.category || (c.library === "broll" ? "product" : "khac");
const MK = { vn: "VN", jp: "JP", eu: "EU", us: "US", th: "TH", id: "ID", tw: "TW", kr: "KR", cn: "CN" };
/** Product categories: the SOURCE folders (even still empty) + whatever the indexed clips carry. */
function cats(lib, src) {
  const m = new Map();
  (src.folders || []).filter((f) => f.library === "product" || f.library === "broll").forEach((f) => { if (!m.has(f.category)) m.set(f.category, { key: f.category, label: f.label, folder: f.folder, n: 0 }); });
  lib.filter((c) => libOf(c) === "product").forEach((c) => {
    const k = catOf(c);
    if (!m.has(k)) m.set(k, { key: k, label: c.category_label || (k === "product" ? "Product" : k), folder: (c.source_rel || "").split("/")[0], n: 0 });
    m.get(k).n += 1;
  });
  return [...m.values()];
}
const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="14" r="6"/><path d="M9.5 6.5L12 4l2.5 2.5L12 9z"/></svg>';
const dur = (c) => (c.usable ? (c.usable[1] - c.usable[0] + 0.05).toFixed(1) + "s" : "");

/** Groups of the active library: product = SKU sets, huyk = action/step label, outro = HuyK outros + shoot batches. */
function groups(lib, cov) {
  const clips = lib.filter((c) => libOf(c) === st.lib && (st.lib !== "product" || !st.cat || catOf(c) === st.cat));
  if (st.lib === "product") {
    const total = Math.max(1, cov.columns.length);
    const skus = new Set(clips.map((c) => c.product_set).filter(Boolean));
    return cov.rows.filter((r) => skus.has(r.sku)).map((r) => ({ key: r.sku, label: r.sku, sub: r.name, n: r.clips, cov: Object.values(r.cells).filter((v) => v > 0).length, total,
      thumb: clips.find((c) => c.product_set === r.sku)?.thumb }));
  }
  const by = new Map();
  clips.forEach((c) => {
    const key = st.lib === "outro" ? (c.outro_kind === "huyk" ? "huyk" : `batch:${c.batch || "khac"}`) : gkey(c);
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(c);
  });
  const name = (k, list) => (st.lib === "outro" ? (k === "huyk" ? "Outro HuyK · VN" : list[0].step_label || "Đợt quay")
    : k.startsWith("talk:") ? `HuyK Talk · ${k.slice(5)}` : k.startsWith("topic:") ? k.slice(6) : { gesture: "HuyK ra hiệu · nhìn", machine: "Máy móc · xưởng", craft: "HuyK làm nghề" }[k] || k);
  return [...by.entries()].sort((a, b) => (a[0] === "huyk" ? -1 : b[0] === "huyk" ? 1 : a[0].localeCompare(b[0])))
    .map(([k, list]) => ({ key: k, label: name(k, list), sub: st.lib === "outro" && k === "huyk" ? "Tự ghép cuối mọi video" : "", n: list.length, thumb: list[0]?.thumb }));
}

function inGroup(c) {
  if (st.lib === "product" && st.cat && catOf(c) !== st.cat) return false;
  if (!st.group) return true;
  if (st.lib === "product") return c.product_set === st.group;
  if (st.lib === "outro") return st.group === "huyk" ? c.outro_kind === "huyk" : `batch:${c.batch || "khac"}` === st.group;
  return gkey(c) === st.group;
}

function clipsOf(lib) {
  const q = st.q.trim().toLowerCase();
  return lib.filter((c) => libOf(c) === st.lib && inGroup(c)
    && (!q || `${c.name} ${c.description_vi} ${c.step_label || ""} ${c.product_set || ""}`.toLowerCase().includes(q)));
}

function header(lib, src) {
  const n = (k) => lib.filter((c) => libOf(c) === k).length;
  const busy = src.state === "scanning";
  return `<header class="ph-bar"><h1>Kho footage</h1>
    <div class="seg" role="tablist" aria-label="Kho">${Object.entries(LIBS).map(([k, v]) => `<button type="button" role="tab" data-lib="${k}" aria-selected="${st.lib === k}">${v} · ${n(k)}</button>`).join("")}</div>
    <div class="sp"></div>
    <label class="search" style="width:240px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <span class="sr">Tìm footage</span><input id="f-q" type="search" placeholder="Tìm mã, công đoạn" value="${esc(st.q)}"></label>
    <span class="muted small" title="Phần mềm tự kiểm tra thư mục SOURCE mỗi 10 phút và quét file mới">${src.auto_paused_until ? `Tự quét tạm dừng đến ${src.auto_paused_until}` : "Tự quét · 10 phút"}</span>
    <button class="btn" id="src-scan" type="button" ${busy || !src.exists ? "disabled" : ""} title="${esc(src.source_dir || "")}">${scanLabel(lib, src)}</button>
    ${busy ? '<button class="btn danger" id="src-cancel" type="button" title="Dừng quét · clip đã quét xong vẫn giữ lại">Hủy quét</button>' : ""}
  </header>
  ${st.lib === "product" ? catBar(lib, src) : ""}`;
}

/** What the scan button scans: the selected category's folder, else the whole library tab. */
function scanTarget(lib, src) {
  if (st.lib === "product" && st.cat) {
    const c = cats(lib, src).find((x) => x.key === st.cat);
    if (c?.folder) return { folder: c.folder, label: c.label };
  }
  return { only: st.lib, label: LIBS[st.lib] };
}
function scanLabel(lib, src) {
  if (src.state === "scanning") {
    const what = src.folder ? src.folder.replace(/^\d+\.\s*/, "") + " " : src.only ? LIBS[src.only] || "" : "";
    return src.step || `Đang quét ${what}${src.done}/${src.total}`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>Quét ${esc(scanTarget(lib, src).label)}`;
}
function catBar(lib, src) {
  const cs = cats(lib, src);
  const all = lib.filter((c) => libOf(c) === "product").length;
  const b = (k, l, n) => `<button type="button" class="pill" data-cat="${esc(k)}" aria-pressed="${st.cat === k}">${esc(l)} <span class="mono muted">${n}</span></button>`;
  return `<div class="fcats" role="group" aria-label="Mục sản phẩm">${b("", "Tất cả", all)}${cs.map((c) => b(c.key, c.label, c.n)).join("")}
    ${st.cat === "product" ? '<span class="muted small">Clip sưu tầm, không gắn mã SP · AI không tự dùng, chọn tay trong Studio (mục Sưu tầm)</span>' : ""}</div>`;
}

function sideList(gs) {
  const row = (g) => `<button type="button" class="lrow${st.group === g.key ? " on" : ""}" data-group="${esc(g.key)}">
    <span class="ic">${g.thumb ? `<img src="${esc(media(g.thumb))}" alt="" loading="lazy" onerror="this.remove()">` : ICON}</span>
    <span class="bd"><span class="t1"><b class="${st.lib === "product" ? "mono" : ""}">${esc(g.label)}</b><span class="muted small">${g.n} clip</span></span>
      ${g.total ? `<span class="covbar" aria-label="${g.cov}/${g.total} công đoạn">${Array.from({ length: Math.min(g.total, 8) }, (_, i) => `<i class="${i < Math.round((g.cov / g.total) * Math.min(g.total, 8)) ? "on" : ""}"></i>`).join("")}</span>`
        : g.sub ? `<span class="muted small">${esc(g.sub)}</span>` : ""}</span></button>`;
  return `<button type="button" class="lrow${!st.group ? " on" : ""}" data-group=""><span class="ic">${ICON}</span><span class="bd"><span class="t1"><b>Tất cả</b></span></span></button>${gs.map(row).join("")}`;
}

function mainHead(lib, cov, gs) {
  const g = gs.find((x) => x.key === st.group);
  let chips = "";
  if (st.lib === "product" && g) {
    const r = cov.rows.find((x) => x.sku === st.group);
    chips = cov.columns.map((c) => `<span class="stepchip${r.cells[c.key] ? " on" : ""}"><span class="dot ${r.cells[c.key] ? "ok" : ""}"></span>${esc(c.label)}${r.cells[c.key] ? ` · ${r.cells[c.key]}` : ""}</span>`).join("");
  } else if (st.lib === "outro") {
    chips = ["Thị trường Việt Nam", "Voice tiếng Việt", "Dọc 1080×1920", st.group === "huyk" || !st.group ? "Tự ghép cuối mọi video" : "Chọn tay trong Studio"]
      .map((x) => `<span class="stepchip on"><span class="dot ok"></span>${x}</span>`).join("");
  }
  const cl = st.lib === "product" && st.cat ? cats(lib, { folders: [] }).find((x) => x.key === st.cat)?.label : "";
  const title = g ? g.label : `Tất cả ${(cl || LIBS[st.lib]).toLowerCase()}`;
  return `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:0;font-size:18px;font-weight:700;${st.lib === "product" && g ? "font-family:var(--mono)" : ""}">${esc(title)}</h2>
      <span class="muted">${g ? g.n : clipsOf(lib).length} clip${g?.sub && st.lib === "product" ? " · " + esc(g.sub) : ""}</span><div style="flex:1"></div>
      ${st.lib === "product" && g ? `<a class="btn pri" href="/?sku=${encodeURIComponent(st.group)}">Dựng video</a>` : ""}</div>
    ${chips ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div>` : ""}`;
}

let usage = {};                                   // clip id → [videos that used it, of which exported]
const PAGE = 60;
function card(c, lb) {
  const [n, done] = usage[c.id] || [0, 0];
  return `<button type="button" class="cclip${st.picked === c.id ? " sel" : ""}" data-clip="${esc(c.id)}">
      <span class="tmb">${thumbImg(c.thumb, c.name)}<span class="lb ${st.lib}">${c.library === "broll" ? "SƯU TẦM" : lb}${c.market && MK[c.market] ? " · " + MK[c.market] : ""}</span><span class="tc">${dur(c)}</span>
        <span class="uc${n ? "" : " zero"}" title="${n ? `Đã dùng trong ${n} video · ${done} đã xuất` : "Chưa dùng trong video nào"}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>${n} lần</span></span>
      <span class="meta"><span>${esc(st.lib === "outro" ? (c.step_label || c.name) : c.step_label || c.description_vi || c.name)}</span><span class="dot ${c.tags?.aesthetic >= 3 ? "ok" : "warn"}"></span></span></button>`;
}
const LB = () => (st.lib === "outro" ? "OUTRO" : st.lib === "huyk" ? "HUYK" : "SP");
const moreRow = (shown, total) => (total > shown ? `<div class="pager fmore" style="justify-content:center"><span class="muted small">${shown}/${total} · kéo xuống để xem thêm</span></div>` : total > PAGE ? `<div class="pager" style="justify-content:center"><span class="muted small">Đã hiện hết ${total} clip</span></div>` : "");

function grid(lib) {
  const list = clipsOf(lib);
  if (!list.length) return `<div class="empty">${st.lib === "outro" ? "Chưa có clip outro. Bỏ video vào SOURCE\\Outro rồi bấm Quét lại." : "Không có clip khớp."}</div>`;
  return `<div class="cgrid">${list.slice(0, st.shown).map((c) => card(c, LB())).join("")}</div><div id="fpager">${moreRow(st.shown, list.length)}</div>`;
}

/** Infinite scroll: the next 60 clips are appended when the end of the grid comes into view. */
function moreClips(el, lib) {
  const list = clipsOf(lib);
  if (st.shown >= list.length) return;
  const from = st.shown;
  st.shown = Math.min(list.length, st.shown + PAGE);
  el.querySelector("#fgrid .cgrid")?.insertAdjacentHTML("beforeend", list.slice(from, st.shown).map((c) => card(c, LB())).join(""));
  const pg = el.querySelector("#fpager");
  if (pg) pg.innerHTML = moreRow(st.shown, list.length);
}

function preview(lib) {
  const c = lib.find((x) => x.id === st.picked);
  if (!c) return "";
  return `<div class="scrim" data-close></div><aside class="drawer" aria-label="Xem clip" style="width:min(460px,100vw)">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong class="mono small" style="word-break:break-all">${esc(c.name)}</strong>
      <button class="btn icon" type="button" data-close aria-label="Đóng">✕</button></div>
    <video src="${esc(media(c.proxy))}#t=${c.best_moment_s || 0}" controls ${c.library === "outro" ? "" : "muted"} playsinline preload="metadata" style="width:100%;max-height:62vh;background:#000;border-radius:10px"></video>
    <div class="kv"><span class="muted">Mô tả</span><span>${esc(c.description_vi || "—")}</span>
      <span class="muted">Kho</span><span>${esc(LIBS[libOf(c)])}${c.product_set ? " · " + esc(c.product_set) : ""}</span>
      <span class="muted">Công đoạn</span><span>${esc(c.step_label || "—")}</span>
      <span class="muted">Dùng được</span><span class="mono">${(c.usable || []).join("–")}s</span></div></aside>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.className = "fscreen";                      // desktop: one screen high, product list and clip grid scroll on their own
  view.replaceChildren(el);
  if (!ctx.boot.library) {                        // admin shell boots without the ~9 MB clip list
    el.innerHTML = '<div class="empty is-busy">Đang tải kho footage…</div>';
    const full = await api.bootstrap();
    Object.assign(ctx.boot, { library: full.library, products: full.products, clip_count: full.clip_count });
  }
  let lib = ctx.boot.library;
  let src, cov;                                   // one round trip instead of two through the tunnel
  [src, cov, usage] = await Promise.all([api.sourceStatus().catch(() => ({ configured: false })), api.coverage(), api.footageUsage().catch(() => ({}))]);
  const paint = () => {
    const gs = groups(lib, cov);
    const sideTop = el.querySelector(".side-l")?.scrollTop || 0;
    el.innerHTML = `${header(lib, src)}<div class="split">
      <aside class="side-l" aria-label="Nhóm">${sideList(gs)}</aside>
      <section class="list" id="fmain">${mainHead(lib, cov, gs)}<div id="fgrid">${grid(lib)}</div></section></div><div id="fprev">${preview(lib)}</div>`;
    const side = el.querySelector(".side-l");
    if (side) side.scrollTop = sideTop;
    watchMore();
  };
  // the end of the grid (#fpager) coming into view loads the next page; the side list keeps its scroll position
  let io = null;
  const watchMore = () => {
    io?.disconnect();
    const pg = el.querySelector("#fpager");
    if (!pg || !("IntersectionObserver" in window)) return;
    io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { moreClips(el, lib); io.disconnect(); requestAnimationFrame(watchMore); } },
      { root: null, rootMargin: "600px 0px" });
    io.observe(pg);
  };
  paint();
  el.addEventListener("input", (e) => {
    if (e.target.id === "f-q") { st.q = e.target.value; st.shown = PAGE; el.querySelector("#fgrid").innerHTML = grid(lib); el.querySelector("#fmain").scrollTop = 0; watchMore(); }
  });
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-close]");
    if (!t) return;
    if (t.dataset.lib) { st.lib = t.dataset.lib; st.group = st.lib === "outro" ? "huyk" : ""; st.shown = 60; paint(); return; }
    if (t.dataset.cat !== undefined) { st.cat = t.dataset.cat; st.group = ""; st.shown = 60; paint(); return; }
    if (t.dataset.group !== undefined) { st.group = t.dataset.group; st.shown = 60; paint(); return; }
    if (t.dataset.clip) { st.picked = t.dataset.clip; el.querySelector("#fprev").innerHTML = preview(lib); return; }
    if (t.hasAttribute("data-close")) { st.picked = null; el.querySelector("#fprev").innerHTML = ""; return; }
    if (t.id === "src-scan") {
      const tg = scanTarget(lib, src);
      try { src = { ...src, ...(await api.sourceScan(tg.only || "", tg.folder || "")) }; wasBusy = true; paint(); toast(`Đang quét ${tg.label}`); } catch (err) { toast(err.message, true); }
    }
    if (t.id === "src-cancel") {
      try { src = { ...src, ...(await api.sourceScanCancel()) }; paint(); toast("Đang dừng quét · clip đã quét xong vẫn giữ lại"); } catch (err) { toast(err.message, true); }
    }
  });
  let wasBusy = src.state === "scanning";
  let lastReload = Date.now();
  const reloadLib = async () => {
    const boot = await api.bootstrap();
    Object.assign(ctx.boot, { library: boot.library, products: boot.products, clip_count: boot.clip_count });
    lib = boot.library; [cov, usage] = await Promise.all([api.coverage(), api.footageUsage().catch(() => usage)]); lastReload = Date.now(); paint();
  };
  let tick = 0;
  const timer = setInterval(async () => {
    tick += 1;
    if (src.state !== "scanning" && !wasBusy && tick % 4) return;          // idle: check every ~10 s (auto-scan may start)
    if (src.state === "scanning") wasBusy = true;
    src = await api.sourceStatus().catch(() => src);
    const b = el.querySelector("#src-scan");
    if (b && src.state === "scanning") { b.disabled = true; b.textContent = scanLabel(lib, src); if (!el.querySelector("#src-cancel")) paint(); }
    if (src.state === "scanning" && Date.now() - lastReload > 45000 && !st.picked) await reloadLib();   // finished clips appear while scanning
    if (wasBusy && src.state !== "scanning") { await reloadLib(); toast(src.state === "cancelled" ? `Đã hủy quét · giữ ${src.clips} clip` : `Đã quét xong · ${src.clips} clip`); }
    wasBusy = src.state === "scanning";
  }, 2500);
  const onKey = (e) => { if (!el.getClientRects().length) return; /* screen kept alive but hidden */ if (e.key === "Escape" && st.picked) { st.picked = null; el.querySelector("#fprev").innerHTML = ""; } };
  document.addEventListener("keydown", onKey);
  ctx.setCleanup(() => { io?.disconnect(); clearInterval(timer); document.removeEventListener("keydown", onKey); });
}
