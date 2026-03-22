import { SyncStorage } from 'jotai/vanilla/utils/atomWithStorage';

export const sessionStorageDriver: SyncStorage<any> = {
  getItem: (key, initialValue) => {
    try {
      const storedValue = sessionStorage.getItem(key);
      if (storedValue !== null) {
        return JSON.parse(storedValue);
      }
      return initialValue;
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  },
  setItem: (key, newValue) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  },
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing sessionStorage key "${key}":`, error);
    }
  },
};
