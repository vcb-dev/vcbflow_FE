// Studio · Kịch bản tab, voice-first: ① pick a script from Kho content (or type) → ② make / pick the voice and
// listen → ③ choose the product footage set → build. The footage is cut to the voice's real length.
import { api } from "./api-client.js";
import { actions, store, toast } from "./editor-store.js";
import { esc, media } from "./format-helpers.js";

const FAM = { A1: "A1 · Mass traffic", A2: "A2 · Kiến thức", A3: "A3 · Niềm tin", A4: "A4 · Chế tác", A5: "A5 · Hero" };
const st = { items: [], omni: null, minimax: null, langs: {}, content: null, voice: null, scriptAtVoice: "", lang: "vi", trSeq: 0, a4: null, huyk: [] };
const LANG_NAMES = { vi: "Tiếng Việt", en: "English", th: "ไทย · Thái", ja: "日本語 · Nhật", id: "Indonesia", zh: "中文 · Đài Loan", es: "Español" };
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const stepHead = (n, label, extra = "") => `<div class="step-head"><span class="step-n">${n}</span><span class="eyebrow">${label}</span><span class="spacer"></span>${extra}</div>`;

export function scriptForm(boot) {
  return `<div class="step-card">${stepHead(1, "Kịch bản", '<span id="content-fam"></span>')}
      <div class="aiw">
        <textarea id="aiw-topic" rows="2" placeholder="Nhập chủ đề để AI tìm thông tin và viết. VD: Viên kim cương Hope và lời nguyền" aria-label="Chủ đề cho AI viết"></textarea>
        <div class="aiw-row"><select id="aiw-family" aria-label="Tuyến nội dung" title="Tuyến nội dung">${Object.keys(FAM).map((f) => `<option value="${f}" title="${FAM[f]}">${f}</option>`).join("")}</select>
          <label class="aiw-chk" title="AI tìm dữ kiện thật trên Google trước khi viết"><input type="checkbox" id="aiw-web" checked> Tìm trên mạng</label>
</div>
        <button id="aiw-btn" class="small-btn aiw-go" type="button">✨ AI viết kịch bản</button>
        <div id="aiw-hint" class="hint"></div></div>
      <div class="aiw-or"><span>hoặc chọn trong kho</span></div>
      <div style="display:flex;gap:6px"><select id="content-select" aria-label="Kịch bản trong kho" style="flex:1;min-width:0"><option value="">— Tự nhập kịch bản —</option></select>
        <select id="lang-select" aria-label="Ngôn ngữ video" title="Ngôn ngữ của video: AI dịch kịch bản, HuyK đọc giọng tiếng đó, phụ đề tiếng đó" style="width:auto">
          ${Object.entries(LANG_NAMES).map(([k]) => `<option value="${k}">${k.toUpperCase()}</option>`).join("")}</select></div>
      <input id="content-search" type="text" placeholder="Tìm trong kho…" aria-label="Tìm kịch bản">
      <div id="content-meta" class="hint"></div>
      <textarea id="script-input" rows="7" placeholder="Chọn kịch bản trong kho hoặc dán kịch bản…" aria-label="Lời kịch bản"></textarea></div>
    <div class="step-card">${stepHead(2, "Sản phẩm")}
      <select id="product-select" aria-label="Bộ footage sản phẩm"><option value="">— Không gắn sản phẩm —</option>
        ${boot.products.map((p) => `<option value="${p.sku}">${esc(p.sku)} · ${esc(p.name.replace(/-/g, " "))} (${p.clips} clip)</option>`).join("")}</select>
      <div id="product-steps" class="hint"></div>
      <label class="field">Tuyến nội dung <select id="line-select" aria-label="Tuyến nội dung"><option value="A4">A4</option></select></label>
      <div id="a4-route"></div>
      <details class="hint"><summary>Tuỳ chọn dựng</summary>
        <label class="field">Template <select id="template-select"><option value="auto">Tự động</option>
          ${boot.templates.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}</select></label>
        <label class="field">Tách phân cảnh <select id="planner-select"><option value="rules" selected>Nhanh · tức thì</option>
          <option value="claude" ${boot.claude_available ? "" : "disabled"}>AI · kỹ hơn, chậm hơn${boot.claude_available ? "" : " (cần khoá AI)"}</option></select></label>
        <div class="hint">Kịch bản từ Kho content dùng sẵn phân cảnh AI đã viết, không phải chờ.</div></details></div>
    <div class="step-card" id="illus-card">${stepHead(3, "Hình minh hoạ", '<span class="hint">A1 · A2 · A3</span>')}
      <label class="ill-chk"><input type="checkbox" id="ill-web"> <span><b>Cào hình &amp; video trên mạng</b><small>Báo, bảo tàng, YouTube, Wikimedia… AI chấm độ khớp từng câu rồi tự ghép</small></span></label>
      <label class="ill-chk"><input type="checkbox" id="ill-ai"> <span><b>AI tạo ảnh minh hoạ</b><small id="ill-ai-sub">Gemini vẽ ảnh cho câu không tìm được hình khớp · ≈1.000đ/ảnh</small></span></label></div>
    <button id="build-btn" class="primary">Dựng video</button>
    <div id="build-hint" class="hint" style="text-align:center"></div>
    <div id="job-summary" class="hint hidden"></div>`;
}

