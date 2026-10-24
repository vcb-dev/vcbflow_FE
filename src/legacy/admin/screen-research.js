// Nghiên cứu đối thủ: thêm kênh (link) → TikHub crawl → AI gắn tag (content / sản phẩm, tuyến, loại SP) → video win
// → đọc kịch bản (phụ đề / Whisper / Gemini) → AI viết 3 bản HuyK → lưu vào Kho content / dựng video.
import { api, esc, toast } from "./admin-api.js";
import * as DR from "./date-range.js";

const PF = { tiktok: ["TT", "#E11D48", "TikTok"], douyin: ["DY", "#7C3AED", "Douyin"], instagram: ["IG", "#C13584", "Instagram"],
  youtube: ["YT", "#CC0000", "YouTube"], xiaohongshu: ["XHS", "#E0245E", "Xiaohongshu"], facebook: ["FB", "#1877F2", "Facebook"] };
const FAMN = { A1: "Thu hút · kiến thức lạ", A2: "Kiến thức nghề", A3: "Câu chuyện thật", A4: "Chế tác · chốt đơn", A5: "Dấu ấn thương hiệu" };
const ROLE = { HOOK: "a5", HUYK: "a3", CHE_TAC: "a4", MONTAGE: "a4", HOAN_THIEN: "a2", NOI_DUNG: "a1", CHIA_DOI: "a3", OUTRO: "a1" };
const st = { chShown: 25, chLabel: "", seg: "win", pf: "", fam: "", ch: "", sort: "x", dr: DR.load("research", "30d"), shown: 48, key: null, opt: 0, fam2: "", topic: "", sku: "", secs: "", busy: false };
const k = (n) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(".", ",")}K` : String(Math.round(n)));
const pfc = (p, cls = "") => `<span class="rs-pf ${cls}" style="background:${(PF[p] || ["?", "#666"])[1]}">${(PF[p] || ["?"])[0]}</span>`;
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
const ago = (t) => {
  if (!t) return "chưa crawl";
  const m = (Date.now() - new Date(t.replace(" ", "T")).getTime()) / 6e4;
  return m < 60 ? `${Math.max(1, Math.round(m))} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
};
const schedVal = (s) => (s.mode === "off" || (s.mode !== "daily" && !s.every_h) ? "off" : s.mode === "daily" ? "daily" : `i${s.every_h}`);
const img = (u, cls = "") => (u ? `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "");
const cov = (v) => img(v.thumb ? "/" + v.thumb : v.cover);          // cover saved on the PC, else the platform link

function rows(d) {
  const win = DR.resolve(st.dr);
  let r = d.videos.filter((v) => (!st.pf || v.platform === st.pf) && (!st.ch || v.channel === st.ch) && (!st.fam || v.tags?.family === st.fam)
    && (!v.created || DR.inRange(v.created, win)));
  const by = { all: () => true, win: (v) => v.win, content: (v) => v.tags?.kind === "content", product: (v) => v.tags?.kind === "product" };
  const counts = Object.fromEntries(Object.entries(by).map(([key, f]) => [key, r.filter(f).length]));
  r = r.filter(by[st.seg]);
  const s = st.sort;
  r = r.slice().sort((a, b) => (s === "new" ? (b.created || "").localeCompare(a.created || "") : (b[s === "x" ? "x" : "metric"] || 0) - (a[s === "x" ? "x" : "metric"] || 0)));
  return { r, counts };
}

