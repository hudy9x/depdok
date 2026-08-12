export interface UserProfile {
  name: string;
  avatar: string;
  onboarded: boolean;
}

export interface AvatarPreset {
  id: string;
  label: string;
  emoji: string;
  colorClass: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'avatar-1', label: 'Developer', emoji: '💻', colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { id: 'avatar-2', label: 'Writer', emoji: '✍️', colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { id: 'avatar-3', label: 'Rocket', emoji: '🚀', colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { id: 'avatar-4', label: 'Sparkles', emoji: '✨', colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { id: 'avatar-5', label: 'Ninja', emoji: '🥷', colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  { id: 'avatar-6', label: 'Cat', emoji: '🐱', colorClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
];

const PROFILE_STORAGE_KEY = 'depdok-user-profile';
const ONBOARDED_STORAGE_KEY = 'depdok-onboarded';
const LEGACY_COMMENT_NAME_KEY = 'depdok-comment-username';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Developer',
  avatar: 'avatar-1',
  onboarded: false,
};

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const onboarded = localStorage.getItem(ONBOARDED_STORAGE_KEY) === 'true';
    const legacyName = localStorage.getItem(LEGACY_COMMENT_NAME_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || legacyName || DEFAULT_PROFILE.name,
        avatar: parsed.avatar || DEFAULT_PROFILE.avatar,
        onboarded: parsed.onboarded ?? onboarded,
      };
    }

    return {
      ...DEFAULT_PROFILE,
      name: legacyName || DEFAULT_PROFILE.name,
      onboarded,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveUserProfile(updates: Partial<UserProfile>): UserProfile {
  try {
    const current = getUserProfile();
    const updated: UserProfile = { ...current, ...updates };

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));

    if (updates.onboarded !== undefined) {
      localStorage.setItem(ONBOARDED_STORAGE_KEY, String(updates.onboarded));
    }

    if (updates.name) {
      localStorage.setItem(LEGACY_COMMENT_NAME_KEY, updates.name);
    }

    return updated;
  } catch (err) {
    console.error('Failed to save user profile:', err);
    return { ...DEFAULT_PROFILE, ...updates };
  }
}

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboarded(status: boolean = true): void {
  saveUserProfile({ onboarded: status });
}
