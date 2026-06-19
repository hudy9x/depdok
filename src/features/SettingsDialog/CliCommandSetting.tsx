import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { getCliInfo, installCli, uninstallCli } from '@/api-client/cli';

const FakeTerminal = (): JSX.Element => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  // Simulation sequence
  useEffect(() => {
    let isMounted = true;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const typeCommand = async (text: string) => {
      for (let i = 0; i <= text.length; i++) {
        if (!isMounted) return;
        setCurrentInput(text.slice(0, i));
        // Simulate slightly variable human typing speed
        await delay(50 + Math.random() * 50);
      }
    };

    const runLoop = async () => {
      while (isMounted) {
        // Step 1: Initial pause
        setLines([]);
        setCurrentInput('');
        await delay(1000);

        // Step 2: Type command to open a directory
        if (!isMounted) return;
        await typeCommand('depdok ./my-project');
        await delay(600);
        
        if (!isMounted) return;
        // Press Enter: add typed command to lines history, reset current input
        setLines(prev => [...prev, '$ depdok ./my-project']);
        setCurrentInput('');
        await delay(200);

        // Show output: opening directory
        if (!isMounted) return;
        setLines(prev => [
          ...prev,
          '🚀 Opening folder "./my-project" in Depdok...',
          '✨ Connected workspace successfully.'
        ]);
        await delay(2500);

        // Clear terminal for the next command demo
        if (!isMounted) return;
        setLines([]);
        setCurrentInput('');
        await delay(500);

        // Step 3: Type command to open a file
        if (!isMounted) return;
        await typeCommand('depdok README.md');
        await delay(600);

        if (!isMounted) return;
        // Press Enter
        setLines(prev => [...prev, '$ depdok README.md']);
        setCurrentInput('');
        await delay(200);

        // Show output: opening file
        if (!isMounted) return;
        setLines(prev => [
          ...prev,
          '📄 Opening file "README.md" in editor...',
          '✨ Opened README.md.'
        ]);
        await delay(3500);
      }
    };

    runLoop();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full bg-[#0c0c0e] border border-zinc-800 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl font-mono text-[11px] select-none text-left">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="text-[10px] text-zinc-400 font-medium font-sans">zsh</span>
        <div className="w-10" />
      </div>

      {/* Terminal Screen */}
      <div className="p-4 space-y-2 h-[155px] overflow-y-auto scrollbar-none text-zinc-300">
        {lines.map((line, i) => {
          let lineClass = "text-zinc-400";
          if (line.startsWith('$')) {
            lineClass = "text-zinc-100 font-medium";
          } else if (line.startsWith('✨')) {
            lineClass = "text-emerald-400 font-semibold";
          } else if (line.startsWith('🚀') || line.startsWith('📄')) {
            lineClass = "text-blue-400 dark:text-blue-400/90";
          }
          return (
            <div key={i} className={lineClass}>
              {line}
            </div>
          );
        })}
        
        {/* Cursor / Typing input line */}
        <div className="flex items-center text-zinc-100">
          <span className="text-zinc-500 mr-2">$</span>
          <span>{currentInput}</span>
          <span className={cn("w-1.5 h-3.5 bg-zinc-200 ml-0.5", showCursor ? "opacity-100" : "opacity-0")} />
        </div>
      </div>
    </div>
  );
};

export const CliCommandSetting = (): JSX.Element => {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [cliPath, setCliPath] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchStatus = async (): Promise<void> => {
      try {
        const info = await getCliInfo();
        setIsInstalled(info.is_installed);
        setCliPath(info.cli_path);
      } catch (err) {
        console.error('Failed to check CLI status:', err);
      }
    };
    fetchStatus();
  }, []);

  const handleInstall = async (): Promise<void> => {
    setLoading(true);
    try {
      await installCli();
      setIsInstalled(true);
      toast.success("Command-line tool 'depdok' installed successfully!");
      if (window.navigator.userAgent.indexOf('Windows') !== -1) {
        toast.info('Please restart your terminal to reload environmental variables.', {
          duration: 6000,
        });
      }
    } catch (err) {
      console.error('Failed to install CLI:', err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async (): Promise<void> => {
    setLoading(true);
    try {
      await uninstallCli();
      setIsInstalled(false);
      toast.success("Command-line tool 'depdok' removed from PATH.");
    } catch (err) {
      console.error('Failed to uninstall CLI:', err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-8 items-start">
      {/* Left Column: Info & Actions */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Command Line Interface</Label>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Install the <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">depdok</code> command to open files or folders in Depdok directly from your terminal.
          </p>
          {cliPath && (
            <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
              Target directory: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] border border-border font-mono">{cliPath}</code>
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isInstalled === null ? (
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          ) : isInstalled ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-green-500 font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Installed in PATH
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={handleUninstall}
                className="text-destructive hover:text-destructive cursor-pointer text-xs"
              >
                Uninstall Command
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleInstall}
              className="cursor-pointer text-xs"
            >
              Install 'depdok' in PATH
            </Button>
          )}
        </div>
      </div>

      {/* Right Column: Fake Terminal */}
      <div className="w-full">
        <FakeTerminal />
      </div>
    </div>
  );
};