function contentOptions() {
  const q = ($("content-search").value || "").trim().toLowerCase();
  const list = st.items.filter((c) => c.status !== "archived" && (!q || `${c.title} ${c.script}`.toLowerCase().includes(q)));
  const groups = Object.keys(FAM).map((f) => {
    const rows = list.filter((c) => c.family === f);
    return rows.length ? `<optgroup label="${FAM[f]} (${rows.length})">${rows.map((c) =>
      `<option value="${esc(c.id)}">${esc(c.title)}${Object.keys(c.voices || {}).length ? " 🎙" : ""}${c.status === "draft" ? " · nháp" : ""}</option>`).join("")}</optgroup>` : "";
  }).join("");
  const cur = $("content-select").value;
  $("content-select").innerHTML = `<option value="">— Tự nhập kịch bản —</option>${groups}`;
  if (list.some((c) => c.id === cur)) $("content-select").value = cur;
}

function voiceStale() {
  return st.voice && st.voice.text !== $("script-input").value.trim();
}

export function voiceStudioHtml() {
  return `<div class="step-card" style="margin-bottom:12px">
      <div class="step-head"><span class="eyebrow">Giọng HuyK</span><span class="spacer"></span><span id="voice-dur" class="mono hint"></span></div>
      <div id="voice-list"></div>
      <div id="voice-player"></div>
      <div style="display:flex;gap:6px;align-items:center">
        <select id="omni-voice" title="Giọng HuyK" aria-label="Giọng HuyK" style="flex:1;min-width:110px"></select>
        <button id="voice-btn" class="small-btn" type="button">Tạo voice</button></div>
      <div id="voice-hint" class="hint"></div></div>`;
}

export function mountVoiceStudio(root) {
  root.innerHTML = voiceStudioHtml();
  root.querySelector("#voice-btn").addEventListener("click", (e) => makeVoice(e.currentTarget));
  root.querySelector("#voice-list").addEventListener("change", (e) => {
    const v = st.content?.voices?.[e.target.value];
    if (v) { st.voice = { audio: v.audio, duration: v.duration, provider: v.uploaded ? "file tải lên" : v.provider, text: $("script-input").value.trim() }; paintVoice(); }
  });
  root.querySelector("#voice-player").addEventListener("click", (e) => {
    if (!e.target.closest("#voice-to-tl") || !st.voice || voiceStale()) return;
    const job = store.job;
    if (job && (job.script || "").trim() === st.voice.text) { actions.voiceTrack(st.voice.audio); return; }
    if (job && !confirm("Timeline đang mở là kịch bản khác. Dựng timeline mới với kịch bản + voice này?")) return;
    $("build-btn").click();
  });
  paintVoice();
  refreshVoices();
}

let voiceFetchAt = 0;
export function ensureMiniMaxVoices() {
  const sel = $("omni-voice");
  if (st.minimax?.voices?.length && sel && [...sel.options].some((o) => o.value)) return;
  if (Date.now() - voiceFetchAt < 2000) return;
  voiceFetchAt = Date.now();
  refreshVoices();
}

async function refreshVoices() {
  try {
    const vs = await api.voiceStatus();
    st.omni = vs.omni;
    st.minimax = vs.minimax;
    paintVoice();
  } catch { /* the select stays on the loading label until the next open */ }
}

