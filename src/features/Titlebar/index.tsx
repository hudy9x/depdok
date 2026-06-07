import { useEffect, useState } from 'react';
import { platform } from '@tauri-apps/plugin-os';
import { WindowsTitlebar } from './WindowsTitlebar';
import { MacOSTitlebar } from './MacOSTitlebar';

export function Titlebar() {
  const [currentPlatform, setCurrentPlatform] = useState<string>('');

  useEffect(() => {
    const getPlatform = async () => {
      const platformName = platform();
      setCurrentPlatform(platformName);
    };

    getPlatform();
  }, []);

  if (!currentPlatform) {
    return null;
  }

  if (currentPlatform === 'macos') {
    return <MacOSTitlebar />;
  }

  return <WindowsTitlebar />;
}
