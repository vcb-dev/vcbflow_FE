// Đã xuất: every finished video in the output folder (YYMMDD_<nhóm>_<mã SP>_<tên content>[_EN].mp4) — browse, filter by
// group / language / day, replay, and send one or many to the Telegram bot.
import { api, esc, toast } from "./admin-api.js";
import { money, isVi } from "../i18n.js";
import * as DR from "./date-range.js";

const LANG_TAG = { vi: "VN", en: "US", ja: "JP", es: "ES", th: "TH", id: "ID", zh: "TW" };
const LANG_NAME = { vi: "Việt Nam", en: "Anh · Mỹ", ja: "Nhật Bản", es: "Tây Ban Nha", th: "Thái Lan", id: "Indonesia", zh: "Đài Loan" };
const f = { q: "", fam: "", dr: DR.load("exports", "all"), lang: "" };
let picked = null;
let shown = 48;
let selecting = false;
const chosen = new Set();

const url = (name, kind = "file") => `/api/exports/${kind}?name=${encodeURIComponent(name)}`;
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const dayVi = (d) => { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; };
const tag = (l) => LANG_TAG[l || "vi"] || (l || "").toUpperCase();
const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PLANE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13l5-5"/></svg>';

function filtered(items) {
  const q = f.q.trim().toLowerCase();
  return items.filter((it) => (!f.fam || it.family === f.fam) && DR.inRange(it.made, DR.resolve(f.dr)) && (!f.lang || (it.lang || "vi") === f.lang)
    && (!q || `${it.title} ${it.sku} ${it.name}`.toLowerCase().includes(q)));
}

const aiCostChip = (c) => (c && c.logged ? `<span class="aicost" title="${Object.entries(c.by_task).map(([k, v]) => `${k}: ${money(v.vnd)}`).join(" · ")}">AI ${money(c.vnd)}</span>` : "");
function grid(items, tg) {
  const list = filtered(items);
  if (!list.length) return `<div class="empty">${items.length ? "Không có video khớp bộ lọc." : "Chưa có video nào được xuất. Video render HD xong sẽ tự vào đây."}</div>`;
  const state = (n) => tg.log.slice().reverse().find((e) => e.name === n);
  return `<div class="cgrid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">${list.slice(0, shown).map((it) => {
    const st = state(it.name);
    const on = chosen.has(it.name);
    const sentAt = tg.sent[it.name];
    return `<button type="button" class="cclip xcard${picked === it.name ? " sel" : ""}${on ? " picked" : ""}" data-name="${esc(it.name)}" aria-pressed="${selecting ? on : "false"}">
      <span class="tmb" style="aspect-ratio:9/16"><img src="${esc(url(it.name, "thumb"))}" alt="" loading="lazy" onerror="this.remove()">
        ${it.family ? `<span class="lb" style="background:var(--tag${esc(it.family)}-bg);color:var(--tag${esc(it.family)})">${esc(it.family)}</span>` : ""}
        <span class="xlang" title="${esc(LANG_NAME[it.lang || "vi"] || "")}">${esc(tag(it.lang))}</span>
        ${selecting ? `<span class="xchk${on ? " on" : ""}">${on ? CHECK : ""}</span>` : ""}
        ${st && st.state !== "sent" ? `<span class="xtg ${st.state === "error" ? "bad" : ""}" title="${esc(st.error || "")}">${st.state === "error" ? "Lỗi gửi" : st.state === "sending" ? "Đang gửi…" : "Chờ gửi"}</span>`
          : sentAt ? `<span class="xtg ok" title="Đã gửi Telegram ${esc(sentAt)}">${PLANE}</span>` : ""}
        <span class="tc">${dayVi(it.made).slice(0, 5)}</span>
        ${selecting ? "" : `<span class="xdel" role="button" tabindex="0" data-del="${esc(it.name)}" title="Xoá video" aria-label="Xoá video ${esc(it.title)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></span>`}</span>
      <span style="padding:8px 10px;display:flex;flex-direction:column;gap:4px">
        <span style="font-weight:600;font-size:12.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(it.title)}</span>
        <span class="mono small muted" style="display:flex;gap:6px;justify-content:space-between">${esc(it.sku)}${aiCostChip(it.ai_cost)}</span></span></button>`;
  }).join("")}</div>
    ${list.length > shown ? `<div class="pager" style="justify-content:center"><button class="btn sm" type="button" data-more>Xem thêm</button></div>` : ""}`;
}

