// "Thêm" (phone tab): every screen without its own tab, the channel connections and the light / dark switch.
import { api, esc } from "./admin-api.js";
import { setTheme, theme } from "../shell.js";
import { LANGS, lang, setLang } from "../i18n.js";

const TILES = [
  ["review", "Duyệt video", "#/review", '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'],
  ["content", "Kho content", "#/content", '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>'],
  ["inventory", "Kho hàng", "#/inventory", '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'],
  ["research", "Nghiên cứu đối thủ", "#/research", '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/><path d="M8.5 11.5l1.8-2 1.6 1.8 1.8-2.3"/>'],
  ["footage", "Kho footage", "#/footage", '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>'],
  ["workflow", "Workflow", "#/workflow", '<rect x="3" y="4" width="6" height="5" rx="1.5"/><rect x="15" y="15" width="6" height="5" rx="1.5"/><path d="M9 6.5h4a2 2 0 0 1 2 2v6.5"/>'],
  ["fx", "FX · nhạc", "#/fx", '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'],
  ["ai", "AI · hệ thống", "#/ai", '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'],
];
const ico = (p) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

export async function render(view) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;min-height:100vh";
  view.replaceChildren(el);
  const [badges, social] = await Promise.all([fetch("/api/badges").then((r) => r.json()).catch(() => ({})), api.social().catch(() => null)]);
  const acc = social?.accounts || {};
  const fbN = (social?.channels || []).filter((c) => c.platform === "facebook").length;
  const igN = (social?.channels || []).filter((c) => c.platform === "instagram").length;
  const conn = [
    ["FB", "Facebook", acc.facebook?.connected ? `Đã kết nối${fbN ? ` · ${fbN} page` : ""}` : "Chưa kết nối", !!acc.facebook?.connected],
    ["IG", "Instagram", igN ? `Đã kết nối · ${igN} tài khoản` : acc.instagram?.connected ? "Đã kết nối" : "Qua Facebook", !!(igN || acc.instagram?.connected)],
    ["TT", "TikTok", acc.tiktok?.connected ? "Đã kết nối" : "Chưa kết nối", !!acc.tiktok?.connected],
  ];
  const paint = () => {
    el.innerHTML = `<header class="ph-bar"><h1>Thêm</h1></header><div class="page more">
      <div class="tiles">${TILES.map(([k, l, h, p]) => `<a class="tile" href="${h}"><span class="ti">${ico(p)}</span>${l}${k === "review" && badges.g2 ? `<span class="tnb">${badges.g2}</span>` : ""}</a>`).join("")}</div>
      <section class="box"><div class="mrow head"><b>Kết nối kênh</b><a class="btn sm" href="#/social/connect">Quản lý</a></div>
        ${conn.map(([c, n, s, ok]) => `<div class="mrow"><span class="pfb ${c.toLowerCase()}">${c}</span><span class="grow"><b>${n}</b><span class="small" style="color:var(${ok ? "--ok" : "--muted"})">${esc(s)}</span></span></div>`).join("")}</section>
      <section class="box"><div class="mrow"><b class="grow">Giao diện</b><div class="seg">
        <button type="button" data-th="dark" aria-pressed="${theme() === "dark"}">Tối</button><button type="button" data-th="light" aria-pressed="${theme() === "light"}">Sáng</button></div></div>
        <div class="mrow"><b class="grow">Ngôn ngữ hệ thống</b><select class="in" data-lang-pick data-noi18n style="width:auto" aria-label="Ngôn ngữ hệ thống">${LANGS.map(([k, l]) => `<option value="${k}" ${lang() === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></section>
      <p class="small muted" style="text-align:center;margin:0">Workflow và FX dùng tốt nhất trên máy tính; trên điện thoại vẫn mở được để xem.</p></div>`;
  };
  paint();
  el.addEventListener("change", (e) => { if (e.target.matches("[data-lang-pick]")) setLang(e.target.value); });
  el.addEventListener("click", (e) => {
    const t = e.target.closest("[data-th]");
    if (t) { setTheme(t.dataset.th); paint(); }
  });
}