function paintVoice() {
  if (!$("voice-list")) return;
  const c = st.content;
  const ready = Object.entries(c?.voices || {}).filter(([lang, v]) => lang === st.lang && (v.uploaded || !v.text || v.text.trim() === $("script-input").value.trim()));
  $("voice-list").innerHTML = ready.length ? ready.map(([lang, v]) => `<label class="hint" style="display:flex;gap:6px;align-items:center;cursor:pointer">
      <input type="radio" name="voice-pick" value="${esc(lang)}" ${st.voice?.audio === v.audio ? "checked" : ""}>
      Voice có sẵn · ${esc(lang.toUpperCase())} · ${(v.duration || 0).toFixed(1)}s · ${v.uploaded ? "file tải lên" : esc((v.provider || "").split(":")[0])}</label>`).join("")
    : st.voice ? "" : '<div class="hint">Kịch bản này chưa có voice — chọn giọng MiniMax rồi bấm "Tạo voice".</div>';
  const mm = st.minimax?.voices?.length ? st.minimax : null;
  const sel = $("omni-voice");
  if (mm) {
    const preferred = mm.by_lang?.[st.lang] || mm.by_lang?.vi || mm.voices[0].id;
    const pick = mm.voices.some((v) => v.id === sel.value) ? sel.value : preferred;
    sel.innerHTML = mm.voices.map((v) => `<option value="${esc(v.id)}" ${v.id === pick ? "selected" : ""}>${esc(v.label)}</option>`).join("");
    sel.disabled = false;
  } else {
    sel.innerHTML = `<option value="">${st.minimax ? "Chưa có giọng MiniMax" : "Đang tải giọng MiniMax…"}</option>`;
    sel.disabled = true;
  }
  const v = st.voice;
  $("voice-player").innerHTML = v ? `<audio controls preload="metadata" src="${esc(media(v.audio))}" style="width:100%;height:34px"></audio>
    <button id="voice-to-tl" class="small-btn" style="width:100%;margin-top:6px" ${voiceStale() ? "disabled" : ""}>Thêm vào timeline</button>` : "";
  $("voice-hint").innerHTML = voiceStale() ? '<span style="color:var(--warn)">Kịch bản đã sửa sau khi tạo voice — bấm "Tạo voice" lại cho khớp.</span>'
    : v ? "Footage sẽ được cắt ghép đúng theo độ dài voice này." : "Chưa tạo voice: lúc dựng, hệ thống đọc bằng giọng MiniMax đang chọn.";
  $("voice-dur").textContent = v ? fmt(v.duration || 0) : "";
  $("build-hint").textContent = v && !voiceStale() ? `Dựng theo voice ${(v.duration || 0).toFixed(1)}s → video ≈ ${fmt((v.duration || 0) + 1)}` : "";
}

function savedVoice(c, lang, script) {
  const sv = c?.voices?.[lang];
  if (!sv || !(sv.uploaded || !sv.text || sv.text.trim() === script.trim())) return null;
  return { audio: sv.audio, duration: sv.duration, provider: sv.uploaded ? "file tải lên" : sv.provider, text: script.trim() };
}

async function applyLang() {
  /** Script of the picked Kho content in the chosen language (AI translation, cached on the server). */
  const c = st.content, lang = st.lang, seq = ++st.trSeq;
  $("market-chip").textContent = lang.toUpperCase();
  $("market-chip").title = `${LANG_NAMES[lang]} · lời + phụ đề ${lang === "vi" ? "· có outro HuyK" : "· không ghép outro (outro chỉ có tiếng Việt)"}`;
  if (!c) { paintVoice(); return; }
  {
    const same = lang === (c.language || "vi");
    if (!same) { $("script-input").value = ""; $("script-input").placeholder = "Đang dịch kịch bản…"; }
    try {
      const tr = await api.contentTranslation(c.id, lang);   // same language: the script without the self-intro line
      if (seq !== st.trSeq) return;
      $("script-input").value = tr.script;
      $("content-meta").innerHTML = `${same ? "" : `<b>${esc(tr.title)}</b> · `}${esc(c.topic)}${c.kind ? ` · dùng chung mọi ${esc(c.kind)}` : ""}`;
    } catch (err) {
      if (seq !== st.trSeq) return;
      $("script-input").value = c.script;
      toast(`Dịch kịch bản: ${err.message}`);
    } finally { $("script-input").placeholder = "Chọn kịch bản trong kho hoặc dán kịch bản…"; }
  }
  st.voice = savedVoice(c, lang, $("script-input").value);
  paintVoice();
}

