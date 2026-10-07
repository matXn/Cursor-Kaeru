import { defineConfig } from "vite";

// The page shares the desktop app's design tokens and CJK font, which live in ../desktop.
export default defineConfig({
  clearScreen: false,
  server: { port: 1421, strictPort: true, fs: { allow: [".."] } },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
