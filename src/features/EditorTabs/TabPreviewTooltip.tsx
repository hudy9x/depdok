import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useAtomValue } from 'jotai';
import { tabPreviewsAtom } from '@/stores/TabPreviewStore';
import { activeTabIdAtom } from '@/stores/TabStore';
import type { Tab } from '@/stores/TabStore';

interface TabPreviewTooltipProps {
  tab: Tab;
  children: React.ReactNode;
}

export function TabPreviewTooltip({ tab, children }: TabPreviewTooltipProps) {
  const previews = useAtomValue(tabPreviewsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const previewDataUrl = previews[tab.id];

  const isActive = tab.id === activeTabId;

  // Don't show tooltip if tab is active or if we don't have a preview yet
  if (isActive || !previewDataUrl) {
    return <>{children}</>;
  }

  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="bottom"
            sideOffset={5}
            className="z-50 overflow-hidden rounded-md border border-border shadow-lg bg-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 p-1"
          >
            <div className="w-[300px] rounded-sm border border-border/50 overflow-hidden relative" style={{ height: '220px' }}>
              <img
                src={previewDataUrl}
                alt={`Preview of ${tab.fileName}`}
                className="w-full h-auto absolute top-[-10px] left-0 object-cover"
              />
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
