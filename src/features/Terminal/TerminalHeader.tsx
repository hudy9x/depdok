import { Plus, ChevronDown, PanelRight, PanelBottom, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TerminalHeaderProps {
  isRight: boolean;
  shells: string[];
  handleAddTab: (shellPath?: string) => void;
  setTerminalPosition: (pos: 'bottom' | 'right') => void;
  setIsOpen: (open: boolean) => void;
  shortcutHint: string;
}

export function TerminalHeader({
  isRight,
  shells,
  handleAddTab,
  setTerminalPosition,
  setIsOpen,
  shortcutHint,
}: TerminalHeaderProps) {
  return (
    <div className="flex items-center justify-between h-[20px] w-full px-3 border-b border-transparent bg-layout-chrome select-none shrink-0 z-10">
      {/* Left side: Title */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Terminal
      </span>

      {/* Right side: Actions */}
      <div className="flex items-center gap-1">
        {/* Add tab (+ shell picker) */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                id="terminal-header-add"
                className="flex items-center justify-center w-6.5 h-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer active:scale-95"
                onClick={() => handleAddTab()}
              >
                <Plus size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" className="text-[10px]">
              New Terminal
            </TooltipContent>
          </Tooltip>

          {shells.length > 1 && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      id="terminal-header-add-dropdown"
                      className="flex items-center justify-center w-5 h-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer active:scale-95"
                    >
                      <ChevronDown size={11} className="opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="text-[10px]">
                  Select Profile...
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                side={isRight ? 'left' : 'top'}
                align="end"
                className="w-48 font-mono text-xs"
              >
                {shells.map((shell) => (
                  <DropdownMenuItem
                    key={shell}
                    onClick={() => handleAddTab(shell)}
                    className="cursor-pointer"
                  >
                    {shell}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Layout toggle button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center justify-center w-6.5 h-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer active:scale-95"
              onClick={() => setTerminalPosition(isRight ? 'bottom' : 'right')}
            >
              {isRight ? <PanelBottom size={13} /> : <PanelRight size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center" className="text-[10px]">
            Move to {isRight ? 'Bottom' : 'Right'}
          </TooltipContent>
        </Tooltip>

        {/* Minimize / Close */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id="terminal-header-minimize"
              className="flex items-center justify-center w-6.5 h-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer active:scale-95"
              onClick={() => setIsOpen(false)}
            >
              <X size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center" className="text-[10px]">
            Hide Terminal ({shortcutHint})
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

