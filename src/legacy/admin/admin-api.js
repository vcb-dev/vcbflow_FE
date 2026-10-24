// API + small UI helpers shared by the admin screens. Reuses the Studio's fetch wrapper and formatters.
import { api as studioApi } from "../api-client.js";
import { esc, fmtTime, media, money } from "../format-helpers.js";

export { esc, fmtTime, media, money };

async function call(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  if (res.status === 401 && !location.hash.startsWith("#/login")) {
    const next = encodeURIComponent(location.hash.replace(/^#/, "") || "/studio");
    location.hash = `#/login?next=${next}`;
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* non-JSON body */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

export const api = {
  webMedia: () => call("/api/web-media/status"),
  webMediaSave: (patch) => call("/api/web-media/settings", { method: "PUT", body: JSON.stringify(patch) }),
  ...studioApi,
  jobs: () => call("/api/jobs"),
  badges: () => call("/api/badges"),
  system: () => call("/api/system"),
  restart: () => call("/api/system/restart", { method: "POST" }),
  review: (id, body) => call(`/api/jobs/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify(body) }),
  coverage: () => call("/api/coverage"),
  footageUsage: () => call("/api/footage/usage"),
  tagQueue: () => call("/api/review/tags"),
  sourceStatus: () => call("/api/source/status"),
  sourceScan: (only = "", folder = "") => call(`/api/source/scan?only=${encodeURIComponent(only)}&folder=${encodeURIComponent(folder)}`, { method: "POST" }),
  sourceScanCancel: () => call("/api/source/scan/cancel", { method: "POST" }),
  deleteJob: (id) => call(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  bulkJobs: (body) => call("/api/jobs/bulk", { method: "POST", body: JSON.stringify(body) }),
  content: () => call("/api/content"),
  contentCreate: (body) => call("/api/content", { method: "POST", body: JSON.stringify(body) }),
  contentUpdate: (id, body) => call(`/api/content/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  contentDelete: (id) => call(`/api/content/${encodeURIComponent(id)}`, { method: "DELETE" }),
  stories: () => call("/api/content/stories"),
  storySave: (id, body) => call(id ? `/api/content/stories/${encodeURIComponent(id)}` : "/api/content/stories", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }),
  storyDelete: (id) => call(`/api/content/stories/${encodeURIComponent(id)}`, { method: "DELETE" }),
  storyTypeAdd: (label) => call("/api/content/story-types", { method: "POST", body: JSON.stringify({ label }) }),
  storyTypeDelete: (id) => call(`/api/content/story-types/${encodeURIComponent(id)}`, { method: "DELETE" }),
  contentGenerate: (body) => call("/api/content/generate", { method: "POST", body: JSON.stringify(body) }),
  contentVoice: (id, lang, voice = "") => call(`/api/content/${encodeURIComponent(id)}/voice`, { method: "POST", body: JSON.stringify({ lang, voice }) }),
  voiceStatus: () => call("/api/voice/status"),
  exports: () => call("/api/exports"),
  social: () => call("/api/social"),
  socialSettings: (patch) => call("/api/social/settings", { method: "PUT", body: JSON.stringify(patch) }),
  socialSchedule: (body) => call("/api/social/schedule", { method: "POST", body: JSON.stringify(body) }),
  socialPost: (id, patch) => call(`/api/social/posts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) }),
  socialPublish: (id) => call(`/api/social/posts/${encodeURIComponent(id)}/publish`, { method: "POST" }),
  socialPull: () => call("/api/social/pull", { method: "POST" }),
  socialInsights: () => call("/api/social/insights"),
  socialLearn: () => call("/api/social/learn", { method: "POST" }),
  socialLesson: (id, patch) => call(`/api/social/lessons/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) }),
  socialPage: (page_id) => call("/api/social/meta/page", { method: "POST", body: JSON.stringify({ page_id }) }),
  socialLibrary: () => call("/api/social/library"),
  research: () => call("/api/research"),
  researchPulse: () => call("/api/research/pulse"),
  researchAdd: (body) => call("/api/research/channels", { method: "POST", body: JSON.stringify(body) }),
  researchChannel: (id, body) => call(`/api/research/channels/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  researchRemove: (id) => call(`/api/research/channels/${id}`, { method: "DELETE" }),
  researchCrawl: (id) => call(`/api/research/channels/${id}/crawl`, { method: "POST" }),
  researchCrawlAll: () => call("/api/research/crawl-all", { method: "POST" }),
  researchSettings: (body) => call("/api/research/settings", { method: "PUT", body: JSON.stringify(body) }),
  researchVideo: (key) => call(`/api/research/videos/${encodeURIComponent(key)}`),
  researchScript: (key) => call(`/api/research/videos/${encodeURIComponent(key)}/script`, { method: "POST" }),
  researchRemix: (key, body) => call(`/api/research/videos/${encodeURIComponent(key)}/remix`, { method: "POST", body: JSON.stringify(body) }),
  researchFrames: (key) => call(`/api/research/videos/${encodeURIComponent(key)}/frames`, { method: "POST" }),
  researchDesign: (key, body) => call(`/api/research/videos/${encodeURIComponent(key)}/design`, { method: "POST", body: JSON.stringify(body) }),
  researchDesignVideo: (key, did, body) => call(`/api/research/videos/${encodeURIComponent(key)}/design/${did}/video`, { method: "POST", body: JSON.stringify(body) }),
  klingStatus: () => call("/api/kling/status"),
  researchDesignMetal: (key, did, metal) => call(`/api/research/videos/${encodeURIComponent(key)}/design/${did}`, { method: "PUT", body: JSON.stringify({ metal }) }),
  researchSave: (key, i) => call(`/api/research/videos/${encodeURIComponent(key)}/remix/${i}/save`, { method: "POST" }),
  ads: (by = "ad", q = {}) => call(`/api/ads?${new URLSearchParams({ by, ...q })}`),
  adsRefresh: () => call("/api/ads/refresh", { method: "POST" }),
  adsSettings: (body) => call("/api/ads/settings", { method: "PUT", body: JSON.stringify(body) }),
  socialBreakdown: (by, q = {}) => call(`/api/social/breakdown?${new URLSearchParams({ by, ...q })}`),
  inventory: () => call("/api/inventory"),
  inventoryRefresh: () => call("/api/inventory/refresh", { method: "POST" }),
  inventorySettings: (body) => call("/api/inventory/settings", { method: "PUT", body: JSON.stringify(body) }),
  inventoryPlan: (body) => call("/api/inventory/plan", { method: "POST", body: JSON.stringify(body) }),
  inventoryVideos: (sku) => call(`/api/inventory/videos/${encodeURIComponent(sku)}`),
  planRules: () => call("/api/plan-rules"),
  planRuleSave: (body) => call("/api/plan-rules", { method: "PUT", body: JSON.stringify(body) }),
  planRulePreview: (body) => call("/api/plan-rules/preview", { method: "POST", body: JSON.stringify(body) }),
  planRuleDelete: (id) => call(`/api/plan-rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
  planRuleRun: (id) => call(`/api/plan-rules/${encodeURIComponent(id)}/run`, { method: "POST" }),
  planRuleAddSkus: (id, skus) => call(`/api/plan-rules/${encodeURIComponent(id)}/skus`, { method: "POST", body: JSON.stringify({ skus }) }),
  socialLibrarySync: (days, pages = []) => call("/api/social/library/sync", { method: "POST", body: JSON.stringify({ days, pages }) }),
  socialItem: (key) => call(`/api/social/library/item/${encodeURIComponent(key)}`),
  socialAnalyze: (key) => call(`/api/social/library/item/${encodeURIComponent(key)}/analyze`, { method: "POST" }),
  socialTip: (key, i) => call(`/api/social/library/item/${encodeURIComponent(key)}/tips/${i}`, { method: "POST" }),
  workflows: () => call("/api/workflows"),
  workflowSave: (id, data) => call(id ? `/api/workflows/${encodeURIComponent(id)}` : "/api/workflows", { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
  workflowDelete: (id) => call(`/api/workflows/${encodeURIComponent(id)}`, { method: "DELETE" }),
  workflowRun: (id) => call(`/api/workflows/${encodeURIComponent(id)}/run`, { method: "POST" }),
  socialAutofill: () => call("/api/social/autofill", { method: "POST" }),
  socialRefreshPages: () => call("/api/social/meta/refresh", { method: "POST" }),
  socialSysToken: (token) => call("/api/social/meta/token", { method: "POST", body: JSON.stringify({ token }) }),
  socialTeams: (teams) => call("/api/social/teams", { method: "PUT", body: JSON.stringify({ teams }) }),
  socialPlan: (cid, patch) => call(`/api/social/plans/${encodeURIComponent(cid)}`, { method: "PUT", body: JSON.stringify(patch) }),
  socialHours: (cid) => call(`/api/social/plans/${encodeURIComponent(cid)}/hours`),
  socialPageMarket: (id, body) => call(`/api/social/pages/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  socialDisconnect: (p) => call(`/api/social/${p}`, { method: "DELETE" }),
  exportsDelete: (names) => call("/api/exports/delete", { method: "POST", body: JSON.stringify({ names }) }),
  telegramSend: (names) => call("/api/telegram/send", { method: "POST", body: JSON.stringify({ names }) }),
  telegramStatus: () => call("/api/telegram/status"),
  telegramDetect: () => call("/api/telegram/detect", { method: "POST" }),
  exportJob: (id) => call(`/api/jobs/${encodeURIComponent(id)}/export`, { method: "POST" }),
  exportSettings: () => call("/api/settings/export"),
  exportSettingsSave: (body) => call("/api/settings/export", { method: "PUT", body: JSON.stringify(body) }),
  voiceSettingsSave: (body) => call("/api/settings/voice", { method: "PUT", body: JSON.stringify(body) }),
  voiceTest: (body) => call("/api/voice/test", { method: "POST", body: JSON.stringify(body) }),
  aiSettings: () => call("/api/settings/ai"),
  aiUsage: (q = "") => call("/api/ai/usage" + (q ? "?" + q : "")),
  aiUsageSave: (body) => call("/api/ai/usage", { method: "PUT", body: JSON.stringify(body) }),
  aiKeys: (keys) => call("/api/settings/ai/keys", { method: "PUT", body: JSON.stringify({ keys }) }),
  aiModelsSave: (models) => call("/api/settings/ai/models", { method: "PUT", body: JSON.stringify({ models }) }),
  aiPrompt: (text) => call("/api/settings/ai/prompt", { method: "PUT", body: JSON.stringify({ text }) }),
  aiTest: (task, backup = false) => call("/api/settings/ai/test", { method: "POST", body: JSON.stringify({ task, backup }) }),
  contentVoiceUpload: (id, body) => call(`/api/content/${encodeURIComponent(id)}/voice-upload`, { method: "POST", body: JSON.stringify(body) }),
  topicAdd: (name) => call("/api/content/topics", { method: "POST", body: JSON.stringify({ name }) }),
  topicDelete: (name) => call(`/api/content/topics/${encodeURIComponent(name)}`, { method: "DELETE" }),
  templates: () => call("/api/templates"),
  templateSave: (id, body) => call(`/api/templates/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  templateDelete: (id) => call(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
  templateReset: () => call("/api/templates/reset", { method: "POST" }),
  automation: () => call("/api/automation"),
  scheduleSave: (body, id) => call(id ? `/api/automation/schedules/${encodeURIComponent(id)}` : "/api/automation/schedules", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }),
  scheduleDelete: (id) => call(`/api/automation/schedules/${encodeURIComponent(id)}`, { method: "DELETE" }),
  scheduleRun: (id) => call(`/api/automation/schedules/${encodeURIComponent(id)}/run`, { method: "POST" }),
  automationRun: (body) => call("/api/automation/run", { method: "POST", body: JSON.stringify(body) }),
  tagDecision: (clipId, body) => call(`/api/review/tags/${encodeURIComponent(clipId)}`, { method: "POST", body: JSON.stringify(body) }),
};

export const STATE = {
  draft: ["Nháp · chờ duyệt render", "chip warn"],
  created: ["Mới tạo", "chip"], rendering: ["Đang render", "chip run"], render_error: ["Lỗi render", "chip bad"],
  missing_asset: ["Thiếu cảnh", "chip bad"], waiting_g2: ["Chờ G2", "chip warn"], passed: ["PASS", "chip ok"],
  rejected: ["LOẠI", "chip bad"], capcut: ["Đã chuyển CapCut", "chip ai"],
};
export const stateChip = (s) => `<span class="${(STATE[s] || ["", "chip"])[1]}">${esc((STATE[s] || [s])[0])}</span>`;
export const RIGHTS = { owned: ["VCB", "chip ok"], collected: ["Sưu tầm", "chip warn"], licensed: ["Có phép", "chip ok"] };

let toastTimer;
export function toast(msg, isErr = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast${isErr ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), isErr ? 6000 : 3000);
}

/** Thumbnail <img> that falls back to a neutral tile when the media file is missing (fresh clone, no proxies). */
export const thumbImg = (path, alt = "", cls = "") =>
  `<img class="${cls}" src="${esc(media(path))}" alt="${esc(alt)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}',style:'display:block;width:100%;height:100%;background:var(--thumb)'}))">`;

export const usd = (v) => money(v);
