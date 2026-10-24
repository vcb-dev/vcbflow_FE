// Left pane (CapCut "media library"): tab bar + Script tab (built once) + Footage library tab.
import { api } from "./api-client.js";
import { actions, currentPart, currentShot, setUi, store } from "./editor-store.js";
import { ICONS } from "./editor-icons.js";
import { esc, media, money } from "./format-helpers.js";
import { renderAiTab, renderAudioTab, renderEffectsTab, renderTextTab } from "./library-option-tabs.js";
import { initScriptPanel, scriptForm } from "./script-panel.js";

const TABS = [["script", "Kịch bản"], ["footage", "Footage"], ["audio", "Âm thanh"], ["text", "Văn bản"], ["effects", "Hiệu ứng"], ["ai", "AI"]];
// Two footage libraries: product craft source (per SKU) and HuyK character source (D:\SOURCE\HuyK\1. VN).
const SCOPES = [["upload", "Tải lên"], ["sku", "SP · đúng SPU"], ["product", "SP · tất cả"], ["huyk", "HuyK"], ["illus", "Minh hoạ AI"], ["web", "Từ mạng"], ["collected", "Sưu tầm"]];
const scopeOf = (c) => (c.library === "upload" ? "upload" : c.library === "web" ? "web" : c.library === "illus" ? "illus" : c.library === "huyk" ? "huyk" : c.rights === "collected" ? "collected" : c.product_set ? "product" : "shared");
const queue = [];                      // uploads in progress: {name, p, error}

/** Upload files from the computer (button, drop on the library, or drop on a timeline shot). Resolves to the new clips. */
export async function uploadFiles(files) {
  const out = [];
  for (const f of files) {
    const q = { name: f.name, p: 0, error: "" };
    queue.push(q);
    renderLibrary(store);
    try {
      const clip = await api.upload(f, (p) => { q.p = p; renderLibrary(store); });
      store.boot.library.unshift(clip);
      out.push(clip);
      queue.splice(queue.indexOf(q), 1);
    } catch (err) { q.error = err.message; }
    renderLibrary(store);
  }
  return out;
}
const STEP_VI = { thiet_ke: "Thiết kế", chuan_bi_nguyen_lieu: "Nguyên liệu", nung_nau: "Nung chảy", do_khuon: "Đổ khuôn", dap_can: "Đập/cán",
  cua_cat: "Cưa cắt", han: "Hàn", dua_mai: "Giũa mài", khoan: "Khoan", gan_da_chu: "Gắn đá chủ", dinh_da: "Đính đá", danh_bong: "Đánh bóng", hoan_thien: "Hoàn thiện" };
let footageFilter = { scope: "sku", step: "" };
let footageShown = 60;                 // thousands of thumbnails at once made the Studio stutter
const $ = (id) => document.getElementById(id);

export function initLibrary() {
  $("lib-tabs").innerHTML = TABS.map(([id, label]) => `<button class="lib-tab" data-lib="${id}">${ICONS[id]}${label}</button>`).join("");
  $("lib-tabs").querySelectorAll("[data-lib]").forEach((b) => b.addEventListener("click", () => setUi({ libTab: b.dataset.lib })));
  $("lib-body").innerHTML = TABS.map(([id]) => `<div id="lib-${id}" class="lib-page"></div>`).join("");
  $("lib-script").innerHTML = scriptForm(store.boot);
  initScriptPanel();
}

function summary(job) {
  const t = job.totals, c = job.costs || {};
  const per = (t.gen_cost_usd || 0) + (c.vo?.est_cost_usd || 0) + (c.script_llm || 0);
  return [["Thời lượng", `${t.duration.toFixed(1)}s · ${job.parts.length} phần`], ["Shot footage thật / AI", `${t.real_shots} / ${t.gen_shots}`],
    ["Template · planner", `${job.template_id} · ${job.planner}`], ["AI generate (đề xuất)", money(t.gen_cost_usd)],
    ["Lồng tiếng", job.voice_track ? "voice có sẵn (cắt theo câu)" : money(c.vo?.est_cost_usd)], ["Lập kế hoạch (LLM)", money(c.script_llm)], ["Chi phí AI / video", money(per)]]
    .map(([k, v]) => `<div class="stat"><span>${k}</span><b>${esc(v)}</b></div>`).join("");
}

