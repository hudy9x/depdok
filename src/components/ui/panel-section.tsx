import React, { ReactElement, ReactNode, createContext, useContext, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface PanelConfig {
  minWidth: number;
  maxWidth: number;
}

interface PanelSectionContextType {
  panelSizes: Record<string, number>;
  isDragging: boolean;
  storageKey?: string;
  registerPanel: (id: string, initialWidth: number, config: PanelConfig) => void;
  startResize: (e: React.MouseEvent, targetId: string, direction?: "left" | "right") => void;
}

const PanelSectionContext = createContext<PanelSectionContextType | null>(null);

export function usePanelSection(): PanelSectionContextType {
  const context = useContext(PanelSectionContext);
  if (!context) {
    throw new Error("PanelSection children must be used within a PanelSectionGroup");
  }
  return context;
}

// 1. PanelSectionGroup Parent Container
interface PanelSectionGroupProps {
  children: ReactNode;
  storageKey?: string;
  className?: string;
}

export function PanelSectionGroup({ children, storageKey, className }: PanelSectionGroupProps): ReactElement {
  const [panelSizes, setPanelSizes] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined" && storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse panel layout sizes", e);
        }
      }
    }
    return {};
  });

  const [isDragging, setIsDragging] = useState(false);
  const panelConfigsRef = useRef<Record<string, PanelConfig>>({});

  const registerPanel = (id: string, initialWidth: number, config: PanelConfig) => {
    panelConfigsRef.current[id] = config;
    setPanelSizes((prev) => {
      if (prev[id] !== undefined) return prev;
      return { ...prev, [id]: initialWidth };
    });
  };

  const startResize = (e: React.MouseEvent, targetId: string, direction: "left" | "right" = "right") => {
    e.preventDefault();
    setIsDragging(true);

    const config = panelConfigsRef.current[targetId] || { minWidth: 100, maxWidth: 500 };
    const startX = e.clientX;
    const startWidth = panelSizes[targetId] ?? config.minWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Invert delta if resizing a panel that grows to the left (e.g. a right sidebar)
      const adjustedDelta = direction === "left" ? -deltaX : deltaX;
      const newWidth = Math.max(config.minWidth, Math.min(config.maxWidth, startWidth + adjustedDelta));
      setPanelSizes((prev) => ({ ...prev, [targetId]: newWidth }));
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);

      const deltaX = upEvent.clientX - startX;
      const adjustedDelta = direction === "left" ? -deltaX : deltaX;
      const finalWidth = Math.max(config.minWidth, Math.min(config.maxWidth, startWidth + adjustedDelta));
      
      setPanelSizes((prev) => {
        const updated = { ...prev, [targetId]: finalWidth };
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        return updated;
      });

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <PanelSectionContext.Provider
      value={{
        panelSizes,
        isDragging,
        storageKey,
        registerPanel,
        startResize,
      }}
    >
      <div className={cn("flex-grow h-full min-w-0 flex relative", className)}>
        {children}
        {isDragging && (
          <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto bg-transparent" />
        )}
      </div>
    </PanelSectionContext.Provider>
  );
}

// 2. PanelSectionItem
interface PanelSectionItemProps {
  id?: string;
  children: ReactNode;
  visible?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  flex?: number | string;
  className?: string;
}

export function PanelSectionItem({
  id,
  children,
  visible = true,
  minWidth = 180,
  maxWidth = 400,
  defaultWidth = 240,
  flex,
  className,
}: PanelSectionItemProps): ReactElement | null {
  const { panelSizes, storageKey, registerPanel } = usePanelSection();

  // If flex is set, this behaves as a fluid pane taking dynamic remaining space
  if (flex !== undefined) {
    return (
      <div style={{ flex }} className={cn("min-w-0 h-full flex flex-col", className)}>
        {children}
      </div>
    );
  }

  const panelId = id || "default-panel";

  // Read initial size synchronously on first render to prevent layout shift before useEffect mounts
  const getInitialWidth = (): number => {
    if (typeof window !== "undefined" && storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const map = JSON.parse(saved);
          if (map && typeof map[panelId] === "number") {
            return Math.max(minWidth, Math.min(maxWidth, map[panelId]));
          }
        } catch {}
      }
    }
    return defaultWidth;
  };

  useEffect(() => {
    registerPanel(panelId, getInitialWidth(), { minWidth, maxWidth });
  }, [panelId, minWidth, maxWidth]);

  if (!visible) return null;

  const currentWidth = panelSizes[panelId] ?? getInitialWidth();

  return (
    <div
      style={{ width: `${currentWidth}px` }}
      className={cn("h-full shrink-0", className)}
    >
      {children}
    </div>
  );
}

// 3. PanelSectionHandle
interface PanelSectionHandleProps {
  targetId: string;
  visible?: boolean;
  resizeDirection?: "left" | "right";
  className?: string;
}

export function PanelSectionHandle({
  targetId,
  visible = true,
  resizeDirection = "right",
  className,
}: PanelSectionHandleProps): ReactElement | null {
  const { startResize } = usePanelSection();

  if (!visible) return null;

  return (
    <div
      onMouseDown={(e) => startResize(e, targetId, resizeDirection)}
      className={cn(
        "w-1 cursor-col-resize shrink-0 select-none relative z-10",
        className
      )}
    />
  );
}
