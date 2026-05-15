import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/** When true, Vite must not proxy /api — Vercel dev serves serverless routes. */
const vercelDev = process.env.VITE_VERCEL_DEV === "1"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // vercel dev sets PORT; standalone `npm run dev` falls back to 3001
    port: Number(process.env.PORT) || 3001,
    strictPort: true,
    // Option B (vite + dev-api-server on 3002): proxy /api → local Node server.
    // Option A (vercel dev): VITE_VERCEL_DEV=1 — no proxy; CLI handles /api.
    ...(vercelDev
      ? {}
      : {
          proxy: {
            "/api": {
              target: "http://localhost:3002",
              changeOrigin: true,
            },
          },
        }),
  },
})