function pickContent(id) {
  const c = st.items.find((x) => x.id === id) || null;
  st.content = c;
  st.voice = null;
  if (c) {
    $("script-input").value = c.script;
    applyLang();
    if (c.sku && store.boot.products.some((p) => p.sku === c.sku)) $("product-select").value = c.sku;
    $("content-meta").innerHTML = `${esc(c.topic)}${c.kind ? ` · dùng chung mọi ${esc(c.kind)}` : ""}`;
    $("content-fam").innerHTML = `<span class="fam ${esc(c.family)}">${esc(c.family)}</span>`;
  } else {
    $("content-meta").textContent = "";
    $("content-fam").innerHTML = "";
  }
  if (c && FAM[c.family]) $("aiw-family").value = c.family;
  showSteps();
  paintVoice();
  if ($("illus-card")) illusHint();
}

function illusHint() {
  if (!$("ill-ai").disabled) $("ill-ai-sub").textContent = $("ill-web").checked
    ? "Gemini vẽ ảnh cho câu không tìm được hình khớp · ≈1.000đ/ảnh" : "Không cào mạng: Gemini vẽ ảnh cho mọi câu minh hoạ · ≈1.000đ/ảnh";
  const fam = st.content?.family;
  $("illus-card").classList.toggle("dim", !!fam && !["A1", "A2", "A3"].includes(fam));
}

/** Topic typed by the editor → AI looks it up on the web → 5A script, saved in Kho content as a draft, picked here. */
async function aiWrite(btn) {
  const topic = $("aiw-topic").value.trim();
  if (topic.length < 3) { toast("Nhập chủ đề cho AI viết"); $("aiw-topic").focus(); return; }
  const web = $("aiw-web").checked;
  btn.disabled = true; btn.textContent = "⏳ Đang viết…";
  $("aiw-hint").innerHTML = `<span class="aiw-busy"></span>${web ? "AI đang tìm thông tin trên mạng rồi viết kịch bản" : "AI đang viết kịch bản"} · khoảng ${web ? "40–90" : "20–40"} giây`;
  try {
    const res = await fetch("/api/content/write", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, family: $("aiw-family").value, sku: $("product-select").value || "", web }) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(r.detail || res.statusText);
    st.items = [r, ...st.items.filter((x) => x.id !== r.id)];
    $("content-search").value = "";
    contentOptions();
    $("content-select").value = r.id;
    pickContent(r.id);
    const src = r.research?.sources || [];
    $("aiw-hint").innerHTML = `✓ Đã viết <b>${esc(r.title)}</b> · lưu nháp trong Kho content${src.length ? ` · ${src.length} nguồn: ` + src.slice(0, 4).map((x) =>
      `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || "nguồn")}</a>`).join(", ") : web ? " · không tìm được nguồn, AI viết theo hiểu biết chung — nên kiểm tra lại dữ kiện" : ""}`;
  } catch (err) {
    $("aiw-hint").innerHTML = `<span style="color:var(--warn)">AI viết lỗi: ${esc(err.message)}</span>`;
  } finally { btn.disabled = false; btn.textContent = "✨ AI viết kịch bản"; }
}

