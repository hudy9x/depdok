import { Plus, FileText, CheckSquare, Image, Code, FolderOpen } from 'lucide-react';
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

const fileTypes = [
  { extension: 'md', label: 'Markdown', icon: FileText, color: 'text-yellow-500' },
  { extension: 'mmd', label: 'Mermaid', icon: Image, color: 'text-purple-500' },
  { extension: 'todo', label: 'Todo', icon: CheckSquare, color: 'text-blue-500' },
  { extension: 'pu', label: 'PlantUML', icon: Code, color: 'text-green-500' },
  { extension: 'txt', label: 'Text', icon: FileText, color: 'text-muted-foreground' },
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
            extensions: ["md", "mmd", "txt", "pu", "puml", "todo"],
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
    createUntitledTab(`Untitled.${extension}`);
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
          const IconComponent = type.icon;
          return (
            <DropdownMenuItem
              key={type.extension}
              onClick={() => handleCreateFile(type.extension)}
              className="cursor-pointer"
            >
              <IconComponent className={`w-4 h-4 mr-2 ${type.color}`} />
              <span>{type.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">.{type.extension}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
