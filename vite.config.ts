import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";
import { rhizome } from "./src/compiler/vite-plugin";

function normalizeBase(value: string | undefined): string {
  const base = value?.trim() || "/";
  return `/${base.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
}

export default defineConfig({
  base: normalizeBase(process.env.RHIZOME_BASE_PATH),
  plugins: [rhizome({ configPath: normalizePath("rhizome.config.yaml") }), react()],
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          graph2d: ["sigma", "graphology"],
        },
      },
    },
  },
});
