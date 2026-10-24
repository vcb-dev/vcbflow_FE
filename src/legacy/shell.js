// Shared app shell for the Studio (/) and the admin (/admin): icon rail, light/dark theme, nav badges.
import { LANGS, initI18n, lang, setLang } from "./i18n.js";

const KEY = "vcb-theme";
let i18nStarted = false;
const ICONS = {
  studio: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z"/>',
  content: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>',
  footage: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  jobs: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  review: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  exports: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 11v5l4-2.5z"/>',
  social: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="M15 6l3-3 3 3M18 3v6"/>',
  workflow: '<rect x="3" y="4" width="6" height="5" rx="1.5"/><rect x="15" y="15" width="6" height="5" rx="1.5"/><path d="M9 6.5h4a2 2 0 0 1 2 2v6.5"/>',
  fx: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  ai: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  inventory: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  research: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/><path d="M8.5 11.5l1.8-2 1.6 1.8 1.8-2.3"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const ITEMS = [
  ["studio", "Studio", "/"], ["content", "Kho content", "/admin#/content"], ["footage", "Kho footage", "/admin#/footage"],
  ["jobs", "Job · tự động", "/admin#/jobs"], ["review", "Duyệt", "/admin#/review"], ["exports", "Đã xuất", "/admin#/exports"], ["inventory", "Kho hàng", "/admin#/inventory"], ["social", "Đăng & hiệu quả", "/admin#/social"], ["research", "Nghiên cứu đối thủ", "/admin#/research"], ["workflow", "Workflow", "/admin#/workflow"], ["fx", "FX · template · nhạc", "/admin#/fx"],
];
const svg = (name) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export function theme() {
  return document.documentElement.dataset.theme || "dark";
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked: theme still applies for this page */ }
  const b = document.getElementById("theme-btn");
  if (b) b.innerHTML = svg(t === "dark" ? "sun" : "moon");
}

/** Render the rail into #rail. `active` = one of the ITEMS keys or "ai"; on /admin the links stay hash-only. */
export function mountRail(active) {
  const el = document.getElementById("rail");
  if (!el) return;
  const onAdmin = location.pathname.startsWith("/admin");
  const href = (h) => (onAdmin && h.startsWith("/admin#") ? h.slice(6) : h);
  const item = ([key, tip, h]) => `<a class="ri${key === active ? " on" : ""}" href="${href(h)}" data-key="${key}" data-tip="${tip}" aria-label="${tip}"${key === active ? ' aria-current="page"' : ""}>${svg(key)}${key === "review" ? '<span class="nb" id="nb-review"></span>' : key === "content" ? '<span class="nb" id="nb-content"></span>' : ""}</a>`;
  el.innerHTML = `<a class="mark" href="/" aria-label="VCB Video Agent"><img src="/web/logo-mark.png" alt="" width="22" height="22"></a>${ITEMS.map(item).join("")}<div class="grow"></div>
    ${item(["ai", "AI · hệ thống", "/admin#/ai"])}
    <button class="ri" id="theme-btn" type="button" data-tip="Sáng / tối" aria-label="Đổi giao diện sáng tối">${svg(theme() === "dark" ? "sun" : "moon")}</button>
    <button class="ri lang-btn" id="lang-btn" type="button" data-tip="Ngôn ngữ hệ thống" aria-label="Ngôn ngữ hệ thống" aria-haspopup="menu" data-noi18n>${(LANGS.find((x) => x[0] === lang()) || LANGS[0])[2]}</button>`;
  document.getElementById("theme-btn").addEventListener("click", () => setTheme(theme() === "dark" ? "light" : "dark"));
  document.getElementById("lang-btn").addEventListener("click", (e) => { e.stopPropagation(); langMenu(e.currentTarget); });
  if (!i18nStarted) { i18nStarted = true; initI18n(); }
  mountTabbar(active, href);
}

/** Small menu next to the rail button: Tiếng Việt · English · 日本語 · ไทย · Español. */
export function langMenu(anchor) {
  let m = document.getElementById("lang-menu");
  if (m) { m.remove(); return; }
  m = document.createElement("div");
  m.id = "lang-menu";
  m.className = "lang-menu";
  m.setAttribute("role", "menu");
  m.dataset.noi18n = "";
  m.innerHTML = LANGS.map(([k, label, code]) => `<button type="button" role="menuitemradio" aria-checked="${lang() === k}" data-lang="${k}"><b>${code}</b>${label}</button>`).join("");
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = `${Math.min(r.right + 8, innerWidth - 180)}px`;
  m.style.top = `${Math.max(8, Math.min(r.top - 80, innerHeight - m.offsetHeight - 8))}px`;
  m.addEventListener("click", (e) => { const b = e.target.closest("[data-lang]"); if (b && b.dataset.lang !== lang()) setLang(b.dataset.lang); else m.remove(); });
  setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }));
}

// Phone: a bottom tab bar replaces the rail (CSS shows one or the other). Screens without a tab live under "Thêm".
const TABS = [["studio", "Studio", "/"], ["jobs", "Job", "/admin#/jobs"], ["social", "Đăng", "/admin#/social"], ["exports", "Đã xuất", "/admin#/exports"], ["more", "Thêm", "/admin#/more"]];
const tabOf = (key) => (TABS.some(([k]) => k === key) ? key : "more");
function mountTabbar(active, href) {
  let el = document.getElementById("tabbar");
  if (!el) { el = document.createElement("nav"); el.id = "tabbar"; el.className = "tabbar"; el.setAttribute("aria-label", "Điều hướng chính"); document.body.append(el); }
  el.innerHTML = TABS.map(([k, l, h]) => `<a class="tb" href="${href(h)}" data-tab="${k}"><span class="tbi">${svg(k)}</span>${l}${k === "more" ? '<span class="nb" id="nb-more"></span>' : ""}</a>`).join("");
  setTab(active);
}
function setTab(key) {
  const t = tabOf(key);
  document.querySelectorAll("#tabbar .tb").forEach((a) => {
    a.classList.toggle("on", a.dataset.tab === t);
    if (a.dataset.tab === t) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

export function setActive(key) {
  setTab(key);
  document.querySelectorAll("#rail .ri[data-key]").forEach((a) => {
    const on = a.dataset.key === key;
    a.classList.toggle("on", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

export async function refreshRailBadges() {
  try {
    const b = await (await fetch("/api/badges")).json();
    const set = (id, n) => { const e = document.getElementById(id); if (e) { e.textContent = n ? String(n) : ""; e.dataset.n = String(n || 0); } };
    set("nb-review", b.g2);
    set("nb-more", b.g2);
    set("nb-content", 0);
    return b;
  } catch { return null; }
}
