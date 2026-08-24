import { parentPort } from "node:worker_threads";
import { parseNote } from "./parse";
import type { RhizomeConfig } from "./types";

interface ParseRequest {
  files: string[];
  vaultRoot: string;
  config: RhizomeConfig;
}

if (!parentPort) throw new Error("Parser worker requires a parent port");

parentPort.on("message", async ({ files, vaultRoot, config }: ParseRequest) => {
  try {
    const notes = await Promise.all(files.map((file) => parseNote(file, vaultRoot, config)));
    parentPort?.postMessage({ notes });
  } catch (error) {
    parentPort?.postMessage({
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }
});
