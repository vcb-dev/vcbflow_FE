import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LANGS, lang } from "../legacy/i18n.js";
import { langMenu } from "../legacy/shell.js";

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
  logout: '<path d="M9 6H5v12h4"/><path d="M9 12h10"/><path d="M15 8l4 4-4 4"/>',
};

const ITEMS = [
  ["studio", "Studio", "/studio"],
  ["content", "Kho content", "/content"],
  ["footage", "Kho footage", "/footage"],
  ["jobs", "Job · tự động", "/jobs"],
  ["review", "Duyệt", "/review"],
  ["exports", "Đã xuất", "/exports"],
  ["inventory", "Kho hàng", "/inventory"],
  ["social", "Đăng & hiệu quả", "/social"],
  ["research", "Nghiên cứu đối thủ", "/research"],
  ["workflow", "Workflow", "/workflow"],
  ["fx", "FX · template · nhạc", "/fx"],
];

const TABS = [
  ["studio", "Studio", "/studio"],
  ["jobs", "Job", "/jobs"],
  ["social", "Đăng", "/social"],
  ["exports", "Đã xuất", "/exports"],
  ["more", "Thêm", "/more"],
];

function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
  );
}

function sectionOf(pathname) {
  const name = pathname.split("/").filter(Boolean)[0] || "studio";
  return name === "g2" ? "review" : name;
}

export default function Rail({ user, onLogout }) {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const tab = TABS.some(([key]) => key === section) ? section : "more";
  const code = (LANGS.find((item) => item[0] === lang()) || LANGS[0])[2];

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("vcb-theme", next); } catch { /* theme still applies */ }
    setTheme(next);
  };

  return (
    <>
      <nav className="rail" id="rail" data-react="1" aria-label="Điều hướng chính">
        <NavLink className="mark" to="/studio" aria-label="VCB Video Agent">
          <img src="/web/logo-mark.png" alt="" width="22" height="22" />
        </NavLink>
        {ITEMS.map(([key, tip, to]) => (
          <NavLink key={key} className={({ isActive }) => `ri${isActive ? " on" : ""}`} to={to} data-key={key} data-tip={tip} aria-label={tip}>
            <Icon name={key} />
            {key === "review" ? <span className="nb" id="nb-review" /> : null}
            {key === "content" ? <span className="nb" id="nb-content" /> : null}
          </NavLink>
        ))}
        <div className="grow" />
        <NavLink className={({ isActive }) => `ri${isActive ? " on" : ""}`} to="/ai" data-key="ai" data-tip="AI · hệ thống" aria-label="AI · hệ thống">
          <Icon name="ai" />
        </NavLink>
        <button className="ri" id="theme-btn" type="button" data-tip="Sáng / tối" aria-label="Đổi giao diện sáng tối" onClick={toggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        <button className="ri lang-btn" id="lang-btn" type="button" data-tip="Ngôn ngữ hệ thống" aria-label="Ngôn ngữ hệ thống" aria-haspopup="menu" data-noi18n onClick={(event) => { event.stopPropagation(); langMenu(event.currentTarget); }}>
          {code}
        </button>
        <button className="ri" type="button" data-tip={user?.email || "Đăng xuất"} aria-label="Đăng xuất" onClick={onLogout}>
          <Icon name="logout" />
        </button>
      </nav>
      <nav className="tabbar" id="tabbar" aria-label="Điều hướng chính">
        {TABS.map(([key, label, to]) => (
          <NavLink key={key} className={() => `tb${tab === key ? " on" : ""}`} to={to} data-tab={key}>
            <span className="tbi"><Icon name={key} /></span>
            {label}
            {key === "more" ? <span className="nb" id="nb-more" /> : null}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
