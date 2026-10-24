import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

function nextPath(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = nextPath(params.get("next"));

  if (auth.status === "loading") return <div className="auth-splash">Đang kiểm tra phiên…</div>;
  if (auth.status === "ready") return <Navigate to={next} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.detail || "Đăng nhập thất bại");
      auth.setUser(data.user);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <img src="/web/logo-mark.png" alt="" width="22" height="22" />
          VCB Video Agent
        </div>
        <p className="auth-sub">Đăng nhập để vào studio</p>
        {auth.status === "error" ? <div className="auth-error">Không kết nối được máy chủ.</div> : null}
        {error ? <div className="auth-error">{error}</div> : null}
        <label className="auth-field">
          <span>Email</span>
          <input type="email" name="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>Mật khẩu</span>
          <input type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </form>
    </div>
  );
}
