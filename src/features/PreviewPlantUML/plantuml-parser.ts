/**
 * PlantUML Message Line Parser
 *
 * Parses PlantUML sequence diagram source and returns an ordered array of
 * 1-indexed line numbers that contain message arrows. The Nth entry corresponds
 * to the Nth `.message` element in the rendered SVG.
 *
 * Supported arrow syntaxes:
 *   Alice -> Bob: label
 *   Alice --> Bob: label    (dashed)
 *   Alice ->> Bob: label    (async)
 *   Alice ->o Bob: label    (lost)
 *   Alice ->x Bob: label    (destroy)
 *   Alice <-> Bob: label    (bidirectional)
 *   Alice -[#red]-> Bob: label  (coloured)
 */

// Matches: participant -[optional color]-> participant: label
// Also covers <-, -->, ->>, <<--, etc.
const MESSAGE_REGEX = /^\s*[\w"']+[\w\s"']*\s*(-+(\[#[\w]+\])?-*>+|<+-+(\[#[\w]+\])?-*|<-+>)/i;

/**
 * Returns an ordered array of 1-indexed line numbers that represent
 * PlantUML message arrows in the given source content.
 */
export function getMessageLines(content: string): number[] {
  const lines = content.split('\n');
  const messageLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (MESSAGE_REGEX.test(line)) {
      messageLines.push(i + 1); // 1-indexed
    }
  }

  return messageLines;
}
