/// <reference types="vitest/config" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // The app always calls /api on its own origin. In development Vite forwards it to the gateway;
      // in Docker the nginx container does the same (see nginx.conf).
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  // npm test: unit tests next to the code (*.test.ts, *.test.tsx) in a simulated browser
  test: {
    environment: "jsdom",
  },
})
