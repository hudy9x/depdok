import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type MarkdownEditorSize = "full" | "wide" | "small";

interface MarkdownSizeControlProps {
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
}

const SizeSmallIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="8" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 9H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SizeMediumIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 9H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SizeLargeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 9H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const sizes: { label: string; value: MarkdownEditorSize; icon: React.ReactNode }[] = [
  {
    label: "Small (default)",
    value: "small",
    icon: <SizeSmallIcon className="h-3.5 w-3.5" />,
  },
  {
    label: "Wide",
    value: "wide",
    icon: <SizeMediumIcon className="h-3.5 w-3.5" />,
  },
  {
    label: "Full width",
    value: "full",
    icon: <SizeLargeIcon className="h-3.5 w-3.5" />,
  },
];

export function MarkdownSizeControl({ size, onSizeChange }: MarkdownSizeControlProps) {
  return (
    <TooltipProvider>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-full border border-border bg-background/80 backdrop-blur-sm px-1.5 py-1 shadow-md">
        {sizes.map((s, i) => (
          <Tooltip key={s.value}>
            <TooltipTrigger asChild>
              <Button
                variant={size === s.value ? "secondary" : "ghost"}
                size="icon"
                className={`h-7 w-7 ${i === 0 ? "rounded-l-full" : ""} ${i === sizes.length - 1 ? "rounded-r-full" : ""}`}
                onClick={() => onSizeChange(s.value)}
                aria-label={s.label}
              >
                {s.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{s.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
