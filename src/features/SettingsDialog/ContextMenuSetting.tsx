import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import {
  checkContextMenuStatus,
  registerContextMenu,
  unregisterContextMenu,
} from '@/api-client/contextMenu';

export const ContextMenuSetting = (): JSX.Element => {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchStatus = async (): Promise<void> => {
      try {
        const status = await checkContextMenuStatus();
        setIsEnabled(status);
      } catch (err) {
        console.error('Failed to check context menu status:', err);
      }
    };
    fetchStatus();
  }, []);

  const handleToggle = async (checked: boolean): Promise<void> => {
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

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="context-menu" className="text-sm font-medium">Windows Explorer Integration</Label>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Show Depdok in Windows Explorer right-click context menu for files and folders.
        </p>
      </div>

      <div className="flex items-center">
        {isEnabled === null ? (
          <div className="h-6 w-10 bg-muted animate-pulse rounded-full" />
        ) : (
          <Switch
            id="context-menu"
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
};
