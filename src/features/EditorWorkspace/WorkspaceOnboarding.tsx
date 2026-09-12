import * as React from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  CalendarCheck,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  FileCode,
  FileText,
  FolderPlus,
  GitCommit,
  Layers,
  Loader2,
  Network,
  Rocket,
  Sidebar,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { setupSkills } from '@/api-client/skills';
import { Button } from '@/components/ui/button';
import {
  fileTreeDataAtom,
  isFileExplorerVisibleAtom,
  refreshDirectoryAtom,
  selectItemAtom,
  workspaceRootAtom,
} from '@/features/FileExplorer/store';
import { createDirectory, writeFileContent } from '@/lib/fileOperations';
import { cn } from '@/lib/utils';
import { createTabAtom } from '@/stores/TabStore';

export type ProjectPreset = 'full' | 'essential' | 'kickoff';

export interface ExampleFile {
  path: string;
  desc: string;
}

export interface BaseFolderDefinition {
  name: string;
  label: string;
  description: string;
  detailedPurpose: string;
  exampleFiles: ExampleFile[];
  isEssential: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export const BASE_FOLDERS: BaseFolderDefinition[] = [
  {
    name: 'requirements',
    label: 'requirements/',
    description: 'Product requirements, PRDs, and user stories',
    detailedPurpose:
      'Defines **what** problem we are solving and **why** it exists from a product and user perspective. Focuses on user needs, business goals, problem statements, and scope boundaries before designing solutions.',
    exampleFiles: [
      {
        path: 'requirements/user-authentication-prd.md',
        desc: 'High-level goals, target personas, and success metrics for OAuth & email login.',
      },
      {
        path: 'requirements/subscription-billing.md',
        desc: 'Business objectives, pricing tiers, and currency support requirements.',
      },
      {
        path: 'requirements/pdf-export.md',
        desc: 'User stories and requirements for exporting markdown documents to PDF.',
      },
    ],
    isEssential: true,
    icon: CheckSquare,
  },
  {
    name: 'specifications',
    label: 'specifications/',
    description: 'Functional specs, technical designs, and contracts',
    detailedPurpose:
      'Details **how** a feature behaves functionally and technically. Specifies exact user flows, UI states, data schemas, API contracts, edge cases, and acceptance criteria.',
    exampleFiles: [
      {
        path: 'specifications/auth-flow-spec.md',
        desc: 'Step-by-step login sequence, session handling, error states, and token refresh.',
      },
      {
        path: 'specifications/stripe-webhook-contract.md',
        desc: 'Webhook payload schema, idempotent event handlers, and retry policies.',
      },
      {
        path: 'specifications/file-tree-virtualization.md',
        desc: 'Detailed specification of virtualized folder tree and drag-and-drop behavior.',
      },
    ],
    isEssential: true,
    icon: FileCode,
  },
  {
    name: 'meeting-notes',
    label: 'meeting-notes/',
    description: 'Syncs, 1-on-1s, agenda, and action items',
    detailedPurpose:
      'Records syncs, team discussions, client interviews, and 1-on-1s with attendee lists, key takeaways, and actionable next steps.',
    exampleFiles: [
      {
        path: 'meeting-notes/2026-09-15-sprint-planning.md',
        desc: 'Sprint goals, assigned story points, and sprint commitments.',
      },
      {
        path: 'meeting-notes/2026-09-12-architecture-review.md',
        desc: 'Notes from system design review with the platform team.',
      },
      {
        path: 'meeting-notes/2026-09-08-stakeholder-demo.md',
        desc: 'Feedback and action items from client product walkthrough.',
      },
    ],
    isEssential: false,
    icon: CalendarCheck,
  },
  {
    name: 'daily-reports',
    label: 'daily-reports/',
    description: 'Daily standups, progress tracking, and blockers',
    detailedPurpose:
      'Lightweight daily tracking of progress, completed tasks, ongoing experiments, and blockers to maintain team momentum.',
    exampleFiles: [
      {
        path: 'daily-reports/2026-09-12.md',
        desc: "Standup notes: what was completed yesterday, today's goals, and active blockers.",
      },
      {
        path: 'daily-reports/2026-w37-weekly-summary.md',
        desc: 'End-of-week roll-up of milestone progress and velocity.',
      },
      {
        path: 'daily-reports/dev-progress-log.md',
        desc: 'Developer-specific work log and implementation notes.',
      },
    ],
    isEssential: false,
    icon: Clock,
  },
  {
    name: 'decisions',
    label: 'decisions/',
    description: 'Architecture Decision Records (ADRs) and key choices',
    detailedPurpose:
      'Captures **Architecture Decision Records (ADRs)** and key technical decisions. Documents context, alternatives considered, trade-offs, and rationale so future maintainers understand why decisions were made.',
    exampleFiles: [
      {
        path: 'decisions/0001-use-sqlite-vec-for-embeddings.md',
        desc: 'Decision record evaluating vector storage options and choosing sqlite-vec.',
      },
      {
        path: 'decisions/0002-adopt-tailwind-v4.md',
        desc: 'Rationale for migrating styling engine to Tailwind CSS v4.',
      },
      {
        path: 'decisions/0003-local-first-llm-orchestrator.md',
        desc: 'Trade-offs between client-side tool execution vs server-side streaming.',
      },
    ],
    isEssential: true,
    icon: GitCommit,
  },
  {
    name: 'technical',
    label: 'technical/',
    description: 'Engineering guides, runbooks, and configurations',
    detailedPurpose:
      'Practical engineering guides, local environment setup, deployment runbooks, troubleshooting checklists, and developer tooling.',
    exampleFiles: [
      {
        path: 'technical/local-setup-guide.md',
        desc: 'Step-by-step instructions for installing dependencies and running the app locally.',
      },
      {
        path: 'technical/database-migration-runbook.md',
        desc: 'Instructions for applying SQLite schema migrations safely.',
      },
      {
        path: 'technical/mcp-server-integration.md',
        desc: 'Configuration guide for Model Context Protocol (MCP) tool integration.',
      },
    ],
    isEssential: true,
    icon: Terminal,
  },
  {
    name: 'architecture',
    label: 'architecture/',
    description: 'System diagrams, data models, and flowcharts',
    detailedPurpose:
      'High-level system architecture, component relationships, data flow diagrams, security boundaries, and domain models.',
    exampleFiles: [
      {
        path: 'architecture/system-overview.md',
        desc: 'High-level architecture diagram and service boundary definitions.',
      },
      {
        path: 'architecture/data-model-erd.md',
        desc: 'Entity-relationship diagrams and database schema references.',
      },
      {
        path: 'architecture/ai-agent-flow.md',
        desc: 'Sequence diagram of dual-model orchestrator and frontend tool execution.',
      },
    ],
    isEssential: false,
    icon: Network,
  },
  {
    name: 'planning',
    label: 'planning/',
    description: 'Roadmaps, milestones, sprints, and release plans',
    detailedPurpose:
      'Project roadmap, sprint milestones, release schedules, resource allocation, and backlog estimations.',
    exampleFiles: [
      {
        path: 'planning/q4-product-roadmap.md',
        desc: 'High-level quarterly goals, deliverables, and timeline.',
      },
      {
        path: 'planning/release-v1.0-checklist.md',
        desc: 'Release readiness checklist, QA sign-off, and launch schedule.',
      },
      {
        path: 'planning/sprint-42-backlog.md',
        desc: 'Story breakdown, priority ranking, and engineer assignments.',
      },
    ],
    isEssential: false,
    icon: Compass,
  },
];

export function generateOverviewMd(folders: BaseFolderDefinition[]): string {
  const treeEntries = folders
    .map((f) => `├── ${(f.name + '/').padEnd(25, ' ')}# ${f.description}`)
    .join('\n');

  const folderSections = folders
    .map((folder, idx) => {
      const examples = folder.exampleFiles
        .map((ex) => `  - \`${ex.path}\` — ${ex.desc}`)
        .join('\n');
      return `### ${idx + 1}. \`${folder.name}/\`
- **Purpose**: ${folder.detailedPurpose}
- **Example Files**:
${examples}`;
    })
    .join('\n\n');

  return `# Project Documentation Overview

Welcome to your project workspace. This documentation system is structured around standard knowledge folders designed to keep product vision, technical designs, decisions, and execution in sync.

---

## 📁 Workspace Directory Structure

\`\`\`
├── overview.md                 # Project summary and documentation directory guide
${treeEntries}
\`\`\`

---

## 📚 Documentation Folders Guide

${folderSections}
`;
}

function joinPath(base: string, child: string): string {
  const isWindows = base.includes('\\');
  const separator = isWindows ? '\\' : '/';
  const cleanBase = base.replace(/[/\\]+$/, '');
  const cleanChild = child.replace(/^[/\\]+/, '');
  return `${cleanBase}${separator}${cleanChild}`;
}

export function WorkspaceOnboarding(): React.JSX.Element {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const fileTreeData = useAtomValue(fileTreeDataAtom);
  const refreshDirectory = useSetAtom(refreshDirectoryAtom);
  const createTab = useSetAtom(createTabAtom);
  const selectItem = useSetAtom(selectItemAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);
  const rootEntries = (workspaceRoot && fileTreeData[workspaceRoot]) || [];
  const existingFolderNames = React.useMemo(() => {
    return new Set(
      rootEntries
        .filter((entry) => entry.is_dir)
        .map((entry) => entry.name.toLowerCase())
    );
  }, [rootEntries]);

  // Track if user explicitly clicked a preset tab, otherwise auto-detect best match
  const [userSelectedPreset, setUserSelectedPreset] = React.useState<ProjectPreset | null>(null);

  const preset = React.useMemo<ProjectPreset>(() => {
    if (userSelectedPreset) return userSelectedPreset;

    const names = existingFolderNames;
    const hasFull = BASE_FOLDERS.every((f) => names.has(f.name.toLowerCase()));
    if (hasFull) return 'full';

    const essentialFolders = BASE_FOLDERS.filter((f) => f.isEssential);
    const hasEssential = essentialFolders.every((f) => names.has(f.name.toLowerCase()));
    if (hasEssential) return 'essential';

    const kickoffNames = ['requirements', 'technical', 'planning'];
    const hasKickoff = kickoffNames.every((n) => names.has(n));
    if (hasKickoff) return 'kickoff';

    return 'full';
  }, [userSelectedPreset, existingFolderNames]);

  const setPreset = (p: ProjectPreset): void => {
    setUserSelectedPreset(p);
  };

  const [isCreating, setIsCreating] = React.useState(false);

  const activeFolders = React.useMemo(() => {
    switch (preset) {
      case 'kickoff':
        return BASE_FOLDERS.filter((f) =>
          ['requirements', 'technical', 'planning'].includes(f.name)
        );
      case 'essential':
        return BASE_FOLDERS.filter((f) => f.isEssential);
      case 'full':
      default:
        return BASE_FOLDERS;
    }
  }, [preset]);

  const missingFolders = React.useMemo(() => {
    return activeFolders.filter(
      (folder) => !existingFolderNames.has(folder.name.toLowerCase())
    );
  }, [activeFolders, existingFolderNames]);

  const handleCreateAllMissing = async (): Promise<void> => {
    if (!workspaceRoot) return;
    setIsFileExplorerVisible(true);
    setIsCreating(true);
    try {
      // 1. Create missing documentation folders for chosen preset
      for (const folder of missingFolders) {
        const folderPath = joinPath(workspaceRoot, folder.name);
        await createDirectory(folderPath);
      }

      // 2. Initialize .depdok/ and .depdok/skills/ with built-in templates
      try {
        await setupSkills(workspaceRoot);
      } catch (skillErr) {
        console.warn('Skills setup fallback:', skillErr);
        await createDirectory(joinPath(workspaceRoot, '.depdok'));
        await createDirectory(joinPath(workspaceRoot, '.depdok/skills'));
      }

      // 3. Create .depdok/memory.json
      const memoryPath = joinPath(workspaceRoot, '.depdok/memory.json');
      try {
        await writeFileContent(memoryPath, '{\n  "memories": []\n}\n');
      } catch (memErr) {
        console.warn('Failed to initialize memory.json:', memErr);
      }

      // 4. Generate and write overview.md template matching the active preset
      const overviewContent = generateOverviewMd(activeFolders);
      const overviewPath = joinPath(workspaceRoot, 'overview.md');
      await writeFileContent(overviewPath, overviewContent);

      // 5. Refresh file tree in explorer
      await refreshDirectory(workspaceRoot);

      // 6. Select only overview.md in explorer tree
      selectItem({ path: overviewPath });

      // 7. Open overview.md in editor tab
      createTab({
        filePath: overviewPath,
        fileName: 'overview.md',
        switchTo: true,
      });

      toast.success(
        `Workspace initialized with ${activeFolders.length} folders, .depdok, and overview.md`
      );
    } catch (error) {
      console.error('Failed to initialize workspace folders:', error);
      toast.error('Failed to create folders: ' + String(error));
    } finally {
      setIsCreating(false);
    }
  };

  const hasOverviewMd = rootEntries.some(
    (entry) => !entry.is_dir && entry.name.toLowerCase() === 'overview.md'
  );

  const handleOpenOverview = (): void => {
    if (!workspaceRoot) return;
    const overviewPath = joinPath(workspaceRoot, 'overview.md');
    selectItem({ path: overviewPath });
    createTab({
      filePath: overviewPath,
      fileName: 'overview.md',
      switchTo: true,
    });
  };

  const isCompletelyEmpty = rootEntries.length === 0;
  const isInitialized = missingFolders.length === 0;

  return (
    <div className="h-full w-full overflow-y-auto bg-layout-content text-foreground p-6 md:p-10 flex flex-col items-center justify-center select-none">
      <div className="max-w-4xl w-full flex flex-col items-center space-y-8 my-auto">
        {/* Header Hero */}
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm">
            <img src="/app-icon.png" alt="Depdok" className="w-20 h-20 object-contain rounded-2xl" />
          </div>

          <div className="space-y-4 flex flex-col items-center">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border shadow-xs',
                isInitialized
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              )}
            >
              {isInitialized ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Workspace Ready
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Workspace Setup
                </>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight pt-1">
              {isCompletelyEmpty
                ? 'This project folder is empty'
                : isInitialized
                  ? 'No file is currently open'
                  : 'No file is currently open'}
            </h1>

            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              {isCompletelyEmpty
                ? 'Create the standard documentation folders to organize your project and get started.'
                : isInitialized
                  ? 'Select a file from the sidebar explorer to begin editing, or open overview.md to review your project documentation structure.'
                  : 'Select a file from the sidebar explorer to begin editing, or add additional documentation folders below.'}
            </p>
          </div>

          {/* Project Type / Preset Toggle */}
          <div className="pt-2">
            <div className="inline-flex p-1 bg-layout-chrome border border-border/80 rounded-xl gap-1 shadow-sm">
              <button
                type="button"
                onClick={() => setPreset('full')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2',
                  preset === 'full'
                    ? 'bg-layout-content text-foreground shadow-sm border border-border/70 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Complete</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('essential')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2',
                  preset === 'essential'
                    ? 'bg-layout-content text-foreground shadow-sm border border-border/70 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Essential</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('kickoff')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2',
                  preset === 'kickoff'
                    ? 'bg-layout-content text-foreground shadow-sm border border-border/70 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Rocket className="w-3.5 h-3.5 text-indigo-500" />
                <span>Kickoff</span>
              </button>
            </div>
          </div>
        </div>

        {/* Folder Status Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {activeFolders.map((folder) => {
            const Icon = folder.icon;
            const exists = existingFolderNames.has(folder.name.toLowerCase());

            return (
              <div
                key={folder.name}
                className={cn(
                  'p-4 rounded-xl border flex items-start gap-3.5 transition-colors',
                  exists
                    ? 'bg-layout-chrome/90 border-border/80 text-foreground'
                    : 'bg-layout-chrome/40 border-dashed border-border/80 text-foreground'
                )}
              >
                <div
                  className={cn(
                    'p-2.5 rounded-lg shrink-0 mt-0.5',
                    exists
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold text-foreground tracking-tight">
                    {folder.label}
                  </div>
                  <p className="text-xs text-muted-foreground/85 leading-relaxed mt-0.5">
                    {folder.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-2">
          {missingFolders.length > 0 && (
            <Button
              size="default"
              variant="default"
              disabled={isCreating}
              onClick={handleCreateAllMissing}
              className="w-full sm:w-auto shadow-sm gap-2 font-medium"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating folders...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  {isCompletelyEmpty
                    ? `Initialize Base Folders (${missingFolders.length})`
                    : `Initialize Missing Folders (${missingFolders.length})`}
                </>
              )}
            </Button>
          )}

          {hasOverviewMd && (
            <Button
              size="default"
              variant={missingFolders.length > 0 ? "outline" : "default"}
              onClick={handleOpenOverview}
              className="w-full sm:w-auto shadow-sm gap-2 font-medium"
            >
              <FileText className="w-4 h-4" />
              Open overview.md
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsFileExplorerVisible(!isFileExplorerVisible)}
            className="w-full sm:w-auto gap-2"
          >
            <Sidebar className="w-4 h-4 text-muted-foreground" />
            {isFileExplorerVisible ? 'Hide sidebar' : 'Open sidebar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