function viewer(items, tg) {
  const it = items.find((x) => x.name === picked);
  if (!it) return "";
  const sentAt = tg.sent[it.name];
  return `<div class="scrim" data-close></div><aside class="drawer" aria-label="Xem video" style="width:min(460px,100vw)">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <span style="display:flex;gap:8px;align-items:center">${it.family ? `<span class="fam ${esc(it.family)}">${esc(it.family)}</span>` : ""}<span class="chip mono">${esc(tag(it.lang))}</span><span class="mono small">${esc(it.sku)}</span></span>
      <button class="btn icon" type="button" data-close aria-label="Đóng">✕</button></div>
    <h2 style="margin:0;font-size:17px;line-height:1.35">${esc(it.title)}</h2>
    <video src="${esc(url(it.name))}" controls autoplay playsinline preload="metadata" style="display:block;height:64vh;max-width:100%;aspect-ratio:9/16;margin:0 auto;background:#000;border-radius:12px"></video>
    <div class="kv" style="grid-template-columns:110px 1fr"><span class="muted">Ngày làm</span><span>${dayVi(it.made)}</span>
      <span class="muted">Ngôn ngữ</span><span>${esc(LANG_NAME[it.lang || "vi"] || it.lang)}</span>
      <span class="muted">Dung lượng</span><span>${mb(it.size)}</span><span class="muted">Tên file</span><span class="mono small" style="word-break:break-all">${esc(it.name)}</span>
      ${sentAt ? `<span class="muted">Telegram</span><span>Đã gửi ${esc(sentAt)}</span>` : ""}
      ${it.ai_cost?.logged ? `<span class="muted">Chi phí AI</span><span><b>${money(it.ai_cost.vnd)}</b> <span class="small muted">${isVi() ? `· $${it.ai_cost.usd.toFixed(4)} ` : ""}· ${Object.entries(it.ai_cost.by_task).map(([k, v]) => `${esc(k)} ${money(v.vnd)}`).join(" · ")}</span></span>` : ""}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn pri" type="button" data-tgone="${esc(it.name)}">${PLANE} ${sentAt ? "Gửi lại Telegram" : "Gửi lên Telegram"}</button>
      <button class="btn" type="button" data-schedone="${esc(it.name)}">Lên lịch đăng</button>
      <a class="btn" href="${esc(url(it.name))}" download="${esc(it.name)}">Tải về</a>
      <button class="btn" type="button" data-copy="${esc(it.name)}">Chép tên file</button>
      <button class="btn danger" type="button" data-delone="${esc(it.name)}">Xoá video</button>
      ${it.job_id ? `<a class="btn" href="#/review/${encodeURIComponent(it.job_id)}">Mở trong Duyệt</a><a class="btn" href="/?job=${encodeURIComponent(it.job_id)}">Sửa trong Studio</a>` : ""}</div></aside>`;
}

