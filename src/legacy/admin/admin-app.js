// Admin shell: hash router (#/content, #/footage, #/jobs, #/review[/job], #/fx, #/ai), shared bootstrap, rail badges.
import { api, esc, toast } from "./admin-api.js";
import { mountRail, refreshRailBadges, setActive } from "../shell.js";

const SCREENS = {
  content: () => import("./screen-content.js"),
  footage: () => import("./screen-footage.js"),
  jobs: () => import("./screen-jobs.js"),
  review: () => import("./screen-review.js"),
  exports: () => import("./screen-exports.js"),
  social: () => import("./screen-social.js"),
  workflow: () => import("./screen-workflow.js"),
  fx: () => import("./screen-fx.js"),
  ai: () => import("./screen-ai.js"),
  more: () => import("./screen-more.js"),
  inventory: () => import("./screen-inventory.js"),
  research: () => import("./screen-research.js"),
};
const ALIAS = { g2: "review" };                      // old links (#/g2/<job>) open the merged review screen

export const ctx = { boot: null, cleanup: null };
const view = document.getElementById("view");

export async function refreshBadges() {
  return refreshRailBadges();
}

let seq = 0, curKey = null;
const alive = new Map();          // screen key -> {stage, params, cleanup, update, show, scroll}
const bar = document.createElement("div");
bar.className = "route-bar";
document.body.append(bar);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Screens stay alive once opened: switching tabs only hides one and shows the other (instant, scroll kept), and the
// screen refreshes its data quietly in the background (ctx.setShow). A screen opened the first time renders off-screen
// and replaces the current one only when its first paint is ready (thin bar on top while it loads). A screen that can
// change its sub-tab in place registers ctx.setUpdate(fn).
function showStage(key) {
  const prev = curKey && alive.get(curKey);
  if (prev && curKey !== key) {
    prev.scroll = window.scrollY;
    prev.stage.querySelectorAll("video, audio").forEach((m) => m.pause());   // a hidden tab never keeps playing
    prev.stage.style.display = "none";
  }
  const e = alive.get(key);
  if (!e.stage.isConnected) view.append(e.stage);
  e.stage.style.display = "contents";
  curKey = key;
  window.scrollTo(0, e.scroll || 0);
  view.focus({ preventScroll: true });
  return e;
}

async function route() {
  let [name = "content", ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  name = ALIAS[name] || name;
  const key = SCREENS[name] ? name : "content";
  const params = rest.map(decodeURIComponent);
  setActive(key);
  const cached = alive.get(key);
  if (cached) {
    let ok = same(cached.params, params);
    if (!ok && cached.update) {
      try { ok = !!(await cached.update(params)); } catch (err) { toast(err.message, true); return; }
      if (ok) cached.params = params;
    }
    if (ok) {
      ++seq; bar.classList.remove("on");
      const wasHidden = curKey !== key;
      showStage(key);
      if (wasHidden && cached.show) Promise.resolve().then(cached.show).catch(() => {});
      return;
    }
  }
  const my = ++seq;
  const slow = setTimeout(() => bar.classList.add("on"), 120);
  const stage = document.createElement("div");
  stage.style.display = "none";
  const entry = { stage, params, cleanup: null, update: null, show: null, scroll: 0 };
  let swapped = false;
  const swap = () => {
    if (my !== seq || swapped) return;
    swapped = true;
    const old = alive.get(key);
    if (old && old !== entry) { old.cleanup?.(); old.stage.remove(); }
    alive.set(key, entry);
    view.append(stage);
    entry.scroll = 0;
    showStage(key);
  };
  const late = setTimeout(swap, 2500);              // a very slow screen still shows its own loading state
  try {
    const mod = await SCREENS[key]();
    await mod.render(stage, { ...ctx, params, refreshBadges,
      setCleanup: (fn) => { entry.cleanup = fn; },
      setUpdate: (fn) => { entry.update = fn; },
      setShow: (fn) => { entry.show = fn; } });
  } catch (err) {
    stage.innerHTML = `<div class="page"><div class="box pad"><h2>Không tải được màn hình</h2><p class="muted">${esc(err.message)}</p></div></div>`;
  }
  clearTimeout(slow); clearTimeout(late);
  if (my === seq) { swap(); bar.classList.remove("on"); }
  else if (!swapped) entry.cleanup?.();                // user already moved on before it showed: drop it
}

// load every screen's code while idle so the first visit of a tab does not wait for it
function prefetch() {
  const go = () => Object.values(SCREENS).forEach((f) => f().catch(() => {}));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500);
}

async function init() {
  mountRail("content");
  ctx.boot = await api.bootstrap(true);          // no clip library: Kho footage loads it when opened
  window.addEventListener("hashchange", route);
  await route();
  refreshBadges();
  checkServer();
  prefetch();
}

// An update copied in while the server kept running: the screens are new but the server still runs the old code.
async function checkServer() {
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    const v = r.status === 404 ? { stale: true } : await r.json();      // 404 = server older than this check itself
    if (!v.stale || document.getElementById("stale-bar")) return;
    const bar = document.createElement("div");
    bar.id = "stale-bar";
    bar.className = "stale-bar";
    bar.innerHTML = "<b>Máy chủ đang chạy bản cũ.</b> Đã có bản cập nhật nhưng máy chủ chưa khởi động lại: đóng cửa sổ đen \"VCB Video Agent\" rồi chạy lại <b>CHAY-VIDEO-AGENT.bat</b>.";
    document.body.prepend(bar);
  } catch { /* offline: try again later */ }
}
setInterval(checkServer, 5 * 60 * 1000);

init().catch((err) => toast(`Lỗi khởi động: ${err.message}`, true));
