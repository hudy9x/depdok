import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ColorTheme {
  bg: string;
  border: string;
  color: string;
}

interface ColorSelectorProps {
  currentColor?: string;
  onColorChange: (color: string | undefined) => void;
  editable: boolean;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  purple: {
    bg: '#6647f0',
    border: '#5940C5',
    color: '#fff',
  },
  neonblue: {
    bg: '#3e63dd',
    border: '#3350B3',
    color: '#fff',
  },
  azureblue: {
    bg: '#0091ff',
    border: '#0976CE',
    color: '#fff',
  },
  teal: {
    bg: '#12a594',
    border: '#108678',
    color: '#fff',
  },
  greeen: {
    bg: '#30a46c',
    border: '#298557',
    color: '#fff',
  },
  yellow: {
    bg: '#ffc53d',
    border: '#CEA032',
    color: '#fff',
  },
  orange: {
    bg: '#f76808',
    border: '#C8540B',
    color: '#fff',
  },
  red: {
    bg: '#e5484d',
    border: '#B93B3F',
    color: '#fff',
  },
  pink: {
    bg: '#e93d82',
    border: '#BD3169',
    color: '#fff',
  },
  violet: {
    bg: '#ab4aba',
    border: '#8A3D97',
    color: '#fff',
  },
  brown: {
    bg: '#a18072',
    border: '#82675C',
    color: '#fff',
  },
  gray: {
    bg: '#8d8d8d',
    border: '#727272',
    color: '#fff',
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
    className="w-4 h-4 cursor-pointer p-1 rounded-md hover:border-foreground transition-colors shrink-0"
    style={{
      backgroundColor: currentColor || '#ffffff',
      // borderColor: getThemeByBg(currentColor)?.border || '#e5e7eb'
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
        <div className="grid grid-cols-6 gap-2">
          {presetColors.map((theme) => (
            <button
              key={theme.bg}
              className="w-5 h-5 cursor-pointer rounded hover:border-foreground transition-colors"
              style={{
                backgroundColor: theme.bg,
              }}
              onClick={() => onColorChange(theme.bg)}
              aria-label={`Set color theme`}
            />
          ))}
          {/* White/Reset option */}
          <button
            className="w-5 h-5 cursor-pointer rounded border-1 border-border hover:border-foreground transition-colors"
            style={{ backgroundColor: '#ffffff' }}
            onClick={() => onColorChange(undefined)}
            aria-label="Reset color"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
