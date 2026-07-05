import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Deployed to GitHub Pages at https://<owner>.github.io/Scoring/
export default defineConfig({
  base: process.env.APP_BASE ?? "/Scoring/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Golf Trip Scoring",
        short_name: "Trip Golf",
        description: "Scorecards, daily comps and trip handicapping for golf trips",
        theme_color: "#256B3C",
        background_color: "#F3F5F0",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // app shell only; all trip data lives in localStorage / the drop-box
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        navigateFallback: undefined,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
} as never);
