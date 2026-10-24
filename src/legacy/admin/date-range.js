// Shared date-range filter for every list / report: presets + "Tuỳ chọn" (from – to). Same presets as server/date_range.py.
// State: { p: preset, from: "yyyy-mm-dd", to: "yyyy-mm-dd" }. Remembered per filter id in localStorage.
import { esc } from "./admin-api.js";

export const PRESETS = [["today", "Hôm nay"], ["yesterday", "Hôm qua"], ["7d", "7 ngày qua"], ["week", "Tuần này"], ["last_week", "Tuần trước"],
  ["month", "Tháng này"], ["last_month", "Tháng trước"], ["30d", "30 ngày qua"], ["60d", "60 ngày qua"], ["90d", "90 ngày qua"],
  ["year", "Năm nay"], ["all", "Toàn bộ"], ["custom", "Tuỳ chọn ngày…"]];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}${s.slice(0, 4) !== String(new Date().getFullYear()) ? "/" + s.slice(2, 4) : ""}` : "");

/** [from, to] ISO dates (both included, "" = open) of a range state. */
export function resolve(r) {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const p = (r && r.p) || "30d";
  if (p === "custom") { let a = r.from || "", b = r.to || ""; if (a && b && a > b) [a, b] = [b, a]; return [a, b]; }
  if (p === "all") return ["", ""];
  if (p === "today") return [iso(t), iso(t)];
  if (p === "yesterday") return [iso(add(t, -1)), iso(add(t, -1))];
  const wd = (t.getDay() + 6) % 7;                       // Monday = 0
  if (p === "week") return [iso(add(t, -wd)), iso(t)];
  if (p === "last_week") return [iso(add(t, -wd - 7)), iso(add(t, -wd - 1))];
  if (p === "month") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
  if (p === "last_month") return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
  if (p === "year") return [iso(new Date(t.getFullYear(), 0, 1)), iso(t)];
  const n = parseInt(p, 10) || 30;
  return [iso(add(t, -(n - 1))), iso(t)];
}
export const inRange = (day, [a, b]) => { const d = String(day || "").slice(0, 10); return d ? (!a || d >= a) && (!b || d <= b) : !a && !b; };
export const label = (r) => { const [a, b] = resolve(r); return !a && !b ? "Toàn bộ thời gian" : a === b ? dmy(a) : `${dmy(a) || "…"} – ${dmy(b) || "nay"}`; };
export const query = (r) => { const [a, b] = resolve(r); return `date_from=${a}&date_to=${b}`; };

export function load(id, def = "30d") {
  try { const x = JSON.parse(localStorage.getItem("dr:" + id) || "null"); if (x && x.p) return x; } catch { /* private mode */ }
  return { p: def, from: "", to: "" };
}
function save(id, r) { try { localStorage.setItem("dr:" + id, JSON.stringify(r)); } catch { /* ignore */ } }

/** The filter control. id names the filter (one per list); r = its state. */
export function html(id, r, opts = {}) {
  const only = opts.presets ? PRESETS.filter(([k]) => opts.presets.includes(k)) : PRESETS;
  const [a, b] = resolve(r);
  return `<span class="drange" data-dr="${esc(id)}"><select class="in" data-drp aria-label="Khoảng thời gian">${only.map(([k, l]) => `<option value="${k}" ${r.p === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    ${r.p === "custom" ? `<input class="in" type="date" data-drf value="${esc(r.from || a)}" aria-label="Từ ngày"><span class="muted">–</span><input class="in" type="date" data-drt value="${esc(r.to || b)}" aria-label="Đến ngày">`
      : `<span class="small muted drl">${esc(label(r))}</span>`}</span>`;
}

/** Listen on a screen root: onChange(id, newState) after the user picks a preset or a date. */
export function wire(root, onChange) {
  root.addEventListener("change", (e) => {
    const box = e.target.closest?.("[data-dr]");
    if (!box || !e.target.matches("[data-drp],[data-drf],[data-drt]")) return;
    e.stopPropagation();
    const id = box.dataset.dr;
    const p = box.querySelector("[data-drp]").value;
    const r = { p, from: box.querySelector("[data-drf]")?.value || "", to: box.querySelector("[data-drt]")?.value || "" };
    if (p === "custom" && !r.from && !r.to) { const [a, b] = resolve({ p: "30d" }); r.from = a; r.to = b; }
    save(id, r);
    onChange(id, r);
  }, true);
}
