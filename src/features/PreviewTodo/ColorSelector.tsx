import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ColorTheme {
  bg: string;
  border: string;
  shadow: string;
}

interface ColorSelectorProps {
  currentColor?: string;
  onColorChange: (color: string | undefined) => void;
  editable: boolean;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  red: {
    bg: '#fbc8c0',
    border: '#f87171',
    shadow: '#fca5a5',
  },
  orange: {
    bg: '#f0d194',
    border: '#fb923c',
    shadow: '#fdba74',
  },
  purple: {
    bg: '#e9e1fa',
    border: '#c084fc',
    shadow: '#d8b4fe',
  },
  peach: {
    bg: '#ffece2',
    border: '#fbbf24',
    shadow: '#fcd34d',
  },
  green: {
    bg: '#e7f5ea',
    border: '#4ade80',
    shadow: '#86efac',
  },
  blue: {
    bg: '#e5f4fb',
    border: '#60a5fa',
    shadow: '#93c5fd',
  },
};

// Helper to get theme by bg color
export function getThemeByBg(bgColor?: string): ColorTheme | undefined {
  if (!bgColor) return undefined;
  return Object.values(COLOR_THEMES).find(theme => theme.bg === bgColor);
}

export function ColorSelector({ currentColor, onColorChange, editable }: ColorSelectorProps) {
  const presetColors = Object.values(COLOR_THEMES);

  const view = <button
    className="w-5 h-5 cursor-pointer rounded border-2 hover:border-foreground transition-colors shrink-0"
    style={{
      backgroundColor: currentColor || '#ffffff',
      borderColor: getThemeByBg(currentColor)?.border || '#e5e7eb'
    }}
    aria-label="Change section color"
  />

  if (!editable) {
    return view;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {view}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-3 gap-2">
          {presetColors.map((theme) => (
            <button
              key={theme.bg}
              className="w-10 h-10 rounded border-2 hover:border-foreground transition-colors"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border
              }}
              onClick={() => onColorChange(theme.bg)}
              aria-label={`Set color theme`}
            />
          ))}
          {/* White/Reset option */}
          <button
            className="w-10 h-10 rounded border-2 border-border hover:border-foreground transition-colors"
            style={{ backgroundColor: '#ffffff' }}
            onClick={() => onColorChange(undefined)}
            aria-label="Reset color"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
