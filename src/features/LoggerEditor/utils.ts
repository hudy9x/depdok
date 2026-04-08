export const HIGHLIGHT_COLORS = [
  "bg-yellow-500/30 text-yellow-500",
  "bg-green-500/30 text-green-500",
  "bg-blue-500/30 text-blue-500",
  "bg-purple-500/30 text-purple-500",
  "bg-pink-500/30 text-pink-500",
  "bg-red-500/30 text-red-500",
  "bg-orange-500/30 text-orange-500",
  "bg-teal-500/30 text-teal-500",
  "bg-cyan-500/30 text-cyan-500",
  "bg-indigo-500/30 text-indigo-500",
];

export const levelColors: Record<string, string> = {
  info: "text-blue-500",
  debug: "text-gray-400",
  warn: "text-yellow-500",
  error: "text-red-500",
};

export function formatTimeDiff(ms: number): string {
  if (ms < 9999) return `${ms}ms`;

  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;

  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;

  const w = Math.floor(d / 7);
  return `${w}w`;
}