function listView(d) {
  const tk = d.tikhub || {};
  const { r, counts } = rows(d);
  const jobs = d.jobs || {};
  const running = Object.values(jobs).filter((j) => j.state === "running" || j.state === "queued").length;
  const chs = d.channels;
  const kpi = (l, v, sub, c = "") => `<div class="kpi"><span class="kl">${l}</span><strong class="kv" ${c ? `style="color:${c}"` : ""}>${v}</strong><span class="ks">${sub}</span></div>`;
  const wins = d.videos.filter((v) => v.win).length;
  const chRow = (c) => {
    const j = jobs[c.id];
    const busy = j && (j.state === "running" || j.state === "queued");
    const n = d.videos.filter((v) => v.channel === c.id);
    const stt = busy ? `<span style="color:var(--warn)">${esc(j.step || "đang chờ")}…</span>` : c.status === "error" ? `<span style="color:var(--bad)" title="${esc(c.error || "")}">lỗi · bấm crawl lại</span>` : `<span class="muted">${c.auto === false ? "tắt tự crawl" : "tự crawl"}</span>`;
    return `<div class="rs-ch${st.ch === c.id ? " on" : ""}"><button type="button" class="rs-chb" data-ch="${esc(c.id)}">
        <span class="rs-av">${img(c.avatar)}<b>${esc((c.name || c.handle || "?").trim()[0] || "?")}</b>${pfc(c.platform, "sm")}</span>
        <span class="grow"><a class="ell" href="${esc(c.url || "#")}" target="_blank" rel="noopener" style="font-weight:600;text-decoration:none" title="Mở kênh">${esc(c.name || c.handle || c.ref?.value || "")}</a><span class="small muted">${c.followers != null ? k(c.followers) + " theo dõi · " : ""}${n.length} video · ${ago(c.last_crawl)}</span>
          <span class="small">${c.label ? `<span class="rs-tag ${c.label === "Sản phẩm" ? "product" : "content"}">${c.label.toUpperCase()}</span> · ` : ""}<b style="color:var(--accent)">${n.filter((v) => v.win).length} win</b> · ${stt}</span></span></button>
      <span class="rs-cha"><button class="btn icon sm" type="button" data-crawl="${esc(c.id)}" title="Crawl lại" aria-label="Crawl lại" ${busy ? "disabled" : ""}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg></button>
        <button class="btn icon sm danger" type="button" data-rmch="${esc(c.id)}" title="Bỏ theo dõi" aria-label="Bỏ theo dõi">✕</button></span></div>`;
  };
  const card = (v) => {
    const t = v.tags || {};
    const j = jobs[v.key];
    return `<article class="rs-card${v.win ? " win" : ""}">
      <a class="rs-th" href="#/research/v/${encodeURIComponent(v.key)}">${cov(v)}${pfc(v.platform, "tl")}
        ${v.win ? `<span class="rs-b tr">WIN ×${String(v.x).replace(".", ",")}</span>` : v.x ? `<span class="rs-b tr dim">×${String(v.x).replace(".", ",")}</span>` : ""}
        <span class="rs-b bl mono">${v.metric_kind === "likes" ? "♥" : "▶"} ${k(v.metric)}</span>${v.duration ? `<span class="rs-b br mono">${dur(v.duration)}</span>` : ""}
        ${v.remixed ? `<span class="rs-b ml">ĐÃ CHUYỂN ${v.remixed}</span>` : ""}</a>
      <div class="rs-bd">
        <div class="rs-tags">${t.kind ? `<span class="rs-tag ${t.kind}">${t.kind === "content" ? "CONTENT" : "SẢN PHẨM"}</span><span class="rs-tag">${esc(t.kind === "product" && t.product ? t.product : `${t.family} · ${FAMN[t.family] || ""}`)}</span>` : '<span class="rs-tag">AI đang gắn tag…</span>'}</div>
        <span class="rs-hook">${esc(t.hook_vi || v.title || "(không có mô tả)")}</span>
        <span class="small muted ell">${esc((chs.find((c) => c.id === v.channel) || {}).name || "")} · ${v.created ? ago(v.created) : ""}${v.comments ? ` · ${k(v.comments)} bình luận` : ""}</span>
        <div style="flex:1"></div>
        <div class="rs-act"><a class="btn sm ${v.win ? "pri" : ""}" href="#/research/v/${encodeURIComponent(v.key)}">${j && j.state === "running" ? "Đang đọc kịch bản…" : t.kind === "product" ? "Redesign" : "Convert content"}</a>
          <a class="btn icon sm" href="${esc(v.url || "#")}" target="_blank" rel="noopener" aria-label="Mở video gốc" title="Mở video gốc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg></a></div></div></article>`;
  };
  const seg = [["all", "Tất cả"], ["win", "Video win"], ["content", "Content"], ["product", "Sản phẩm"]];
  return `<div class="page rs">
    ${!tk.configured ? '<div class="cost-alert">Chưa có TikHub API key. Điền <b>TIKHUB_API_KEY</b> ở <a href="#/ai">Cài đặt › Khoá kết nối</a>.</div>' : tk.balance != null && tk.balance < 1 ? `<div class="cost-alert">Số dư TikHub còn $${String(tk.balance.toFixed(2)).replace(".", ",")} · nạp thêm để crawl tiếp.</div>` : ""}
    <div class="rs-wrap"><aside class="rs-side">
      <form class="box pad rs-add" id="rs-add"><b>Thêm kênh / page để crawl</b>
        <label class="small muted">Link kênh hoặc @tên<input class="in" name="link" id="rs-link" required placeholder="https://www.tiktok.com/@ten-kenh" autocomplete="off"></label>
        <div class="rs-pfs" id="rs-pfs">${Object.entries(PF).map(([p, x]) => `<span class="rs-pfchip" data-p="${p}"><i style="background:${x[1]}"></i>${x[2]}</span>`).join("")}</div>
        <label class="small muted">Số video mới nhất cần lấy<span class="rs-num"><input class="in" type="number" name="limit" min="5" max="300" step="5" value="${d.settings.per_channel}" inputmode="numeric">
          ${[30, 60, 120].map((n) => `<button type="button" class="btn sm" data-rlim="${n}">${n}</button>`).join("")}</span></label>
        <span class="small muted">AI tự gắn nhãn kênh <b>Sản phẩm</b> hoặc <b>Content</b> sau khi crawl.</span>
        <button class="btn pri" type="submit">Thêm &amp; crawl ngay</button>
        <span class="small muted">TikTok, Douyin, Instagram, YouTube Shorts, Xiaohongshu, Facebook.</span></form>
      <section class="box rs-chs"><div class="rs-chh"><b>Kênh theo dõi</b><span class="mono muted small">${chs.length}</span><div style="flex:1"></div>
        <div class="seg sm" role="group" aria-label="Lọc nhãn kênh">${[["", "Tất cả"], ["Sản phẩm", "Sản phẩm"], ["Content", "Content"]].map(([v, l]) => `<button type="button" aria-pressed="${st.chLabel === v}" data-chl="${v}">${l}</button>`).join("")}</div>
        ${st.ch ? '<button class="btn sm" type="button" data-ch="" title="Bỏ lọc kênh">✕</button>' : ""}</div>
        <div class="rs-chlist" id="rs-chlist">${chs.filter((c) => !st.chLabel || c.label === st.chLabel).slice(0, st.chShown).map(chRow).join("") || '<div class="empty small">Chưa có kênh. Dán link kênh ở trên.</div>'}</div></section>
      <details class="box pad rs-set"><summary class="small"><b>Cài đặt crawl</b></summary>
        <label class="small muted">Video win khi gấp<select class="in" data-rset="win_x">${[3, 5, 8, 10].map((x) => `<option value="${x}" ${+d.settings.win_x === x ? "selected" : ""}>${x} lần trung vị kênh</option>`).join("")}</select></label>
        <label class="small muted">Lịch tự crawl<select class="in" data-rsched>${[["off", "Tắt"], ["i6", "Mỗi 6 giờ"], ["i12", "Mỗi 12 giờ"], ["i24", "Mỗi 24 giờ"], ["daily", "Hàng ngày theo giờ"]].map(([v, l]) => `<option value="${v}" ${schedVal(d.settings) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${d.settings.mode === "daily" ? `<label class="small muted">Giờ crawl (cách nhau dấu phẩy)<span class="rs-num"><input class="in" id="rs-times" value="${esc((d.settings.times || []).join(", "))}" placeholder="07:00, 19:00"><button class="btn sm" type="button" data-rtimes>Lưu</button></span></label>` : ""}
        ${d.next_run ? `<span class="small muted">Đang chạy: ${esc(d.next_run)}</span>` : '<span class="small muted">Tự crawl đang tắt · bấm crawl tay ở từng kênh</span>'}
        <label class="small muted">Mặc định mỗi kênh lấy<span class="rs-num"><input class="in" type="number" min="5" max="300" step="5" data-rset="per_channel" value="${d.settings.per_channel}"><span>video</span></span></label></details>
    </aside>
    <main class="rs-main">
      <section class="kpis">${kpi("Kênh theo dõi", chs.length, `${new Set(chs.map((c) => c.platform)).size} nền tảng · ${chs.filter((c) => c.label === "Sản phẩm").length} sản phẩm · ${chs.filter((c) => c.label === "Content").length} content`)}
        ${kpi("Video đã crawl", d.videos.length, running ? `${running} việc đang chạy` : (d.next_run ? `tự crawl ${d.next_run.split(" · ")[0]}` : "tự crawl đang tắt"))}
        ${kpi("Video win", wins, `≥ ${String(d.settings.win_x).replace(".", ",")} lần trung vị kênh`, "var(--accent)")}
        ${kpi("Đã chuyển thành HuyK", d.remixed, "bản đã lưu vào Kho content", "var(--ai)")}</section>
      <section class="fbar"><div class="seg" role="group" aria-label="Lọc">${seg.map(([v, l]) => `<button type="button" aria-pressed="${st.seg === v}" data-rseg="${v}">${l}<span class="mono n">${counts[v]}</span></button>`).join("")}</div>
        <select class="in" data-rf="pf" aria-label="Nền tảng"><option value="">Mọi nền tảng</option>${Object.entries(PF).map(([p, x]) => `<option value="${p}" ${st.pf === p ? "selected" : ""}>${x[2]}</option>`).join("")}</select>
        <select class="in" data-rf="fam" aria-label="Tuyến"><option value="">Mọi tuyến</option>${Object.entries(FAMN).map(([f, l]) => `<option value="${f}" ${st.fam === f ? "selected" : ""}>${f} · ${l}</option>`).join("")}</select>
        ${DR.html("research", st.dr)}
        <div style="flex:1"></div>
        <select class="in" data-rf="sort" aria-label="Xếp theo">${[["x", "Độ win (× trung vị)"], ["metric", "Lượt xem / thích"], ["new", "Mới nhất"]].map(([v, l]) => `<option value="${v}" ${st.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></section>
      ${r.length ? `<section class="rs-grid">${r.slice(0, st.shown).map(card).join("")}</section>${r.length > st.shown ? `<div class="rs-sentinel" id="rs-more"><span class="small muted">Đang tải thêm…</span></div>` : ""}`
        : `<div class="empty">${d.videos.length ? "Không có video khớp bộ lọc." : "Chưa có video. Thêm một kênh ở cột bên trái."}</div>`}
      <span class="small muted">Win = lượt xem (Douyin ẩn lượt xem nên dùng lượt thích) gấp ≥ ${d.settings.win_x} lần trung vị của kênh. Tag do AI đọc caption: CONTENT (kiến thức, câu chuyện, mẹo) hay SẢN PHẨM (khoe / bán một món), tuyến A1–A5, loại sản phẩm.</span>
    </main></div></div>`;
}

const METAL_OPT = [["auto", "Giữ như ảnh gốc"], ["s925", "Bạc S925"], ["k10", "Vàng 10K"], ["k14", "Vàng 14K"], ["k18", "Vàng 18K"], ["pt950", "Bạch kim PT950"]];
const BG_OPT = [["marble", "Nền cẩm thạch"], ["velvet", "Đế nhung đen"], ["white", "Nền trắng TMĐT"], ["hand", "Đeo trên người"]];
const num1 = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString(globalThis.VCB_LOC || "vi-VN", { maximumFractionDigits: d }));
const fmtUsd = (n) => n.toLocaleString(globalThis.VCB_LOC || "vi-VN", { maximumFractionDigits: 2 });
function videoBox(e, busy) {
  const k = st.kling || {};
  const vids = e.videos || [];
  const res = st.vres || "1080p", mot = st.vmot || "turn";
  const u = (k.units || {})[res] || 0;
  const ctl = !k.configured ? `<span class="small muted">Thêm <b>KLING_API_KEY</b> ở Cài đặt › Khoá kết nối để tạo video ${k.duration || 10}s từ ảnh render.</span>`
    : `<div class="rs-vctl"><select class="in" data-dx="vmot" aria-label="Chuyển động">${Object.entries(k.motions || {}).map(([m, l]) => `<option value="${m}" ${m === mot ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select class="in" data-dx="vres" aria-label="Độ phân giải">${Object.keys(k.units || {}).map((r) => `<option value="${r}" ${r === res ? "selected" : ""}>${r}</option>`).join("")}</select>
        <span class="small muted">${k.duration}s · ${u} đơn vị ≈ ${fmtUsd(u * 0.098)}–${fmtUsd(u * (k.unit_usd || 0.14))} USD${(k.worn || []).includes(mot) ? " + ảnh đeo Gemini ≈ 0,13 USD" : ""}</span>
        <button class="btn" type="button" data-dvideo="${esc(e.id)}" ${busy ? "disabled" : ""}>🎬 Tạo video ${k.duration}s</button></div>`;
  return `<div class="pad rs-sec"><span class="rs-h">Video sản phẩm (Kling 3.0, không tiếng)</span>${ctl}
    ${vids.length ? `<div class="rs-vids">${vids.map((x) => `<figure><video src="/${esc(x.file)}" controls loop muted playsinline preload="metadata"></video>
      <figcaption class="small muted">${esc(x.motion_label)} · ${esc(x.resolution)} · ${esc(x.at.slice(5))}${x.clip_id ? " · ✓ đã vào kho Tải lên" : ""} · <a href="/${esc(x.file)}" download>Tải</a></figcaption></figure>`).join("")}</div>` : ""}</div>`;
}
function designPanel(v) {
  const j = v.design_job || {};
  const busy = j.state === "running" || j.state === "queued";
  const fr = v.frames || [];
  if (!st.fsel) st.fsel = new Set(fr.slice(2, 4));
  const base = (v.designs || []).find((x) => x.id === st.dbase);
  const frameBox = fr.length ? `<div class="rs-frames">${fr.map((f) => `<button type="button" class="rs-frame${st.fsel.has(f) ? " on" : ""}" data-frame="${esc(f)}" aria-pressed="${st.fsel.has(f)}">${img("/" + f)}<i>${st.fsel.has(f) ? "✓" : ""}</i></button>`).join("")}</div>
      <span class="small muted">Chọn 1–4 khung thấy sản phẩm rõ nhất (đang chọn ${st.fsel.size}).</span>`
    : `<button class="btn" type="button" data-rframes ${st.fbusy ? "disabled" : ""}>${st.fbusy ? "Đang cắt khung hình…" : "Lấy khung hình từ video"}</button>
       <span class="small muted">Ảnh bìa thường không thấy rõ sản phẩm, nên lấy 8 khung hình trong video để chọn.</span>`;
  const form = `<div class="pad rs-sec">
      ${base ? `<div class="rs-basebar"><img src="/${esc(base.sketch)}" alt=""><span class="grow"><b>Biến tấu từ bản ${esc(base.at.slice(5))}</b><span class="small muted">AI vẽ lại từ bản thiết kế này theo ghi chú</span></span><button class="btn sm" type="button" data-dbase="">Bỏ</button></div>` : frameBox}
      ${base ? "" : `<div class="rs-modes" role="radiogroup" aria-label="Kiểu vẽ lại">${[["copy", "Vẽ lại giống 100%", "Giữ nguyên từng chi tiết của mẫu gốc"], ["improve", "Vẽ lại có cải tiến", "Giữ nhận diện mẫu, cải tiến nhẹ 2–3 điểm, đánh dấu ★"]].map(([k2, l, h]) => `<button type="button" role="radio" class="rs-mode${(st.dmode || "copy") === k2 ? " on" : ""}" aria-checked="${(st.dmode || "copy") === k2}" data-dmode="${k2}"><b>${l}</b><span class="small muted">${h}</span></button>`).join("")}</div>`}
      <div class="rs-ctl" style="padding:0;border:0">
        <label class="small muted">Kim loại<select class="in" data-dx="dmetal">${METAL_OPT.map(([k2, l]) => `<option value="${k2}" ${(st.dmetal || "auto") === k2 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="small muted">Ảnh render<select class="in" data-dx="dbg">${BG_OPT.map(([k2, l]) => `<option value="${k2}" ${(st.dbg || "marble") === k2 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="small muted">Kiểu bản vẽ<select class="in" data-dx="dstyle"><option value="tech" ${(st.dstyle || "tech") === "tech" ? "selected" : ""}>Bản vẽ kỹ thuật 3 hình chiếu</option><option value="watercolor" ${st.dstyle === "watercolor" ? "selected" : ""}>Phác thảo màu nước</option></select></label></div>
      <label class="small muted">${base ? "Biến tấu theo HuyK (bắt buộc)" : "Biến tấu theo HuyK (tuỳ chọn)"}<textarea class="in" id="rs-dnotes" rows="2" placeholder="vd: đổi đá chủ sang moissanite 8 li, thêm họa tiết rồng, làm bản nam bản rộng 6 li">${esc(st.dnotes || "")}</textarea></label>
      <div class="rs-foot"><span class="small muted">${busy ? `${esc(j.step || "Đang chờ")}…` : j.state === "error" ? `<span style="color:var(--bad)">Lỗi: ${esc(j.error || "")}</span>` : "Bản vẽ → ảnh render → nguyên vật liệu · khoảng 1 phút · ≈ 0,3 USD"}</span><div style="flex:1"></div>
        <button class="btn pri" type="button" data-rdesign ${busy || (!base && !fr.length && !v.thumb) ? "disabled" : ""}>${busy ? "AI đang vẽ…" : base ? "Vẽ bản biến tấu" : "Vẽ thiết kế + tính nguyên liệu"}</button></div></div>`;
  const card = (e) => {
    const b = e.bom || {}, c = e.calc || {};
    const w = (c.weights || []).find((x) => x.chosen) || {};
    return `<article class="rs-design"><div class="pad rs-dimgs"><a href="/${esc(e.sketch)}" target="_blank" rel="noopener"><img src="/${esc(e.sketch)}" alt="Bản thiết kế"><span>Bản thiết kế</span></a>
        <a href="/${esc(e.render)}" target="_blank" rel="noopener"><img src="/${esc(e.render)}" alt="Ảnh render"><span>Ảnh render</span></a></div>
      ${videoBox(e, busy)}
      <div class="pad rs-sec"><div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><b class="rs-title">${esc(b.product || "")}</b><span class="rs-tag ${e.mode === "improve" ? "content" : ""}">${e.base ? "BIẾN TẤU" : e.mode === "improve" ? "CẢI TIẾN" : "GIỐNG 100%"}</span><span class="small muted">${esc(e.at)}${e.notes ? " · biến tấu: " + esc(e.notes) : ""}</span></div>
        <p class="small" style="margin:0">${esc(b.summary || "")}</p>
        <span class="small muted">Ảnh gốc theo AI: <b>${esc(b.metal_guess || "—")}</b>${b.plating ? ` · Xi / mạ: ${esc(b.plating)}` : ""} · Độ tin cậy số đo: <b>${esc(b.confidence || "—")}</b></span></div>
      <div class="pad rs-sec"><span class="rs-h">Kim loại</span>
        <div class="rs-kv"><span>Thể tích kim loại</span><b class="mono">${num1(c.volume_mm3, 1)} mm³</b>
          <span>Trọng lượng (${esc(e.metal_label)})</span><b class="mono" style="color:var(--accent)">${num1(w.grams)} g · ${num1(w.chi)} chỉ</b></div>
        <table class="ctab rs-bt"><thead><tr><th>Bộ phận</th><th class="num">Thể tích</th><th class="num">${esc(e.metal_label)}</th><th>Cách ước</th></tr></thead>
          <tbody>${(b.parts || []).map((p) => `<tr><td>${esc(p.name)}</td><td class="num mono">${num1(p.volume_mm3, 1)} mm³</td><td class="num mono">${num1(p.grams)} g</td><td class="small muted">${esc(p.how || "")}</td></tr>`).join("")}</tbody></table>
        <div class="rs-alloys">${(c.weights || []).map((x) => `<button type="button" class="rs-alloy${x.chosen ? " on" : ""}" data-dmetal="${x.key}" data-did="${esc(e.id)}"><span>${esc(x.label)}</span><b class="mono">${num1(x.grams)} g</b><small>${num1(x.chi)} chỉ</small></button>`).join("")}</div></div>
      <div class="pad rs-sec"><span class="rs-h">Đá · tổng ${c.stone_count || 0} viên · ${num1(c.ct_total, 3)} ct</span>
        <table class="ctab rs-bt"><thead><tr><th>Vị trí</th><th>Loại đá</th><th>Dáng</th><th class="num">Kích thước</th><th class="num">SL</th><th class="num">ct / viên</th><th class="num">Tổng ct</th><th>Cách gắn</th></tr></thead>
          <tbody>${(c.stones || []).map((s) => `<tr><td>${esc(s.role)}</td><td>${esc(s.type)}${s.color ? `<span class="small muted" style="display:block">${esc(s.color)}</span>` : ""}</td><td>${esc(s.shape)}</td><td class="num mono">${esc(s.size)}</td><td class="num mono">${s.count}</td><td class="num mono">${num1(s.ct_each, 3)}</td><td class="num mono">${num1(s.ct_total, 3)}</td><td>${esc(s.setting)}</td></tr>`).join("")}</tbody></table></div>
      ${(b.changes || []).length ? `<div class="pad rs-sec"><span class="rs-h">Điểm cải tiến so với mẫu gốc</span>${b.changes.map((x) => `<div class="rs-why"><b class="small" style="color:var(--accent)">★</b><span>${esc(x)}</span></div>`).join("")}</div>` : ""}
      ${(b.specs || []).length ? `<div class="pad rs-sec"><span class="rs-h">Thông số sản xuất</span><div class="rs-kv">${b.specs.map((x) => `<span>${esc(x.name)}</span><b>${esc(x.value)}</b>`).join("")}</div></div>` : ""}
      ${(b.findings || []).length ? `<div class="pad rs-sec"><span class="rs-h">Phụ kiện</span><div class="rs-kv">${b.findings.map((x) => `<span>${esc(x.name)} × ${x.qty}</span><b>${esc(x.spec)}</b>`).join("")}</div></div>` : ""}
      ${(b.processes || []).length ? `<div class="pad rs-sec"><span class="rs-h">Công đoạn</span>${b.processes.map((x, i) => `<div class="rs-why"><b class="mono small">${i + 1}</b><span><b>${esc(x.step)}</b> · ${esc(x.note)}</span></div>`).join("")}</div>` : ""}
      ${(b.notes || []).length ? `<div class="pad rs-sec"><span class="rs-h">Lưu ý</span>${b.notes.map((x) => `<div class="rs-why"><i></i><span>${esc(x)}</span></div>`).join("")}</div>` : ""}
      <div class="pad rs-foot"><span class="small muted">Số đo ước từ ảnh: thợ cần đo / dựng CAD lại trước khi đúc. Trọng lượng = thể tích × tỷ trọng hợp kim; carat theo công thức kích thước × tỷ trọng đá.</span><div style="flex:1"></div>
        <button class="btn" type="button" data-dbase="${esc(e.id)}">Biến tấu từ bản này</button></div></article>`;
  };
  return form + ((v.designs || []).map(card).join("") || '<div class="empty">Chưa có bản thiết kế. Chọn khung hình rồi bấm “Vẽ thiết kế + tính nguyên liệu”.</div>');
}

// product videos (only visuals / product intro) default to Redesign; story videos with dialogue to Convert content
const modeOf = (v) => st.rtab || ((v && v.tags && v.tags.kind) === "product" ? "design" : "script");

function remixView(v, d, products) {
  const t = v.tags || {}, s = v.script, j = v.job || {};
  const r = v.remix || {};
  const reading = j.kind === "script" && (j.state === "running" || j.state === "queued");
  const vs = r.variants || [];
  const cur = vs[Math.min(st.opt, Math.max(0, vs.length - 1))];
  const fam = st.fam2 || r.params?.family || t.family || "A1";
  const topic = st.topic || r.params?.topic || (d.topics.includes(t.topic) ? t.topic : d.topics[0]);
  const srcName = { caption: "phụ đề của nền tảng", whisper: "Whisper trên máy", elevenlabs: "ElevenLabs", none: "không có lời thoại · đọc từ caption" };
  const savedId = cur ? (r.saved || {})[String(st.opt)] : null;
  return `<div class="page rs"><a class="btn sm" href="#/research" style="align-self:flex-start">← Danh sách video</a>
    <div class="rs-wrap">
    <section class="box rs-src">
      <div class="rs-srch"><a class="rs-th big" href="${esc(v.url || "#")}" target="_blank" rel="noopener" title="Mở video gốc">${cov(v)}${pfc(v.platform, "tl")}<span class="rs-play"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></a>
        <div class="grow"><div class="rs-tags">${v.win ? `<span class="rs-tag win">WIN ×${String(v.x).replace(".", ",")}</span>` : ""}${t.kind ? `<span class="rs-tag ${t.kind}">${t.kind === "content" ? "CONTENT" : "SẢN PHẨM"}</span><span class="rs-tag">${t.family} · ${FAMN[t.family] || ""}</span>${t.product ? `<span class="rs-tag">${esc(t.product)}</span>` : ""}` : ""}</div>
          <b class="rs-title">${esc(s?.hook_vi || t.hook_vi || v.title || "")}</b>
          <span class="small muted">${esc(v.channel_name || "")} · ${(PF[v.platform] || [0, 0, ""])[2]} · ${v.created ? ago(v.created) : ""}${v.duration ? " · " + dur(v.duration) : ""}</span>
          <div class="rs-met">${[["Lượt xem", k(v.views)], ["Thích", k(v.likes)], ["Bình luận", k(v.comments)], ["Chia sẻ", k(v.shares)]].map(([l, x]) => `<div><small>${l}</small><b class="mono">${x}</b></div>`).join("")}</div>
          <details class="small"><summary class="muted">Caption gốc</summary><p style="white-space:pre-wrap">${esc(v.title || "")}</p></details></div></div>
      ${s ? `<div class="pad rs-sec"><span class="rs-h">AI tách cấu trúc <span class="muted small">· lời thoại: ${srcName[s.source] || s.source}${s.scenes?.length ? " · cảnh: Gemini" : ""}${s.timing?.total ? ` · đọc trong ${Math.round(s.timing.total)} giây` : ""}</span></span>
          <p class="small" style="margin:0"><b>Cơ chế:</b> ${esc(s.mechanism || "")}</p>
          ${(s.beats || []).map((b) => `<div class="rs-beat"><span class="mono small muted">${esc(b.t)}</span><span class="rs-role">${esc(b.role)}</span><span>${esc(b.text)}</span></div>`).join("")}</div>
        <div class="pad rs-sec"><span class="rs-h">Vì sao win</span>${(s.whys || []).map((w) => `<div class="rs-why"><i></i><span>${esc(w)}</span></div>`).join("")}</div>
        <details class="pad rs-sec"><summary class="rs-h">Lời thoại (dịch tiếng Việt)</summary><p class="small" style="white-space:pre-wrap;margin:6px 0 0">${esc(s.transcript_vi || "")}</p>
          ${s.scenes?.length ? `<span class="rs-h" style="margin-top:8px">Cảnh</span>${s.scenes.map((x) => `<div class="rs-beat"><span class="mono small muted">${esc(x.t)}</span><span class="small">${esc(x.shot)}${x.onscreen ? ` · <i>chữ: ${esc(x.onscreen)}</i>` : ""}</span></div>`).join("")}` : ""}
          ${(s.notes || []).length ? `<p class="small muted">Ghi chú: ${esc(s.notes.join(" · "))}</p>` : ""}</details>
        <div class="pad"><button class="btn sm" type="button" data-rscript ${reading ? "disabled" : ""}>Đọc lại kịch bản</button></div>`
      : `<div class="pad rs-sec"><span class="rs-h">Kịch bản video gốc</span>
          <p class="small muted" style="margin:0">${reading ? `${esc(j.step || "Đang chờ")}…` : j.state === "error" ? `<span style="color:var(--bad)">Lỗi: ${esc(j.error || "")}</span>` : "Chưa đọc. Hệ thống lấy phụ đề của nền tảng, hoặc nghe lời thoại bằng Whisper trên máy, rồi AI tách cấu trúc và lý do win."}</p>
          <button class="btn pri" type="button" data-rscript ${reading ? "disabled" : ""}>${reading ? "Đang đọc…" : "Đọc kịch bản video này"}</button>
          ${d.gemini && !d.gemini.ok ? `<span class="small muted">Gemini chưa dùng được (${esc(d.gemini.error || "")}) · bỏ qua phần đọc cảnh.</span>` : ""}</div>`}
    </section>
    <section class="box rs-out">
      <div class="rs-rtabs"><div class="seg" role="group" aria-label="Chế độ">${(modeOf(v) === "design" ? [["design", "Redesign · bản thiết kế"], ["script", "Convert content"]] : [["script", "Convert content"], ["design", "Redesign · bản thiết kế"]]).map(([k2, l]) => `<button type="button" aria-pressed="${modeOf(v) === k2}" data-rtab="${k2}">${l}${k2 === "design" && (v.designs || []).length ? ` <span class="mono n">${v.designs.length}</span>` : ""}</button>`).join("")}</div></div>
      ${modeOf(v) === "design" ? designPanel(v) : `<div class="pad rs-ctl">
        <label class="small muted">Tuyến<select class="in" data-rx="fam2">${Object.keys(FAMN).map((f) => `<option value="${f}" ${fam === f ? "selected" : ""}>${f} · ${FAMN[f]}</option>`).join("")}</select></label>
        <label class="small muted">Chủ đề<select class="in" data-rx="topic">${d.topics.map((x) => `<option ${topic === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
        <label class="small muted">Gắn sản phẩm<select class="in" data-rx="sku"><option value="">Không gắn SPU</option>${products.map((p) => `<option value="${esc(p.sku)}" ${(st.sku || r.params?.sku) === p.sku ? "selected" : ""}>${esc(p.sku)} · ${esc((p.name || "").slice(0, 40))}</option>`).join("")}</select></label>
        <label class="small muted">Độ dài (giây)<input class="in" type="number" min="0" max="900" step="5" data-rx="secs" list="rs-secs" style="width:110px"
          placeholder="Tự do" value="${st.secs ?? r.params?.seconds ?? ""}" title="Để trống = tự do, AI kể trọn câu chuyện"><datalist id="rs-secs">${[30, 45, 60, 90, 120, 180].map((x) => `<option value="${x}">`).join("")}</datalist></label>
        <div style="flex:1"></div>
        <button class="btn pri" type="button" data-rremix ${st.busy ? "disabled" : ""}>${st.busy ? "AI đang viết 3 bản…" : vs.length ? "Viết lại 3 bản" : "Viết 3 bản HuyK"}</button></div>
      ${!s && !vs.length ? '<div class="small muted pad" style="padding-top:0">Nên đọc kịch bản trước để AI học đúng cơ chế. Chưa đọc thì AI dựa vào caption và tag.</div>' : ""}
      ${cur ? `<div class="pad rs-vtabs"><div class="seg" role="group" aria-label="Phương án">${vs.map((x, i) => `<button type="button" aria-pressed="${st.opt === i}" data-ropt="${i}">${esc(x.angle_name || `Bản ${i + 1}`)}${(r.saved || {})[String(i)] ? " ✓" : ""}</button>`).join("")}</div>
          <span class="small muted">${esc(cur.angle || "")}</span></div>
        <div class="pad rs-sec"><span class="small muted">Tiêu đề</span><b class="rs-title">${esc(cur.title)}</b><p class="small muted" style="white-space:pre-wrap;margin:0">${esc(cur.positioning || "")}</p></div>
        <div class="pad rs-lines">${(cur.storyboard || []).filter((l) => l.vo || l.role !== "OUTRO").map((l) => `<div class="rs-line"><span class="rs-role ${ROLE[l.role] || ""}">${esc(l.role.replace("_", " "))}</span><span>${esc(l.vo || "(outro)")}</span></div>`).join("")}</div>
        <details class="pad rs-sec"><summary class="small"><b>3 phương án hook · caption</b></summary>${(cur.hooks || []).map((h) => `<div class="rs-why"><i></i><span>${esc(h)}</span></div>`).join("")}<p class="small muted" style="white-space:pre-wrap">${esc(cur.caption || "")}</p></details>
        <div class="rs-note small"><b>Bám câu chuyện gốc:</b> HuyK kể lại, nêu quan điểm, hoặc chuyển cốt truyện sang nghề kim hoàn; lời viết mới, không dịch nguyên văn. Hình lấy từ Kho footage. Chỗ ghi [CẦN XÁC NHẬN] là dữ kiện cần anh kiểm tra.</div>
        <div class="pad rs-foot">${savedId ? `<a class="btn" href="#/content">Mở trong Kho content</a>` : `<button class="btn" type="button" data-rsave="${st.opt}">Lưu vào Kho content</button>`}
          <div style="flex:1"></div><button class="btn pri" type="button" data-rbuild="${st.opt}">Dựng video ngay</button></div>`
      : `<div class="empty">${st.busy ? "AI đang viết 3 bản HuyK (khoảng 15–30 giây)…" : "Chọn tuyến, chủ đề, sản phẩm rồi bấm “Viết 3 bản HuyK”."}</div>`}`}
    </section></div></div>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  DR.wire(el, (_, r) => { st.dr = r; st.shown = 48; paint(); });
  let d = await api.research();
  let v = null, poll = null;
  const products = (ctx.boot?.products || []).slice().sort((a, b) => a.sku.localeCompare(b.sku));
  const route = (params) => {
    const key = params[0] === "v" && params[1] ? decodeURIComponent(params[1]) : null;
    if (key !== st.key) st.rtab = null;
    st.key = key;
  };
  route(ctx.params || []);
  const loadV = async () => { v = st.key ? await api.researchVideo(st.key).catch(() => null) : null; };
  if (!st.kling) api.klingStatus().then((x) => { st.kling = x; if (st.key) paint(); }).catch(() => {});
  if (st.key) await loadV();
  const head = () => {
    const tk = d.tikhub || {};
    return `<header class="ph-bar"><h1>Nghiên cứu đối thủ</h1><nav class="seg" aria-label="Mục con"><a href="#/research" ${!st.key ? 'aria-current="page" class="on"' : ""}>Video crawl</a>${st.key ? `<a aria-current="page" class="on">${modeOf(v) === "design" ? "Redesign" : "Convert content"}</a>` : ""}</nav><div class="sp"></div>
      ${d.queue ? `<span class="small muted hide-m">${d.queue} việc đang chờ</span>` : ""}
      ${!st.key ? `<button class="btn" type="button" data-rall ${d.channels.length ? "" : "disabled"}>Crawl tất cả kênh</button>` : ""}</header>`;
  };
  let io = null;
  const wire = () => {
    const list = el.querySelector("#rs-chlist");
    if (list) {
      list.scrollTop = st.chScroll || 0;
      list.onscroll = () => {
        st.chScroll = list.scrollTop;
        if (list.scrollTop + list.clientHeight > list.scrollHeight - 60 && st.chShown < d.channels.length) { st.chShown += 25; paint(); }
      };
    }
    io?.disconnect();
    const more = el.querySelector("#rs-more");
    if (more && "IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); st.shown += 48; paint(); } }, { rootMargin: "600px" });
      io.observe(more);
    }
  };
  const paint = () => {
    el.innerHTML = head() + (st.key ? (v ? remixView(v, d, products) : '<div class="empty">Không tìm thấy video.</div>') : listView(d));
    wire();
  };
  const busyNow = () => Object.values(d.jobs || {}).some((j) => j.state === "running" || j.state === "queued")
    || (v && [v.job, v.design_job].some((x) => x && (x.state === "running" || x.state === "queued")));
  const watch = () => {
    clearTimeout(poll);
    poll = setTimeout(async () => {
      if (!el.getClientRects().length) { watch(); return; }        // screen kept alive but hidden
      const wasBusy = busyNow();
      // light poll (job steps); the full list (~1 MB) only when the data changed
      const pz = await api.researchPulse().catch(() => null);
      if (!pz || pz.rev !== d.rev) d = await api.research().catch(() => d);
      else d = { ...d, jobs: pz.jobs, queue: pz.queue };
      if (st.key) await loadV();
      if (document.activeElement?.closest?.("#rs-add, #rs-dnotes")) { watch(); return; }   // do not wipe what is being typed
      paint();
      if (busyNow() || wasBusy) watch();
    }, 3000);
  };
  paint();
  if (busyNow()) watch();
  const detect = () => {
    const x = (el.querySelector("#rs-link")?.value || "").toLowerCase();
    const p = /facebook|fb\.com/.test(x) ? "facebook" : /douyin/.test(x) ? "douyin" : /instagram/.test(x) ? "instagram" : /youtu/.test(x) ? "youtube" : /xiaohongshu|xhslink/.test(x) ? "xiaohongshu" : x ? "tiktok" : "";
    el.querySelectorAll(".rs-pfchip").forEach((c) => c.classList.toggle("on", c.dataset.p === p));
  };
  el.addEventListener("input", (e) => { if (e.target.id === "rs-link") detect(); });
  el.addEventListener("submit", async (e) => {
    if (e.target.id !== "rs-add") return;
    e.preventDefault();
    const f = new FormData(e.target);
    const b = e.target.querySelector("button[type=submit]");
    b.disabled = true;
    try {
      const c = await api.researchAdd({ link: f.get("link"), limit: Math.max(5, Math.min(300, +f.get("limit") || 0)) });
      toast(`Đã thêm kênh · đang crawl`);
      d = await api.research(); st.ch = c.id; paint(); watch();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
  el.addEventListener("change", async (e) => {
    const t = e.target;
    try {
      if (t.dataset.rf) { st[t.dataset.rf] = t.dataset.rf === "days" ? +t.value : t.value; st.shown = 48; paint(); return; }
      if (t.dataset.dx) { st[t.dataset.dx] = t.value; if (t.dataset.dx === "vres" || t.dataset.dx === "vmot") paint(); return; }
      if (t.dataset.rx) { st[t.dataset.rx] = t.dataset.rx === "secs" ? (t.value === "" ? "" : Math.max(0, +t.value)) : t.value; return; }
      if (t.hasAttribute("data-rsched")) {
        const x = t.value;
        d.settings = await api.researchSettings(x === "off" ? { mode: "off" } : x === "daily" ? { mode: "daily" } : { mode: "interval", every_h: +x.slice(1) });
        d = await api.research(); toast("Đã lưu lịch tự crawl"); paint(); return;
      }
      if (t.dataset.rset) { d.settings = await api.researchSettings({ [t.dataset.rset]: +t.value }); d = await api.research(); toast("Đã lưu cài đặt crawl"); paint(); }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    try {
      if (t.dataset.rlim) { const i = el.querySelector("#rs-add [name=limit]"); if (i) i.value = t.dataset.rlim; return; }
      if (t.dataset.chl !== undefined) { st.chLabel = t.dataset.chl; st.chShown = 25; st.chScroll = 0; paint(); return; }
      if (t.hasAttribute("data-rtimes")) {
        const times = (el.querySelector("#rs-times")?.value || "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => (/^\d:/.test(x) ? "0" + x : x));
        d.settings = await api.researchSettings({ mode: "daily", times }); d = await api.research(); toast("Đã lưu giờ crawl"); paint(); return;
      }
      if (t.dataset.rseg) { st.seg = t.dataset.rseg; st.shown = 48; paint(); return; }
      if (t.dataset.ch !== undefined) { st.ch = st.ch === t.dataset.ch ? "" : t.dataset.ch; st.shown = 48; paint(); return; }
      if (t.hasAttribute("data-rmore")) { st.shown += 48; paint(); return; }
      if (t.dataset.crawl) { await api.researchCrawl(t.dataset.crawl); toast("Đang crawl lại kênh"); d = await api.research(); paint(); watch(); return; }
      if (t.hasAttribute("data-rall")) { const x = await api.researchCrawlAll(); toast(`Đang crawl ${x.queued} kênh`); d = await api.research(); paint(); watch(); return; }
      if (t.dataset.rmch) {
        const c = d.channels.find((x) => x.id === t.dataset.rmch);
        if (!confirm(`Bỏ theo dõi ${c?.name || "kênh này"}? Video đã crawl của kênh sẽ bị xoá (bản đã chuyển thành HuyK vẫn giữ).`)) return;
        await api.researchRemove(t.dataset.rmch); if (st.ch === t.dataset.rmch) st.ch = ""; d = await api.research(); paint(); return;
      }
      if (t.hasAttribute("data-rscript")) { await api.researchScript(st.key); await loadV(); paint(); watch(); return; }
      if (t.dataset.rtab) { st.rtab = t.dataset.rtab; paint(); return; }
      if (t.dataset.frame) { st.fsel = st.fsel || new Set(); st.fsel.has(t.dataset.frame) ? st.fsel.delete(t.dataset.frame) : st.fsel.size < 4 && st.fsel.add(t.dataset.frame); paint(); return; }
      if (t.hasAttribute("data-rframes")) {
        st.fbusy = true; paint();
        try { const x = await api.researchFrames(st.key); v.frames = x.frames; st.fsel = new Set(x.frames.slice(2, 4)); } finally { st.fbusy = false; paint(); }
        return;
      }
      if (t.dataset.dmode) { st.dmode = t.dataset.dmode; st.dnotes = el.querySelector("#rs-dnotes")?.value || ""; paint(); return; }
      if (t.dataset.dbase !== undefined) { st.dbase = t.dataset.dbase; paint(); window.scrollTo(0, 0); return; }
      if (t.dataset.dvideo) {
        await api.researchDesignVideo(st.key, t.dataset.dvideo, { motion: st.vmot || "turn", resolution: st.vres || "1080p" });
        toast("Kling đang tạo video 10s · khoảng 2–5 phút"); await loadV(); paint(); watch(); return;
      }
      if (t.dataset.did) { await api.researchDesignMetal(st.key, t.dataset.did, t.dataset.dmetal); await loadV(); paint(); return; }
      if (t.hasAttribute("data-rdesign")) {
        st.dnotes = el.querySelector("#rs-dnotes")?.value || "";
        if (st.dbase && !st.dnotes.trim()) { toast("Gõ yêu cầu biến tấu trước", true); return; }
        await api.researchDesign(st.key, { frames: [...(st.fsel || [])], metal: st.dmetal || "auto", bg: st.dbg || "marble", style: st.dstyle || "tech", notes: st.dnotes, base: st.dbase || "", mode: st.dmode || "copy" });
        toast("AI đang vẽ · khoảng 1 phút"); await loadV(); paint(); watch(); return;
      }
      if (t.dataset.ropt !== undefined) { st.opt = +t.dataset.ropt; paint(); return; }
      if (t.hasAttribute("data-rremix")) {
        const r = v.remix || {}, tg = v.tags || {};
        st.busy = true; paint();
        try {
          await api.researchRemix(st.key, { family: st.fam2 || r.params?.family || tg.family || "", topic: st.topic || r.params?.topic || "",
            sku: st.sku || r.params?.sku || "", seconds: +(st.secs ?? r.params?.seconds ?? 0) || 0 });
          st.opt = 0; await loadV(); toast("Đã viết 3 bản HuyK");
        } finally { st.busy = false; paint(); }
        return;
      }
      if (t.dataset.rsave !== undefined || t.dataset.rbuild !== undefined) {
        const i = +(t.dataset.rsave ?? t.dataset.rbuild);
        t.disabled = true;
        const item = await api.researchSave(st.key, i);
        await loadV(); d = await api.research();
        if (t.dataset.rbuild !== undefined) { location.href = `/?content=${encodeURIComponent(item.id)}${item.sku ? `&sku=${encodeURIComponent(item.sku)}` : ""}`; return; }
        toast("Đã lưu vào Kho content (bản nháp)"); paint();
      }
    } catch (err) { toast(err.message, true); }
  });
  ctx.setShow?.(async () => { d = await api.research().catch(() => d); if (st.key) await loadV(); paint(); if (busyNow()) watch(); });
  ctx.setUpdate?.(async (params) => { route(params); st.opt = 0; st.fam2 = st.topic = st.sku = ""; st.fsel = null; st.dbase = ""; st.dnotes = ""; if (st.key) await loadV(); paint(); window.scrollTo(0, 0); if (busyNow()) watch(); return true; });
  ctx.setCleanup(() => clearTimeout(poll));
}
