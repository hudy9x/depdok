import React, { useMemo, useEffect } from "react";
import { Sparkles, Terminal, RefreshCw, Wrench } from "lucide-react";
import { Skill } from "../store/LLMChat2Store";

export type SlashItem =
  | {
      type: "command";
      name: "skill-setup" | "skill-reload";
      description: string;
    }
  | {
      type: "skill";
      name: string;
      description: string;
      skill: Skill;
    };

interface SlashCommandPopupProps {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  availableSkills: Skill[];
  onSelect: (item: SlashItem) => void;
  onClose: () => void;
  onItemsChange?: (items: SlashItem[]) => void;
}

const HARDCODED_COMMANDS: SlashItem[] = [
  {
    type: "command",
    name: "skill-setup",
    description: "Initialize project skills (.depdok/skills/) and default skill-creator template",
  },
  {
    type: "command",
    name: "skill-reload",
    description: "Re-read skill files from disk and update cache",
  },
];

function getFuzzyScore(query: string, name: string, description: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!q) return 0;

  const nRaw = name.toLowerCase();
  const dRaw = description.toLowerCase();
  const nClean = nRaw.replace(/[^a-z0-9]/g, "");
  const dClean = dRaw.replace(/[^a-z0-9]/g, "");

  // 1. Exact match on name
  if (nRaw === query.toLowerCase() || nClean === q) return 1000;

  // 2. Prefix match on raw name or cleaned name (e.g. "skill" -> "skill-creator")
  if (nRaw.startsWith(query.toLowerCase()) || nClean.startsWith(q)) return 800;

  // 3. Substring match on name (e.g. "creator" -> "skill-creator")
  if (nRaw.includes(query.toLowerCase()) || nClean.includes(q)) return 600;

  // 4. Acronym match (e.g. "sc" -> "skill-creator", "sr" -> "skill-reload")
  const parts = nRaw.split("-");
  const acronym = parts.map((p) => p[0]).join("");
  if (acronym.startsWith(q)) return 500;

  // 5. Subsequence fuzzy match on name (e.g. "skillcr" -> "skill-creator")
  let qIdx = 0;
  for (let i = 0; i < nClean.length && qIdx < q.length; i++) {
    if (nClean[i] === q[qIdx]) {
      qIdx++;
    }
  }
  if (qIdx === q.length) return 400;

  // 6. Substring match on description
  if (dRaw.includes(query.toLowerCase()) || dClean.includes(q)) return 200;

  // 7. Subsequence fuzzy match on description
  qIdx = 0;
  for (let i = 0; i < dClean.length && qIdx < q.length; i++) {
    if (dClean[i] === q[qIdx]) {
      qIdx++;
    }
  }
  if (qIdx === q.length) return 100;

  return null;
}

export const SlashCommandPopup: React.FC<SlashCommandPopupProps> = ({
  isOpen,
  query,
  selectedIndex,
  availableSkills,
  onSelect,
  onClose,
  onItemsChange,
}) => {
  const items = useMemo<SlashItem[]>(() => {
    const cleanQuery = query.toLowerCase().replace(/^\/+/, "").trim();

    const all: Array<{ item: SlashItem; score: number }> = [];

    for (const cmd of HARDCODED_COMMANDS) {
      const score = getFuzzyScore(cleanQuery, cmd.name, cmd.description);
      if (score !== null) {
        all.push({ item: cmd, score });
      }
    }

    for (const skill of availableSkills) {
      const score = getFuzzyScore(cleanQuery, skill.name, skill.description);
      if (score !== null) {
        all.push({
          item: {
            type: "skill",
            name: skill.name,
            description: skill.description,
            skill,
          },
          score,
        });
      }
    }

    // Sort by relevance score descending
    all.sort((a, b) => b.score - a.score);

    return all.map((entry) => entry.item);
  }, [query, availableSkills]);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border/80 bg-background/98 backdrop-blur-xl shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Commands & Skills (/)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground font-mono">
            ↑↓ to navigate • Enter to select
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 rounded hover:bg-muted/60"
            title="Close popup (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">
          No commands or skills matching &quot;/{query}&quot;
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const isCommand = item.type === "command";

            return (
              <button
                key={`${item.type}-${item.name}`}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-muted text-foreground border border-border/80"
                    : "text-foreground hover:bg-muted/60 border border-transparent"
                }`}
              >
                <div className="shrink-0">
                  {isCommand ? (
                    item.name === "skill-reload" ? (
                      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    )
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold font-mono tracking-tight text-xs">
                      /{item.name}
                    </span>
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono font-medium bg-muted text-muted-foreground">
                      {isCommand ? "Command" : "Skill"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {item.description}
                  </p>
                </div>

                {item.type === "skill" && item.skill.tools.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground font-mono">
                    <Wrench className="w-2.5 h-2.5 opacity-70" />
                    <span>{item.skill.tools.length}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
