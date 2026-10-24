// Left-pane option tabs bound to job settings: Âm thanh, Văn bản, Hiệu ứng, AI. Controls carry
// data-set (setting key) + data-value (JSON) and are wired generically by library-panel.js.
import { esc, money, GEN_LABEL } from "./format-helpers.js";
import { isVi } from "./i18n.js";
const ZERO = () => (isVi() ? "0đ" : "$0");

const cfg = (s) => ({ ...s.boot.settings_defaults, ...(s.job?.settings || {}) });
const locked = (s) => (!s.job || s.busy ? "disabled" : "");

function opt(s, key, value, title, sub) {
  const on = cfg(s)[key] === value ? " on" : "";
  return `<button class="opt${on}" data-set="${key}" data-value='${JSON.stringify(value)}' ${locked(s)}><b>${title}</b><small>${sub || ""}</small></button>`;
}

function toggle(s, key, label, sub) {
  const value = cfg(s)[key];
  return `<div class="toggle"><span>${label}<br><small class="hint">${sub}</small></span>
    <button class="switch ${value ? "on" : ""}" data-set="${key}" data-value='${JSON.stringify(!value)}' ${locked(s)} aria-label="${label}"></button></div>`;
}

export function renderAudioTab(s) {
  const c = cfg(s);
  const tracks = s.boot.music.map((t) => opt(s, "music_track", t.id, esc(t.name), `${t.duration}s`)).join("");
  return `<div class="sec"><div class="sec-title">Giọng đọc (VO)</div><div class="opt-grid">
      ${opt(s, "voice", "huyk", "Giọng HuyK", s.boot.eleven_available ? "ElevenLabs clone · eleven_v4" : "cần API key")}
      ${opt(s, "voice", "demo", "Giọng demo", "macOS “Linh” · offline")}</div>
      <p class="hint" style="margin-top:6px">Cảm xúc từng câu chỉnh ở panel phải → tab <b>Giọng</b>.</p></div>
    <div class="sec"><div class="sec-title">Nhạc nền</div><div class="opt-list">${tracks}</div>
      <div class="field">Âm lượng nhạc (tự hạ khi có giọng)<div class="range-row">
        <input type="range" min="0" max="0.8" step="0.02" value="${c.music_volume}" data-set="music_volume" ${locked(s)}><output>${Math.round(c.music_volume * 100)}%</output></div></div>
      <p class="hint">Mỗi video tự chọn một bài khác nhau và lấy đoạn đang có nhạc (bỏ phần dạo đầu / im lặng).${c.music_start ? ` Bài này bắt đầu từ giây ${Math.round(c.music_start)}.` : ""}</p></div>`;
}

export function renderTextTab(s) {
  return `<div class="sec"><div class="sec-title">Phụ đề theo lời đọc</div>${toggle(s, "subtitles", "Hiện phụ đề", "tự chia 8 từ / dòng theo nhịp giọng")}
      <div class="opt-grid" style="margin-top:8px">${opt(s, "subtitle_style", "box", "Hộp nền", "giống project CapCut mẫu")}${opt(s, "subtitle_style", "outline", "Viền chữ", "chữ đậm, không nền")}</div></div>
    <div class="sec"><div class="sec-title">Chữ hook (0–5s)</div>${toggle(s, "hook_text", "Hiện câu hook đầu video", "8 từ đầu của kịch bản, chữ vàng phía trên")}</div>`;
}

export function renderEffectsTab(s) {
  return `<div class="sec"><div class="sec-title">Chuyển cảnh giữa các phần</div><div class="opt-grid">
      ${opt(s, "transition", "cut", "Cắt thẳng", "nhịp nhanh")}${opt(s, "transition", "dip", "Mờ qua đen", "0,18s mỗi biên")}</div></div>
    <div class="sec"><div class="sec-title">Bộ lọc màu</div><div class="opt-grid">
      ${opt(s, "color", "none", "Gốc", "không chỉnh")}${opt(s, "color", "warm", "Trang sức ấm", "vàng, đá ấm")}${opt(s, "color", "cool", "Bạc lạnh", "bạc, đá xanh")}</div></div>
    <div class="sec"><div class="sec-title">Logo thương hiệu</div>${toggle(s, "logo", "Logo HuyK ở outro", "chỉ phủ khi clip outro chưa có logo · không gắn lên cảnh chế tác (chốt 15/10/2026)")}</div>`;
}

export function renderAiTab(s) {
  if (!s.job) return '<p class="hint">Dựng video để xem các đề xuất AI.</p>';
  const rows = s.job.parts.filter((p) => (p.gen_options || []).length).map((p) => {
    const active = p.shots.some((sh) => sh.selected.kind === "gen");
    return `<div class="gen-card${active ? "" : " shoot"}"><div class="row"><b>${esc(p.part_id.toUpperCase())} · ${esc(p.role_label)}</b>
      <span class="chip ${active ? "ai" : ""}">${active ? "đang dùng AI" : "footage thật"}</span></div>
      ${p.gen_options.map((g) => `<div class="row" style="margin-top:6px"><span>${esc(GEN_LABEL[g.type] || g.type)} · ${g.type === "shoot_request" ? ZERO() : money(g.est_cost_usd)}</span>
        <button class="small-btn" data-ai-gen="${g.gen_id}" data-part="${p.part_id}" ${locked(s)}>Dùng</button></div>`).join("")}</div>`;
  }).join("");
  return `<div class="sec"><div class="sec-title">Đề xuất AI generate <span>${money(s.job.totals.gen_cost_usd)}</span></div>
    <p class="hint" style="margin-bottom:8px">Agent chỉ đề xuất AI khi kho thiếu cảnh. Không bao giờ sinh quá trình chế tác của SPU (phiếu quay bổ sung).</p>${rows}</div>`;
}
