import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { getCliInfo, installCli, uninstallCli } from '@/api-client/cli';

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
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Command Line Interface</Label>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Install the <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">depdok</code> command to open files or folders in Depdok directly from your terminal.
        </p>
        {cliPath && (
          <p className="text-[11px] text-muted-foreground/80 mt-1 leading-relaxed">
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
  );
};

