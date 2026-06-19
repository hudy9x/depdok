import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronRight, Folder, MousePointer2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import {
  checkContextMenuStatus,
  registerContextMenu,
  unregisterContextMenu,
} from '@/api-client/contextMenu';

export const ContextMenuSetting = (): JSX.Element => {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [animState, setAnimState] = useState<'folder' | 'moving' | 'click' | 'menu' | 'fadeout'>('folder');

  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win');

  useEffect(() => {
    if (!isWindows) {
      setIsEnabled(false);
      return;
    }
    const fetchStatus = async (): Promise<void> => {
      try {
        const status = await checkContextMenuStatus();
        setIsEnabled(status);
      } catch (err) {
        console.error('Failed to check context menu status:', err);
      }
    };
    fetchStatus();
  }, [isWindows]);

  const handleToggle = async (checked: boolean): Promise<void> => {
    if (!isWindows) return;
    setLoading(true);
    try {
      if (checked) {
        await registerContextMenu();
        setIsEnabled(true);
        toast.success("Added 'Open with Depdok' to Explorer context menu!");
      } else {
        await unregisterContextMenu();
        setIsEnabled(false);
        toast.success("Removed 'Open with Depdok' from Explorer context menu.");
      }
    } catch (err) {
      console.error('Failed to update context menu:', err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Loop the context menu demo animation
  useEffect(() => {
    let active = true;
    
    const runAnimation = async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      while (active) {
        setAnimState('folder');
        await delay(1000); // Display folder first for 1s
        if (!active) return;
        
        setAnimState('moving');
        await delay(800);  // Cursor slides in
        if (!active) return;
        
        setAnimState('click');
        await delay(200);  // Right click ripple
        if (!active) return;
        
        setAnimState('menu');
        await delay(3500); // Show shadcn context menu
        if (!active) return;
        
        setAnimState('fadeout');
        await delay(400);  // Fade out
      }
    };
    
    runAnimation();
    
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-8 items-start">
      {/* Left Column: Config */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Label htmlFor="context-menu" className="text-sm font-medium">Windows Explorer Integration</Label>
            {!isWindows && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-semibold shrink-0">
                Windows Only
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Show Depdok in the Windows Explorer right-click context menu. This lets you right-click any file or directory and open it directly in Depdok.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEnabled === null ? (
            <div className="h-6 w-10 bg-muted animate-pulse rounded-full" />
          ) : (
            <Switch
              id="context-menu"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={!isWindows || loading}
            />
          )}
          <span className="text-xs font-medium text-foreground">
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {!isWindows && (
          <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed">
            This option is only available on Windows operating systems.
          </p>
        )}
      </div>

      {/* Right Column: Fake Windows Context Menu with Shadcn styling */}
      <div className="relative rounded-xl border border-border/80 bg-muted/20 p-4 flex items-center justify-center overflow-hidden h-[240px] shadow-sm select-none">
        
        {/* Animated Folder Element */}
        <div 
          className={cn(
            "absolute flex flex-col items-center gap-1 transition-all duration-300",
            animState === 'click' ? 'scale-95' : 'scale-100'
          )}
          style={{
            top: '25%',
            left: '20%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Folder className="w-8 h-8 text-primary fill-primary/80 dark:fill-primary/95 drop-shadow-sm" />
          <span className="text-[9px] font-medium text-muted-foreground">my-project</span>
        </div>

        {/* Click Ripple Indicator */}
        {animState === 'click' && (
          <div 
            className="absolute w-8 h-8 rounded-full bg-primary/25 border border-primary/45 scale-100 animate-ping pointer-events-none" 
            style={{
              top: '25%',
              left: '20%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Mouse Pointer Cursor */}
        <div 
          className={cn(
            "absolute pointer-events-none z-20 text-foreground drop-shadow-md transition-all ease-out",
            animState === 'folder' && "opacity-0 scale-75 duration-0",
            animState === 'moving' && "opacity-100 scale-100 duration-700",
            animState === 'click' && "opacity-100 scale-90 duration-75",
            animState === 'menu' && "opacity-0 scale-100 duration-300",
            animState === 'fadeout' && "opacity-0 scale-75 duration-300"
          )}
          style={{ 
            top: animState === 'folder' ? '80%' : '25%',
            left: animState === 'folder' ? '80%' : '20%',
            transform: 'translate(-2px, -2px)' 
          }}
        >
          <MousePointer2 className="w-4.5 h-4.5 fill-foreground text-background" />
        </div>

        {/* Shadcn-Style Context Menu */}
        <div 
          className={cn(
            "absolute z-10 w-[150px] bg-popover text-popover-foreground border border-border shadow-md rounded-md p-1.5 text-[10px] font-sans transition-all origin-top-left",
            animState === 'menu' 
              ? "opacity-100 scale-100 pointer-events-auto duration-200" 
              : "opacity-0 scale-95 pointer-events-none duration-150"
          )}
          style={{
            top: '16%',
            left: '22%',
          }}
        >
          <div className="flex items-center justify-between px-1.5 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-default text-muted-foreground/90">
            <span>View</span>
            <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
          </div>
          <div className="flex items-center justify-between px-1.5 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-default text-muted-foreground/90">
            <span>Sort by</span>
            <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
          </div>
          <div className="px-1.5 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-default text-muted-foreground/90">
            Refresh
          </div>

          <div className="h-[1px] bg-border my-1" />

          {/* Open with Depdok (Always active in preview) */}
          <div className="flex items-center gap-1.5 px-1.5 py-1 bg-accent text-accent-foreground font-semibold rounded-sm cursor-default">
            <img src="/app-icon.png" alt="Depdok" className="w-3 h-3 object-contain shrink-0" />
            <span className="flex-1 truncate">Open with Depdok</span>
          </div>

          <div className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-default text-muted-foreground/90">
            <span className="w-3 h-3 flex items-center justify-center text-blue-500 font-bold font-mono text-[8px] border border-blue-500/20 rounded shrink-0">VS</span>
            <span>Open with Code</span>
          </div>

          <div className="h-[1px] bg-border my-1" />

          <div className="flex items-center justify-between px-1.5 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-default text-muted-foreground/90">
            <span>New</span>
            <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
          </div>

          <div className="px-1.5 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-default text-muted-foreground/90">
            Properties
          </div>
        </div>
      </div>
    </div>
  );
};

