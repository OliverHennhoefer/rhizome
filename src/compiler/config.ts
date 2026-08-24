import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "yaml";
import type { RhizomeConfig } from "./types.ts";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

export async function loadConfig(projectRoot: string, configPath: string): Promise<RhizomeConfig> {
  const absolute = path.resolve(projectRoot, configPath);
  const [configSource, schemaSource] = await Promise.all([
    readFile(absolute, "utf8"),
    readFile(path.resolve(projectRoot, "rhizome.schema.json"), "utf8"),
  ]);
  const input: unknown = parse(configSource);
  const schema = JSON.parse(schemaSource) as Record<string, unknown>;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(input)) {
    const issues = (validate.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`Invalid Rhizome configuration: ${issues}`);
  }
  assertRecord(input, "configuration");
  assertRecord(input.site, "site");
  assertRecord(input.content, "content");
  assertRecord(input.relations, "relations");

  if (typeof input.site.title !== "string" || !input.site.title.trim()) {
    throw new Error("site.title must be a non-empty string");
  }
  if (typeof input.content.root !== "string" || !input.content.root.trim()) {
    throw new Error("content.root must be a non-empty string");
  }
  const exclude = input.content.exclude ?? [];
  if (!Array.isArray(exclude) || exclude.some((item) => typeof item !== "string")) {
    throw new Error("content.exclude must be an array of glob strings");
  }

  const relations: RhizomeConfig["relations"] = {};
  for (const [key, value] of Object.entries(input.relations)) {
    assertRecord(value, `relations.${key}`);
    if (
      typeof value.label !== "string" ||
      typeof value.directed !== "boolean" ||
      typeof value.color !== "string" ||
      !HEX_COLOR.test(value.color)
    ) {
      throw new Error(`relations.${key} requires label, directed, and a six-digit hex color`);
    }
    relations[key] = {
      label: value.label,
      directed: value.directed,
      color: value.color,
    };
  }

  return {
    site: { title: input.site.title },
    content: { root: input.content.root, exclude: exclude as string[] },
    relations,
  };
}
