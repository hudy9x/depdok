import { useAtom } from 'jotai';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { isFileExplorerVisibleAtom } from './store';

export function ToggleButton() {
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);

  const styleToggleButton = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 hover:bg-background/100 opacity-90 border-r border-border flex-shrink-0`;

  const toggleFileExplorer = () => {
    setIsFileExplorerVisible(!isFileExplorerVisible);
  };

  return (
    <button
      onClick={toggleFileExplorer}
      className={styleToggleButton}
      title={isFileExplorerVisible ? "Hide File Explorer" : "Show File Explorer"}
    >
      {isFileExplorerVisible ? (
        <PanelLeftClose className="w-4 h-4" />
      ) : (
        <PanelLeft className="w-4 h-4" />
      )}
    </button>
  );
}
