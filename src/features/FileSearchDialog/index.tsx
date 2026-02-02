import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tabsAtom, switchTabAtom } from "@/stores/TabStore";
import { FileIcon } from "@/components/FileIcon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function FileSearchDialog() {
  const [open, setOpen] = useState(false);
  const tabs = useAtomValue(tabsAtom);
  const switchTab = useSetAtom(switchTabAtom);

  // Register Cmd/Ctrl+P keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (tabId: string) => {
    switchTab(tabId);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tabs..." />
      <CommandList>
        <CommandEmpty>No tabs found.</CommandEmpty>
        <CommandGroup heading="Open file">
          {tabs.map((tab) => (
            <CommandItem
              key={tab.id}
              value={tab.fileName}
              onSelect={() => handleSelect(tab.id)}
              className="cursor-pointer"
            >
              <FileIcon filename={tab.fileName} className="mr-2" />
              <div className="flex flex-col">
                <span>{tab.fileName}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {tab.filePath}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
