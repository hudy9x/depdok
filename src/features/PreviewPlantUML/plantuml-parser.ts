/**
 * PlantUML Parser
 *
 * Utilities for parsing and modifying PlantUML sequence diagram source.
 */

// ── Message parsing ───────────────────────────────────────────────────────────

// Matches arrow lines like:  Alice -> Bob: label  |  Alice --> Bob  |  Alice -[#red]-> Bob: label
const MESSAGE_REGEX = /^\s*[\w"']+[\w\s"']*\s*(-+(\[#[\w]+\])?-*>+|<+-+(\[#[\w]+\])?-*|<-+>)/i;

/**
 * Returns an ordered array of 1-indexed line numbers that represent
 * PlantUML message arrows in the given source content.
 * The Nth entry corresponds to the Nth `.message` element in the rendered SVG.
 */
export function getMessageLines(content: string): number[] {
  const lines = content.split('\n');
  const messageLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (MESSAGE_REGEX.test(lines[i])) {
      messageLines.push(i + 1); // 1-indexed
    }
  }

  return messageLines;
}

// ── Participant parsing ───────────────────────────────────────────────────────

const PARTICIPANT_KEYWORD = '(?:participant|actor|boundary|control|entity|database|collections|queue)';

export interface ParticipantDef {
  lineNumber: number;   // 1-indexed
  displayName: string;  // what is shown in the diagram
  hasAlias: boolean;    // whether an "as <alias>" clause exists
}

/**
 * Find the definition line for a participant by its identifier (alias).
 *
 * Handles:
 *   participant "Display Name" as Alice
 *   participant Alice as A
 *   participant Alice          (no alias — identifier IS the display name)
 */
export function findParticipantDefinition(content: string, identifier: string): ParticipantDef | null {
  const lines = content.split('\n');
  const esc = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. Quoted display + "as <identifier>"
  const reQuotedAlias = new RegExp(`^\\s*${PARTICIPANT_KEYWORD}\\s+"([^"]+)"\\s+as\\s+${esc}\\b`, 'i');
  // 2. Unquoted display + "as <identifier>"
  const reWordAlias = new RegExp(`^\\s*${PARTICIPANT_KEYWORD}\\s+(\\S+)\\s+as\\s+${esc}\\b`, 'i');
  // 3. No alias — participant matches identifier directly (quoted or unquoted)
  const reNoAlias = new RegExp(`^\\s*${PARTICIPANT_KEYWORD}\\s+"?${esc}"?\\s*$`, 'i');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const m1 = line.match(reQuotedAlias);
    if (m1) return { lineNumber: i + 1, displayName: m1[1], hasAlias: true };

    const m2 = line.match(reWordAlias);
    if (m2) return { lineNumber: i + 1, displayName: m2[1], hasAlias: true };

    if (reNoAlias.test(line)) return { lineNumber: i + 1, displayName: identifier, hasAlias: false };
  }

  return null;
}

/**
 * Update the display name of a participant in the source content.
 *
 * - If a definition line exists and already has an alias → replaces only the display part.
 * - If a definition line exists without an alias → adds "as <identifier>" so messages still work.
 * - If no definition exists → inserts `participant "newName" as <identifier>` right after `@startuml`.
 */
export function updateParticipantName(
  content: string,
  identifier: string,
  newDisplayName: string,
): string {
  const lines = content.split('\n');
  const def = findParticipantDefinition(content, identifier);
  const quoted = (s: string) => (s.includes(' ') ? `"${s}"` : s);

  if (def) {
    const idx = def.lineNumber - 1;
    const line = lines[idx];

    if (def.hasAlias) {
      // Replace whatever comes between the keyword and " as <alias>"
      lines[idx] = line.replace(
        new RegExp(
          `^(\\s*${PARTICIPANT_KEYWORD}\\s+)(?:"[^"]+"|\\S+)(\\s+as\\s+\\S+.*)$`,
          'i',
        ),
        (_, kw, aliasTail) => `${kw}${quoted(newDisplayName)}${aliasTail}`,
      );
    } else {
      // No alias clause — add one so messages keep working with the original identifier
      lines[idx] = line.replace(
        new RegExp(`^(\\s*${PARTICIPANT_KEYWORD}\\s+)(?:"?${identifier}"?)(.*)$`, 'i'),
        (_, kw, rest) => `${kw}${quoted(newDisplayName)} as ${identifier}${rest}`,
      );
    }
  } else {
    // Not defined anywhere — insert after @startuml
    const startIdx = lines.findIndex(l => l.trim().toLowerCase() === '@startuml');
    const insertAt = startIdx !== -1 ? startIdx + 1 : 0;
    lines.splice(insertAt, 0, `participant ${quoted(newDisplayName)} as ${identifier}`);
  }

  return lines.join('\n');
}
