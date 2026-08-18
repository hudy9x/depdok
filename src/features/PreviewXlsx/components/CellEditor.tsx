import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Check, X, Sparkles } from 'lucide-react';
import { CellStyle } from '../core/types';
import {
  formatDateToPattern,
  hasTimeFormat,
  isDateOrTimeFormat,
  parseDateValue,
} from '../core/numberFormatter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CellEditorProps {
  initialValue: string;
  position: { top: number; left: number; width: number; height: number };
  style?: CellStyle;
  numFmt?: string;
  onChange: (val: string) => void;
  onCommit: (direction?: 'down' | 'up' | 'right' | 'left') => void;
  onCancel: () => void;
}

export const CellEditor: React.FC<CellEditorProps> = ({
  initialValue,
  position,
  style = {},
  numFmt,
  onChange,
  onCommit,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDateType = useMemo(() => isDateOrTimeFormat(numFmt), [numFmt]);
  const isTimeType = useMemo(() => hasTimeFormat(numFmt), [numFmt]);

  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(() => isDateType);

  // Parse initial date
  const initialParsedDate = useMemo(() => {
    const parsed = parseDateValue(initialValue);
    return parsed || new Date();
  }, [initialValue]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialParsedDate);
  const [hours, setHours] = useState<number>(() => initialParsedDate.getHours());
  const [minutes, setMinutes] = useState<number>(() => initialParsedDate.getMinutes());
  const [seconds, setSeconds] = useState<number>(() => initialParsedDate.getSeconds());

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'up' : 'down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const applyDateTime = (newDate: Date, newH = hours, newM = minutes, newS = seconds) => {
    const combined = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      newH,
      newM,
      newS
    );
    setSelectedDate(combined);
    setHours(newH);
    setMinutes(newM);
    setSeconds(newS);

    const formatted = formatDateToPattern(combined, numFmt || 'YYYY-MM-DD');
    onChange(formatted);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    applyDateTime(date, hours, minutes, seconds);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    val = Math.max(0, Math.min(23, val));
    applyDateTime(selectedDate, val, minutes, seconds);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    val = Math.max(0, Math.min(59, val));
    applyDateTime(selectedDate, hours, val, seconds);
  };

  const handleSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    val = Math.max(0, Math.min(59, val));
    applyDateTime(selectedDate, hours, minutes, val);
  };

  const handleSetToday = () => {
    const now = new Date();
    applyDateTime(now, now.getHours(), now.getMinutes(), now.getSeconds());
  };

  const handleSetNow = () => {
    const now = new Date();
    applyDateTime(now, now.getHours(), now.getMinutes(), now.getSeconds());
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-30 bg-background shadow-md border-2 border-primary overflow-visible flex items-center"
      style={{
        top: `${position.top - 1}px`,
        left: `${position.left - 1}px`,
        minWidth: `${position.width + 2}px`,
        height: `${position.height + 2}px`,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={initialValue}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!isPickerOpen) {
            onCommit();
          }
        }}
        className={cn(
          'w-full h-full px-1.5 py-0 border-none outline-none text-xs leading-none',
          style.bgColor && style.bgColor !== 'transparent' ? '' : 'bg-background text-foreground'
        )}
        style={{
          fontWeight: style.bold ? 'bold' : 'normal',
          fontStyle: style.italic ? 'italic' : 'normal',
          textDecoration: style.underline ? 'underline' : style.strike ? 'line-through' : 'none',
          textAlign: style.align || 'left',
          backgroundColor: style.bgColor || 'var(--background)',
          color: style.color ? style.color : (style.bgColor && style.bgColor !== 'transparent') ? '#000000' : 'inherit',
          fontSize: style.fontSize ? `${style.fontSize}px` : '12px',
          fontFamily: style.fontFamily || 'inherit',
        }}
      />

      {/* DatePicker Popover Anchor & Trigger */}
      <Popover
        open={isPickerOpen}
        onOpenChange={(open) => {
          setIsPickerOpen(open);
          if (!open) {
            inputRef.current?.focus();
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsPickerOpen((prev) => !prev)}
            title={isTimeType ? 'Pick Date & Time' : 'Pick Date'}
            className={cn(
              'h-full px-1 flex items-center justify-center cursor-pointer transition-colors shrink-0',
              isDateType ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground/40 hover:text-foreground hover:bg-muted'
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-auto p-3 z-[9999] bg-popover text-popover-foreground border border-border shadow-xl rounded-lg select-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => {
            setIsPickerOpen(false);
            onCommit();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/70 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <CalendarIcon className="w-3.5 h-3.5 text-primary" />
              <span>{isTimeType ? 'Select Date & Time' : 'Select Date'}</span>
            </div>
            {numFmt && (
              <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                {numFmt}
              </span>
            )}
          </div>

          {/* Calendar Picker */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="p-0"
          />

          {/* Time Picker Controls (if DateTime or Time format) */}
          {isTimeType && (
            <div className="mt-3 pt-2.5 border-t border-border/70">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-medium">Time:</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Hours */}
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={String(hours).padStart(2, '0')}
                      onChange={handleHourChange}
                      className="w-10 h-7 text-center text-xs font-mono bg-muted/50 border border-input rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      title="Hour (0-23)"
                    />
                    <span className="text-[9px] text-muted-foreground">HH</span>
                  </div>
                  <span className="font-bold text-xs pb-3">:</span>

                  {/* Minutes */}
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={String(minutes).padStart(2, '0')}
                      onChange={handleMinuteChange}
                      className="w-10 h-7 text-center text-xs font-mono bg-muted/50 border border-input rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      title="Minute (0-59)"
                    />
                    <span className="text-[9px] text-muted-foreground">MM</span>
                  </div>

                  {/* Seconds */}
                  <span className="font-bold text-xs pb-3">:</span>
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={String(seconds).padStart(2, '0')}
                      onChange={handleSecondChange}
                      className="w-10 h-7 text-center text-xs font-mono bg-muted/50 border border-input rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      title="Second (0-59)"
                    />
                    <span className="text-[9px] text-muted-foreground">SS</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between gap-1.5 mt-3 pt-2 border-t border-border/70">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSetToday}
                className="h-6 text-[11px] px-2"
              >
                Today
              </Button>
              {isTimeType && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetNow}
                  className="h-6 text-[11px] px-2 gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5 text-primary" />
                  Now
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                setIsPickerOpen(false);
                onCommit();
              }}
              className="h-6 text-[11px] px-2.5 gap-1"
            >
              <Check className="w-3 h-3" />
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
