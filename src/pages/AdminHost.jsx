import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api, esc, toast } from "../legacy/admin/admin-api.js";
import { refreshRailBadges } from "../legacy/shell.js";

const SCREENS = {
  content: () => import("../legacy/admin/screen-content.js"),
  footage: () => import("../legacy/admin/screen-footage.js"),
  jobs: () => import("../legacy/admin/screen-jobs.js"),
  review: () => import("../legacy/admin/screen-review.js"),
  exports: () => import("../legacy/admin/screen-exports.js"),
  social: () => import("../legacy/admin/screen-social.js"),
  workflow: () => import("../legacy/admin/screen-workflow.js"),
  fx: () => import("../legacy/admin/screen-fx.js"),
  ai: () => import("../legacy/admin/screen-ai.js"),
  more: () => import("../legacy/admin/screen-more.js"),
  inventory: () => import("../legacy/admin/screen-inventory.js"),
  research: () => import("../legacy/admin/screen-research.js"),
};
const ALIAS = { g2: "review" };
const same = (a, b) => a.length === b.length && a.every((item, index) => item === b[index]);

const boot = { current: null };

async function openScreen(view, bar, state, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const name = ALIAS[parts[0]] || parts[0] || "content";
  const key = SCREENS[name] ? name : "content";
  const params = parts.slice(1).map(decodeURIComponent);
  const cached = state.alive.get(key);
  if (cached) {
    let ok = same(cached.params, params);
    if (!ok && cached.update) {
      try { ok = !!(await cached.update(params)); } catch (err) { toast(err.message, true); return; }
      if (ok) cached.params = params;
    }
    if (ok) {
      state.seq += 1;
      bar.classList.remove("on");
      const wasHidden = state.curKey !== key;
      showStage(view, state, key);
      if (wasHidden && cached.show) Promise.resolve().then(cached.show).catch(() => {});
      return;
    }
  }
  const my = ++state.seq;
  const slow = setTimeout(() => bar.classList.add("on"), 120);
  const stage = document.createElement("div");
  stage.style.display = "none";
  const entry = { stage, params, cleanup: null, update: null, show: null, scroll: 0 };
  let swapped = false;
  const swap = () => {
    if (my !== state.seq || swapped) return;
    swapped = true;
    const old = state.alive.get(key);
    if (old && old !== entry) { old.cleanup?.(); old.stage.remove(); }
    state.alive.set(key, entry);
    view.append(stage);
    entry.scroll = 0;
    showStage(view, state, key);
  };
  const late = setTimeout(swap, 2500);
  try {
    if (!boot.current) boot.current = await api.bootstrap(true);
    const mod = await SCREENS[key]();
    await mod.render(stage, {
      boot: boot.current,
      params,
      refreshBadges: refreshRailBadges,
      setCleanup: (fn) => { entry.cleanup = fn; },
      setUpdate: (fn) => { entry.update = fn; },
      setShow: (fn) => { entry.show = fn; },
    });
  } catch (err) {
    stage.innerHTML = `<div class="page"><div class="box pad"><h2>Không tải được màn hình</h2><p class="muted">${esc(err.message)}</p></div></div>`;
  }
  clearTimeout(slow);
  clearTimeout(late);
  if (my === state.seq) { swap(); bar.classList.remove("on"); }
  else if (!swapped) entry.cleanup?.();
}

function showStage(view, state, key) {
  const prev = state.curKey && state.alive.get(state.curKey);
  if (prev && state.curKey !== key) {
    prev.scroll = window.scrollY;
    prev.stage.querySelectorAll("video, audio").forEach((media) => media.pause());
    prev.stage.style.display = "none";
  }
  const entry = state.alive.get(key);
  if (!entry.stage.isConnected) view.append(entry.stage);
  entry.stage.style.display = "contents";
  state.curKey = key;
  window.scrollTo(0, entry.scroll || 0);
  view.focus({ preventScroll: true });
}

export default function AdminHost() {
  const { pathname } = useLocation();
  const viewRef = useRef(null);
  const barRef = useRef(null);
  const state = useRef({ seq: 0, curKey: null, alive: new Map() });

  useEffect(() => {
    const go = () => Object.values(SCREENS).forEach((load) => load().catch(() => {}));
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 1500);
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const bar = barRef.current;
    if (!view || !bar) return undefined;
    const name = pathname.split("/").filter(Boolean)[0] || "";
    if (!name || name === "studio") return undefined;
    let cancel = false;
    openScreen(view, bar, state.current, pathname).catch((err) => {
      if (!cancel) toast(`Lỗi khởi động: ${err.message}`, true);
    });
    return () => { cancel = true; };
  }, [pathname]);

  return (
    <>
      <div ref={barRef} className="route-bar" />
      <main className="main" id="view" tabIndex={-1} ref={viewRef} />
    </>
  );
}
