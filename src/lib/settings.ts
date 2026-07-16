interface AppSettings {
  autoSave: boolean;
  autoSaveDelay: number; // milliseconds
  viewMode: 'side-by-side' | 'editor-only' | 'preview-only';
  theme: 'light' | 'dark' | 'system';
  editorTheme: string;
  assetsFolder: string; // folder name for markdown assets
  plantUmlServerUrl: string; // custom PlantUML server URL (empty = use default)
  plantUmlThemeLight: string; // selected PlantUML theme in light mode
  plantUmlThemeDark: string; // selected PlantUML theme in dark mode
}

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  autoSaveDelay: 1000,
  viewMode: 'editor-only',
  theme: 'system',
  editorTheme: 'vs-dark',
  assetsFolder: '',
  plantUmlServerUrl: '',
  plantUmlThemeLight: 'default',
  plantUmlThemeDark: 'default',
};

class SettingsService {
  private readonly STORAGE_KEY = 'depdok-settings';

  getSettings(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    try {
      const parsed = JSON.parse(stored);
      // Migrate old single plantUmlTheme to dual theme settings
      if (parsed.plantUmlTheme) {
        parsed.plantUmlThemeLight = parsed.plantUmlThemeLight || parsed.plantUmlTheme;
        parsed.plantUmlThemeDark = parsed.plantUmlThemeDark || parsed.plantUmlTheme;
        delete parsed.plantUmlTheme;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  updateSettings(settings: Partial<AppSettings>) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  resetSettings() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const settingsService = new SettingsService();
export type { AppSettings };
