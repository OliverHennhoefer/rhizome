import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";
import { rhizome } from "./src/compiler/vite-plugin.ts";

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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "graph2d",
              test: /node_modules[\\/](?:sigma|graphology)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
