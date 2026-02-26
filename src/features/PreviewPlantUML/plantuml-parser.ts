/**
 * PlantUML Parser
 *
 * Utilities for parsing and modifying PlantUML sequence diagram source.
 */

// ── Message parsing ───────────────────────────────────────────────────────────

const MESSAGE_REGEX = /^\s*[\w"']+[\w\s"']*\s*(-+(\[#[\w]+\])?-*>+|<+-+(\[#[\w]+\])?-*|<-+>)/i;

/**
 * Returns an ordered array of 1-indexed line numbers that represent
 * PlantUML message arrows. The Nth entry maps to the Nth `.message` SVG element.
 */
export function getMessageLines(content: string): number[] {
  const lines = content.split('\n');
  const result: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (MESSAGE_REGEX.test(lines[i])) result.push(i + 1);
  }
  return result;
}

// ── Participant parsing ───────────────────────────────────────────────────────

const PARTICIPANT_KEYWORD = '(?:participant|actor|boundary|control|entity|database|collections|queue)';

export interface ParticipantDef {
  lineNumber: number;   // 1-indexed
  displayName: string;
  hasAlias: boolean;
}

/**
 * Find the definition line for a participant by its identifier (alias).
 */
export function findParticipantDefinition(content: string, identifier: string): ParticipantDef | null {
  const lines = content.split('\n');
  const esc = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const reQuotedAlias = new RegExp(`^\\s*${PARTICIPANT_KEYWORD}\\s+"([^"]+)"\\s+as\\s+${esc}\\b`, 'i');
  const reWordAlias = new RegExp(`^\\s*${PARTICIPANT_KEYWORD}\\s+(\\S+)\\s+as\\s+${esc}\\b`, 'i');
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
 * Returns the 1-indexed line numbers of all participant definition lines, in source order.
 */
export function getAllParticipantLineNumbers(content: string): number[] {
  const lines = content.split('\n');
  const re = new RegExp(`^\\s*${PARTICIPANT_KEYWORD}\\s+`, 'i');
  return lines.reduce<number[]>((acc, l, i) => {
    if (re.test(l)) acc.push(i + 1);
    return acc;
  }, []);
}

/**
 * Update the display name of a participant.
 * - Found with alias    → replaces display part, keeps "as <alias>"
 * - Found without alias → adds "as <identifier>" so messages keep working
 * - Not found           → inserts `participant "newName" as <identifier>` after @startuml
 */
export function updateParticipantName(content: string, identifier: string, newDisplayName: string): string {
  const lines = content.split('\n');
  const def = findParticipantDefinition(content, identifier);
  const quoted = (s: string) => (s.includes(' ') ? `"${s}"` : s);

  if (def) {
    const idx = def.lineNumber - 1;
    const line = lines[idx];
    if (def.hasAlias) {
      lines[idx] = line.replace(
        new RegExp(`^(\\s*${PARTICIPANT_KEYWORD}\\s+)(?:"[^"]+"|\\S+)(\\s+as\\s+\\S+.*)$`, 'i'),
        (_, kw, aliasTail) => `${kw}${quoted(newDisplayName)}${aliasTail}`,
      );
    } else {
      lines[idx] = line.replace(
        new RegExp(`^(\\s*${PARTICIPANT_KEYWORD}\\s+)(?:"?[^\\s]+"?)(\\s*.*)$`, 'i'),
        (_, kw, rest) => `${kw}${quoted(newDisplayName)} as ${identifier}${rest}`,
      );
    }
  } else {
    const startIdx = lines.findIndex(l => l.trim().toLowerCase() === '@startuml');
    lines.splice(startIdx !== -1 ? startIdx + 1 : 0, 0, `participant ${quoted(newDisplayName)} as ${identifier}`);
  }
  return lines.join('\n');
}

/**
 * Insert a new participant definition line immediately AFTER the definition line
 * of `afterIdentifier`. Falls back to: after last participant def → after @startuml.
 */
export function insertParticipantAfter(
  content: string,
  afterIdentifier: string,
  newDefinition: string,
): string {
  const lines = content.split('\n');
  const def = findParticipantDefinition(content, afterIdentifier);

  let insertAt: number;
  if (def) {
    insertAt = def.lineNumber; // 0-based index = lineNumber (1-based) without -1 → one after
  } else {
    const all = getAllParticipantLineNumbers(content);
    if (all.length > 0) {
      insertAt = all[all.length - 1]; // after the last participant def
    } else {
      const startIdx = lines.findIndex(l => l.trim().toLowerCase() === '@startuml');
      insertAt = startIdx !== -1 ? startIdx + 1 : 0;
    }
  }

  lines.splice(insertAt, 0, newDefinition);
  return lines.join('\n');
}

/**
 * Move a participant definition up ("left" in diagram) or down ("right" in diagram)
 * relative to the other participant definitions.
 */
export function moveParticipant(
  content: string,
  identifier: string,
  direction: 'up' | 'down',
): string {
  const lines = content.split('\n');
  const def = findParticipantDefinition(content, identifier);
  if (!def) return content;

  const allLineNums = getAllParticipantLineNumbers(content);
  const myPos = allLineNums.indexOf(def.lineNumber);
  if (myPos === -1) return content;

  const targetPos = direction === 'up' ? myPos - 1 : myPos + 1;
  if (targetPos < 0 || targetPos >= allLineNums.length) return content;

  const myIdx = def.lineNumber - 1;
  const otherIdx = allLineNums[targetPos] - 1;

  // Swap the two definition lines
  [lines[myIdx], lines[otherIdx]] = [lines[otherIdx], lines[myIdx]];
  return lines.join('\n');
}

// ── Note parsing ──────────────────────────────────────────────────────────────

export interface NoteDef {
  startLine: number; // 1-indexed
  endLine: number;   // 1-indexed (same as startLine for single-line notes)
  textBlock: string; // The full text content of the note (excluding keywords)
}

/**
 * Parses the PlantUML source for single-line and multi-line notes.
 * Returns an array of NoteDef objects, which provide the line numbers
 * and text content. The text content is used heuristically to map SVG <text>
 * elements back to their source definition.
 */
export function getNotes(content: string): NoteDef[] {
  const lines = content.split('\n');
  const result: NoteDef[] = [];

  // Single-line match: "note [left|right|top|bottom|across] [of ID] : Note text here"
  const singleNoteRe = /^\s*note\s+.*?:(.*)$/i;
  // Multi-line start match: "note [left|right|top|bottom|across] [of ID]"
  const multiStartRe = /^\s*note\s+[^:]*$/i;
  // Multi-line end match: "end note"
  const multiEndRe = /^\s*end\s+note\s*$/i;

  let inMultiLineNote = false;
  let multiLineStartIndex = -1;
  let currentNoteTextLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inMultiLineNote) {
      if (multiEndRe.test(line)) {
        // Multi-line note closed
        result.push({
          startLine: multiLineStartIndex + 1,
          endLine: i + 1,
          textBlock: currentNoteTextLines.join('\n').trim()
        });
        inMultiLineNote = false;
        currentNoteTextLines = [];
      } else {
        currentNoteTextLines.push(line);
      }
      continue;
    }

    // Check for single-line note first (has a colon)
    const singleMatch = line.match(singleNoteRe);
    if (singleMatch) {
      result.push({
        startLine: i + 1,
        endLine: i + 1,
        textBlock: singleMatch[1].trim()
      });
      continue;
    }

    // Check for multi-line start (has NO colon at end of "note ...")
    if (multiStartRe.test(line)) {
      inMultiLineNote = true;
      multiLineStartIndex = i;
      currentNoteTextLines = [];
    }
  }

  // Handle unclosed multi-line note at EOF just in case
  if (inMultiLineNote) {
    result.push({
      startLine: multiLineStartIndex + 1,
      endLine: lines.length,
      textBlock: currentNoteTextLines.join('\n').trim()
    });
  }

  return result;
}
