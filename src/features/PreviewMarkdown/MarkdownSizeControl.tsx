import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MarkdownEditorSize = "full" | "wide" | "small" | "page";

interface MarkdownSizeControlProps {
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
  className?: string;
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

const SizePageIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 7H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 10.5H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 14H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  {
    label: "Page",
    value: "page",
    icon: <SizePageIcon className="h-3.5 w-3.5" />,
  },
];

export function MarkdownSizeControl({ size, onSizeChange, className }: MarkdownSizeControlProps) {
  return (
    <TooltipProvider>
      <div className={className || "absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-full border border-border bg-background/80 backdrop-blur-sm px-1.5 py-1 shadow-md"}>
        {sizes.map((s, i) => (
          <Tooltip key={s.value}>
            <TooltipTrigger asChild>
              <Button
                variant={size === s.value ? "secondary" : "ghost"}
                size="icon"
                className={`h-7 w-7 ${i === sizes.length - 1 ? "rounded-r-full !rounded-l-md" : ""}`}
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

/** Size control dropdown for container query collapsed view (< 859px) */
export function MarkdownSizeDropdown({
  size,
  onSizeChange,
}: {
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeSize = sizes.find((s) => s.value === size) || sizes[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="flex items-center gap-0.5 p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title={`Editor size: ${activeSize.label}`}
        >
          {activeSize.icon}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-36 p-1 flex flex-col gap-0.5 bg-popover/95 backdrop-blur-md border border-border shadow-md"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        {sizes.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              onSizeChange(s.value);
              setOpen(false);
            }}
            className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 transition-colors ${
              size === s.value ? "bg-accent font-medium text-accent-foreground" : "text-foreground"
            }`}
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

