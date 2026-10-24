// Cài đặt: AI viết & dựng (mức chất lượng, prompt) · Giọng đọc · Khoá kết nối · Máy & mạng.
// "AI trong hệ thống" lists every AI the app uses and for which job; the text AIs (main + backup) are chosen there.
import { api, esc, toast } from "./admin-api.js";
import * as DR from "./date-range.js";
import { isVi } from "../i18n.js";

const SECS = { ai: "AI viết & dựng", cost: "Chi phí AI", voice: "Giọng đọc", web: "Minh hoạ từ mạng", keys: "Khoá kết nối", system: "Máy & mạng" };

// money: USD with enough decimals for tiny per-call costs, VND rounded
export const usd = (v) => (v == null ? "—" : v === 0 ? "$0" : v < 0.01 ? `$${v.toFixed(4)}` : v < 1 ? `$${v.toFixed(3)}` : `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
export const vnd = (v) => (v == null ? "—" : `${Math.round(v).toLocaleString(globalThis.VCB_LOC || "vi-VN")}đ`);
const n = (v) => Number(v || 0).toLocaleString(globalThis.VCB_LOC || "vi-VN");

let costDr = DR.load("cost", "30d");
function costSec(u) {
  if (!u) return '<div class="empty is-busy">Đang tính chi phí…</div>';
  const r = u.vnd_rate;
  const VI = isVi();                         // other languages: USD only (no VND twin)
  const both = (x) => (VI ? `${usd(x)}<span class="small muted"> · ${vnd(x * r)}</span>` : usd(x));
  const low = u.providers.filter((p) => p.low);
  const prov = (p) => {
    const api = p.api || {};
    const left = api.chars_left != null ? `${n(api.chars_left)} ký tự` : p.left != null ? both(p.left) : '<span class="pc-none">Chưa nhập số dư</span>';
    const state = p.low ? '<span class="chip bad">Sắp hết · nạp thêm</span>' : p.unknown ? '<span class="chip">Chưa biết số dư</span>' : '<span class="chip ok">Đủ dùng</span>';
    const src = api.source === "api" ? `Lấy trực tiếp từ ${esc(p.label)}${api.note ? ` · ${esc(api.note)}` : ""}`
      : p.topup?.usd ? `Đã nạp ${usd(+p.topup.usd)} từ ${esc(p.topup.since || "?")} · đã tiêu ${usd(p.spent_since)}` : "Nhập số tiền đã nạp để app tự trừ dần";
    return `<article class="pcost${p.low ? " low" : ""}"><div class="pc-h"><b>${esc(p.label)}</b>${state}</div>
      <div class="pc-left"><small>Còn lại</small><strong>${left}</strong>${p.days_left != null ? `<span class="small ${p.days_left < 5 ? "bad-t" : "muted"}">≈ ${p.days_left} ngày theo mức dùng 7 ngày qua</span>` : ""}</div>
      <div class="pc-g"><div><small>Hôm nay</small><b>${usd(p.today)}</b></div><div><small>Trong khoảng</small><b>${usd(p.range)}</b></div><div><small>Tổng</small><b>${usd(p.all)}</b></div><div><small>TB / ngày (7n)</small><b>${usd(p.per_day)}</b></div></div>
      <div class="small muted">${src}</div>
      ${api.source === "api" ? "" : `<form class="pc-top" data-topup="${p.provider}"><label><small>Đã nạp (USD)</small><input class="in" name="usd" inputmode="decimal" value="${esc(p.topup?.usd ?? "")}" placeholder="VD 20"></label>
        <label><small>Ngày nạp</small><input class="in" name="since" type="date" value="${esc(p.topup?.since || new Date().toISOString().slice(0, 10))}"></label>
        <label><small>Báo khi còn dưới</small><input class="in" name="alert_usd" inputmode="decimal" value="${esc(p.topup?.alert_usd ?? 2)}"></label><button class="btn sm ink" type="submit">Lưu</button></form>`}
      <a class="btn sm${p.low ? " pri" : ""}" href="${esc(p.topup_url)}" target="_blank" rel="noopener">Mở trang nạp tiền ↗</a></article>`;
  };
  const price = (m) => { const p = m.price || {}; return p.chars != null ? `${usd(p.chars)} / 1K ký tự` : `${usd(p.in || 0)} vào · ${usd(p.out || 0)} ra / 1M token`; };
  const outs = (u.outputs?.items || []);
  const outCard = (o) => `<div class="ocard"><span class="kl">${esc(o.label)}</span><strong class="kv">${n(o.range)}</strong>
      <span class="ks">Tổng từ trước tới nay <b>${n(o.all)}</b></span>
      <span class="ks muted">${esc(o.sub)}</span>
      ${o.usd_range ? `<span class="ks gold">AI ${usd(o.usd_range)}${o.per_item_range ? ` · ≈ ${VI ? vnd(o.per_item_range * r) : usd(o.per_item_range)}/cái` : ""}</span>` : ""}</div>`;
  const R = u.range || {};
  return `${low.length ? `<div class="cost-alert" role="alert"><b>Sắp hết tiền:</b> ${low.map((p) => esc(p.label)).join(", ")}. Nạp thêm để video không bị dừng giữa chừng.</div>` : ""}
    <div class="csec-bar"><h2 class="csec">Chi phí AI</h2>${DR.html("cost", costDr)}</div>
    <section class="kpis cost-k"><div class="kpi"><span class="kl">Chi phí · ${esc(DR.label(costDr))}</span><strong class="kv">${usd(R.usd)}</strong><span class="ks">${VI ? vnd((R.usd || 0) * r) + " · " : ""}${n(R.days)} ngày</span></div>
      <div class="kpi"><span class="kl">Trung bình / ngày</span><strong class="kv">${usd(R.per_day)}</strong><span class="ks">${VI ? vnd((R.per_day || 0) * r) : ""}</span></div>
      <div class="kpi"><span class="kl">Trung bình 1 video</span><strong class="kv">${u.avg_video_usd != null ? (VI ? vnd(u.avg_video_usd * r) : usd(u.avg_video_usd)) : "—"}</strong><span class="ks">${u.avg_video_usd != null ? `${VI ? usd(u.avg_video_usd) + " · " : ""}${u.videos_30d} video trong khoảng` : "chưa có video nào được tính"}</span></div>
      <div class="kpi"><span class="kl">Hôm nay</span><strong class="kv">${usd(u.total.today)}</strong><span class="ks">${VI ? vnd(u.total.today * r) : ""}</span></div></section>
    <h2 class="csec">Kết quả đã làm ra <span class="small muted">${esc(DR.label(costDr))} · cập nhật ${esc(u.outputs?.at || "")}</span></h2>
    <section class="ocards">${outs.map(outCard).join("") || '<div class="empty">Chưa có số liệu.</div>'}</section>
    <h2 class="csec">Số dư từng tài khoản</h2>
    <div class="pcosts">${u.providers.map(prov).join("") || '<div class="empty">Chưa có khoá AI nào.</div>'}</div>
    <section class="box"><div class="sq-day" style="display:flex;align-items:center;gap:8px">Chi tiêu theo model<div style="flex:1"></div>
        <label class="small muted" style="display:flex;gap:6px;align-items:center">1 USD = <input class="in mono" id="vnd-rate" value="${r}" style="width:90px;min-height:30px"> đ</label><button class="btn sm" type="button" data-saverate>Lưu</button></div>
      <div class="tscroll"><table class="ctab mtab"><thead><tr><th>Model</th><th>Giá</th><th class="num">Hôm nay</th><th class="num">Trong khoảng</th><th class="num">Tổng</th><th class="num">Lần gọi (khoảng)</th><th class="num">Token vào / ra · ký tự</th><th>Dùng cho</th></tr></thead>
      <tbody>${u.models.map((m) => `<tr><td><b>${esc(m.model)}</b><div class="small muted">${esc(m.provider)}</div></td><td class="small"><button class="linkbtn" type="button" data-editprice="${esc(m.provider)}:${esc(m.model)}">${price(m)}</button></td>
        <td class="num mono">${usd(m.today)}</td><td class="num mono"><b>${usd(m.range)}</b></td><td class="num mono">${usd(m.all)}</td><td class="num mono">${n(m.r_calls)}</td>
        <td class="num mono small">${m.chars ? `${n(m.chars)} ký tự` : `${n(m.in)} / ${n(m.out)}`}</td><td class="small">${Object.entries(m.tasks).map(([k, v]) => `${esc(k)} ${usd(v)}`).join(" · ")}</td></tr>`).join("")
        || '<tr><td colspan="8" class="muted">Chưa có lượt gọi AI nào được ghi. Chi phí bắt đầu được tính từ bản cập nhật này.</td></tr>'}</tbody></table></div>
      <div id="price-edit"></div></section>
    <p class="small muted" style="margin:0">Giá là giá tham khảo theo bảng giá công khai của từng hãng, bấm vào giá để sửa cho khớp hoá đơn. Chi phí mỗi video = tách phân cảnh + giọng đọc của video đó + phần chia của bài viết (chia đều cho các video làm từ cùng một bài) + phần dịch (chia cho các video cùng ngôn ngữ).</p>`;
}
const TIERS = { fast: ["Nhanh", "Viết hàng loạt"], balanced: ["Cân bằng", "Dùng hằng ngày"], best: ["Tốt nhất", "Bài quan trọng"] };
const TASK_VI = { writer: "Viết content", translator: "Dịch kịch bản", planner: "Tách phân cảnh" };
const TASK_WHERE = { writer: "Kho content · lịch tự động viết bài mới", translator: "Video tiếng Anh, Thái, Nhật… · lời đọc + phụ đề",
  planner: "Kịch bản gõ tay trong Studio (bài từ Kho đã có sẵn phân cảnh)" };

function aiMap(s, mm, omni) {
  const prov = (k, x, backup) => `<select class="in" data-mprov="${k}:${backup ? 1 : 0}" aria-label="${backup ? "AI dự phòng" : "AI chính"} · ${esc(TASK_VI[k])}" style="min-height:32px">
      ${backup ? `<option value="" ${x ? "" : "selected"}>Không có</option>` : ""}${Object.entries(s.providers).map(([p, v]) => `<option value="${p}" ${x?.provider === p ? "selected" : ""}>${esc(v.label)}${s.keys[v.key]?.set ? "" : " ⚠"}</option>`).join("")}</select>
    <input class="in mono" data-mmodel="${k}:${backup ? 1 : 0}" list="mlist-${k}-${backup ? 1 : 0}" value="${esc(x?.model || "")}" spellcheck="false" aria-label="Phiên bản" style="min-height:32px;font-size:12px" ${x ? "" : "disabled"}>
    <datalist id="mlist-${k}-${backup ? 1 : 0}">${(x ? s.providers[x.provider].models : []).map((m) => `<option value="${esc(m)}">`).join("")}</datalist>`;
  const llmRow = (k) => {
    const m = s.models[k];
    return `<tr><th scope="row"><b>${TASK_VI[k]}</b><small>${TASK_WHERE[k]}</small></th>
      <td><div class="aipick">${prov(k, m, false)}</div></td><td><div class="aipick">${prov(k, m.fallback, true)}</div></td>
      <td><span class="chip ${s.available[k] ? "ok" : "bad"}">${s.available[k] ? "Sẵn sàng" : "Thiếu khoá"}</span></td>
      <td><button class="btn sm" type="button" data-test="${k}">Kiểm tra</button><div class="small muted" id="tr-${k}" style="max-width:220px"></div></td></tr>`;
  };
  const voices = mm ? Object.entries(mm.by_lang || {}).map(([l, id]) => `${l.toUpperCase()} ${esc((mm.voices.find((v) => v.id === id) || {}).label || id)}`).join(" · ") : "";
  const fixed = [
    ["Giọng HuyK", "Lời đọc mọi video, mọi ngôn ngữ", mm ? `MiniMax · <span class="mono">${esc(mm.model || "speech-2.8-hd")}</span><small>${voices}</small>` : "MiniMax", "Giọng local khi MiniMax lỗi",
      mm?.ready ? (mm.active ? ["ok", "Đang dùng"] : ["", "Đang tắt"]) : ["bad", "Thiếu khoá"]],
    ["Giọng local", "Lồng tiếng trên máy này (GPU), dự phòng cho MiniMax", "OmniVoice · chạy trên máy", "Giọng online ElevenLabs",
      omni?.ready ? ["ok", "Đang chạy"] : ["", "Chưa chạy"]],
    ["Phân loại footage", "Mã SP, công đoạn, HuyK, outro", "Không dùng AI · đọc từ tên thư mục SOURCE", "—", ["ok", "Luôn chạy"]],
    ["Dựng & xuất video", "Cắt ghép, phụ đề, nhạc, outro", "Không dùng AI · ffmpeg trên máy (GPU)", "—", ["ok", "Luôn chạy"]],
  ].map(([job, where, main, backup, [cls, st]]) => `<tr><th scope="row"><b>${job}</b><small>${where}</small></th><td>${main}</td><td class="muted small">${backup}</td>
      <td><span class="chip ${cls}">${st}</span></td><td>${job === "Giọng HuyK" || job === "Giọng local" ? '<button class="btn sm" type="button" data-sec="voice">Mở</button>' : ""}</td></tr>`).join("");
  return `<section class="box pad"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2>AI trong hệ thống</h2>
      <span class="muted small">AI chính làm việc; lỗi hoặc thiếu khoá thì AI dự phòng làm thay</span><div style="flex:1"></div>
      <button class="btn sm ink" type="button" id="save-models">Lưu thay đổi</button></div>
    <div style="overflow-x:auto"><table class="aimap"><thead><tr><th>Việc</th><th>AI chính</th><th>Dự phòng</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${Object.keys(s.tasks).map(llmRow).join("")}${fixed}</tbody></table></div></section>`;
}
const KEY_VI = { ANTHROPIC_API_KEY: "Khoá Claude (Anthropic)", DEEPSEEK_API_KEY: "Khoá DeepSeek", GEMINI_API_KEY: "Khoá AI Google (Gemini)", MINIMAX_API_KEY: "Khoá giọng MiniMax", ELEVENLABS_API_KEY: "Khoá giọng dự phòng",
  ELEVENLABS_VOICE_ID: "Mã giọng mẫu online", VCB_ACCESS_PIN: "Mã PIN mạng LAN",
  TELEGRAM_BOT_TOKEN: "Telegram · token bot", TELEGRAM_CHAT_ID: "Telegram · chat ID" };
let sec = "ai";

function aiSec(s, mm, omni) {
  const task = (k) => {
    const m = s.models[k];
    return `<section class="box pad"><div style="display:flex;align-items:center;gap:10px">
        <h2>${TASK_VI[k] || esc(s.tasks[k])} · tốc độ</h2></div>
      <div class="tier" role="radiogroup" aria-label="${esc(TASK_VI[k] || k)}">${Object.entries(TIERS).map(([t, [l, sub]]) => `<button type="button" role="radio" aria-checked="${m.speed === t}" data-tier="${k}:${t}"><b>${l}</b><small>${sub}</small></button>`).join("")}</div></section>`;
  };
  return `${aiMap(s, mm, omni)}${Object.keys(s.tasks).map(task).join("")}
    <section class="box pad"><div style="display:flex;align-items:center;gap:10px"><h2>Prompt viết content</h2>
        <span class="chip">${s.prompt_custom ? "Đã sửa" : "Mặc định"}</span><div style="flex:1"></div><span class="muted small" id="pr-count">${s.system_prompt.length.toLocaleString(globalThis.VCB_LOC || "vi-VN")} ký tự</span></div>
      <label class="sr" for="sys-prompt">Prompt</label>
      <textarea id="sys-prompt" class="in mono" rows="10" spellcheck="false" style="font-size:12px;line-height:1.6">${esc(s.system_prompt)}</textarea>
      <div style="display:flex;gap:8px"><button class="btn ink" type="button" id="save-prompt">Lưu prompt</button><button class="btn" type="button" id="reset-prompt">Khôi phục mặc định</button></div></section>
`;
}

const LANG_VI = { vi: "Tiếng Việt", th: "Tiếng Thái", en: "Tiếng Anh", es: "Tây Ban Nha", ja: "Tiếng Nhật" };
const SRC = { auto: "Tự động", minimax: "MiniMax", omnivoice: "Local" };

function minimaxSec(mm) {
  if (!mm) return "";
  const row = (lang) => {
    const opts = mm.voices.filter((v) => v.lang === lang);
    return `<div class="krow"><span class="kn">${LANG_VI[lang]}</span>
      ${opts.length ? `<select class="in" data-mmlang="${lang}" style="flex:1;min-width:180px" aria-label="Giọng ${LANG_VI[lang]}">${opts.map((v) => `<option value="${esc(v.id)}" ${mm.by_lang[lang] === v.id ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select>`
        : `<span class="muted small" style="flex:1">Chưa có giọng</span>`}
      <span id="mmt-${lang}" style="display:flex;align-items:center;gap:6px"></span>
      <button class="btn sm" type="button" data-mmtest="${lang}" ${mm.ready && opts.length ? "" : "disabled"}>Nghe thử</button></div>`;
  };
  return `<section class="box pad"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2>Giọng HuyK · MiniMax</h2>
      <span class="chip ${mm.ready ? (mm.active ? "ok" : "") : "bad"}">${mm.ready ? (mm.active ? "Đang dùng" : "Đã có khoá · đang tắt") : "Chưa có khoá"}</span>
      <div style="flex:1"></div>
      <div class="seg" role="radiogroup" aria-label="Nguồn giọng">${Object.entries(SRC).map(([k, v]) => `<button type="button" role="radio" aria-checked="${mm.provider === k}" aria-pressed="${mm.provider === k}" data-vsrc="${k}">${v}</button>`).join("")}</div></div>
    ${mm.ready ? "" : '<div class="muted small">Dán khoá MiniMax ở mục Khoá kết nối để dùng giọng HuyK online cho mọi ngôn ngữ.</div>'}
    <div>${["vi", "th", "en", "es", "ja"].map(row).join("")}</div>
    <div style="display:flex;align-items:center;gap:10px"><label class="f" for="mm-speed" style="margin:0">Tốc độ đọc</label>
      <input id="mm-speed" type="range" min="0.8" max="1.3" step="0.05" value="${mm.speed}" style="flex:1;max-width:260px;accent-color:var(--accent)"><span class="mono small" id="mm-speed-v">${mm.speed}×</span></div>
    <div class="muted small">Tự động = dùng MiniMax khi có khoá, nếu lỗi chuyển sang giọng local.</div></section>`;
}

function voiceSec(o, s, mm) {
  const eleven = s.keys.ELEVENLABS_API_KEY?.set && s.keys.ELEVENLABS_VOICE_ID?.set;
  return `${minimaxSec(mm)}<section class="box pad"><div style="display:flex;align-items:center;gap:10px"><h2>Giọng local</h2>
      <span class="chip ${o.ready ? "ok" : o.running ? "warn" : "bad"}">${o.ready ? `Đang chạy${o.device ? " · " + esc(o.device) : ""}` : o.running ? "Đang nạp…" : "Chưa chạy"}</span></div>
    ${o.ready ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${(o.voices || []).map((v) => `<span class="stepchip on">${esc(v)}</span>`).join("") || '<span class="muted small">Chưa có giọng mẫu</span>'}</div>
      <div class="muted small">Đã tạo ${o.generated ?? 0} câu · giọng mẫu trong ${esc(o.voices_dir || "omnivoice_worker/voices")}</div>`
      : `<div class="muted small">${esc(o.error || "Bấm đúp CHAY-OMNIVOICE.bat (cần máy có GPU NVIDIA).")}</div>`}</section>
    <section class="box pad" style="flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap"><h2>Giọng online dự phòng</h2><span class="muted small">Dùng khi giọng local tắt</span>
      <div style="flex:1"></div><span class="chip ${eleven ? "ok" : ""}">${eleven ? "Đã cài" : "Chưa có khoá"}</span></section>`;
}

/** Minh hoạ từ mạng (A1/A2): which sources the AI searches, in which order, and the picking rules. */
function webSec(w) {
  if (!w) return '<div class="empty is-busy">Đang tải…</div>';
  const st = w.settings;
  const rule = (k, l) => `<label class="wsr"><input type="checkbox" data-wsrule="${k}" ${st[k] ? "checked" : ""}> ${l}</label>`;
  const num = (k, l, unit) => `<label class="wsn"><small>${l}</small><span><input class="in mono" data-wsnum="${k}" value="${esc(st[k])}" inputmode="numeric"> ${unit}</span></label>`;
  return `<section class="box pad"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2>Tự ghép hình minh hoạ cho video A1 / A2</h2>
      <div style="flex:1"></div><button type="button" class="switch" role="switch" data-wsauto aria-checked="${st.auto}" aria-label="Bật tắt tự ghép"></button></div>
    <div class="muted small">Khi dựng video tuyến A1 / A2, AI đọc từng câu minh hoạ, tạo từ khoá, tìm trên các nguồn dưới đây, xem từng hình để chấm độ khớp rồi tự đặt hình khớp nhất vào video. Trong Studio, bấm “Tìm hình trên mạng…” ở một shot để đổi hình.${w.gemini ? "" : ' <b style="color:var(--bad)">Cần khoá Google Gemini để AI chấm hình và tìm bài báo.</b>'}</div></section>
    <section class="box"><div class="sq-day">Thứ tự ưu tiên nguồn · ${w.library} hình / video đã tải trong kho minh hoạ</div>
      ${w.sources.map((x, i) => `<div class="wsrc${x.on ? "" : " off"}"><span class="mono muted">${i + 1}</span>
        <span class="grow"><b>${esc(x.label)}</b><span class="small muted">${esc(x.what)}</span></span>
        <span class="chip ${x.has_key ? "ok" : "warn"}">${x.needs_key ? (x.has_key ? "Đã có khoá" : "Cần khoá · Khoá kết nối") : "Không cần khoá"}</span>
        ${x.copyright ? '<span class="chip">Có bản quyền</span>' : '<span class="chip ok">Dùng tự do</span>'}
        <button type="button" class="btn sm" data-wsup="${x.id}" ${i ? "" : "disabled"} aria-label="Đưa ${esc(x.label)} lên trên">↑</button>
        <button type="button" class="switch" role="switch" data-wssrc="${x.id}" aria-checked="${x.on}" aria-label="Bật tắt ${esc(x.label)}"></button></div>`).join("")}</section>
    <section class="box pad"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2>Trang ưu tiên lấy thông tin &amp; hình</h2><span class="small muted">${(st.sites || []).length} trang · mỗi dòng một trang</span><div style="flex:1"></div><button type="button" class="btn sm ink" data-wssites>Lưu danh sách</button></div>
      <div class="muted small" style="margin:4px 0 8px">AI tìm bài báo, bảo tàng, nhà đấu giá, thương hiệu… trong các trang này trước rồi mới tới trang khác. Bảo tàng The Met và Cleveland lấy thẳng ảnh mở (không bản quyền).</div>
      <textarea id="ws-sites" class="in mono" rows="8" style="width:100%;box-sizing:border-box;font-size:12.5px" aria-label="Trang ưu tiên">${esc((st.sites || []).join("\n"))}</textarea></section>
    <section class="box pad"><h2>Quy tắc chọn hình</h2>
      <div class="wsrules">${rule("hook_video", "Hook mở đầu ưu tiên video ấn tượng")}${rule("no_watermark", "Bỏ hình có watermark / logo kênh to")}</div>
      <label class="wsn" style="margin-bottom:12px"><small>Ảnh AI vẽ bằng Gemini (~1.000đ / ảnh)</small><select class="in" data-wsai style="max-width:340px">
        ${[["fill", "Chỉ câu không tìm được hình khớp"], ["all", "Mọi câu minh hoạ"], ["off", "Không tạo"]].map(([v, l]) => `<option value="${v}" ${st.ai_images === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <div class="wsnums">${num("min_px", "Bỏ ảnh nhỏ hơn", "px")}${num("reuse_days", "Không lặp hình đã dùng trong", "ngày")}${num("max_per_source", "Tối đa cùng 1 nguồn / video", "shot")}
        ${num("clip_max", "Đoạn video cắt dài tối đa", "giây")}${num("per_part", "Số hình tải sẵn mỗi câu", "hình")}</div>
      <div class="muted small">Hình từ báo, YouTube, ảnh web, link dán vào được gắn nhãn “Có bản quyền” trong Studio để biết trước khi chạy ads. Google Images cần khoá Google (Custom Search) ở mục Khoá kết nối; không có khoá thì tìm qua Bing và Google Search của Gemini.</div></section>`;
}

function keysSec(s) {
  return `<section class="box" style="padding:4px 16px">${Object.entries(s.keys).map(([name, k]) => `<div class="krow">
      <span class="kn">${esc(KEY_VI[name] || k.label)}</span>
      <input class="in" type="password" autocomplete="off" spellcheck="false" data-key="${esc(name)}" aria-label="${esc(KEY_VI[name] || k.label)}" placeholder="${k.set ? `Đã lưu · ${esc(k.masked)}` : "Dán vào đây"}" style="flex:1;min-width:200px">
      <span class="dot ${k.set ? "ok" : ""}" title="${k.set ? "Đã lưu" : "Trống"}"></span>
      <button class="btn sm ink" type="button" data-savekey="${esc(name)}">Lưu</button>
      ${k.source === "admin" ? `<button class="btn sm danger" type="button" data-delkey="${esc(name)}">Xoá</button>` : ""}</div>`).join("")}</section>
    <p class="muted small" style="margin:0">Khoá chỉ lưu trên máy này, có hiệu lực ngay.</p>
    <section class="box pad"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2>Telegram · gửi video</h2>
        <span class="chip ${s.keys.TELEGRAM_BOT_TOKEN?.set && s.keys.TELEGRAM_CHAT_ID?.set ? "ok" : ""}">${s.keys.TELEGRAM_BOT_TOKEN?.set ? (s.keys.TELEGRAM_CHAT_ID?.set ? "Sẵn sàng" : "Thiếu chat ID") : "Chưa có token"}</span>
        <div style="flex:1"></div><button class="btn sm" type="button" id="tg-detect" ${s.keys.TELEGRAM_BOT_TOKEN?.set ? "" : "disabled"}>Tìm chat ID</button></div>
      <div class="muted small">Nhắn 1 tin bất kỳ cho bot (hoặc thêm bot vào nhóm rồi nhắn trong nhóm), sau đó bấm "Tìm chat ID" và chọn nơi nhận video.</div>
      <div id="tg-chats"></div></section>`;
}

function systemSec(sy, ex) {
  if (!sy) return '<div class="empty is-busy">Đang đọc…</div>';
  return `<section class="box pad"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2>Xuất video</h2><div style="flex:1"></div>
      <span class="small muted">Tự xuất khi render HD xong</span>
      <button class="switch" type="button" role="switch" aria-checked="${!!ex?.auto}" aria-label="Tự xuất video" data-exauto></button></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="sr" for="ex-dir">Thư mục xuất</label>
        <input id="ex-dir" class="in mono" value="${esc(ex?.dir || "")}" style="flex:1;min-width:260px" spellcheck="false">
        <button class="btn ink" type="button" id="ex-save">Lưu</button></div>
      <div class="muted small">Tên file: <span class="mono">ngày_nhóm_mã SP_tên content.mp4</span> · ví dụ <span class="mono">261016_A4_N0017_Chuyển cọc rồi, lỡ HuyK không gửi thì sao.mp4</span></div></section>
    <div class="row">
    <section class="box pad grow"><h2>Máy này</h2>
      <div class="stat3"><div><small>Cấu hình</small><b>${sy.name === "lite" ? "Máy nhẹ" : "Máy mạnh"}</b></div><div><small>GPU</small><b>${sy.gpu ? "Có · NVENC" : "Không"}</b></div>
        <div><small>CPU · RAM</small><b>${sy.cpu} luồng · ${sy.ram_gb} GB</b></div><div><small>Render cùng lúc</small><b>${sy.render_workers} video</b></div></div>
      <button class="btn" type="button" id="restart-btn">Khởi động lại phần mềm</button></section>
    <section class="box pad side-col"><h2>Mạng nội bộ</h2>
      ${sy.lan_mode ? `<div class="stat3">${sy.lan_urls.map((u) => `<div><small>Máy khác mở</small><b class="mono">${esc(u)}</b></div>`).join("")}</div>`
        : '<div class="muted small">Chỉ máy này. Chạy CHAY-MAY-CHU-LAN.bat để máy khác trong văn phòng dùng chung.</div>'}
      <div class="muted small">Mã PIN đặt ở mục Khoá kết nối.</div></section></div>`;
}

export async function render(view, ctx) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  const saveU = (b) => api.aiUsageSave(b).then(() => api.aiUsage(DR.query(costDr)));
  DR.wire(el, (_, r) => { costDr = r; usage = null; paint(); loadUsage(); });
  let s = await api.aiSettings();
  let omni = ctx.boot.omni || {};
  let sy = null;
  let mm = null;
  let ex = null;
  api.exportSettings().then((x) => { ex = x; if (sec === "system") paint(); }).catch(() => {});
  let usage = null;
  let wm = null;
  api.webMedia().then((x) => { wm = x; if (sec === "web") paint(); }).catch(() => {});
  const loadUsage = () => api.aiUsage(DR.query(costDr)).then((x) => { usage = x; if (sec === "cost") paint(); }).catch((err) => toast(err.message, true));
  loadUsage();
  const body = () => (sec === "cost" ? costSec(usage) : sec === "ai" ? aiSec(s, mm, omni) : sec === "voice" ? voiceSec(omni, s, mm) : sec === "keys" ? keysSec(s) : sec === "web" ? webSec(wm) : systemSec(sy, ex));
  const dotOk = { cost: () => !(usage?.providers || []).some((p) => p.low), ai: () => Object.values(s.available).every(Boolean), voice: () => omni.ready || mm?.active, keys: () => s.keys.ANTHROPIC_API_KEY?.set || s.keys.DEEPSEEK_API_KEY?.set, web: () => !wm || (wm.gemini && wm.settings.auto), system: () => true };
  const paint = () => {
    el.innerHTML = `<header class="ph-bar"><h1>Cài đặt</h1></header>
      <div class="split"><nav class="snav" aria-label="Mục cài đặt">${Object.entries(SECS).map(([k, v]) => `<button type="button" data-sec="${k}" aria-current="${sec === k ? "page" : "false"}">${v}<span class="dot ${dotOk[k]() ? "ok" : "warn"}"></span></button>`).join("")}</nav>
        <main class="sbody${sec === "cost" ? " wide" : ""}" id="sbody">${body()}</main></div>`;
  };
  paint();
  const refresh = async () => { s = await api.aiSettings(); paint(); };
  api.system().then((x) => { sy = x; if (sec === "system") paint(); }).catch(() => {});
  api.voiceStatus().then((v) => { omni = v.omni || {}; mm = v.minimax; paint(); }).catch(() => {});
  const t = setInterval(() => { if (sec === "voice" && !omni.ready) api.voiceStatus().then((v) => { omni = v.omni || {}; mm = v.minimax; paint(); }).catch(() => {}); }, 8000);
  ctx.setCleanup(() => clearInterval(t));

  el.addEventListener("change", async (e) => {
    try {
      if (e.target.dataset.mmlang) { mm = await api.voiceSettingsSave({ by_lang: { [e.target.dataset.mmlang]: e.target.value } }); toast("Đã đổi giọng"); }
      if (e.target.id === "mm-speed") { mm = await api.voiceSettingsSave({ speed: Number(e.target.value) }); toast(`Tốc độ đọc ${mm.speed}×`); }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("submit", async (e) => {
    const f = e.target;
    if (!f.dataset.topup && !f.dataset.price) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    for (const k of Object.keys(d)) if (k !== "since") d[k] = d[k] === "" ? "" : Number(String(d[k]).replace(",", "."));
    try {
      if (f.dataset.topup) { usage = await saveU({ topups: { [f.dataset.topup]: d } }); toast("Đã lưu số tiền nạp"); }
      else { usage = await saveU({ prices: { [f.dataset.price]: d } }); toast("Đã lưu giá"); }
      paint();
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("change", async (e) => {
    try {
      if (e.target.hasAttribute("data-wsai")) { wm = await api.webMediaSave({ ai_images: e.target.value }); toast("Đã lưu"); }
      if (e.target.dataset.wsrule) { wm = await api.webMediaSave({ [e.target.dataset.wsrule]: e.target.checked }); toast("Đã lưu"); }
      if (e.target.dataset.wsnum) { const v = Number(String(e.target.value).replace(/\D/g, "")); if (v > 0) { wm = await api.webMediaSave({ [e.target.dataset.wsnum]: v }); toast("Đã lưu"); } paint(); }
    } catch (err) { toast(err.message, true); }
  });
  el.addEventListener("input", (e) => { if (e.target.id === "mm-speed") el.querySelector("#mm-speed-v").textContent = `${e.target.value}×`; });
  el.addEventListener("input", (e) => { if (e.target.id === "sys-prompt") el.querySelector("#pr-count").textContent = `${e.target.value.length.toLocaleString(globalThis.VCB_LOC || "vi-VN")} ký tự`; });
  el.addEventListener("change", (e) => {
    const key = e.target.dataset.mprov;                // "<task>:<0 main | 1 backup>"
    if (!key) return;
    const [task, b] = key.split(":");
    const input = el.querySelector(`[data-mmodel="${key}"]`);
    const p = s.providers[e.target.value];
    input.disabled = !p;
    input.value = p ? p.models[0] : "";
    el.querySelector(`#mlist-${task}-${b}`).innerHTML = (p ? p.models : []).map((x) => `<option value="${esc(x)}">`).join("");
  });
  el.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    try {
      if (btn.dataset.sec) { sec = btn.dataset.sec; paint(); if (sec === "cost") loadUsage(); return; }
      if (btn.hasAttribute("data-wssites")) { wm = await api.webMediaSave({ sites: el.querySelector("#ws-sites").value.split(/\n+/).map((x) => x.trim()).filter(Boolean) }); toast(`Đã lưu ${wm.settings.sites.length} trang`); paint(); return; }
      if (btn.hasAttribute("data-wsauto")) { wm = await api.webMediaSave({ auto: !wm.settings.auto }); toast(wm.settings.auto ? "Bật tự ghép hình minh hoạ" : "Tắt tự ghép hình minh hoạ"); paint(); return; }
      if (btn.dataset.wssrc) {
        const off = new Set(wm.settings.off); off.has(btn.dataset.wssrc) ? off.delete(btn.dataset.wssrc) : off.add(btn.dataset.wssrc);
        wm = await api.webMediaSave({ off: [...off] }); paint(); return;
      }
      if (btn.dataset.wsup) {
        const o = wm.settings.order.slice(); const i = o.indexOf(btn.dataset.wsup);
        if (i > 0) { [o[i - 1], o[i]] = [o[i], o[i - 1]]; wm = await api.webMediaSave({ order: o }); paint(); }
        return;
      }
      if (btn.hasAttribute("data-saverate")) { usage = await saveU({ vnd_rate: Number(el.querySelector("#vnd-rate").value.replace(/\D/g, "")) }); toast("Đã lưu tỉ giá"); paint(); return; }
      if (btn.dataset.editprice) {
        const k = btn.dataset.editprice; const p = usage.prices[k] || {};
        const f = (name, l) => `<label><small>${l}</small><input class="in mono" name="${name}" value="${esc(p[name] ?? "")}"></label>`;
        el.querySelector("#price-edit").innerHTML = `<form class="pc-top" data-price="${esc(k)}" style="padding:12px 16px;border-top:1px solid var(--line)"><b style="flex:1 1 100%">Giá ${esc(k)} (USD)</b>
          ${p.chars != null || k.startsWith("minimax") || k.startsWith("elevenlabs") ? f("chars", "/ 1K ký tự") : f("in", "Vào / 1M token") + f("cached", "Vào (cache) / 1M") + f("out", "Ra / 1M token")}
          <button class="btn sm ink" type="submit">Lưu giá</button>${usage.custom_prices[k] ? '<button class="btn sm" type="button" data-resetprice="' + esc(k) + '">Về giá mặc định</button>' : ""}</form>`;
        return;
      }
      if (btn.dataset.resetprice) { usage = await saveU({ prices: { [btn.dataset.resetprice]: null } }); toast("Đã dùng lại giá mặc định"); paint(); return; }
      if (btn.hasAttribute("data-exauto")) { ex = await api.exportSettingsSave({ auto: !ex.auto }); toast(ex.auto ? "Bật tự xuất video" : "Tắt tự xuất video"); paint(); return; }
      if (btn.id === "ex-save") { ex = await api.exportSettingsSave({ dir: el.querySelector("#ex-dir").value }); toast(`Thư mục xuất: ${ex.dir}`); paint(); return; }
      if (btn.dataset.vsrc) { mm = await api.voiceSettingsSave({ provider: btn.dataset.vsrc }); toast(`Nguồn giọng: ${SRC[mm.provider]}`); paint(); return; }
      if (btn.dataset.mmtest) {
        const lang = btn.dataset.mmtest;
        const voice = el.querySelector(`[data-mmlang="${lang}"]`)?.value || "";
        btn.disabled = true; btn.textContent = "Đang tạo…";
        try {
          const r = await api.voiceTest({ lang, voice });
          el.querySelector(`#mmt-${lang}`).innerHTML = `<audio controls autoplay src="/${r.audio}" style="height:32px;width:220px"></audio>`;
        } finally { btn.disabled = false; btn.textContent = "Nghe thử"; }
        return;
      }
      if (btn.dataset.tier) {
        const [task, speed] = btn.dataset.tier.split(":");
        await api.aiModelsSave({ [task]: { ...s.models[task], speed } }); toast(`${TASK_VI[task] || task}: ${TIERS[speed][0]}`); await refresh(); return;
      }
      if (btn.dataset.test) {
        const out = el.querySelector(`#tr-${btn.dataset.test}`);
        btn.disabled = true; out.textContent = "Đang thử…"; out.style.color = "";
        try {
          const r = await api.aiTest(btn.dataset.test);
          let msg = `Chính: tốt · ${r.seconds}s`;
          if (s.models[btn.dataset.test].fallback) {
            try { const b = await api.aiTest(btn.dataset.test, true); msg += ` · Dự phòng: tốt · ${b.seconds}s`; } catch (err) { msg += ` · Dự phòng lỗi: ${err.message.slice(0, 60)}`; }
          }
          out.textContent = msg; out.style.color = "var(--ok)";
        }
        catch (err) { out.textContent = err.message.slice(0, 120); out.style.color = "var(--bad)"; }
        finally { btn.disabled = false; }
        return;
      }
      if (btn.id === "save-models") {
        const models = {};
        Object.keys(s.tasks).forEach((k) => {
          const fbp = el.querySelector(`[data-mprov="${k}:1"]`).value;
          models[k] = { provider: el.querySelector(`[data-mprov="${k}:0"]`).value, model: el.querySelector(`[data-mmodel="${k}:0"]`).value.trim(),
            speed: s.models[k].speed, fallback: fbp ? { provider: fbp, model: el.querySelector(`[data-mmodel="${k}:1"]`).value.trim() } : null };
        });
        await api.aiModelsSave(models); toast("Đã lưu"); await refresh(); return;
      }
      if (btn.id === "save-prompt") { await api.aiPrompt(el.querySelector("#sys-prompt").value); toast("Đã lưu prompt"); await refresh(); return; }
      if (btn.id === "reset-prompt") {
        if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "Bấm lần nữa để khôi phục"; return; }
        await api.aiPrompt(""); toast("Đã khôi phục prompt mặc định"); await refresh(); return;
      }
      if (btn.id === "tg-detect") {
        btn.disabled = true;
        try {
          const { chats } = await api.telegramDetect();
          el.querySelector("#tg-chats").innerHTML = chats.length ? chats.map((c) => `<div class="krow"><span class="kn">${esc(c.title || "(không tên)")}</span>
              <span class="mono small muted" style="flex:1">${esc(c.id)} · ${esc(c.type)}</span><button class="btn sm ink" type="button" data-tgchat="${esc(c.id)}">Gửi video về đây</button></div>`).join("")
            : '<div class="muted small">Chưa thấy tin nhắn nào gửi tới bot — nhắn cho bot rồi bấm lại.</div>';
        } finally { btn.disabled = false; }
        return;
      }
      if (btn.dataset.tgchat) { await api.aiKeys({ TELEGRAM_CHAT_ID: btn.dataset.tgchat }); toast("Đã chọn nơi nhận video Telegram"); await refresh(); return; }
      if (btn.dataset.savekey) {
        const v = el.querySelector(`[data-key="${btn.dataset.savekey}"]`).value.trim();
        if (!v) { toast("Dán khoá trước khi lưu", true); return; }
        await api.aiKeys({ [btn.dataset.savekey]: v }); toast("Đã lưu khoá"); await refresh(); return;
      }
      if (btn.dataset.delkey) {
        if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "Chắc chưa?"; return; }
        await api.aiKeys({ [btn.dataset.delkey]: "" }); toast("Đã xoá khoá"); await refresh(); return;
      }
      if (btn.id === "restart-btn") {
        if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "Bấm lần nữa để khởi động lại"; return; }
        await api.restart(); toast("Đang khởi động lại… trang tự tải lại sau ít giây"); setTimeout(() => location.reload(), 25000);
      }
    } catch (err) { toast(err.message, true); }
  });
}
