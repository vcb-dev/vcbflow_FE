// Duyệt: Video (hàng chờ · xem · kiểm tra · duyệt/sửa/loại) và Gắn nhãn clip (AI đoán công đoạn, bấm Đúng / Loại).
// Replaces the old "Hàng duyệt" + "Bàn duyệt G2" screens; #/g2/<job> links land here.
import { api, esc, media, thumbImg, toast } from "./admin-api.js";
import { money } from "../i18n.js";

const QUEUE = ["waiting_g2", "missing_asset", "rendering", "created"];
let tab = "video";
let cur = null;
let reasons = new Set();
let tagCursor = 0;
let tagShown = 24;

function queueList(jobs, current) {
  const list = jobs.filter((j) => QUEUE.includes(j.state));
  if (current && !list.some((j) => j.id === current.id)) list.unshift(current);
  return list;
}

function qrow(j) {
  const title = j.content?.title || j.product_name || "Kịch bản tay";
  const p = j.poster || (j.render_status === "done" && j.revision ? `media/renders/${j.id}_r${j.revision}${j.quality === "preview" ? "_pv" : ""}.jpg` : "");
  return `<a class="lrow${cur === j.id ? " on" : ""}" href="#/review/${encodeURIComponent(j.id)}" style="text-decoration:none;align-items:flex-start">
    <span class="ic" style="width:36px;height:64px;flex-basis:36px">${p ? `<img src="${esc(media(p))}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
    <span class="bd"><span style="font-weight:600;line-height:1.35">${esc(title)}</span>
      <span class="muted small" style="display:flex;gap:8px;flex-wrap:wrap"><span class="mono">${esc(j.sku || "—")}</span>${j.duration ? `<span>${Math.round(j.duration)}s</span>` : ""}
        <span>${["rendering", "created"].includes(j.state) ? "đang dựng" : j.quality === "preview" ? "Nháp" : "HD"}</span></span></span></a>`;
}

function strip(job) {
  const T = (job.timeline?.duration || 1) + (job.outro && job.settings?.outro !== false ? job.outro.duration : 0);
  const shots = (job.timeline?.shots || []).map((s) => {
    const c = s.selected.kind === "clip" ? job.clips[s.selected.clip_id] : null;
    const color = !c ? "var(--gen)" : c.library === "huyk" ? "var(--huyk)" : "var(--real)";
    return `<span title="${esc(c?.step_label || "")}" style="flex:${s.duration} 1 0;height:26px;border-radius:4px;background:${color}"></span>`;
  });
  if (job.outro && job.settings?.outro !== false) shots.push(`<span title="Outro" style="flex:${job.outro.duration} 1 0;height:26px;border-radius:4px;background:var(--outro)"></span>`);
  return `<div class="pstrip" aria-label="Các cảnh · ${T.toFixed(0)}s">${shots.join("")}</div>`;
}

function checks(job) {
  const t = job.totals || {};
  const aiShare = t.shots ? t.gen_shots / t.shots : 0;
  const gaps = job.parts.filter((p) => p.status === "gap").length;
  const hd = job.render.status === "done" && job.render.quality !== "preview";
  const final = job.parts.some((p) => p.role === "product_final") || !job.sku;
  const items = [[hd, hd ? "Bản HD sẵn sàng" : "Mới có bản nháp 360p"], [!gaps, gaps ? `${gaps} phần thiếu cảnh` : "Đủ cảnh"],
    [final, "Có cảnh hoàn thiện"], [aiShare <= 0.3, `Cảnh AI ${Math.round(aiShare * 100)}%`],
    [!!job.outro && job.settings?.outro !== false, job.outro && job.settings?.outro !== false ? `Outro ${job.outro.label}` : "Không có outro"]];
  return `<div class="checks">${items.map(([ok, l]) => `<span><i class="${ok ? "ok" : "no"}">${ok ? "✓" : "!"}</i>${esc(l)}</span>`).join("")}</div>`;
}

const aiCostChip = (c) => (c && c.logged ? `<span class="aicost" title="${Object.entries(c.by_task).map(([k, v]) => `${k}: ${money(v.vnd)}`).join(" · ")}">AI ${money(c.vnd)}</span>` : "");
let opened = false;                  // phone: list first; a video opened from the list fills the screen
function videoView(jobs, job, rejectReasons) {
  const list = queueList(jobs, job && jobs.find((j) => j.id === job.id));
  if (!job) {
    return `<div class="split"><aside class="side-l" aria-label="Hàng chờ">${list.map(qrow).join("") || '<div class="empty">Không có video chờ duyệt.</div>'}</aside>
      <section class="stage"><div class="empty">${list.length ? "Chọn một video ở hàng chờ." : "Hết video chờ duyệt. Video mới vào đây khi dựng xong."}</div></section></div>`;
  }
  const r = job.render;
  const hd = r.status === "done" && r.quality !== "preview";
  const title = job.content?.title || job.product_name || "Kịch bản tay";
  const player = r.status === "done" ? `<video src="${esc(media(r.url))}" poster="${esc(media(r.poster || ""))}" controls playsinline preload="metadata"></video>`
    : `<div class="ph">${r.status === "rendering" ? "Đang dựng…" : r.status === "draft" ? "Bản nháp chưa render" : `Render lỗi<br><span class="small">${esc((r.error || "").slice(-140))}</span>`}</div>`;
  const next = list.find((j) => j.id !== job.id && j.state === "waiting_g2");
  return `<div class="split rv${opened ? " rv-open" : ""}">
    <aside class="side-l" aria-label="Hàng chờ">${list.map(qrow).join("")}</aside>
    <section class="stage"><a class="btn sm mob rv-back" href="#/review">← Danh sách</a><div class="player9">${player}</div>${strip(job)}</section>
    <aside class="side-r" aria-label="Quyết định" style="width:340px;flex-basis:340px">
      <div class="dt-head"><h2 style="font-size:16px">${esc(title)}</h2>
        <span class="muted small"><span class="mono">${esc(job.sku || "—")}</span> · ${(job.totals?.duration || 0).toFixed(0)}s${job.outro && job.settings?.outro !== false ? ` + outro ${job.outro.duration.toFixed(0)}s` : ""} · ${hd ? "HD" : "Nháp"} ${aiCostChip(job.ai_cost)}</span></div>
      <div class="decide">
        <div><div class="eyebrow" style="margin-bottom:8px">Kiểm tra</div>${checks(job)}</div>
        <div><div class="eyebrow" style="margin-bottom:8px">Lý do nếu chưa đạt</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${rejectReasons.map((x) => `<button type="button" class="pill" data-reason="${esc(x)}" aria-pressed="${reasons.has(x)}">${esc(x)}</button>`).join("")}</div></div>
        <div style="flex:1"></div>
        ${job.export ? `<a class="btn ok-soft" href="#/exports/${encodeURIComponent((job.export.name || job.export.path.split(/[\\/]/).pop()))}" title="${esc(job.export.path)}" style="justify-content:flex-start;gap:8px;white-space:normal;text-align:left;height:auto;padding:8px 12px">▶ <span><b>Xem file đã xuất</b><br><span class="small mono" style="word-break:break-all">${esc(job.export.name || job.export.path)}</span></span></a>`
          : job.export_error ? `<div class="small" style="color:var(--bad)">Xuất file lỗi: ${esc(job.export_error)}</div>` : ""}
        ${(job.review || []).length ? `<div class="muted small">Lần trước: ${esc(job.review.slice(-1)[0].decision)}${job.review.slice(-1)[0].reason ? " · " + esc(job.review.slice(-1)[0].reason) : ""}</div>` : ""}
        <div style="display:flex;flex-direction:column;gap:8px">
          ${hd ? '<button class="btn pri lg" type="button" data-d="pass">Duyệt · xuất HD</button>'
            : `<button class="btn pri lg" type="button" data-hd ${r.status === "rendering" ? "disabled" : ""}>${r.status === "rendering" ? "Đang dựng…" : "Render HD để duyệt"}</button>`}
          <div style="display:flex;gap:8px"><a class="btn" href="/?job=${encodeURIComponent(job.id)}" style="flex:1">Sửa trong Studio</a>
            <button class="btn danger" type="button" data-reject style="flex:1">Loại</button></div>
          <details><summary class="small muted">Khác</summary><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            ${hd ? `<button class="btn sm" type="button" data-export>${job.export ? "Xuất lại file" : "Xuất file"}</button>` : ""}
            ${job.export ? `<a class="btn sm" href="#/exports/${encodeURIComponent((job.export.name || job.export.path.split(/[\\/]/).pop()))}">Xem file đã xuất</a>` : ""}
            <button class="btn sm" type="button" data-d="capcut">Chuyển CapCut</button><a class="btn sm" href="${esc(api.packageUrl(job.id))}">Tải gói dữ liệu</a></div></details>
          ${next ? `<a class="btn sm" href="#/review/${encodeURIComponent(next.id)}">Video tiếp →</a>` : ""}
        </div></div></aside></div>`;
}

function tagsView(q) {
  if (!q.items.length) return '<div class="page"><div class="empty">Không còn clip nào cần xác nhận.</div></div>';
  const items = q.items.slice(0, Math.max(tagShown, tagCursor + 1));
  return `<div class="page"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="muted">Clip mới quét cần xác nhận công đoạn</span><div style="flex:1"></div>
      <span class="muted small"><kbd>A</kbd> đúng <kbd>R</kbd> loại <kbd>J</kbd>/<kbd>K</kbd> di chuyển</span></div>
    <div class="cgrid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${items.map((it, i) => `<div class="tagcard${i === tagCursor ? " cur" : ""}" data-i="${i}">
      <span class="tmb">${thumbImg(it.thumb, it.name)}</span>
      <div class="bd"><span style="display:flex;justify-content:space-between;gap:6px" class="muted small"><span class="mono">${esc(it.product_set || "HuyK")}</span><span>AI đoán</span></span>
        <select class="in" data-step="${i}" aria-label="Công đoạn">${q.steps.map((s) => `<option value="${s.key}" ${it.craft_step === s.key ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
        <div style="display:flex;gap:6px"><button class="btn sm okbtn" type="button" data-act="approve" data-i="${i}" style="flex:1">Đúng</button>
          <button class="btn sm" type="button" data-act="reject" data-i="${i}" style="flex:1">Loại</button></div></div></div>`).join("")}</div>
    ${q.items.length > items.length ? `<div class="pager" style="justify-content:center"><button class="btn sm" type="button" data-more>Xem thêm</button></div>` : ""}</div>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  let [q, { jobs, reject_reasons: rejectReasons }] = await Promise.all([api.tagQueue(), api.jobs()]);
  cur = ctx.params[0] || null;
  opened = !!cur;
  if (cur) tab = "video";
  if (!cur) cur = jobs.find((j) => j.state === "waiting_g2")?.id || jobs.find((j) => QUEUE.includes(j.state))?.id || null;
  let job = cur ? await api.getJob(cur).catch(() => null) : null;
  const waiting = () => jobs.filter((j) => j.state === "waiting_g2").length;

  const paint = () => {
    const previews = jobs.filter((j) => j.state === "waiting_g2" && j.quality === "preview").length;
    el.innerHTML = `<header class="ph-bar"><h1>Duyệt</h1>
      <div class="seg" role="tablist" aria-label="Loại duyệt"><button type="button" role="tab" data-tab="video" aria-selected="${tab === "video"}">Video · ${waiting()}</button>
        <button type="button" role="tab" data-tab="tags" aria-selected="${tab === "tags"}">Gắn nhãn clip · ${q.open}</button></div>
      <div class="sp"></div>${tab === "video" && previews ? `<button class="btn" type="button" id="hd-all">Render HD ${previews} bản nháp</button>` : ""}</header>
      ${tab === "video" ? videoView(jobs, job, rejectReasons) : tagsView(q)}`;
  };
  paint();

  const refresh = async () => {
    [{ jobs }] = await Promise.all([api.jobs()]);
    if (cur) job = await api.getJob(cur).catch(() => null);
    paint(); ctx.refreshBadges();
  };
  const decide = async (decision, reason = "") => {
    try {
      await api.review(job.id, { decision, reason });
      reasons = new Set();
      toast(decision === "pass" ? "Đã duyệt · gói HD sẵn sàng" : decision === "capcut" ? "Đã chuyển CapCut" : `Đã loại: ${reason}`);
      if (decision === "capcut") window.location.href = api.packageUrl(job.id);
      const next = jobs.find((j) => j.id !== job.id && j.state === "waiting_g2");
      if (next && decision !== "capcut") { location.hash = `#/review/${next.id}`; return; }
      await refresh();
    } catch (err) { toast(err.message, true); }
  };
  const tagDecide = async (i, decision) => {
    const it = q.items[i];
    if (!it) return;
    const step = el.querySelector(`[data-step="${i}"]`)?.value || null;
    try {
      await api.tagDecision(it.id, { decision, craft_step: step });
      q = await api.tagQueue();
      tagCursor = Math.min(tagCursor, Math.max(q.items.length - 1, 0));
      paint(); ctx.refreshBadges();
    } catch (err) { toast(err.message, true); }
  };

  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button, .tagcard");
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; paint(); return; }
    if (t.dataset.reason) { reasons.has(t.dataset.reason) ? reasons.delete(t.dataset.reason) : reasons.add(t.dataset.reason); t.setAttribute("aria-pressed", String(reasons.has(t.dataset.reason))); return; }
    if (t.dataset.d) { decide(t.dataset.d); return; }
    if (t.hasAttribute("data-reject")) {
      if (!reasons.size) { toast("Chọn lý do chưa đạt trước", true); return; }
      decide("reject", [...reasons][0]); return;
    }
    if (t.hasAttribute("data-export")) {
      t.disabled = true;
      try { job = await api.exportJob(job.id); toast(`Đã xuất: ${job.export.name}`); location.hash = `#/exports/${encodeURIComponent(job.export.name)}`; } catch (err) { toast(err.message, true); t.disabled = false; }
      return;
    }
    if (t.hasAttribute("data-hd")) {
      t.disabled = true;
      try { await api.bulkJobs({ ids: [job.id], action: "approve" }); toast("Đang render HD"); await refresh(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.id === "hd-all") {
      t.disabled = true;
      const ids = jobs.filter((j) => j.state === "waiting_g2" && j.quality === "preview").map((j) => j.id);
      try { const r = await api.bulkJobs({ ids, action: "approve" }); toast(`Đang render HD ${r.done.length} video`); await refresh(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.act) { tagCursor = Number(t.dataset.i); await tagDecide(tagCursor, t.dataset.act); return; }
    if (t.hasAttribute("data-more")) { tagShown += 24; paint(); return; }
    if (t.classList.contains("tagcard") && !e.target.closest("select")) { tagCursor = Number(t.dataset.i); el.querySelectorAll(".tagcard").forEach((c) => c.classList.toggle("cur", Number(c.dataset.i) === tagCursor)); }
  });
  const onKey = (e) => { if (!el.getClientRects().length) return; /* screen kept alive but hidden */
    if (tab !== "tags" || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "a") tagDecide(tagCursor, "approve");
    else if (k === "r") tagDecide(tagCursor, "reject");
    else if (k === "j" || k === "k") {
      tagCursor = Math.max(0, Math.min(q.items.length - 1, tagCursor + (k === "j" ? 1 : -1)));
      if (tagCursor >= tagShown) { tagShown += 24; paint(); }
      el.querySelectorAll(".tagcard").forEach((c) => c.classList.toggle("cur", Number(c.dataset.i) === tagCursor));
      el.querySelector(".tagcard.cur")?.scrollIntoView({ block: "nearest" });
    }
  };
  document.addEventListener("keydown", onKey);
  const timer = setInterval(() => { if (el.getClientRects().length && tab === "video" && (job?.render.status === "rendering" || jobs.some((j) => ["rendering", "created"].includes(j.state)))) refresh(); }, 4000);
  ctx.setShow?.(() => refresh());
  ctx.setCleanup(() => { clearInterval(timer); document.removeEventListener("keydown", onKey); });
}
