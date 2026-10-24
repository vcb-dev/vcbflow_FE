// Job · tự động: dải lịch tự động (bật/tắt, giờ, số video, chạy ngay) + bảng kanban theo trạng thái.
// Sửa lịch mở ngăn bên phải; "Chọn nhiều" bật tích chọn để duyệt/render/xoá hàng loạt.
import { api, esc, media, toast } from "./admin-api.js";
import { money } from "../i18n.js";

const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];          // Python weekday 0 = thứ 2
const MODES = { mix: "Kho trước, thiếu thì AI viết", library: "Chỉ kho content", ai: "AI viết mới toàn bộ" };
const COLS = [
  ["Nháp", ["draft"], ""], ["Đang dựng", ["rendering", "created"], "run"], ["Chờ duyệt", ["waiting_g2", "missing_asset"], "warn"],
  ["Đã duyệt", ["passed", "capcut"], "ok"], ["Lỗi", ["render_error", "rejected"], "bad"],
];
const selected = new Set();
let selecting = false;
let editing = null;                 // schedule id being edited ("" = new) — drawer open when !== null
let drawer = false;

const checks = (name, items, on, label = (x) => x, value = (x) => x) => items.map((x) =>
  `<label class="chip" style="cursor:pointer;min-height:32px"><input type="checkbox" class="chk" style="width:16px;height:16px" name="${name}" value="${esc(String(value(x)))}" ${on.includes(value(x)) ? "checked" : ""}> ${esc(label(x))}</label>`).join("");