const A4_SLOTS = [
  { role: "Sản phẩm", seconds: 5, from: "product", variant: "hero" },
  { role: "HuyK", seconds: 4, from: "huyk" },
  { role: "Chế tác 1", seconds: 3, from: "craft" },
  { role: "Chế tác 2", seconds: 3, from: "craft" },
  { role: "Chế tác 3", seconds: 3, from: "craft" },
  { role: "HuyK", seconds: 4, from: "huyk" },
  { role: "Chế tác 4", seconds: 3, from: "craft" },
  { role: "Sản phẩm hoàn thiện", seconds: 8, from: "product", variant: "final" },
  { role: "Outro", seconds: 4, from: "outro" },
];
const A4_KINDS = [
  { key: "product:hero", from: "product", variant: "hero", role: "Sản phẩm", seconds: 5 },
  { key: "huyk", from: "huyk", role: "HuyK", seconds: 4 },
  { key: "craft", from: "craft", role: "Chế tác", seconds: 3 },
  { key: "product:final", from: "product", variant: "final", role: "Sản phẩm hoàn thiện", seconds: 8 },
  { key: "outro", from: "outro", role: "Outro", seconds: 4 },
];
const A4_FORMULA = [
  ["thiet_ke", "chuan_bi_nguyen_lieu", "nung_nau"],
  ["do_khuon", "dap_can", "tao_dang", "cua_cat"],
  ["han", "dua_mai", "khoan", "gan_da_chu"],
  ["dinh_da", "lam_sach", "danh_bong", "khac_laser", "hoan_thien"],
];
const a4Key = (s) => (s.from === "product" ? `product:${s.variant || "hero"}` : s.from);

function withSlotIndex(slots) {
  const count = { craft: 0, huyk: 0 };
  return (slots || A4_SLOTS).map((s) => {
    if (s.from === "craft") {
      const at = count.craft++;
      return { ...s, at, role: `Chế tác ${at + 1}`, seconds: s.seconds || 3 };
    }
    if (s.from === "huyk") {
      const at = count.huyk++;
      return { ...s, at, role: "HuyK", seconds: s.seconds || 4 };
    }
    if (s.from === "product") {
      const final = s.variant === "final";
      return { ...s, role: final ? "Sản phẩm hoàn thiện" : "Sản phẩm", seconds: s.seconds || (final ? 8 : 5) };
    }
    return { ...s, role: "Outro", seconds: s.seconds || 4 };
  });
}

function spreadCraft(steps) {
  const ordered = (steps || []).filter((s) => s.step && s.step !== "hoan_thien");
  const count = Math.min(4, ordered.length);
  if (count <= 1) return ordered.slice(0, count).map((s, at) => ({ step: s.step, name: s.label, at }));
  const picks = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let idx = Math.round(i * (ordered.length - 1) / (count - 1));
    if (idx <= last) idx = last + 1;
    if (idx >= ordered.length) break;
    last = idx;
    const s = ordered[idx];
    picks.push({ step: s.step, name: s.label, at: picks.length });
  }
  return picks;
}

function formulaCraft(steps, randomize) {
  if (!randomize) return spreadCraft(steps);
  const have = new Map((steps || []).map((s) => [s.step, s]));
  const used = new Set();
  return A4_FORMULA.map((group, at) => {
    const choices = group.filter((id) => have.has(id) && !used.has(id));
    if (!choices.length) return null;
    const id = choices[Math.floor(Math.random() * choices.length)];
    used.add(id);
    return { step: id, name: have.get(id).label, at };
  }).filter(Boolean).map((row, at) => ({ ...row, at }));
}

function productOf() {
  return store.boot.products.find((x) => x.sku === $("product-select").value);
}

function ensureA4() {
  const p = productOf();
  if (!p) { st.a4 = null; return null; }
  if (st.a4?.sku === p.sku) return st.a4;
  const saved = store.job?.a4_line && store.job.sku === p.sku ? store.job.a4_plan : null;
  if (saved?.slots?.length) {
    st.a4 = { sku: p.sku, slots: saved.slots.map((s) => ({ ...s, from: s.from || s.kind })), craft: saved.craft || [], huyk: saved.huyk || [] };
    return st.a4;
  }
  const huyk = st.huyk.slice(0, 2).map((h, at) => ({ name: h.name, path: h.name, at }));
  st.a4 = { sku: p.sku, slots: A4_SLOTS.map((s) => ({ ...s })), craft: formulaCraft(p.step_detail), huyk };
  return st.a4;
}

function a4Role(slot) {
  if (slot.from === "product") return slot.variant === "final" ? "product_final" : "product_hero";
  if (slot.from === "huyk") return "huyk_talk";
  if (slot.from === "craft") return "craft";
  return "outro";
}

async function liveA4(index) {
  const job = store.job;
  const draft = st.a4;
  if (!job?.a4_line || !draft || job.sku !== draft.sku || job.parts.length !== withSlotIndex(draft.slots).length) return;
  const slot = withSlotIndex(draft.slots)[index];
  const part = job.parts[index];
  if (!slot || !part || store.busy) return;
  const craft = slot.from === "craft" ? draft.craft?.[slot.at]?.step : null;
  const huyk = slot.from === "huyk" ? draft.huyk?.[slot.at]?.name : null;
  return actions.source(part.part_id, a4Role(slot), craft, huyk);
}

