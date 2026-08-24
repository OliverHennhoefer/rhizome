export const COMMUNITY_TONES = ["#f5f5f7", "#d2d2d7", "#aeaeb2", "#8e8e93", "#6e6e73"];

const RELATION_TONES = ["#f5f5f7", "#c7c7cc", "#98989d", "#6e6e73"];

export function relationTone(relation: string): string {
  if (relation === "link") return "#8e8e93";
  let hash = 0;
  for (let index = 0; index < relation.length; index += 1) {
    hash = Math.imul(hash ^ relation.charCodeAt(index), 16777619);
  }
  return RELATION_TONES[Math.abs(hash) % RELATION_TONES.length];
}
