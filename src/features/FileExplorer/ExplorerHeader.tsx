import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  VscSearch,
  VscSync,
  VscGraph,
  VscNewFile,
  VscNewFolder,
  VscCollapseAll
} from 'react-icons/vsc';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createTabAtom } from '@/stores/TabStore';
import { viewModeAtom } from '@/stores/EditorStore';
import { createFile, readFileContent, writeFileContent } from '@/lib/fileOperations';
import { buildKnowledgeGraphFilePath, KNOWLEDGE_GRAPH_FILE_NAME } from '@/lib/knowledgeGraph';
import { KnowledgeBaseSearchDialog } from './KnowledgeBaseSearchDialog';
import { MarkdownKnowledgeBaseDialog } from './MarkdownKnowledgeBaseDialog';
import {
  workspaceRootAtom,
  openCreateDialogAtom,
  expandedFoldersAtom
} from './store';

export function ExplorerHeader() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const openCreateDialog = useSetAtom(openCreateDialogAtom);
  const setExpandedFolders = useSetAtom(expandedFoldersAtom);
  const createTab = useSetAtom(createTabAtom);
  const setViewMode = useSetAtom(viewModeAtom);
  const navigate = useNavigate();
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  const handleCreateFile = () => {
    if (workspaceRoot) {
      openCreateDialog({ path: workspaceRoot, type: 'file' });
    }
  };

  const handleCreateFolder = () => {
    if (workspaceRoot) {
      openCreateDialog({ path: workspaceRoot, type: 'folder' });
    }
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
  };

  const handleOpenKnowledgeGraph = async () => {
    if (!workspaceRoot) return;

    const graphFilePath = buildKnowledgeGraphFilePath(workspaceRoot);

    try {
      await readFileContent(graphFilePath);
    } catch {
      await createFile(graphFilePath);
      await writeFileContent(
        graphFilePath,
        `# Knowledge Graph\n\nThis file opens the knowledge graph for ${workspaceRoot.split(/[/\\]/).pop() || 'this project'}.\n`
      );
    }

    createTab({
      filePath: graphFilePath,
      fileName: KNOWLEDGE_GRAPH_FILE_NAME,
      switchTo: true,
    });
    setViewMode('preview-only');
    navigate('/editor');
  };

  if (!workspaceRoot) return null;

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1 shrink-0 group/explorer-header">
        <span className="text-xs h-6 leading-6 font-semibold text-muted-foreground truncate" title={workspaceRoot}>
          {workspaceRoot.split(/[/\\]/).pop() || 'WORKSPACE'}
        </span>
        <div className="items-center gap-0.5 hidden group-hover:flex transition-opacity duration-200">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={() => setIsSearchDialogOpen(true)} title="Search Knowledge Base">
            <VscSearch className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={() => setIsScanDialogOpen(true)} title="Scan Markdown Files">
            <VscSync className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleOpenKnowledgeGraph} title="Knowledge Graph">
            <VscGraph className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleCreateFile} title="New File">
            <VscNewFile className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleCreateFolder} title="New Folder">
            <VscNewFolder className="h-3.5 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleCollapseAll} title="Collapse All">
            <VscCollapseAll className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <MarkdownKnowledgeBaseDialog
        workspaceRoot={workspaceRoot}
        open={isScanDialogOpen}
        onOpenChange={setIsScanDialogOpen}
      />
      <KnowledgeBaseSearchDialog
        open={isSearchDialogOpen}
        onOpenChange={setIsSearchDialogOpen}
      />
    </>
  );
}