async function schedModalHtml(names, langs) {
  const d = await api.social();
  const PFC = { facebook: ["FB", "#1877F2"], instagram: ["IG", "#C13584"], tiktok: ["TT", "#E11D48"] };
  const chs = d.channels || [];
  return `<div class="scrim" data-sclose></div><div class="box pad xmodal" role="dialog" aria-label="Lên lịch đăng">
    <h2>Lên lịch đăng ${names.length} video</h2>
    ${chs.length ? `<div class="small muted">Kênh (đã chọn sẵn kênh có thị trường cùng ngôn ngữ video: ${[...langs].map((l) => l.toUpperCase()).join(", ")})</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <input class="in" id="s-chq" type="search" placeholder="Tìm kênh" style="flex:1;min-width:140px;min-height:32px" aria-label="Tìm kênh">
      <button class="btn sm" type="button" data-schall>Chọn tất cả</button><button class="btn sm" type="button" data-schnone>Bỏ chọn</button>
      <button class="btn sm" type="button" data-schlang>Cùng ngôn ngữ</button><span class="small muted" id="s-chn"></span></div>
    <div style="display:grid;gap:4px;max-height:300px;overflow:auto" id="s-chlist">${chs.map((c) => `<label data-chname="${esc(c.name.toLowerCase())}" data-chlang="${esc(c.lang)}" style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" class="chk" data-sch="${esc(c.cid)}" ${langs.has(c.lang) ? "checked" : ""}>
      <span class="pfchip" style="background:${(PFC[c.platform] || PFC.facebook)[1]}">${(PFC[c.platform] || PFC.facebook)[0]}</span><span style="flex:1">${esc(c.name)}</span>
      <span class="chip mono">${esc((c.market || "").toUpperCase())}</span>${c.team ? `<span class="small muted">${esc(c.team)}</span>` : ""}</label>`).join("")}</div>`
      : '<div class="small" style="color:var(--warn)">Chưa kết nối kênh nào — vào Đăng &amp; hiệu quả › Kết nối.</div>'}
    <label class="f" for="s-when">Giờ đăng</label><input class="in mono" id="s-when" type="datetime-local" style="width:auto">
    <div class="small muted">Để trống = mỗi video vào khung giờ trống tiếp theo theo lịch của từng kênh (Đăng &amp; hiệu quả › Lịch đăng).</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-sclose>Huỷ</button><button class="btn pri" type="button" data-sgo>Xếp lịch</button></div></div>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  let [data, tg] = await Promise.all([api.exports(), api.telegramStatus().catch(() => ({ ready: false, log: [], sent: {} }))]);
  if (ctx.params?.[0]) { picked = ctx.params[0]; selecting = false; }   // #/exports/<file name>: open that video
  const days = () => [...new Set(data.items.map((x) => x.made))].slice(0, 60);
  const selbar = () => selecting ? `<div class="box xsel"><strong>${chosen.size} video đã chọn</strong>
      <button class="btn sm" type="button" data-all>Chọn hết đang lọc</button><button class="btn sm" type="button" data-none>Bỏ chọn</button>
      <div style="flex:1"></div>${tg.ready ? "" : '<span class="small" style="color:var(--warn)">Chưa cài Telegram · Cài đặt › Khoá kết nối</span>'}
      <button class="btn" type="button" data-sched ${chosen.size ? "" : "disabled"}>Lên lịch đăng</button>
      <button class="btn danger" type="button" data-delsel ${chosen.size ? "" : "disabled"}>Xoá ${chosen.size || ""} video</button>
      <button class="btn pri" type="button" data-tgsend ${chosen.size && tg.ready ? "" : "disabled"}>${PLANE} Gửi lên Telegram</button></div>` : "";
  const paintGrid = () => {
    el.querySelector("#xgrid").innerHTML = grid(data.items, tg);
    el.querySelector("#xselbar").innerHTML = selbar();
  };
  const paint = () => {
    const fams = ["A1", "A2", "A3", "A4", "A5"].filter((k) => data.items.some((x) => x.family === k));
    const langs = Object.keys(LANG_TAG).filter((k) => data.items.some((x) => (x.lang || "vi") === k));
    const total = data.items.reduce((s, x) => s + x.size, 0);
    el.innerHTML = `<header class="ph-bar"><h1>Đã xuất</h1><span class="muted small">${data.items.length} video · ${mb(total)}</span><div class="sp"></div>
        <label class="search" style="width:260px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
          <span class="sr">Tìm video</span><input id="x-q" type="search" placeholder="Tìm tên, mã SP" value="${esc(f.q)}"></label>
        <button class="btn" type="button" id="x-sel" aria-pressed="${selecting}">${selecting ? "Xong" : "Chọn nhiều video"}</button>
        <button class="btn" type="button" id="x-reload">Làm mới</button></header>
      <div class="page">
        <div class="chips" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <button type="button" class="pill" data-fam="" aria-pressed="${!f.fam}">Tất cả</button>
          ${fams.map((k) => `<button type="button" class="pill" data-fam="${k}" aria-pressed="${f.fam === k}">${k}<span class="n">${data.items.filter((x) => x.family === k).length}</span></button>`).join("")}
          <span class="vsep" style="margin:0 4px"></span>
          <button type="button" class="pill" data-lang="" aria-pressed="${!f.lang}">Mọi ngôn ngữ</button>
          ${langs.map((k) => `<button type="button" class="pill" data-lang="${k}" aria-pressed="${f.lang === k}" title="${esc(LANG_NAME[k])}"><span class="mono">${tag(k)}</span><span class="n">${data.items.filter((x) => (x.lang || "vi") === k).length}</span></button>`).join("")}
          <div style="flex:1"></div>
          ${DR.html("exports", f.dr)}</div>
        <div id="xselbar">${selbar()}</div>
        <div id="xgrid">${grid(data.items, tg)}</div></div>
      <div id="xview">${viewer(data.items, tg)}</div>`;
  };
  paint();
  const send = async (names) => {
    try { tg = await api.telegramSend(names); toast(`Đang gửi ${names.length} video lên Telegram…`); paintGrid(); poll(); }
    catch (err) { toast(err.message, true); }
  };
  let pollT = null;
  const poll = () => {
    clearTimeout(pollT);
    pollT = setTimeout(async () => {
      tg = await api.telegramStatus().catch(() => tg);
      paintGrid();
      const busy = tg.log.some((e) => e.state === "waiting" || e.state === "sending");
      if (busy) poll();
      else {
        const errs = tg.log.filter((e) => e.state === "error").length;
        toast(errs ? `Gửi Telegram xong · ${errs} lỗi` : "Đã gửi xong lên Telegram", !!errs);
      }
    }, 2500);
  };
  if (tg.log.some((e) => e.state === "waiting" || e.state === "sending")) poll();
  el.addEventListener("input", (e) => {
    if (e.target.id === "s-chq") { const q = e.target.value.trim().toLowerCase(); el.querySelectorAll("#s-chlist label").forEach((l) => { l.style.display = !q || l.dataset.chname.includes(q) ? "" : "none"; }); return; }
    if (e.target.id === "x-q") { f.q = e.target.value; shown = 48; paintGrid(); }
  });
  DR.wire(el, (_, r) => { f.dr = r; paint(); });
  const del = async (names, btn) => {
    if (btn && btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.classList.add("armed"); if (btn.tagName === "BUTTON") btn.textContent = `Bấm lần nữa để xoá${names.length > 1 ? ` ${names.length} video` : ""}`; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove("armed"); } }, 4000); return; }
    try {
      const r = await api.exportsDelete(names);
      const gone = new Set(r.deleted);
      data.items = data.items.filter((x) => !gone.has(x.name));
      gone.forEach((n) => chosen.delete(n));
      if (gone.has(picked)) picked = null;
      paint();
      toast(`Đã xoá ${r.deleted.length} video · file chuyển vào thư mục _da_xoa trong OUTPUT`);
    } catch (err) { toast(err.message, true); }
  };
  el.addEventListener("click", async (e) => {
    const dz = e.target.closest("[data-del]");
    if (dz) { e.preventDefault(); e.stopPropagation(); await del([dz.dataset.del], dz); return; }
    const t = e.target.closest("button, [data-close], [data-sclose]");
    if (!t) return;
    if (t.dataset.delone) { await del([t.dataset.delone], t); return; }
    if (t.hasAttribute("data-delsel")) { await del([...chosen], t); if (!chosen.size) { selecting = false; paint(); } return; }
    if (t.dataset.fam !== undefined && t.classList.contains("pill")) { f.fam = t.dataset.fam; paint(); return; }
    if (t.dataset.lang !== undefined && t.classList.contains("pill")) { f.lang = t.dataset.lang; paint(); return; }
    if (t.id === "x-sel") { selecting = !selecting; if (!selecting) chosen.clear(); paint(); return; }
    if (t.hasAttribute("data-all")) { filtered(data.items).forEach((x) => chosen.add(x.name)); paintGrid(); return; }
    if (t.hasAttribute("data-none")) { chosen.clear(); paintGrid(); return; }
    if (t.hasAttribute("data-tgsend")) { const names = [...chosen]; chosen.clear(); selecting = false; paint(); await send(names); return; }
    if (t.hasAttribute("data-sched")) { schedModal([...chosen]); return; }
    if (t.dataset.schedone) { schedModal([t.dataset.schedone]); return; }
    if (t.hasAttribute("data-sclose")) { el.querySelector("#xsched")?.remove(); return; }
    if (t.hasAttribute("data-schall") || t.hasAttribute("data-schnone") || t.hasAttribute("data-schlang")) {
      const box = el.querySelector("#xsched"), langs = new Set(JSON.parse(box.dataset.langs || "[]"));
      box.querySelectorAll("#s-chlist label").forEach((l) => {
        if (l.style.display === "none") return;
        const i = l.querySelector("input");
        i.checked = t.hasAttribute("data-schall") ? true : t.hasAttribute("data-schnone") ? false : langs.has(l.dataset.chlang);
      });
      box.querySelector("#s-chn").textContent = `${box.querySelectorAll("[data-sch]:checked").length} kênh`;
      return;
    }
    if (t.hasAttribute("data-sgo")) {
      const box = el.querySelector("#xsched");
      const channels = [...box.querySelectorAll("[data-sch]:checked")].map((i) => i.dataset.sch);
      const when = box.querySelector("#s-when").value;
      try {
        const r = await api.socialSchedule({ names: JSON.parse(box.dataset.names), channels, when: when ? when.replace("T", " ") : null });
        box.remove(); chosen.clear(); selecting = false; paint();
        toast(r.created.length ? `Đã xếp ${r.created.length} bài · xem ở Đăng & hiệu quả` : "Các video này đã có lịch trên nền tảng đã chọn");
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.tgone) { await send([t.dataset.tgone]); el.querySelector("#xview").innerHTML = viewer(data.items, tg); return; }
    if (t.dataset.name) {
      if (selecting) { chosen.has(t.dataset.name) ? chosen.delete(t.dataset.name) : chosen.add(t.dataset.name); paintGrid(); return; }
      picked = t.dataset.name; el.querySelector("#xview").innerHTML = viewer(data.items, tg); return;
    }
    if (t.hasAttribute("data-close")) { picked = null; el.querySelector("#xview").innerHTML = ""; if (location.hash.split("/").length > 2) history.replaceState(null, "", "#/exports"); return; }
    if (t.hasAttribute("data-more")) { shown += 48; paintGrid(); return; }
    if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); toast("Đã chép tên file"); } catch { toast(t.dataset.copy); } return; }
    if (t.id === "x-reload") { data = await api.exports(); tg = await api.telegramStatus().catch(() => tg); paint(); }
  });
  async function schedModal(names) {
    if (!names.length) return;
    const w = document.createElement("div");
    w.id = "xsched"; w.dataset.names = JSON.stringify(names);
    const langs = new Set(names.map((n) => (data.items.find((x) => x.name === n) || {}).lang || "vi"));
    w.dataset.langs = JSON.stringify([...langs]);
    try { w.innerHTML = await schedModalHtml(names, langs); } catch (err) { toast(err.message, true); return; }
    el.querySelector("#xsched")?.remove(); el.appendChild(w);
  }
  const onKey = (e) => { if (!el.getClientRects().length) return; /* screen kept alive but hidden */ if (e.key === "Escape" && picked) { picked = null; el.querySelector("#xview").innerHTML = ""; } };
  document.addEventListener("keydown", onKey);
  const timer = setInterval(async () => { if (el.getClientRects().length && !picked && !selecting) { const d = await api.exports().catch(() => null); if (d && d.items.length !== data.items.length) { data = d; paint(); } } }, 15000);
  ctx.setShow?.(async () => { if (picked || selecting) return; const d = await api.exports().catch(() => null); if (d && JSON.stringify(d.items.map((x) => x.name)) !== JSON.stringify(data.items.map((x) => x.name))) { data = d; paint(); } });
  ctx.setCleanup(() => { clearInterval(timer); clearTimeout(pollT); document.removeEventListener("keydown", onKey); });
}
