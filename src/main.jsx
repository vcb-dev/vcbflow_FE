import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles/theme.css";
import "./styles/admin.css";
import "./styles/editor-layout.css";
import "./styles/editor-panels.css";
import "./styles/auth.css";

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
