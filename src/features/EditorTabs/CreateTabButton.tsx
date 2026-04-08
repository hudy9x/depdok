import { Plus, FolderOpen } from 'lucide-react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { createUntitledTabAtom, createTabAtom } from '@/stores/TabStore';
import { FileIcon } from '@/components/FileIcon';

const fileTypes = [
  { extension: 'md', label: 'Markdown' },
  { extension: 'mmd', label: 'Mermaid' },
  { extension: 'todo', label: 'Todo' },
  { extension: 'pu', label: 'PlantUML' },
  { extension: 'excalidraw', label: 'Excalidraw' },
  { extension: 'format', label: 'Format' },
  { extension: 'logger', label: 'Logger' },
];

export function CreateTabButton() {
  const createUntitledTab = useSetAtom(createUntitledTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Documentation Files",
            extensions: ["md", "mmd", "txt", "pu", "puml", "todo", "excalidraw", "format", "logger"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const fileName = selected.split("/").pop() || "Untitled";
        createTab({ filePath: selected, fileName, switchTo: true });
        if (window.location.pathname !== '/editor') {
          navigate('/editor');
        }
      }
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Failed to open file");
    }
  };

  const handleCreateFile = (extension: string) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const randomId = Array.from({ length: 6 })
      .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
      .join('');
    
    createUntitledTab(`Untitled-${randomId}.${extension}`);
    // Navigate to editor if not already there
    if (window.location.pathname !== '/editor') {
      navigate('/editor');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          className="h-[35px] w-8 p-0 rounded-none border-r border-border hover:bg-background cursor-pointer flex items-center justify-center"
          title="Create new file"
          data-tauri-drag-region="false"
        >
          <Plus className="w-4 h-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-48 z-[9999]">
        <DropdownMenuItem onClick={handleOpenFile} className="cursor-pointer">
          <FolderOpen className="w-4 h-4 mr-2 text-blue-500" />
          <span>Open File...</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {fileTypes.map((type) => {
          return (
            <DropdownMenuItem
              key={type.extension}
              onClick={() => handleCreateFile(type.extension)}
              className="cursor-pointer"
            >
              <FileIcon filename={`untitled.${type.extension}`} className="mr-2" />
              <span>{type.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">.{type.extension}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
