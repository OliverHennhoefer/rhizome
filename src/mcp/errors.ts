import { z } from "zod";

export const KnowledgeErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "UNKNOWN_ID",
  "SOURCE_UNAVAILABLE",
  "INVALID_ARTIFACT",
  "SNAPSHOT_CHANGED",
]);
export type KnowledgeErrorCode = z.infer<typeof KnowledgeErrorCodeSchema>;
export class KnowledgeError extends Error {
  constructor(
    readonly code: KnowledgeErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export function invalidArtifact(message: string): never {
  throw new KnowledgeError("INVALID_ARTIFACT", message);
}
