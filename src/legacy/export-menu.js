// "Xuất" — one click opens one dialog with every way out of the Studio, and one "Xuất" button does them all:
// render HD when the current version is a draft → copy to the output folder → queue the chosen channels (Lên lịch
// đăng) → send to Telegram → download the MP4 (and the dev package) to this computer. The server does the render /
// export / schedule / Telegram part (POST /api/jobs/{id}/ship), so the tab may be closed while it works.
// "Lưu làm template dựng" keeps the cut structure + settings of this video for the Script tab.
import { api } from "./api-client.js";
import { applyJob, store } from "./editor-store.js";
import { esc } from "./format-helpers.js";

const $ = (id) => document.getElementById(id);
const PFC = { facebook: ["FB", "#1877F2"], instagram: ["IG", "#C13584"], tiktok: ["TT", "#E11D48"] };
const X = {
  open: false, job: null, dl: true, pkg: false, tpl: false, tplName: "", sch: false, ch: new Set(), when: "", chq: "",
  tg: false, chans: null, tgReady: null, phase: "idle", st: null, msg: "", saved: "", downloaded: false, timer: 0,
};

function resetFor(job) {
  X.job = job.id;
  X.tplName = job.preset?.name || `${job.template_label || "Template"} · ${(job.content?.title || job.product_name || "").slice(0, 30)}`;
  X.phase = "idle"; X.st = null; X.msg = ""; X.saved = ""; X.downloaded = false; X.ch = new Set();
}

async function openDialog() {
  if (!store.job) return;
  if (X.job !== store.job.id) resetFor(store.job);
  X.open = true;
  paint();
  if (X.chans == null) {
    api.social().then((d) => {
      X.chans = d.channels || [];
      const lang = store.job?.lang || "vi";
      if (!X.ch.size) X.chans.filter((c) => c.lang === lang).forEach((c) => X.ch.add(c.cid));
      paint();
    }).catch(() => { X.chans = []; paint(); });
    api.telegramStatus().then((t) => { X.tgReady = !!t.ready; paint(); }).catch(() => { X.tgReady = false; paint(); });
  }
}

function close() { X.open = false; paint(); }

function download(href, name) {
  const a = document.createElement("a");
  a.href = href; if (name) a.download = name;
  document.body.append(a); a.click(); a.remove();
}

/** Follow the server: render progress, then the export / schedule / Telegram steps. */
function follow() {
  clearTimeout(X.timer);
  const id = store.job?.id;
  X.timer = setTimeout(async () => {
    if (!id || X.phase !== "working") return;
    try {
      const st = await api.jobStatus(id);
      X.st = st;
      const sh = st.ship || {};
      if (sh.state === "done") {
        X.phase = "done";
        const ex = (sh.steps || []).find((s) => s.k === "export");
        if (!X.downloaded) {
          X.downloaded = true;
          if (X.dl && ex?.text) download(`/api/exports/file?name=${encodeURIComponent(ex.text)}`, ex.text);
          if (X.pkg) setTimeout(() => download(api.packageUrl(id)), 600);
        }
      } else if (sh.state === "error" || st.status === "error") {
        X.phase = "error";
        X.msg = sh.error || st.error || "Lỗi không rõ";
      }
    } catch { /* transient */ }
    paint();
    if (X.phase === "working") follow();
  }, 1000);
}

async function go() {
  if (!store.job || X.phase === "working") return;
  X.phase = "working"; X.msg = ""; X.downloaded = false; X.st = null;
  paint();
  try {
    if (X.tpl) {
      const p = await api.savePreset(store.job.id, X.tplName);
      X.saved = p.name;
      window.dispatchEvent(new Event("vcb-presets"));
    }
    const plan = { telegram: X.tg && !!X.tgReady, schedule: X.sch && X.ch.size ? { channels: [...X.ch], when: X.when ? X.when.replace("T", " ") : null } : null };
    applyJob(await api.ship(store.job.id, plan));
    follow();
  } catch (err) {
    X.phase = "error"; X.msg = err.message; paint();
  }
}