function footageTab(s) {
  const sku = s.job?.sku;
  const clips = s.boot.library.filter((c) => {
    const scope = scopeOf(c);
    if (footageFilter.scope === "sku") { if (scope !== "product" || c.product_set !== sku) return false; }
    else if (footageFilter.scope === "product") { if (scope !== "product") return false; }
    else if (scope !== footageFilter.scope) return false;
    return !footageFilter.step || scope === "upload" || scope === "web" || scope === "illus" || c.craft_step === footageFilter.step;
  });
  const counts = Object.fromEntries(SCOPES.map(([id]) => [id, s.boot.library.filter((c) => (id === "sku" ? scopeOf(c) === "product" && c.product_set === sku : scopeOf(c) === id)).length]));
  const shot = currentShot(), part = currentPart();
  const up = footageFilter.scope === "upload";
  const upBox = up ? `<label class="up-drop" id="up-drop"><input id="up-input" type="file" multiple accept="video/*,image/*" hidden>
      <b>＋ Tải video / ảnh từ máy lên</b><span class="hint">Bấm để chọn, hoặc kéo thả file vào đây · thả thẳng file lên một shot trên timeline cũng được</span></label>
      ${queue.map((q) => `<div class="up-row${q.error ? " err" : ""}"><span class="ell">${esc(q.name)}</span>${q.error ? `<small>${esc(q.error)}</small><button class="small-btn" data-up-dismiss="${esc(q.name)}">✕</button>` : `<i style="--p:${Math.round(q.p * 100)}%"></i><small>${q.p >= 1 ? "đang xử lý…" : Math.round(q.p * 100) + "%"}</small>`}</div>`).join("")}` : "";
  return `${upBox}<div class="chips">${SCOPES.map(([id, l]) => `<button class="small-btn ${footageFilter.scope === id ? "on" : ""}" data-scope="${id}">${l} <span style="opacity:.6">${counts[id]}</span></button>`).join("")}</div>
    ${up ? "" : `<select id="step-filter"><option value="">Mọi công đoạn</option>${Object.entries(STEP_VI).map(([k, v]) => `<option value="${k}" ${footageFilter.step === k ? "selected" : ""}>${v}</option>`).join("")}</select>`}
    <p class="hint" style="margin:8px 0">${shot ? `Kéo clip thả lên shot bất kỳ trên timeline, hoặc bấm để thay vào <b>${esc(part.role_label)} · shot ${shot.index + 1}</b>.` : "Dựng video trước, rồi kéo clip thả lên timeline."} ${sku ? "" : "Chọn bộ footage sản phẩm để lọc đúng SKU."}</p>
    <div class="cards">${clips.slice(0, footageShown).map((c) => `<div class="card" draggable="true" data-lib-clip="${c.id}" title="${esc(c.description_vi)}">
      <span class="badge">${c.library === "upload" ? "TẢI LÊN" : c.library === "huyk" ? "HUYK" : c.rights === "collected" ? "SƯU TẦM" : esc(c.product_set || "CHUNG")}</span>
      ${c.library === "upload" ? `<button class="card-del" data-up-del="${c.id}" title="Gỡ khỏi kho tải lên" aria-label="Gỡ">✕</button>` : ""}
      <img class="thumb" src="${media(c.thumb)}" alt="" loading="lazy" decoding="async"><div class="meta"><b>${esc(c.name)}</b>${esc(c.step_label || STEP_VI[c.craft_step] || c.roles[0] || "")}</div></div>`).join("") || `<p class="hint">${up ? "Chưa có file nào. Tải video hoặc ảnh của anh lên để dùng như footage." : "Không có clip phù hợp bộ lọc."}</p>`}</div>
    ${clips.length > footageShown ? `<button class="small-btn" id="footage-more" style="width:100%;margin-top:8px">Xem thêm (${footageShown}/${clips.length})</button>` : ""}`;
}

