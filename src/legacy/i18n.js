// System language (Tiếng Việt · English · 日本語 · ไทย · Español). The UI is written in Vietnamese; for another language
// 1) a dictionary (web/i18n/<lang>.json, built by tools/i18n_extract.py + i18n_translate.py) is applied to every text node
//    and to placeholder / title / aria-label / data-tip, also on content rendered later (MutationObserver);
// 2) whatever the dictionary does not cover (crawled competitor videos, captions, titles, scripts, server messages…) is
//    sent to /api/i18n/tr, translated once by Gemini on the server and cached there, then swapped in place.
// Numbers and product codes inside a text are matched as {#}, so "Chọn N0037" uses the entry "Chọn {#}".
// Money: in any language other than Vietnamese, VND amounts are shown in USD (rate from Cài đặt › Chi phí AI).
export const LANGS = [["vi", "Tiếng Việt", "VI"], ["en", "English", "EN"], ["ja", "日本語", "JA"], ["th", "ไทย", "TH"], ["es", "Español", "ES"]];
const KEY = "vcb-lang";
const ATTRS = ["placeholder", "title", "aria-label", "data-tip", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "INPUT"]);
const NUM = /\d+(?:[.,]\d+)*/g;
const CODE = /\b[A-Z]{1,4}\d[\w-]*|\d+(?:[.,]\d+)*/g;          // product codes (N0037, GB0001-S-WH) + numbers
const VN = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const CJK = /[぀-ヿ㐀-鿿가-힯]/;
const THAI = /[฀-๿]/;
const PATH = /[A-Za-z]:\\|^\/[\w.-]+\/|\.(mp4|mov|jpg|jpeg|png|wav|mp3|json)\b/i;
let dict = null;
let L = "vi";
const rt = new Map();          // runtime translations (server cache) of this page
const mine = new Set();        // values this module wrote, never sent back for translation
const pending = new Map();     // text → [{n, a, orig, set}] waiting for the server
const asked = new Set();
let timer = 0, busy = false, rtOff = false;

export function lang() {
  try { return localStorage.getItem(KEY) || "vi"; } catch { return "vi"; }
}
export const isVi = () => lang() === "vi";
// numbers follow the UI language everywhere (screens call toLocaleString(globalThis.VCB_LOC || "vi-VN")): 7.125 vs 7,125
if (!isVi()) globalThis.VCB_LOC = { en: "en-US", ja: "ja-JP", th: "th-TH", es: "es-ES" }[lang()] || "en-US";

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  location.reload();                       // simplest way to re-render every screen in the new language
}

// ---- money ---------------------------------------------------------------------------------------------------------
function rate() {
  try { return Number(localStorage.getItem("vcb-vnd-rate")) || 26300; } catch { return 26300; }
}
/** A dollar amount with enough decimals for tiny per-call costs. */
export function usdFmt(v) {
  const x = Number(v) || 0, a = Math.abs(x);
  const d = a === 0 ? 0 : a < 0.01 ? 4 : a < 1 ? 3 : a < 1000 ? 2 : 0;
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d });
}
/** A VND amount: "12.500đ" in Vietnamese, "$0.48" in every other language. */
export function money(vnd) {
  if (vnd == null || Number.isNaN(Number(vnd))) return "—";
  return isVi() ? `${Math.round(vnd).toLocaleString("vi-VN")}đ` : usdFmt(vnd / rate());
}
/** Short VND ("45,2tr" / "1,2 tỷ" / "850K") or short USD ("$1.7K"); suffix "đ" is added in Vietnamese only when asked. */
export function moneyShort(n, withD = false) {
  if (n == null) return "—";
  if (isVi()) {
    const s = n >= 1e9 ? `${(n / 1e9).toFixed(2).replace(".", ",")} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(".", ",")}tr`
      : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));
    return withD ? s + "đ" : s;
  }
  const u = n / rate();
  return u >= 1e6 ? `$${(u / 1e6).toFixed(2)}M` : u >= 1e4 ? `$${(u / 1e3).toFixed(1)}K` : usdFmt(u);
}

