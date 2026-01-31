import { atom } from 'jotai';
import { settingsService } from '@/lib/settings';

export const settingsAtom = atom(settingsService.getSettings());

// Derived atoms for specific settings
export const autoSaveEnabledAtom = atom(
  (get) => get(settingsAtom).autoSave,
  (get, set, value: boolean) => {
    const settings = { ...get(settingsAtom), autoSave: value };
    set(settingsAtom, settings);
    settingsService.updateSettings(settings);
  }
);

export const autoSaveDelayAtom = atom(
  (get) => get(settingsAtom).autoSaveDelay,
  (get, set, value: number) => {
    const settings = { ...get(settingsAtom), autoSaveDelay: value };
    set(settingsAtom, settings);
    settingsService.updateSettings(settings);
  }
);

export const viewModeSettingAtom = atom(
  (get) => get(settingsAtom).viewMode,
  (get, set, value: 'side-by-side' | 'editor-only' | 'preview-only') => {
    const settings = { ...get(settingsAtom), viewMode: value };
    set(settingsAtom, settings);
    settingsService.updateSettings(settings);
  }
);

export const themeAtom = atom(
  (get) => get(settingsAtom).theme,
  (get, set, value: 'light' | 'dark' | 'system') => {
    const settings = { ...get(settingsAtom), theme: value };
    set(settingsAtom, settings);
    settingsService.updateSettings(settings);
  }
);

export const editorThemeAtom = atom(
  (get) => get(settingsAtom).editorTheme,
  (get, set, value: string) => {
    const settings = { ...get(settingsAtom), editorTheme: value };
    set(settingsAtom, settings);
    settingsService.updateSettings(settings);
  }
);

export const plantUmlServerUrlAtom = atom(
  (get) => get(settingsAtom).plantUmlServerUrl,
  (get, set, value: string) => {
    const settings = { ...get(settingsAtom), plantUmlServerUrl: value };
    set(settingsAtom, settings);
    settingsService.updateSettings(settings);
  }
);
