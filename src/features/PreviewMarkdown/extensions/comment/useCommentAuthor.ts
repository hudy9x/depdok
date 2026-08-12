import { useState, useEffect } from 'react';
import {
  getUserProfile,
  saveUserProfile,
  AVATAR_PRESETS,
  type AvatarPreset,
} from '@/lib/userProfile';

export function getSavedCommentAuthor(): string {
  return getUserProfile().name;
}

export function saveCommentAuthor(name: string): void {
  saveUserProfile({ name });
}

export function useCommentAuthor() {
  const [profile, setProfile] = useState(getUserProfile);

  useEffect(() => {
    const handleStorage = () => {
      setProfile(getUserProfile());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setAuthor = (newAuthor: string) => {
    const updated = saveUserProfile({ name: newAuthor });
    setProfile(updated);
  };

  const setAvatar = (newAvatar: string) => {
    const updated = saveUserProfile({ avatar: newAvatar });
    setProfile(updated);
  };

  const preset: AvatarPreset =
    AVATAR_PRESETS.find((p) => p.id === profile.avatar) || AVATAR_PRESETS[0];

  return [profile.name, setAuthor, profile.avatar, preset, setAvatar] as const;
}