// ---- view ---------------------------------------------------------------------------------------------------------
function progress() {
  const st = X.st, r = store.job?.render || {};
  const rendering = st ? st.status === "rendering" : r.status === "rendering";
  const sh = st?.ship || {};
  let pct = 0, label = "Đang chuẩn bị";
  if (rendering) {
    const el = st?.started && st?.now ? st.now - st.started : 0;
    pct = Math.min(92, Math.max(3, (el / Math.max(st?.eta || 60, 5)) * 92));
    label = `Đang render bản HD 720×1280 · ${Math.round(pct)}%${st?.eta ? ` · còn khoảng ${Math.max(1, Math.round((st.eta - el)))} giây` : ""}`;
  } else if (sh.state === "running" || (sh.state === "waiting" && st?.status === "done")) {
    pct = 95; label = "Đang chép file, xếp lịch đăng, gửi Telegram";
  }
  if (X.phase === "done") { pct = 100; label = "Xong"; }
  return `<div class="xp-work"><span class="vbot sm"></span><div style="flex:1;min-width:0">
      <div class="xp-lbl">${esc(label)}</div><div class="vprog"><i style="width:${pct}%"></i></div>
      <small>Có thể đóng hộp này hoặc chuyển trang — máy chủ vẫn làm tiếp.</small></div></div>`;
}

function results() {
  const sh = X.st?.ship || {};
  const line = (ok, t) => `<div class="xp-res ${ok ? "ok" : "bad"}">${ok ? "✓" : "✕"} ${t}</div>`;
  const out = [];
  if (X.saved) out.push(line(true, `Đã lưu template “${esc(X.saved)}”`));
  for (const s of sh.steps || []) {
    if (s.k === "export") out.push(line(true, `Đã xuất <b>${esc(s.text)}</b> vào thư mục OUTPUT${X.dl ? " · đang tải về máy" : ""}`));
    if (s.k === "schedule") out.push(line(s.ok, s.ok ? `Đã xếp lịch ${s.n} bài đăng` : `Lên lịch: ${esc(s.text)}`));
    if (s.k === "telegram") out.push(line(s.ok, s.ok ? "Đã đưa vào hàng gửi Telegram" : `Telegram: ${esc(s.text)}`));
  }
  if (X.phase === "error") out.push(line(false, esc(X.msg)));
  return out.join("");
}

function chanList() {
  if (X.chans == null) return '<div class="small muted is-busy">Đang tải danh sách kênh…</div>';
  if (!X.chans.length) return '<div class="small" style="color:var(--collected)">Chưa kết nối kênh nào — vào Đăng &amp; hiệu quả › Kết nối.</div>';
  const q = X.chq.trim().toLowerCase();
  return `<input class="xp-in" id="xp-chq" type="search" placeholder="Tìm kênh" value="${esc(X.chq)}" aria-label="Tìm kênh">
    <div class="xp-chs">${X.chans.filter((c) => !q || c.name.toLowerCase().includes(q)).map((c) => { const pf = PFC[c.platform] || PFC.facebook; return `<label class="xp-ch"><input type="checkbox" data-ch="${esc(c.cid)}" ${X.ch.has(c.cid) ? "checked" : ""}>
      <span class="xp-pf" style="background:${pf[1]}">${pf[0]}</span><span class="xp-chn">${esc(c.name)}</span><span class="small muted mono">${esc((c.market || "").toUpperCase())}</span></label>`; }).join("")}</div>
    <label class="xp-sub">Giờ đăng <input class="xp-in mono" id="xp-when" type="datetime-local" value="${esc(X.when)}"></label>
    <small>Để trống = khung giờ trống tiếp theo theo lịch của từng kênh. Đã chọn ${X.ch.size} kênh.</small>`;
}