function a4Payload() {
  const draft = ensureA4();
  if (!draft) return null;
  const slots = withSlotIndex(draft.slots);
  return {
    slots: slots.map((s) => ({ kind: s.from, variant: s.variant || null, seconds: s.seconds, at: s.at ?? null })),
    craft: (draft.craft || []).filter(Boolean).map((c) => ({ step: c.step, name: c.name, at: c.at })),
    huyk: (draft.huyk || []).filter(Boolean).map((h) => ({ name: h.name, path: h.path || h.name, at: h.at })),
  };
}

function paintA4() {
  const root = $("a4-route");
  if (!root) return;
  const p = productOf();
  const draft = ensureA4();
  if (!p || !draft) {
    root.innerHTML = `<div class="hint">Chọn sản phẩm để chỉnh các ô footage A4.</div>`;
    return;
  }
  const slots = withSlotIndex(draft.slots);
  const steps = p.step_detail || [];
  const name = (p.name || p.sku).replace(/-/g, " ");
  root.innerHTML = `<div class="sec-title"><span>Footage theo tuyến A4</span><span class="a4-tools">
      <button class="small-btn" type="button" data-a4="formula" ${steps.length ? "" : "disabled"}>Theo thứ tự công đoạn</button>
      <button class="small-btn" type="button" data-a4="reshuffle" title="Bốc tổ hợp công đoạn khác">↻ đổi cảnh</button></span></div>
    <div class="hint">Đổi loại ô (Sản phẩm / HuyK / Chế tác). “Theo thứ tự công đoạn” lấy 4 ô từ đầu tới cuối quy trình, không nhảy lùi.</div>
    ${slots.map((s, i) => {
      const current = s.from === "craft" ? draft.craft?.[s.at] : s.from === "huyk" ? draft.huyk?.[s.at] : null;
      const kindOpts = A4_KINDS.map((k) => `<option value="${k.key}" ${a4Key(s) === k.key ? "selected" : ""}>${esc(s.from === "craft" && k.key === "craft" ? s.role : k.role)} · ${k.seconds}s</option>`).join("");
      let src = `<b>${esc(s.from === "product" ? name : "kho outro")}</b>`;
      if (s.from === "craft") {
        const extra = current?.step && !steps.some((st) => st.step === current.step) ? `<option value="${esc(current.step)}">${esc(current.name || current.step)}</option>` : "";
        src = `<span class="slot-src"><select data-a4="craft" data-i="${i}" aria-label="${esc(s.role)}">
            ${current?.step ? "" : `<option value="">— chọn công đoạn —</option>`}${extra}
            ${steps.map((st) => `<option value="${esc(st.step)}" ${current?.step === st.step ? "selected" : ""}>${esc(st.label)} · ${st.clips} clip</option>`).join("")}
          </select><button class="small-btn" type="button" data-a4="roll" data-i="${i}" title="Đổi công đoạn khác trong nhóm">↻</button></span>`;
      } else if (s.from === "huyk") {
        const known = st.huyk.some((h) => h.name === current?.name);
        src = `<span class="slot-src"><select data-a4="huyk" data-i="${i}" aria-label="Cảnh HuyK">
            ${current?.name ? "" : `<option value="">— chọn cảnh HuyK —</option>`}
            ${current?.name && !known ? `<option value="${esc(current.name)}">${esc(current.name)}</option>` : ""}
            ${st.huyk.map((h) => `<option value="${esc(h.name)}" ${current?.name === h.name ? "selected" : ""}>${esc(h.label)} · ${h.clips}</option>`).join("")}
          </select><button class="small-btn" type="button" data-a4="roll" data-i="${i}" title="Bốc cảnh HuyK khác">↻</button></span>`;
      }
      return `<div class="a4-slot"><div class="a4-slot-head"><select class="a4-kind" data-a4="kind" data-i="${i}" aria-label="Loại ô ${i + 1}">${kindOpts}</select>${src}</div></div>`;
    }).join("")}
    ${steps.length ? "" : `<div class="hint">Mã ${esc(p.sku)} chưa có công đoạn chế tác trong catalog.</div>`}`;
}

