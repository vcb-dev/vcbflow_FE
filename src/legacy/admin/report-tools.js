// "Xuất Excel" and "Báo cáo PDF" for Đăng & hiệu quả / Quảng cáo.
// Excel: the rows the page shows (all pages of the current filters) → /api/export/xlsx → .xlsx download.
// PDF: a printable A4 report (KPIs, charts drawn as SVG, short findings) opened in the browser's print dialog,
// where "Lưu dưới dạng PDF" / "Save as PDF" makes the file — no extra software on the server.
import { esc, toast } from "./admin-api.js";

export async function downloadXlsx(filename, sheets) {
  const r = await fetch("/api/export/xlsx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename, sheets }) });
  if (!r.ok) throw new Error(`Xuất Excel lỗi ${r.status}`);
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Đã xuất ${filename}`);
}

const N = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 0 }));
export const K = (n) => (n == null ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2).replace(".", ",")} tỷ` : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(".", ",")}K` : String(Math.round(n)));
const PAL = ["#8C6A1C", "#3F6E9B", "#B4642B", "#2E7D4F", "#6B4FA0", "#23807D", "#9A4F1C", "#5E5C57"];

/** Horizontal bars: items = [[label, value, sub?]]. */
export function hbars(items, { fmt = K, color = PAL[0], width = 900 } = {}) {
  const rows = items.filter((x) => x[1] > 0).slice(0, 12);
  if (!rows.length) return '<p class="muted">Chưa có số liệu.</p>';
  const max = Math.max(...rows.map((x) => x[1]));
  const lw = width > 600 ? 280 : 150, bw = width - lw - 110, h = 22, cut = width > 600 ? 44 : 22;
  return `<svg viewBox="0 0 ${width} ${rows.length * h + 4}" width="${width}" style="max-width:100%;height:auto" role="img" aria-label="Biểu đồ">${rows.map(([l, v, sub], i) => {
    const w = Math.max(2, (v / max) * bw);
    return `<text x="${lw - 8}" y="${i * h + 15}" text-anchor="end" font-size="11" fill="#33322F">${esc(String(l).length > cut ? String(l).slice(0, cut - 1) + "…" : String(l))}</text>
      <rect x="${lw}" y="${i * h + 4}" width="${w}" height="${h - 8}" rx="3" fill="${color}"/>
      <text x="${lw + w + 6}" y="${i * h + 15}" font-size="11" fill="#17171A" font-weight="600">${esc(fmt(v))}${sub ? ` <tspan fill="#8A877F" font-weight="400">${esc(sub)}</tspan>` : ""}</text>`;
  }).join("")}</svg>`;
}

/** Columns per day with a line for the second series: days = [[label, a, b]]. */
export function daily(days, { aLabel = "Views", bLabel = "Video đăng" } = {}) {
  if (!days.length) return '<p class="muted">Chưa có số liệu.</p>';
  const W = 1000, H = 220, pad = 34, cw = (W - pad * 2) / days.length;
  const ma = Math.max(...days.map((d) => d[1]), 1), mb = Math.max(...days.map((d) => d[2]), 1);
  const y = (v, m) => H - 26 - (v / m) * (H - 50);
  const step = Math.ceil(days.length / 15);
  const line = days.map((d, i) => `${pad + i * cw + cw / 2},${y(d[2], mb)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(aLabel)} theo ngày">
    <line x1="${pad}" y1="${H - 26}" x2="${W - pad}" y2="${H - 26}" stroke="#D3CFC6"/>
    ${days.map((d, i) => `<rect x="${pad + i * cw + cw * 0.15}" y="${y(d[1], ma)}" width="${cw * 0.7}" height="${H - 26 - y(d[1], ma)}" fill="#D9C79A"/>
      ${i % step === 0 ? `<text x="${pad + i * cw + cw / 2}" y="${H - 10}" font-size="10" text-anchor="middle" fill="#5E5C57">${esc(d[0])}</text>` : ""}`).join("")}
    <polyline points="${line}" fill="none" stroke="#3F6E9B" stroke-width="2"/>
    ${days.map((d, i) => `<circle cx="${pad + i * cw + cw / 2}" cy="${y(d[2], mb)}" r="2.5" fill="#3F6E9B"/>`).join("")}
    <text x="${pad}" y="14" font-size="11" fill="#8C6A1C" font-weight="600">■ ${esc(aLabel)} (cao nhất ${K(ma)})</text>
    <text x="${pad + 260}" y="14" font-size="11" fill="#3F6E9B" font-weight="600">● ${esc(bLabel)} (cao nhất ${N(mb)})</text></svg>`;
}

/** Share bars (one stacked bar + legend): parts = [[label, value]]. */
export function shares(parts) {
  const p = parts.filter((x) => x[1] > 0);
  const tot = p.reduce((s, x) => s + x[1], 0);
  if (!tot) return '<p class="muted">Chưa có số liệu.</p>';
  let x = 0;
  return `<svg viewBox="0 0 520 26" width="100%" height="26" preserveAspectRatio="none" role="img" aria-label="Tỉ trọng">${p.map(([l, v], i) => { const w = (v / tot) * 520; const r = `<rect x="${x}" y="0" width="${w}" height="26" fill="${PAL[i % PAL.length]}"/>`; x += w; return r; }).join("")}</svg>
    <div class="legend">${p.map(([l, v], i) => `<span><i style="background:${PAL[i % PAL.length]}"></i>${esc(l)} <b>${Math.round((v / tot) * 100)}%</b> <span class="muted">${K(v)}</span></span>`).join("")}</div>`;
}

const CSS = `@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; } body { font: 12px/1.45 "Be Vietnam Pro", "Segoe UI", Arial, sans-serif; color: #17171A; margin: 0; }
h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #8C6A1C; break-after: avoid; }
.muted { color: #6E6C67; } .sub { color: #5E5C57; margin-bottom: 10px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; } .kpi { border: 1px solid #E2DFD8; border-radius: 8px; padding: 8px 10px; }
.kpi small { display: block; color: #5E5C57; font-size: 10.5px; } .kpi b { font-size: 17px; } .kpi span { display: block; font-size: 10.5px; color: #6E6C67; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } .card { break-inside: avoid; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; font-size: 11px; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
table { width: 100%; border-collapse: collapse; font-size: 11px; } th { text-align: left; background: #F3EAD6; padding: 5px 6px; } td { padding: 4px 6px; border-bottom: 1px solid #EFECE6; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; } tr { break-inside: avoid; }
ul.find { margin: 0; padding-left: 18px; } ul.find li { margin: 3px 0; }
.foot { margin-top: 18px; color: #8A877F; font-size: 10px; }`;

/** Open the report in a hidden frame and show the print dialog (choose "Save as PDF"). */
export function printReport(title, body) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(f);
  const doc = f.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`);
  doc.close();
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (err) { toast(err.message, true); }
    setTimeout(() => f.remove(), 60000);
  }, 400);
}

export const fmtN = N;