function body() {
  const r = store.job?.render || {};
  const hd = r.status === "done" && r.quality === "hd";
  const working = X.phase === "working";
  const opt = (id, on, title, sub, extra = "", dis = false) => `<div class="xp-opt${on ? " on" : ""}${dis ? " dis" : ""}">
      <label class="xp-row"><input type="checkbox" id="${id}" ${on ? "checked" : ""} ${dis || working ? "disabled" : ""}><span><b>${title}</b><small>${sub}</small></span></label>${on ? extra : ""}</div>`;
  return `<div class="xp-head"><h2>Xuất video</h2><button class="xp-x" type="button" data-xclose aria-label="Đóng">✕</button></div>
    <div class="xp-sub2">${hd ? `Bản ${r.revision} · HD 720×1280 đã sẵn sàng` : `Bản hiện tại là ${r.status === "rendering" ? "đang dựng" : "bản nháp 360p"} — bấm Xuất sẽ tự render bản HD rồi làm tiếp`}</div>
    <div class="xp-opts">
      ${opt("xp-dl", X.dl, "⤓ Tải MP4 về máy", "720×1280 HD · −14 LUFS · cũng chép vào thư mục OUTPUT")}
      ${opt("xp-sch", X.sch, "🗓 Lên lịch đăng", "TikTok · Facebook · Instagram theo kênh đã kết nối", `<div class="xp-more">${chanList()}</div>`)}
      ${opt("xp-tg", X.tg, "✈ Gửi qua Telegram", X.tgReady === false ? "Chưa cài bot — điền token và chat ID ở Cài đặt › Khoá kết nối" : "Gửi file video vào nhóm / chat đã cài", "", X.tgReady === false)}
      ${opt("xp-pkg", X.pkg, "🗂 Gói dữ liệu cho dev", "MP4 + phụ đề SRT + timeline.json + VO từng phần")}
      ${opt("xp-tpl", X.tpl, "Lưu làm template dựng", "Giữ cách cắt shot, độ dài, nhạc, phụ đề, logo, chuyển cảnh, footage tải lên / HuyK. Lần sau chọn ở tab Kịch bản › “Template dựng đã lưu”.",
        `<div class="xp-more"><input class="xp-in" id="xp-tplname" maxlength="80" value="${esc(X.tplName)}" placeholder="Tên template" aria-label="Tên template"></div>`)}
      <div class="xp-opt dis"><div class="xp-row"><span><b>🎬 Project CapCut (.draft)</b><small>Sắp có</small></span></div></div>
    </div>
    ${X.phase !== "idle" ? `<div class="xp-status">${X.phase === "working" || X.phase === "done" ? progress() : ""}${results()}</div>` : ""}
    <div class="xp-foot"><button class="xp-cancel" type="button" data-xclose>${X.phase === "done" ? "Đóng" : "Huỷ"}</button>
      <button class="export-btn xp-go" type="button" id="xp-go" ${working || (!X.dl && !X.sch && !X.tg && !X.pkg && !X.tpl) ? "disabled" : ""}>${working ? "Đang xuất…" : X.phase === "done" ? "Xuất lại" : "Xuất"}</button></div>`;
}

function paint() {
  const box = $("export-menu");
  $("export-btn").disabled = !store.job;
  if (!X.open) { box.classList.add("hidden"); box.innerHTML = ""; box.dataset.html = ""; return; }
  const html = `<div class="xp-scrim" data-xclose></div><div class="xp-dlg" role="dialog" aria-label="Xuất video">${body()}</div>`;
  if (box.dataset.html === html) return;
  const f = document.activeElement, fid = f?.id, caret = f?.selectionStart;
  const scroll = box.querySelector(".xp-chs")?.scrollTop || 0;
  box.innerHTML = html; box.dataset.html = html;
  box.classList.remove("hidden");
  const chs = box.querySelector(".xp-chs"); if (chs) chs.scrollTop = scroll;
  if (fid && $(fid)) { $(fid).focus(); try { if (caret != null) $(fid).setSelectionRange(caret, caret); } catch { /* date input */ } }
}

export function initExportMenu() {
  const box = $("export-menu");
  box.classList.add("xp");
  $("export-btn").addEventListener("click", (e) => { e.stopPropagation(); X.open ? close() : openDialog(); });
  box.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.closest("[data-xclose]")) return close();
    if (e.target.closest("#xp-go")) go();
  });
  box.addEventListener("change", (e) => {
    const t = e.target;
    const map = { "xp-dl": "dl", "xp-sch": "sch", "xp-tg": "tg", "xp-pkg": "pkg", "xp-tpl": "tpl" };
    if (map[t.id]) { X[map[t.id]] = t.checked; if (X.phase === "done" || X.phase === "error") X.phase = "idle"; paint(); return; }
    if (t.dataset.ch) { t.checked ? X.ch.add(t.dataset.ch) : X.ch.delete(t.dataset.ch); paint(); return; }
    if (t.id === "xp-when") { X.when = t.value; paint(); }
  });
  box.addEventListener("input", (e) => {
    if (e.target.id === "xp-tplname") X.tplName = e.target.value;
    if (e.target.id === "xp-chq") { X.chq = e.target.value; paint(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && X.open) close(); });
}

/** Called on every store change (render status moves the progress / enables the button). */
export function renderExportMenu(s) {
  if (s.job && X.job && X.job !== s.job.id) resetFor(s.job);
  paint();
}
