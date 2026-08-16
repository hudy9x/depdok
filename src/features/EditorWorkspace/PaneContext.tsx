import * as React from 'react';
import type { ViewMode } from '@/stores/PaneStore';

export interface PaneContextValue {
  paneId: string;
  filePath: string;
  viewMode: ViewMode;
}

export const PaneContext = React.createContext<PaneContextValue | null>(null);

export function usePaneContext(): PaneContextValue | null {
  return React.useContext(PaneContext);
}