function onA4Change(e) {
  const act = e.target.dataset.a4;
  const draft = st.a4;
  if (!draft || !act) return;
  const i = Number(e.target.dataset.i);
  const slots = withSlotIndex(draft.slots);
  const slot = slots[i];
  if (act === "kind") {
    const kind = A4_KINDS.find((k) => k.key === e.target.value);
    if (!kind) return;
    draft.slots = withSlotIndex(draft.slots.map((s, n) => n === i ? { from: kind.from, variant: kind.variant, seconds: kind.seconds } : s));
    const next = withSlotIndex(draft.slots)[i];
    if (next.from === "craft" && !draft.craft?.[next.at]) {
      const step = (productOf()?.step_detail || [])[0];
      if (step) draft.craft[next.at] = { step: step.step, name: step.label, at: next.at };
    }
    if (next.from === "huyk" && !draft.huyk?.[next.at] && st.huyk[0]) draft.huyk[next.at] = { name: st.huyk[0].name, path: st.huyk[0].name, at: next.at };
  } else if (act === "craft" && slot?.from === "craft" && e.target.value) {
    const step = (productOf()?.step_detail || []).find((s) => s.step === e.target.value);
    draft.craft[slot.at] = { step: e.target.value, name: step?.label || e.target.value, at: slot.at };
  } else if (act === "huyk" && slot?.from === "huyk" && e.target.value) {
    draft.huyk[slot.at] = { name: e.target.value, path: e.target.value, at: slot.at };
  } else return;
  paintA4();
  liveA4(i);
}

async function onA4Click(e) {
  const btn = e.target.closest("[data-a4]");
  const draft = st.a4;
  if (!btn || !draft || btn.tagName !== "BUTTON") return;
  const p = productOf();
  if (btn.dataset.a4 === "formula") {
    draft.craft = formulaCraft(p?.step_detail);
  } else if (btn.dataset.a4 === "reshuffle") {
    draft.craft = formulaCraft(p?.step_detail, true);
    const pool = st.huyk.map((h) => h.name);
    const pick = () => pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : "";
    draft.huyk = [0, 1].map((at) => { const name = pick(); return name ? { name, path: name, at } : draft.huyk?.[at]; });
  } else if (btn.dataset.a4 === "roll") {
    const slot = withSlotIndex(draft.slots)[Number(btn.dataset.i)];
    if (!slot) return;
    if (slot.from === "craft") {
      const group = A4_FORMULA.find((g) => g.includes(draft.craft?.[slot.at]?.step)) || (p?.step_detail || []).map((s) => s.step);
      const choices = group.filter((id) => id !== draft.craft?.[slot.at]?.step && (p?.step_detail || []).some((s) => s.step === id));
      const id = choices[Math.floor(Math.random() * choices.length)];
      const step = (p?.step_detail || []).find((s) => s.step === id);
      if (step) draft.craft[slot.at] = { step: step.step, name: step.label, at: slot.at };
    } else if (slot.from === "huyk") {
      const used = new Set((draft.huyk || []).map((h) => h?.name));
      const free = st.huyk.filter((h) => h.name !== draft.huyk?.[slot.at]?.name && !used.has(h.name));
      const list = free.length ? free : st.huyk.filter((h) => h.name !== draft.huyk?.[slot.at]?.name);
      const item = list[Math.floor(Math.random() * list.length)];
      if (item) draft.huyk[slot.at] = { name: item.name, path: item.name, at: slot.at };
    }
    paintA4();
    liveA4(Number(btn.dataset.i));
    return;
  }
  paintA4();
  const open = store.job?.a4_line && store.job.sku === draft.sku;
  if (!open) return;
  for (const [i, slot] of withSlotIndex(draft.slots).entries()) {
    if (slot.from === "craft" || slot.from === "huyk") await liveA4(i);
  }
}

function showSteps() {
  const p = productOf();
  $("product-steps").textContent = p ? `Công đoạn có footage: ${p.step_labels.join(" → ")}${p.has_final ? "" : " · chưa có cảnh hoàn thiện"}` : "";
  if (st.a4 && p && st.a4.sku !== p.sku) st.a4 = null;
  if (!p) st.a4 = null;
  paintA4();
}