function wireFootage(root) {
  root.querySelectorAll("[data-scope]").forEach((b) => b.addEventListener("click", () => { footageFilter.scope = b.dataset.scope; footageShown = 60; renderLibrary(store); }));
  root.querySelector("#footage-more")?.addEventListener("click", () => { footageShown += 60; renderLibrary(store); });
  root.querySelector("#step-filter")?.addEventListener("change", (e) => { footageFilter.step = e.target.value; footageShown = 60; renderLibrary(store); });
  root.querySelectorAll("[data-lib-clip]").forEach((card) => card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/vcb-clip", card.dataset.libClip);
    e.dataTransfer.effectAllowed = "copy";
    document.body.classList.add("dragging-clip");
  }));
  root.querySelectorAll("[data-lib-clip]").forEach((card) => card.addEventListener("dragend", () => document.body.classList.remove("dragging-clip")));
  root.querySelector("#up-input")?.addEventListener("change", (e) => { uploadFiles([...e.target.files]); e.target.value = ""; });
  const drop = root.querySelector("#up-drop");
  if (drop) {
    drop.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("on"); } });
    drop.addEventListener("dragleave", () => drop.classList.remove("on"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("on"); uploadFiles([...e.dataTransfer.files]); });
  }
  root.querySelectorAll("[data-up-dismiss]").forEach((b) => b.addEventListener("click", () => {
    const i = queue.findIndex((q) => q.name === b.dataset.upDismiss && q.error);
    if (i >= 0) queue.splice(i, 1);
    renderLibrary(store);
  }));
  root.querySelectorAll("[data-up-del]").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!confirm("Gỡ file này khỏi kho tải lên? Video đã dựng vẫn giữ nguyên.")) return;
    await api.deleteUpload(b.dataset.upDel);
    store.boot.library = store.boot.library.filter((c) => c.id !== b.dataset.upDel);
    renderLibrary(store);
  }));
  root.querySelectorAll("[data-lib-clip]").forEach((card) => card.addEventListener("click", () => {
    const shot = currentShot();
    if (!shot) return;
    actions.choose(shot.part_id, shot.index, { kind: "clip", clip_id: card.dataset.libClip, manual: true });
  }));
}

export function renderLibrary(s) {
  document.querySelectorAll(".lib-tab").forEach((b) => b.classList.toggle("active", b.dataset.lib === s.libTab));
  document.querySelectorAll(".lib-page").forEach((p) => p.classList.toggle("hidden", p.id !== `lib-${s.libTab}`));
  if (s.job) $("job-summary").innerHTML = summary(s.job);
  $("build-btn").disabled = !!s.busy;
  const pages = { footage: footageTab, audio: renderAudioTab, text: renderTextTab, effects: renderEffectsTab, ai: renderAiTab };
  if (pages[s.libTab]) {
    const root = $(`lib-${s.libTab}`);
    root.innerHTML = pages[s.libTab](s);
    if (s.libTab === "footage") wireFootage(root);
    root.querySelectorAll("[data-set]").forEach((el) => el.addEventListener(el.type === "range" ? "change" : "click", () => {
      const value = el.type === "range" ? Number(el.value) : JSON.parse(el.dataset.value);
      actions.settings({ [el.dataset.set]: value });
    }));
    root.querySelectorAll("[data-ai-gen]").forEach((b) => b.addEventListener("click", () =>
      actions.choose(b.dataset.part, 0, { kind: "gen", gen_id: b.dataset.aiGen })));
  }
}