function planForm(auto, s) {
  s = s || { name: "Lịch tự động", enabled: true, times: ["08:00"], days: [0, 1, 2, 3, 4, 5, 6], count: 5, skus: [],
    families: ["A4"], topics: [], content_mode: "mix", auto_render: false, langs: ["vi"], hook_text: false };
  const prods = auto.products;
  const langs = s.langs || ["vi"];
  const langChips = (auto.languages || [{ code: "vi", label: "Tiếng Việt", voice: true, outro: true }]).map((l) =>
    `<label class="chip" style="cursor:pointer;min-height:32px" title="${l.voice ? "Có giọng HuyK" : "Chưa có giọng HuyK cho ngôn ngữ này"}${l.outro ? " · có outro" : ""}">
      <input type="checkbox" class="chk" style="width:16px;height:16px" name="lang" value="${esc(l.code)}" ${langs.includes(l.code) ? "checked" : ""}>
      <span class="mono small">${esc(l.code.toUpperCase())}</span> ${esc(l.label)}${!l.voice ? ' <span class="muted small">· chưa có giọng</span>' : l.code !== "vi" && l.own_voice === false ? ' <span class="muted small">· giọng Việt</span>' : ""}</label>`).join("");
  return `<section aria-labelledby="plan-h" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 id="plan-h">${editing ? "Sửa lịch" : "Chạy tự động"}</h2>
      <span class="chip ${auto.ai_available ? "ok" : "warn"}">${auto.ai_available ? "AI viết content sẵn sàng" : "AI chưa có key · chỉ dùng kho"}</span></div>
    <div class="grid2">
      <div><label class="f" for="p-name">Tên lịch</label><input id="p-name" class="in" value="${esc(s.name)}"></div>
      <div><label class="f" for="p-count">Số video mỗi ngôn ngữ / lần chạy</label><input id="p-count" class="in" type="number" min="1" max="50" value="${s.count}"></div>
    </div>
    <div><span class="f">Ngôn ngữ xuất video <span class="muted" id="lang-n"></span></span><div class="tabs">${langChips}</div>
      <p class="muted small" style="margin:4px 0 0">Mỗi ngôn ngữ = 1 video riêng: lời HuyK + phụ đề đúng tiếng đó. Chọn nhiều tiếng thì cùng 1 sản phẩm sẽ lấy các đoạn footage khác nhau cho từng bản. Outro chỉ ghép cho bản tiếng Việt.</p></div>
    <div><span class="f">Nhóm content</span><div class="tabs">${checks("fam", Object.keys(auto.families), s.families, (f) => auto.families[f])}</div></div>
    <div><span class="f">Chủ đề (bỏ trống = tất cả)</span><div class="tabs">${checks("topic", auto.topics, s.topics)}</div></div>
    <div><label class="f" for="p-mode">Nguồn content</label><select id="p-mode" class="in">${Object.entries(MODES).map(([k, v]) =>
      `<option value="${k}" ${s.content_mode === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="f">Mã sản phẩm sẽ chạy <span id="sku-n" class="muted"></span></span>
        <span><button type="button" class="btn sm" id="sku-all">Chọn hết</button> <button type="button" class="btn sm" id="sku-none">Bỏ chọn</button></span></div>
      <input id="sku-q" class="in" placeholder="Tìm mã / tên…" style="margin:6px 0">
      <div id="sku-list" style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px">
        ${prods.length ? prods.map((p) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 2px;cursor:pointer" data-q="${esc((p.sku + " " + p.name).toLowerCase())}">
          <input type="checkbox" class="chk" name="sku" value="${esc(p.sku)}" ${s.skus.includes(p.sku) ? "checked" : ""}>
          <span class="mono" style="font-size:12.5px">${esc(p.sku)}</span><span class="muted small" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
          <span class="chip">${p.clips} clip</span></label>`).join("") : '<p class="muted small">Chưa có bộ footage sản phẩm trong SOURCE.</p>'}
      </div>
      <p class="muted small" style="margin:4px 0 0">Không chọn mã nào = chạy xoay vòng tất cả.</p>
    </div>
    <div class="grid2">
      <div><label class="f" for="p-times">Giờ chạy (HH:MM, cách nhau dấu phẩy)</label><input id="p-times" class="in" value="${esc(s.times.join(", "))}" placeholder="08:00, 14:00"></div>
      <div><span class="f">Ngày</span><div class="tabs">${checks("day", DAYS.map((_, i) => i), s.days, (i) => DAYS[i])}</div></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center"><input id="p-hook" type="checkbox" class="chk" ${s.hook_text ? "checked" : ""}> Hiện chữ tiêu đề ở đầu video</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="p-render" type="checkbox" class="chk" ${s.auto_render ? "checked" : ""}> Render luôn (bỏ qua bước duyệt nháp)</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="p-enabled" type="checkbox" class="chk" ${s.enabled ? "checked" : ""}> Lịch đang bật</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="p-run" class="btn pri" type="button">${editing ? "Lưu &amp; chạy ngay" : "Chạy ngay"}</button>
      <button id="p-save" class="btn" type="button">${editing ? "Lưu thay đổi lịch" : "Lưu thành lịch"}</button>
      ${editing ? '<button id="p-cancel" class="btn" type="button">Huỷ sửa</button>' : ""}
    </div>
    <p class="muted small" style="margin:0">Mỗi video ghép 1 mã SP × 1 content; footage chỉ lấy đúng bộ của mã. HuyK xuất hiện ~3–4s/lần, logo chỉ ở outro.</p>
  </section>`;
}

function readForm(el) {
  const vals = (n) => [...el.querySelectorAll(`input[name="${n}"]:checked`)].map((i) => i.value);
  return { name: el.querySelector("#p-name").value.trim() || "Lịch tự động", count: Number(el.querySelector("#p-count").value) || 1,
    families: vals("fam"), topics: vals("topic"), skus: vals("sku"), days: vals("day").map(Number),
    times: el.querySelector("#p-times").value.split(",").map((t) => t.trim()).filter(Boolean),
    content_mode: el.querySelector("#p-mode").value, auto_render: el.querySelector("#p-render").checked,
    langs: vals("lang").length ? vals("lang") : ["vi"], hook_text: el.querySelector("#p-hook").checked,
    enabled: el.querySelector("#p-enabled").checked };
}

function schedulesBox(auto) {
  const list = auto.schedules;
  const runs = auto.running.concat(auto.runs).slice(0, 8);
  return `<section aria-labelledby="sch-h" style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:14px">
    <h2 id="sch-h">Lịch đã lưu (${list.length})</h2>
    ${list.length ? list.map((s) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding:10px 0">
      <div style="flex:1;min-width:180px"><strong>${esc(s.name)}</strong> <span class="chip ${s.enabled ? "ok" : ""}">${s.enabled ? "bật" : "tắt"}</span>
        <div class="muted small">${esc(s.times.join(", ") || "chưa đặt giờ")} · ${s.days.length === 7 ? "mỗi ngày" : s.days.map((d) => DAYS[d]).join(" ")} · ${s.count} video${(s.langs || ["vi"]).length > 1 ? ` × ${s.langs.length} tiếng` : ""} · ${(s.langs || ["vi"]).map((l) => l.toUpperCase()).join(" ")} ·
        ${s.families.map((f) => `<span class="tag ${f}">${f}</span>`).join(" ")} · ${s.skus.length ? s.skus.length + " mã SP" : "mọi mã"} · ${esc(MODES[s.content_mode])}${s.auto_render ? " · render luôn" : ""}</div></div>
      <button class="btn sm" data-srun="${esc(s.id)}" type="button">Chạy ngay</button>
      <button class="btn sm" data-sedit="${esc(s.id)}" type="button">Sửa</button>
      <button class="btn sm" data-sdel="${esc(s.id)}" type="button">Xoá</button></div>`).join("") : '<p class="muted small">Chưa có lịch. Điền form bên trên rồi bấm "Lưu thành lịch".</p>'}
    <h2 style="margin-top:14px">Nhật ký chạy</h2>
    ${runs.length ? runs.map((r) => `<div style="border-top:1px solid var(--line);padding:8px 0">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip ${r.state === "running" ? "run" : r.errors?.length ? "warn" : "ok"}">${r.state === "running" ? "đang chạy" : r.state === "error" ? "lỗi" : "xong"}</span>
        <span class="mono small">${esc((r.started_at || "").slice(5, 16))}</span><span>${esc(r.name || "")}</span>
        <span class="muted small">${r.jobs.length}${r.requested ? "/" + r.requested : ""} job</span></div>
      ${(r.errors || []).slice(0, 3).map((e) => `<div class="small" style="color:var(--bad)">${esc(e)}</div>`).join("")}</div>`).join("") : '<p class="muted small">Chưa có lần chạy nào.</p>'}
  </section>`;
}

function nextRun(s) {
  if (!s?.enabled || !s.times?.length) return "";
  const now = new Date();
  for (let d = 0; d < 8; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const wd = (day.getDay() + 6) % 7;
    if (!s.days.includes(wd)) continue;
    for (const t of [...s.times].sort()) {
      const [h, m] = t.split(":").map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      if (at > now) return `${t} ${d === 0 ? "hôm nay" : d === 1 ? "mai" : DAYS[wd]}`;
    }
  }
  return "";
}

function autostrip(auto) {
  const s = auto.schedules[0];
  if (!s) {
    return `<section class="box autostrip" aria-label="Lịch tự động"><strong>Tự động</strong><span class="muted">Chưa có lịch chạy</span><div style="flex:1"></div>
      <button class="btn" type="button" data-open-plan="">Tạo lịch</button>
      <button class="btn pri" type="button" data-full-auto title="Mỗi ngày 08:00 · 10 video · tự xoay vòng mọi mã sản phẩm · kho content trước, thiếu thì AI viết · render HD và xuất file">Bật tự động hoàn toàn</button></section>`;
  }
  const running = auto.running.length;
  return `<section class="box autostrip" aria-label="Lịch tự động">
    <button class="switch" type="button" role="switch" aria-checked="${s.enabled}" aria-label="Bật lịch tự động" data-flip="${esc(s.id)}"></button>
    <strong>${esc(s.name)}</strong><span class="vsep"></span>
    <span class="muted">${esc(s.times.join(", ") || "chưa đặt giờ")} · ${s.days.length === 7 ? "hằng ngày" : s.days.map((d) => DAYS[d]).join(" ")}</span>
    <span>${s.count} video${(s.langs || ["vi"]).length > 1 ? ` × ${s.langs.length}` : ""}</span>
    <span class="mono small">${(s.langs || ["vi"]).map((l) => l.toUpperCase()).join(" · ")}</span>
    <span style="display:flex;gap:4px">${s.families.map((f) => `<span class="fam ${f}">${f}</span>`).join("")}</span>
    <span class="muted">${esc(s.topics.length ? s.topics.slice(0, 2).join(", ") + (s.topics.length > 2 ? "…" : "") : "mọi chủ đề")}</span>
    <div style="flex:1"></div>
    ${running ? `<span class="chip run">Đang chạy ${running} lượt</span>` : nextRun(s) ? `<span class="muted small">Lần tới · <span class="mono">${esc(nextRun(s))}</span></span>` : ""}
    ${auto.schedules.length > 1 ? `<span class="chip">${auto.schedules.length} lịch</span>` : ""}
    <button class="btn sm" type="button" data-open-plan="${esc(s.id)}">Sửa lịch</button>
    <button class="btn sm ink" type="button" data-srun="${esc(s.id)}">Chạy ngay</button></section>`;
}

const STAGES = [["content", "Kịch bản"], ["plan", "Timeline · voice"], ["render", "Dựng HD"], ["done", "Xuất file"]];
const mmss = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const FULL_AUTO = { name: "Tự động hoàn toàn", enabled: true, times: ["08:00"], days: [0, 1, 2, 3, 4, 5, 6], count: 10, skus: [],
  families: ["A4", "A3", "A2"], topics: [], content_mode: "mix", auto_render: true, langs: ["vi"], hook_text: false };
const STAGE_IDX = { waiting: -1, content: 0, plan: 1, render: 2, draft: 2, done: 4, error: -2 };

function progress(auto) {
  const live = auto.running[0];
  const last = auto.runs.find((r) => r.items?.length);
  const run = live || (last && Date.now() - new Date((last.finished_at || last.started_at).replace(" ", "T")).getTime() < 12 * 3600e3 ? last : null);
  if (!run || !run.items?.length) return "";
  const done = run.items.filter((it) => ["done", "draft"].includes(it.stage)).length;
  const errs = run.items.filter((it) => it.stage === "error").length;
  const pct = Math.round(((done + errs) / run.items.length) * 100);
  const row = (it) => {
    const at = STAGE_IDX[it.stage] ?? -1;
    const failAt = it.stage === "error" ? Math.max(0, STAGES.findIndex(([k]) => k === (it.job_id ? "render" : it.title ? "plan" : "content"))) : -1;
    const steps = STAGES.map(([, label], k) => {
      const cls = failAt === k ? "bad" : at > k || at === 4 ? "ok" : at === k ? "run" : "";
      return `<span class="pstep ${cls}" title="${label}"><span class="dot ${cls}"></span>${label}</span>`;
    }).join("");
    const tail = it.stage === "error" ? `<span class="small" style="color:var(--bad)">${esc(it.error || "Lỗi")}</span>`
      : it.stage === "done" ? (it.export ? `<a class="small mono" href="#/exports/${encodeURIComponent(it.export)}" title="Xem video">▶ ${esc(it.export)}</a>` : '<span class="small mono">Xong</span>')
      : it.stage === "draft" ? '<span class="small muted">Chờ duyệt render</span>' : "";
    const secs = it.total_s ?? (it.t0 && !["error", "draft"].includes(it.stage) ? Date.now() / 1000 - it.t0 : null);
    return `<div class="prow"><span class="mono small muted">${it.i + 1}</span><span class="fam ${esc(it.family)}">${esc(it.family)}</span>
      <span class="mono small" style="width:72px">${esc(it.sku)}</span>${run.langs?.length > 1 || (it.lang && it.lang !== "vi") ? `<span class="chip mono" style="min-height:22px;padding:0 6px">${esc((it.lang || "vi").toUpperCase())}</span>` : ""}
      <span class="pt">${it.job_id ? `<a href="#/review/${encodeURIComponent(it.job_id)}">${esc(it.title || "…")}</a>` : esc(it.title || (it.stage === "waiting" ? "Đang chờ lượt" : it.stage === "error" ? "Không có kịch bản" : "Đang chọn kịch bản…"))}</span>
      <span class="psteps">${steps}</span><span class="mono small ${it.total_s ? "" : "muted"}" style="width:44px;text-align:right" title="Thời gian làm video này">${mmss(secs)}</span><span class="ptail">${tail}</span></div>`;
  };
  return `<section class="box" aria-label="Tiến trình chạy">
    <div class="box-head"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <strong>${live ? "Đang chạy" : "Lần chạy gần nhất"}</strong><span class="muted small">${esc(run.name || "")} · ${esc((run.started_at || "").slice(11, 16))}</span>
      <span class="chip ${errs ? "warn" : live ? "run" : "ok"}">${done}/${run.items.length} video${errs ? ` · ${errs} lỗi` : ""}</span>
      ${run.stats?.avg_s ? `<span class="chip">TB ${mmss(run.stats.avg_s)} / video</span><span class="chip">${run.stats.per_hour} video / giờ</span>` : ""}</div>
      <span class="prog" style="width:220px"><i style="width:${pct}%"></i></span></div>
    <div class="plist">${run.items.map(row).join("")}</div></section>`;
}

const poster = (j) => j.poster || (j.render_status === "done" && j.revision ? `media/renders/${j.id}_r${j.revision}${j.quality === "preview" ? "_pv" : ""}.jpg` : "");

const aiCostChip = (c) => (c && c.logged ? `<span class="aicost" title="${Object.entries(c.by_task).map(([k, v]) => `${k}: ${money(v.vnd)}`).join(" · ")}">AI ${money(c.vnd)}</span>` : "");
function kcard(j) {
  const c = j.content;
  const title = c?.title || j.product_name || "Kịch bản tay";
  const busy = ["rendering", "created"].includes(j.state);
  const note = j.state === "missing_asset" ? `${j.gaps || ""} phần thiếu cảnh` : j.state === "render_error" ? "Render lỗi" : j.state === "rejected" ? (j.review?.[0]?.reason || "Đã loại")
    : j.state === "waiting_g2" && j.quality === "preview" ? "Bản nháp 360p" : j.state === "passed" ? "Đã xuất HD" : "";
  return `<article class="kcard">
    ${selecting ? `<input type="checkbox" class="chk" data-sel="${esc(j.id)}" aria-label="Chọn" ${selected.has(j.id) ? "checked" : ""}>` : ""}
    <a class="kt" href="#/review/${encodeURIComponent(j.id)}" aria-label="Mở ${esc(title)}">${poster(j) ? `<img src="${esc(media(poster(j)))}" alt="" loading="lazy" onerror="this.remove()">` : ""}</a>
    <div class="kb">
      <a href="#/review/${encodeURIComponent(j.id)}" class="ttl" style="color:inherit;text-decoration:none">${esc(title)}</a>
      <span class="meta">${c ? `<span class="fam ${esc(c.family)}">${esc(c.family)}</span>` : ""}<span class="mono">${esc(j.sku || "—")}</span>${j.duration ? `<span>${Math.round(j.duration)}s</span>` : ""}${aiCostChip(j.ai_cost)}</span>
      ${busy ? '<span class="prog" aria-label="Đang dựng"><i style="width:55%"></i></span>' : ""}
      ${j.export ? `<a class="small" style="color:var(--ok)" href="#/exports/${encodeURIComponent((j.export.name || j.export.path.split(/[\\/]/).pop()))}" title="Xem ${esc(j.export.path)}">▶ Xem file đã xuất</a>` : ""}
      ${note ? `<span class="small" style="color:${["render_error", "rejected", "missing_asset"].includes(j.state) ? "var(--bad)" : "var(--muted)"}">${esc(note)}</span>` : ""}
      <span class="acts">${j.state === "draft" ? `<button class="btn sm pri" type="button" data-approve="${esc(j.id)}">Render</button>` : ""}
        <a class="btn sm icon" href="/?job=${encodeURIComponent(j.id)}" aria-label="Mở trong Studio" title="Mở trong Studio"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16z"/></svg></a>
        <button class="btn sm icon danger" type="button" data-del="${esc(j.id)}" aria-label="Xoá" title="Xoá"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></span>
    </div></article>`;
}

let kcol = 0;                        // phone: one column at a time, picked from a segmented switch
function board(jobs) {
  const counts = COLS.map(([, states]) => jobs.filter((j) => states.includes(j.state)).length);
  return `<nav class="seg kseg" aria-label="Trạng thái job">${COLS.map(([name], i) => `<button type="button" data-kcol="${i}" aria-pressed="${i === kcol}">${name}<span class="mono n">${counts[i]}</span></button>`).join("")}</nav>
    <div class="kanban" data-col="${kcol}">${COLS.map(([name, states, dot]) => {
    const list = jobs.filter((j) => states.includes(j.state));
    return `<section class="kcol" aria-label="${name}"><header><span class="dot ${dot}"></span><strong>${name}</strong><span class="n">${list.length}</span></header>
      ${list.slice(0, 40).map(kcard).join("") || '<div class="muted small" style="padding:8px 4px">—</div>'}
      ${list.length > 40 ? `<div class="muted small" style="padding:4px">+${list.length - 40} job</div>` : ""}</section>`;
  }).join("")}</div>`;
}

function bulkbar() {
  if (!selecting) return "";
  return `<div class="bulkbar" role="region" aria-label="Thao tác hàng loạt"><strong>${selected.size} đã chọn</strong>
    <button class="btn sm pri" data-bulk="approve" type="button" ${selected.size ? "" : "disabled"}>Duyệt & render HD</button>
    <button class="btn sm" data-bulk="render" type="button" ${selected.size ? "" : "disabled"}>Render lại</button>
    <button class="btn sm danger" data-bulk="delete" type="button" ${selected.size ? "" : "disabled"}>Xoá</button>
    <div style="flex:1"></div><button class="btn sm" data-bulk="clear" type="button">Xong</button></div>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  let [{ jobs }, auto] = await Promise.all([api.jobs(), api.automation()]);
  const paint = () => {
    el.innerHTML = `<header class="ph-bar"><h1>Job · tự động</h1><div class="sp"></div>
        <button class="btn" type="button" id="sel-mode" aria-pressed="${selecting}">${selecting ? "Bỏ chọn" : "Chọn nhiều"}</button>
        <a class="btn pri" href="/">+ Video mới</a></header>
      <div class="page">${autostrip(auto)}<div id="progress">${progress(auto)}</div><div id="bulk">${bulkbar()}</div><div id="board">${board(jobs)}</div></div>
      <div id="plan-drawer">${drawer ? `<div class="scrim" data-close></div><aside class="drawer" aria-label="Lịch tự động">
        <div style="display:flex;justify-content:space-between;align-items:center"><strong>Lịch tự động</strong><button class="btn icon" type="button" data-close aria-label="Đóng">✕</button></div>
        <div id="plan">${planForm(auto, editing ? auto.schedules.find((s) => s.id === editing) : null)}</div><div id="sched">${schedulesBox(auto)}</div></aside>` : ""}</div>`;
    if (drawer) bindPlan();
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kcol]");
    if (b) { kcol = +b.dataset.kcol; el.querySelector("#board").innerHTML = board(jobs); }
  });
  const reload = async () => {
    [{ jobs }, auto] = await Promise.all([api.jobs(), api.automation()]);
    const ids = new Set(jobs.map((j) => j.id));
    [...selected].forEach((id) => { if (!ids.has(id)) selected.delete(id); });
    el.querySelector("#board").innerHTML = board(jobs);
    el.querySelector("#bulk").innerHTML = bulkbar();
    el.querySelector("#progress").innerHTML = progress(auto);
    const strip = el.querySelector(".autostrip");
    if (strip) strip.outerHTML = autostrip(auto);
    if (drawer) { el.querySelector("#sched").innerHTML = schedulesBox(auto); }
    ctx.refreshBadges();
  };
  const $ = (s) => el.querySelector(s);

  function bindPlan() {
    const countSku = () => { $("#sku-n").textContent = `(${el.querySelectorAll('input[name="sku"]:checked').length} chọn)`; };
    countSku();
    $("#sku-list").addEventListener("change", countSku);
    const countLang = () => {
      const n = el.querySelectorAll('input[name="lang"]:checked').length || 1;
      $("#lang-n").textContent = `· ${n} tiếng = ${(Number($("#p-count").value) || 1) * n} video mỗi lần`;
    };
    countLang();
    el.querySelectorAll('input[name="lang"]').forEach((i) => i.addEventListener("change", countLang));
    $("#p-count").addEventListener("input", countLang);
    $("#sku-q").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      el.querySelectorAll("#sku-list [data-q]").forEach((l) => { l.style.display = !q || l.dataset.q.includes(q) ? "" : "none"; });
    });
    $("#sku-all").addEventListener("click", () => { el.querySelectorAll("#sku-list [data-q]").forEach((l) => { if (l.style.display !== "none") l.querySelector("input").checked = true; }); countSku(); });
    $("#sku-none").addEventListener("click", () => { el.querySelectorAll('input[name="sku"]').forEach((i) => { i.checked = false; }); countSku(); });
    $("#p-run").addEventListener("click", async (e) => {
      const body = readForm(el);
      e.target.disabled = true;
      try {
        if (editing && body.times.length) { await api.scheduleSave(body, editing); auto = await api.automation(); }   // run what you see = save it too
        await api.automationRun(body); toast(`Đang tạo ${body.count * body.langs.length} video ở nền…`); drawer = false; paint(); setTimeout(reload, 1500); }
      catch (err) { toast(err.message, true); } finally { e.target.disabled = false; }
    });
    $("#p-save").addEventListener("click", async () => {
      const body = readForm(el);
      if (!body.times.length) { toast("Nhập ít nhất 1 giờ chạy (vd 08:00)", true); return; }
      try { await api.scheduleSave(body, editing || null); toast(editing ? "Đã lưu lịch" : "Đã tạo lịch"); editing = null; drawer = false; [{ jobs }, auto] = await Promise.all([api.jobs(), api.automation()]); paint(); }
      catch (err) { toast(err.message, true); }
    });
    $("#p-cancel")?.addEventListener("click", () => { editing = null; $("#plan").innerHTML = planForm(auto); bindPlan(); });
  }
  paint();

  el.addEventListener("change", (e) => {
    if (e.target.dataset.sel) { e.target.checked ? selected.add(e.target.dataset.sel) : selected.delete(e.target.dataset.sel); $("#bulk").innerHTML = bulkbar(); }
  });
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button, [data-close]");
    if (!b) return;
    try {
      if (b.id === "sel-mode") { selecting = !selecting; if (!selecting) selected.clear(); paint(); return; }
      if (b.hasAttribute("data-close")) { drawer = false; editing = null; paint(); return; }
      if (b.hasAttribute("data-full-auto")) {
        const s = await api.scheduleSave(FULL_AUTO);
        await api.scheduleRun(s.id || (await api.automation()).schedules[0]?.id);
        toast("Đã bật tự động hoàn toàn · đang chạy lượt đầu"); setTimeout(reload, 1500); return;
      }
      if (b.dataset.openPlan !== undefined) { editing = b.dataset.openPlan || null; drawer = true; paint(); return; }
      if (b.dataset.flip) {
        const s = auto.schedules.find((x) => x.id === b.dataset.flip);
        await api.scheduleSave({ ...s, enabled: !s.enabled }, s.id); toast(s.enabled ? "Đã tắt lịch" : "Đã bật lịch"); await reload(); return;
      }
      if (b.dataset.srun) { await api.scheduleRun(b.dataset.srun); toast("Đang chạy ở nền"); setTimeout(reload, 1500); return; }
      if (b.dataset.sedit) { editing = b.dataset.sedit; $("#plan").innerHTML = planForm(auto, auto.schedules.find((s) => s.id === editing)); bindPlan(); return; }
      if (b.dataset.sdel) {
        if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Bấm lần nữa để xoá"; return; }
        await api.scheduleDelete(b.dataset.sdel); toast("Đã xoá lịch"); if (editing === b.dataset.sdel) editing = null; [{ jobs }, auto] = await Promise.all([api.jobs(), api.automation()]); paint(); return;
      }
      if (b.dataset.approve) { b.disabled = true; await api.bulkJobs({ ids: [b.dataset.approve], action: "approve" }); toast("Đang render"); await reload(); return; }
      if (b.dataset.del) {
        if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.classList.add("pri"); toast("Bấm lần nữa để xoá"); return; }
        await api.deleteJob(b.dataset.del); selected.delete(b.dataset.del); toast("Đã xoá job"); await reload(); return;
      }
      if (b.dataset.bulk) {
        const action = b.dataset.bulk;
        if (action === "clear") { selecting = false; selected.clear(); paint(); return; }
        if (action === "delete" && b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = `Xoá ${selected.size} job?`; return; }
        b.disabled = true;
        const res = await api.bulkJobs({ ids: [...selected], action });
        toast(`${res.done.length} job xong${res.errors.length ? ` · ${res.errors.length} lỗi: ${res.errors[0]}` : ""}`, !!res.errors.length);
        selected.clear(); await reload();
      }
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });

  const timer = setInterval(() => { if (el.getClientRects().length && !drawer && (jobs.some((j) => ["rendering", "created"].includes(j.state)) || auto.running.length)) reload(); }, 4000);
  ctx.setCleanup(() => clearInterval(timer));
  ctx.setShow?.(() => { if (!drawer) reload(); });            // back on this tab: fresh numbers, no reload flash
}
