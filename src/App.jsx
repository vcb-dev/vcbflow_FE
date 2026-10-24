import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Rail from "./components/Rail";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import AdminHost from "./pages/AdminHost";
import LoginPage from "./pages/LoginPage";
import StudioPage from "./pages/StudioPage";
import { initI18n } from "./legacy/i18n.js";
import { refreshRailBadges } from "./legacy/shell.js";

function Shell() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const studio = pathname === "/" || pathname === "/studio" || pathname.startsWith("/studio/");
  const [seenStudio, setSeenStudio] = useState(studio);
  const [seenAdmin, setSeenAdmin] = useState(!studio);

  useEffect(() => {
    if (studio) setSeenStudio(true);
    else setSeenAdmin(true);
  }, [studio]);

  useEffect(() => {
    initI18n();
    refreshRailBadges();
    const timer = setInterval(refreshRailBadges, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={studio ? "studio-app" : "app"}>
      <Rail user={auth.user} onLogout={async () => {
        await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
        auth.clear();
      }} />
      {seenStudio ? <StudioPage hidden={!studio} /> : null}
      {seenAdmin ? (
        <div hidden={studio} style={studio ? undefined : { display: "contents" }}>
          <AdminHost />
        </div>
      ) : null}
      <div id="toast" className="toast hidden" role="status" aria-live="polite" />
    </div>
  );
}

function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === "loading") return <div className="auth-splash">Đang kiểm tra phiên…</div>;
  if (auth.status !== "ready") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="*" element={<RequireAuth />} />
      </Routes>
    </AuthProvider>
  );
}
