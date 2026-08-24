import path from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { VaultCompiler } from "./compile.ts";

interface RhizomePluginOptions {
  configPath?: string;
}

function contentType(file: string): string {
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function rhizome(options: RhizomePluginOptions = {}): Plugin {
  let config: ResolvedConfig;
  let compiler: VaultCompiler;
  let assets = new Map<string, string | Uint8Array>();
  let timer: NodeJS.Timeout | undefined;

  async function rebuild(server?: ViteDevServer, changed?: string): Promise<void> {
    const result = changed ? await compiler.update([changed]) : await compiler.update();
    assets = result.assets;
    if (server) server.ws.send({ type: "full-reload" });
  }

  return {
    name: "rhizome-compiler",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
      compiler = new VaultCompiler({
        projectRoot: config.root,
        configPath: options.configPath,
      });
    },
    async buildStart() {
      if (config.command !== "build") return;
      const result = await compiler.clean();
      for (const [fileName, source] of result.assets) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
    async configureServer(server) {
      await rebuild();
      const contentRoot = path.resolve(config.root, "content");
      server.watcher.add([
        contentRoot,
        path.resolve(config.root, options.configPath ?? "rhizome.config.yaml"),
      ]);
      server.watcher.on("all", (_event, changed) => {
        if (
          !changed.startsWith(contentRoot) &&
          changed !== path.resolve(config.root, options.configPath ?? "rhizome.config.yaml")
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          rebuild(server, changed).catch((error) => server.config.logger.error(String(error)));
        }, 60);
      });
      server.middlewares.use((request, response, next) => {
        const pathname = decodeURIComponent((request.url ?? "").split("?", 1)[0]);
        const base = config.base === "/" ? "/" : config.base;
        const relative = pathname.startsWith(base)
          ? pathname.slice(base.length)
          : pathname.slice(1);
        const asset = assets.get(relative);
        if (asset === undefined) return next();
        response.statusCode = 200;
        response.setHeader("Content-Type", contentType(relative));
        response.setHeader("Cache-Control", "no-cache");
        response.end(asset);
      });
    },
  };
}
