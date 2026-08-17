import { useEffect, useState } from 'react';
import { platform, type Platform } from '@tauri-apps/plugin-os';

function getDebugPlatformOverride(): Platform | null {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('debug_platform') || (window as unknown as { __DEPDOK_PLATFORM__?: Platform }).__DEPDOK_PLATFORM__;
    if (override && (override === 'windows' || override === 'macos' || override === 'linux')) {
      return override as Platform;
    }
  }
  return null;
}

/**
 * Returns the current platform synchronously with a safe fallback.
 * Checks for debug override (localStorage 'debug_platform') first in development.
 */
export function getPlatform(): Platform | 'macos' {
  const override = getDebugPlatformOverride();
  if (override) {
    return override;
  }

  try {
    return platform();
  } catch {
    return 'macos';
  }
}

/**
 * Synchronous check whether the current OS is macOS.
 */
export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

/**
 * Synchronous check whether the current OS is Windows.
 */
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Synchronous check whether the current OS is Linux.
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * Set platform override for testing in dev mode.
 * e.g. setDebugPlatform('windows') or setDebugPlatform(null) to reset.
 */
export function setDebugPlatform(p: Platform | null) {
  if (typeof window === 'undefined') return;
  if (p) {
    localStorage.setItem('debug_platform', p);
  } else {
    localStorage.removeItem('debug_platform');
  }
  window.dispatchEvent(new Event('depdok-platform-changed'));
}

// Expose on window in dev for convenient console switching
if (typeof window !== 'undefined') {
  (window as unknown as { setPlatform?: typeof setDebugPlatform }).setPlatform = setDebugPlatform;
}

/**
 * React hook to get reactive platform information.
 */
export function usePlatform() {
  const [currentPlatform, setCurrentPlatform] = useState<string>(() => getPlatform());

  useEffect(() => {
    const update = () => setCurrentPlatform(getPlatform());
    window.addEventListener('depdok-platform-changed', update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener('depdok-platform-changed', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return {
    platform: currentPlatform,
    isMacOS: currentPlatform === 'macos',
    isWindows: currentPlatform === 'windows',
    isLinux: currentPlatform === 'linux',
    setDebugPlatform,
  };
}
