import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const be = "http://127.0.0.1:8787";
const proxy = { target: be, changeOrigin: false, secure: false };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": proxy,
      "/media": proxy,
      "/web": proxy,
      "/wv": proxy,
      "/__login": proxy,
    },
  },
});
