import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// Popover open/close state
export const licensePopoverOpenAtom = atom(false);

// Track if user has dismissed the popover (persisted to localStorage)
export const licensePopoverDismissedAtom = atomWithStorage('license-popover-dismissed', false);

// Action to show popover (respects dismissed state)
export const showLicensePopoverAtom = atom(
  null,
  (_get, set) => {
    const dismissed = _get(licensePopoverDismissedAtom);
    if (!dismissed) {
      set(licensePopoverOpenAtom, true);
    }
  }
);

// Action to dismiss popover (sets both closed and dismissed)
export const dismissLicensePopoverAtom = atom(
  null,
  (_get, set) => {
    set(licensePopoverOpenAtom, false);
    set(licensePopoverDismissedAtom, true);
  }
);

// Action to reset dismissed state (for testing or when user wants to see it again)
export const resetPopoverDismissedAtom = atom(
  null,
  (_get, set) => {
    set(licensePopoverDismissedAtom, false);
  }
);
