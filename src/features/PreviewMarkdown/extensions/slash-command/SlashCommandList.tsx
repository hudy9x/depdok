import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { SlashCommandItem } from './slashCommandItems';

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export interface SlashCommandListProps extends SuggestionProps<SlashCommandItem> {
  items: SlashCommandItem[];
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    useEffect(() => {
      if (scrollContainerRef.current) {
        const activeElement = scrollContainerRef.current.querySelector<HTMLElement>(
          `[data-index="${selectedIndex}"]`
        );
        if (activeElement) {
          activeElement.scrollIntoView({ block: 'nearest' });
        }
      }
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev <= 0 ? props.items.length - 1 : prev - 1));
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev >= props.items.length - 1 ? 0 : prev + 1));
          return true;
        }

        if (event.key === 'Enter') {
          if (props.items.length > 0) {
            selectItem(selectedIndex);
            return true;
          }
        }

        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="w-64 p-3 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-2xl text-xs text-muted-foreground text-center">
          No matching commands
        </div>
      );
    }

    // Group items by category if not filtering or preserve list index
    return (
      <div
        ref={scrollContainerRef}
        className="w-72 max-h-80 overflow-y-auto p-1.5 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-2xl text-popover-foreground flex flex-col gap-0.5 select-none custom-scroller"
        style={{ scrollbarWidth: 'thin' }}
      >
        {props.items.map((item, index) => {
          const isSelected = index === selectedIndex;
          const Icon = item.icon;
          const isFirstInGroup =
            index === 0 || props.items[index - 1].group !== item.group;

          return (
            <React.Fragment key={item.id}>
              {isFirstInGroup && (
                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                  {item.group}
                </div>
              )}
              <button
                type="button"
                data-index={index}
                onClick={() => selectItem(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-accent text-accent-foreground font-medium shadow-xs'
                    : 'text-foreground hover:bg-accent/60'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs leading-snug truncate">{item.title}</span>
                  <span
                    className={`text-[11px] leading-tight truncate ${
                      isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {item.subtext}
                  </span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

SlashCommandList.displayName = 'SlashCommandList';
