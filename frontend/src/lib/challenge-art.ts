export const CHALLENGE_ART_OPTIONS = [
  { key: "strategy", label: "Strategy line", source: "/assets/challenge-art-strategy.png" },
  { key: "fan-command", label: "Fan command", source: "/assets/challenge-art-fan-command.png" },
  { key: "logistics", label: "Sustainable logistics", source: "/assets/challenge-art-logistics.png" },
  { key: "innovation", label: "Open innovation", source: "/assets/challenge-art-innovation.png" },
] as const;

export type ChallengeArtKey = (typeof CHALLENGE_ART_OPTIONS)[number]["key"];

const legacyArtBySortOrder: Record<number, ChallengeArtKey> = {
  1: "strategy",
  2: "fan-command",
  3: "logistics",
};

export function getChallengeArtKey(imageKey?: string | null, sortOrder?: number): ChallengeArtKey {
  const selected = CHALLENGE_ART_OPTIONS.find((option) => option.key === imageKey);
  return selected?.key ?? legacyArtBySortOrder[sortOrder ?? 0] ?? "innovation";
}

export function getChallengeArtSource(imageKey?: string | null, sortOrder?: number) {
  const key = getChallengeArtKey(imageKey, sortOrder);
  return CHALLENGE_ART_OPTIONS.find((option) => option.key === key)?.source ?? "/assets/challenge-art-innovation.png";
}
