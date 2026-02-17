import { invoke } from '@tauri-apps/api/core';

export interface LicenseStatus {
  is_valid: boolean;
  status: 'grace_period' | 'licensed' | 'expired' | 'invalid';
  days_remaining?: number;
  customer_email?: string;
  expires_at?: string;
}

export interface GracePeriodInfo {
  is_in_grace_period: boolean;
  days_since_installation: number;
  days_remaining: number;
}

/**
 * Validate a license key with Polar.sh
 */
export async function validateLicense(key: string, orgId: string): Promise<LicenseStatus> {
  return await invoke<LicenseStatus>('validate_license', { key, orgId });
}

/**
 * Get current license status
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  return await invoke<LicenseStatus>('get_license_status');
}

/**
 * Save license key to system keychain
 */
export async function saveLicenseKey(key: string): Promise<void> {
  return await invoke<void>('save_license_key', { key });
}

/**
 * Remove license key from system keychain
 */
export async function removeLicenseKey(): Promise<void> {
  return await invoke<void>('remove_license_key');
}

/**
 * Check if user is licensed (has valid license OR in grace period)
 */
export async function isLicensed(): Promise<boolean> {
  return await invoke<boolean>('is_licensed');
}

/**
 * Get grace period information
 */
export async function getGracePeriodInfo(): Promise<GracePeriodInfo> {
  return await invoke<GracePeriodInfo>('get_grace_period_info');
}
