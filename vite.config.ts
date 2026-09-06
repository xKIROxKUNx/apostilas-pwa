import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const GITHUB_PAGES_BASE = "/apostilas-pwa/";
const resolvedBase = process.env.VITE_BASE_PATH ?? GITHUB_PAGES_BASE;

export default defineConfig({
  base: resolvedBase,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "wasm/*.wasm"],
      manifest: {
        id: resolvedBase,
        name: "Apostilas",
        short_name: "Apostilas",
        description:
          "Leitor de apostilas universitárias com anotações e acesso por assinatura.",
        lang: "pt-BR",
        theme_color: "#1b1b1f",
        background_color: "#1b1b1f",
        display: "standalone",
        orientation: "any",
        start_url: resolvedBase,
        scope: resolvedBase,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}"],
        navigateFallbackDenylist: [/^\/_/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache" },
          },
          {
            urlPattern: /^https:\/\/(firebasestorage\.googleapis\.com|firestore\.googleapis\.com)\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
  },
});
