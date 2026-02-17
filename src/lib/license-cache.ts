import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LicenseStatus } from '../api-client/license';

interface LicenseCacheDB extends DBSchema {
  license: {
    key: string;
    value: {
      status: LicenseStatus;
      cachedAt: number;
    };
  };
}

const DB_NAME = 'depdok-license';
const STORE_NAME = 'license';
const CACHE_KEY = 'current_license';

let dbPromise: Promise<IDBPDatabase<LicenseCacheDB>> | null = null;

function getDB(): Promise<IDBPDatabase<LicenseCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LicenseCacheDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Cache license status in IndexedDB
 */
export async function cacheLicenseStatus(status: LicenseStatus): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, {
      status,
      cachedAt: Date.now(),
    }, CACHE_KEY);
  } catch (error) {
    console.error('Failed to cache license status:', error);
  }
}

/**
 * Get cached license status from IndexedDB
 */
export async function getCachedLicenseStatus(): Promise<LicenseStatus | null> {
  try {
    const db = await getDB();
    const cached = await db.get(STORE_NAME, CACHE_KEY);

    if (!cached) {
      return null;
    }

    return cached.status;
  } catch (error) {
    console.error('Failed to get cached license status:', error);
    return null;
  }
}

/**
 * Clear license cache
 */
export async function clearLicenseCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear license cache:', error);
  }
}
