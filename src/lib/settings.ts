interface AppSettings {
  autoSave: boolean;
  autoSaveDelay: number; // milliseconds
  viewMode: 'side-by-side' | 'editor-only' | 'preview-only';
}

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  autoSaveDelay: 1000,
  viewMode: 'editor-only',
};

class SettingsService {
  private readonly STORAGE_KEY = 'depdok-settings';

  getSettings(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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
