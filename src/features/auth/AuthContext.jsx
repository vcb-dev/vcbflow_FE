import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null });

  const refresh = async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
      if (res.status === 401) {
        setState({ status: "anonymous", user: null });
        return null;
      }
      if (!res.ok) throw new Error("Máy chủ chưa phản hồi");
      const user = await res.json();
      setState({ status: "ready", user });
      return user;
    } catch {
      setState({ status: "error", user: null });
      return null;
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(() => ({
    ...state,
    refresh,
    setUser(user) {
      setState({ status: "ready", user });
    },
    clear() {
      setState({ status: "anonymous", user: null });
    },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