async function makeVoice(btn) {
  const script = $("script-input").value.trim();
  if (script.length < 10) { toast("Kịch bản quá ngắn"); return; }
  btn.disabled = true; btn.textContent = "⏳ Đang tạo…";
  try {
    const r = await api.studioVoice({ script, voice: $("omni-voice").value || "", lang: st.lang, content_id: st.content?.id || null });
    st.voice = { ...r, text: script };
    paintVoice();
    $("voice-player").querySelector("audio")?.play().catch(() => {});
  } catch (err) { toast(`Tạo voice: ${err.message}`); } finally { btn.disabled = false; btn.textContent = "🎙 Tạo voice"; }
}

export async function initScriptPanel() {
  $("content-select").addEventListener("change", (e) => pickContent(e.target.value));
  $("lang-select").addEventListener("change", (e) => { st.lang = e.target.value; st.voice = null; applyLang(); });
  $("content-search").addEventListener("input", contentOptions);
  $("script-input").addEventListener("input", paintVoice);
  $("product-select").addEventListener("change", () => { st.a4 = null; showSteps(); });
  $("a4-route").addEventListener("change", onA4Change);
  $("a4-route").addEventListener("click", onA4Click);
  fetch("/api/a4/huyk").then((r) => r.json()).then((d) => {
    st.huyk = d.actions || [];
    if (st.a4 && !(st.a4.huyk || []).some((h) => h?.name)) st.a4 = null;
    paintA4();
  }).catch(() => {});
  $("build-btn").addEventListener("click", () => {
    const useVoice = st.voice && !voiceStale();
    if (st.voice && !useVoice && !confirm("Kịch bản đã sửa sau khi tạo voice. Dựng không dùng voice này (tự lồng tiếng lại)?")) return;
    const line = $("line-select").value;
    const picked = $("template-select").value;
    actions.build({ script: $("script-input").value, sku: $("product-select").value,
      template_id: picked !== "auto" ? picked : (line === "A4" ? "A4_v1" : "auto"),
      line, plan: line === "A4" ? a4Payload() : null, planner: $("planner-select").value, content_id: st.content?.id || null, voice_track: useVoice ? st.voice.audio : null, lang: st.lang,
      preview: true, web_search: $("ill-web").checked, ai_images: $("ill-ai").checked });                               // fast 360p draft while editing; HD from the Xuất menu
  });
  $("aiw-btn").addEventListener("click", (e) => aiWrite(e.currentTarget));
  $("aiw-topic").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("aiw-btn").click(); });
  $("ill-web").addEventListener("change", illusHint);
  $("ill-ai").addEventListener("change", illusHint);
  fetch("/api/web-media/status").then((r) => r.json()).then((w) => {
    $("ill-web").checked = !!w.settings?.auto;
    $("ill-ai").checked = (w.settings?.ai_images || "fill") !== "off" && !!w.gemini;
    $("ill-ai").disabled = !w.gemini;
    if (!w.gemini) $("ill-ai-sub").textContent = "Cần khoá Gemini ở AI › Cài đặt";
    illusHint();
  }).catch(() => {});
  try {
    const [lib, vs] = await Promise.all([api.content(), api.voiceStatus()]);
    st.items = lib.items;
    st.omni = vs.omni;
    st.minimax = vs.minimax;
  } catch { st.items = []; }
  contentOptions();
  const poll = setInterval(async () => {
    if (st.minimax?.voices?.length) return clearInterval(poll);
    await refreshVoices();
    if (st.minimax?.voices?.length) clearInterval(poll);
  }, 5000);
  const q = new URLSearchParams(location.search);
  const want = q.get("content") && st.items.find((c) => c.id === q.get("content"));
  const first = want || st.items.find((c) => c.status === "approved") || st.items[0];
  if (first) { $("content-select").value = first.id; pickContent(first.id); } else paintVoice();
  if (q.get("sku") && store.boot.products.some((p) => p.sku === q.get("sku"))) { $("product-select").value = q.get("sku"); showSteps(); }
}

export function renderScriptPanel(s) {
  $("build-btn").disabled = !!s.busy;
  if (s.job?.lang && $("market-chip")) $("market-chip").textContent = s.job.lang.toUpperCase();
}