// ---- dictionary ----------------------------------------------------------------------------------------------------
function look(t, re) {
  const nums = t.match(re);
  if (!nums) return null;
  const out = dict[t.replace(re, "{#}")];
  if (out === undefined) return null;
  let i = 0;
  return out.replace(/\{#\}/g, () => nums[i++] ?? "");
}

function one(t) {
  if (t.length < 2) return null;
  let out = dict[t];
  if (out !== undefined) return out;
  const arrow = t.match(/^(.*\S)\s*([↓↑▲▼])$/);              // sortable header "Tổng views ↓"
  if (arrow) { const x = one(arrow[1]); return x == null ? null : `${x} ${arrow[2]}`; }
  if (rt.has(t)) return rt.get(t);
  return look(t, NUM) ?? look(t, CODE);
}

function tr(s) {
  if (!dict || !s) return null;
  const t = s.trim();
  if (t.length < 2) return null;
  let out = one(t);
  if (out == null && t.includes(" · ")) {                  // "Jane · 7 ngày trước · 7 bình luận": piece by piece
    let hit = false;
    out = t.split(" · ").map((p) => { const x = one(p.trim()); if (x != null) { hit = true; return x; } return p; }).join(" · ");
    if (!hit) out = null;
  }
  return out == null ? null : s.replace(t, out);
}

/** Does this text (still) need the server: has letters of another language and is not a path / our own output. */
function foreign(t) {
  if (VN.test(t)) return true;
  if (L === "ja") return false;
  return CJK.test(t) || (L !== "th" && THAI.test(t));
}
function needs(t) {
  return !rtOff && t.length >= 2 && !mine.has(t) && !rt.has(t) && !PATH.test(t) && foreign(t);
}

/** Ask the server for `orig` when what is shown now (`set`, maybe a partly translated "a · b") still has foreign text. */
function queue(n, a, orig, set) {
  const key = orig.trim();
  if (!needs(key) || !foreign(set ?? orig)) return;
  if (!pending.has(key)) pending.set(key, []);
  pending.get(key).push({ n, a, orig, set: set ?? orig });
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

async function flush() {
  if (busy) { timer = setTimeout(flush, 300); return; }
  const keys = [...pending.keys()].filter((k) => !asked.has(k)).slice(0, 200);
  if (!keys.length) return;
  busy = true;
  keys.forEach((k) => asked.add(k));
  try {
    const r = await fetch("/api/i18n/tr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: L, texts: keys }) });
    const j = r.ok ? await r.json() : { map: {}, ok: false };
    if (!j.ok && !Object.keys(j.map || {}).length) rtOff = true;      // no Gemini key: stop asking
    for (const k of keys) {
      const v = (j.map || {})[k];
      const list = pending.get(k) || [];
      pending.delete(k);
      if (v == null) continue;
      rt.set(k, v);
      mine.add(v.trim());
      for (const { n, a, orig, set } of list) {
        const now = a ? n.getAttribute?.(a) : n.nodeValue;
        if (now !== set) continue;                   // re-rendered meanwhile: the new node is translated on its own
        const nv = orig.replace(orig.trim(), v);
        if (a) n.setAttribute(a, nv); else n.nodeValue = nv;
      }
    }
  } catch { /* offline: leave the text as it is */ }
  busy = false;
  if ([...pending.keys()].some((k) => !asked.has(k))) timer = setTimeout(flush, 50);
}

function apply(v) {
  const t = tr(v);
  if (t != null) mine.add(t.trim());
  return t;
}

function attrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const t = apply(v);
    if (t != null && t !== v) el.setAttribute(a, t);
    queue(el, a, v, t ?? v);
  }
}

// ---- "working" states: a text that starts with "Đang …" (Đang tải…, Đang dựng…, Đang lưu…) gets a spinner (buttons,
// chips, notes) or the robot (.empty / .ph placeholders), in every language — marked on the Vietnamese original.
const BUSY = /^(Đang|đang chờ|Chờ gửi)\s/;
const NOT_BUSY = /^Đang (dùng|bật|hoạt động|mở|hiện|xem|có|là|chạy ·|chọn|ở)/;
const BUSY_TAGS = new Set(["BUTTON", "SPAN", "SMALL", "P", "DIV", "B", "STRONG", "A", "LABEL", "EM", "I"]);
function mark(n, v) {
  const p = n.parentElement;
  if (!p || !BUSY_TAGS.has(p.nodeName)) return;
  const t = (v ?? n.nodeValue).trim();
  if (BUSY.test(t) && !NOT_BUSY.test(t) && t.length < 140 && p.firstChild === n) p.classList.add("is-busy");
  else if (p.classList.contains("is-busy") && p.firstChild === n) p.classList.remove("is-busy");
}
function markTree(r) {
  if (r.nodeType === 3) return mark(r);
  if (r.nodeType !== 1) return;
  const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
  for (let c = w.nextNode(); c; c = w.nextNode()) mark(c);
}

function text(n) {
  const p = n.parentNode;
  if (!p || SKIP.has(p.nodeName) || p.closest?.("[data-noi18n]") || p.isContentEditable) return;
  const v = n.nodeValue;
  if (!mine.has(v.trim())) mark(n, v);
  const t = apply(v);
  if (t != null && t !== v) n.nodeValue = t;
  queue(n, null, v, t ?? v);
}

function node(n) {
  if (n.nodeType === 3) return text(n);
  if (n.nodeType !== 1 || n.closest("[data-noi18n]")) return;
  attrs(n);
  if (SKIP.has(n.nodeName)) return;
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let c = w.nextNode(); c; c = w.nextNode()) {
    if (c.nodeType === 3) text(c);
    else attrs(c);
  }
}

/** Translate one string now (dictionary / cache only) — for code that builds text outside the DOM. */
export const t = (s) => (dict ? tr(String(s)) ?? s : s);

/** Load the dictionary and keep translating everything rendered from now on. */
export async function initI18n() {
  L = lang();
  document.documentElement.lang = L;
  if (L === "vi") {                          // no translation: only the "working" spinners
    markTree(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") mark(m.target);
        else m.addedNodes.forEach(markTree);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    return;
  }
  fetch("/api/i18n/meta").then((r) => (r.ok ? r.json() : null)).then((m) => {
    if (m?.vnd_rate) try { localStorage.setItem("vcb-vnd-rate", String(m.vnd_rate)); } catch { /* ignore */ }
    if (m && !m.ok) rtOff = true;
  }).catch(() => {});
  try {
    const r = await fetch(`/web/i18n/${L}.json`, { cache: "force-cache" });
    dict = r.ok ? await r.json() : null;
  } catch { dict = null; }
  if (!dict) return;
  node(document.body);
  document.title = tr(document.title) || document.title;
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "characterData") node(m.target);
      else if (m.type === "attributes") node(m.target);
      else m.addedNodes.forEach(node);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const _toast = window.alert;
  window.alert = (msg) => _toast(tr(String(msg)) || msg);
  const _confirm = window.confirm;
  window.confirm = (msg) => _confirm(tr(String(msg)) || msg);
}
