export interface UserProfile {
  name: string;
  avatar: string;
  onboarded: boolean;
}

export interface AvatarPreset {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  colorClass: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'developer', label: 'Developer', emoji: '💻', bg: '#DCE7FB', colorClass: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100' },
  { id: 'writer',    label: 'Writer',    emoji: '✒️', bg: '#DCEFE1', colorClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' },
  { id: 'rocket',    label: 'Rocket',    emoji: '🚀', bg: '#F6E3EC', colorClass: 'bg-pink-100 text-pink-900 dark:bg-pink-900/40 dark:text-pink-100' },
  { id: 'sparkles',  label: 'Sparkles',  emoji: '✨', bg: '#FBEAD2', colorClass: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' },
  { id: 'ninja',     label: 'Ninja',     emoji: '🥷', bg: '#F6DCDF', colorClass: 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100' },
  { id: 'cat',       label: 'Cat',       emoji: '🐱', bg: '#E4E1FB', colorClass: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100' },
];

const PROFILE_STORAGE_KEY = 'depdok-user-profile';
const ONBOARDED_STORAGE_KEY = 'depdok-onboarded';
const LEGACY_COMMENT_NAME_KEY = 'depdok-comment-username';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  avatar: 'writer',
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
        name: parsed.name ?? (legacyName || DEFAULT_PROFILE.name),
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

    if (updates.name !== undefined) {
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
