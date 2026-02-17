import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { LicenseStatus, GracePeriodInfo } from '../api-client/license';
import * as licenseApi from '../api-client/license';
import { cacheLicenseStatus, getCachedLicenseStatus } from '../lib/license-cache';

// Polar.sh organization ID from environment
const POLAR_ORG_ID = import.meta.env.VITE_POLAR_ORG_ID || '';

// License state atoms
export const licenseStatusAtom = atom<LicenseStatus | null>(null);
export const gracePeriodInfoAtom = atom<GracePeriodInfo | null>(null);
export const isLoadingLicenseAtom = atom(false);
export const licenseErrorAtom = atom<string | null>(null);

// Derived atoms
export const isLicensedAtom = atom((get) => {
  const status = get(licenseStatusAtom);
  return status?.is_valid ?? false;
});

export const isInGracePeriodAtom = atom((get) => {
  const status = get(licenseStatusAtom);
  return status?.status === 'grace_period';
});

export const daysRemainingAtom = atom((get) => {
  const status = get(licenseStatusAtom);
  return status?.days_remaining ?? 0;
});

// Action atoms
export const refreshLicenseStatusAtom = atom(
  null,
  async (get, set) => {
    set(isLoadingLicenseAtom, true);
    set(licenseErrorAtom, null);

    try {
      // Try to get from backend first
      const status = await licenseApi.getLicenseStatus();
      set(licenseStatusAtom, status);

      // Cache in IndexedDB
      await cacheLicenseStatus(status);

      // Also get grace period info
      const gracePeriodInfo = await licenseApi.getGracePeriodInfo();
      set(gracePeriodInfoAtom, gracePeriodInfo);
    } catch (error) {
      console.error('Failed to refresh license status:', error);

      // Try to get from cache
      const cached = await getCachedLicenseStatus();
      if (cached) {
        set(licenseStatusAtom, cached);
      } else {
        set(licenseErrorAtom, error instanceof Error ? error.message : 'Failed to get license status');
      }
    } finally {
      set(isLoadingLicenseAtom, false);
    }
  }
);

export const activateLicenseAtom = atom(
  null,
  async (get, set, licenseKey: string) => {
    set(isLoadingLicenseAtom, true);
    set(licenseErrorAtom, null);

    try {
      // Validate license with Polar.sh
      const status = await licenseApi.validateLicense(licenseKey, POLAR_ORG_ID);

      if (!status.is_valid) {
        throw new Error('Invalid license key');
      }

      // Save to keychain
      await licenseApi.saveLicenseKey(licenseKey);

      // Update state
      set(licenseStatusAtom, status);

      // Cache in IndexedDB
      await cacheLicenseStatus(status);

      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate license';
      set(licenseErrorAtom, errorMessage);
      throw error;
    } finally {
      set(isLoadingLicenseAtom, false);
    }
  }
);

export const removeLicenseAtom = atom(
  null,
  async (get, set) => {
    set(isLoadingLicenseAtom, true);
    set(licenseErrorAtom, null);

    try {
      // Remove from keychain (also clears backend cache)
      await licenseApi.removeLicenseKey();

      // Clear IndexedDB cache
      const { clearLicenseCache } = await import('../lib/license-cache');
      await clearLicenseCache();

      // Clear state
      set(licenseStatusAtom, null);

      // Refresh to get grace period status
      await set(refreshLicenseStatusAtom);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove license';
      set(licenseErrorAtom, errorMessage);
      throw error;
    } finally {
      set(isLoadingLicenseAtom, false);
    }
  }
);

// Check if licensed (simple boolean check)
export const checkIsLicensedAtom = atom(
  null,
  async (get, set) => {
    try {
      const isLicensed = await licenseApi.isLicensed();
      return isLicensed;
    } catch (error) {
      console.error('Failed to check license:', error);
      return false;
    }
  }
);
