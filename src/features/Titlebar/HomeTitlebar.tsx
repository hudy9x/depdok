import { useEffect, useState } from 'react';
import { platform } from '@tauri-apps/plugin-os';
import { MacOSButtons } from './MacOSButtons';
import { WindowsButtons } from './WindowsButtons';
import { TitlebarContainer } from './TitlebarContainer';

export function HomeTitlebar() {
  const [currentPlatform, setCurrentPlatform] = useState<string>('');

  useEffect(() => {
    const getPlatform = async () => {
      const platformName = platform();
      setCurrentPlatform(platformName);
    };

    getPlatform();
  }, []);

  if (!currentPlatform) {
    return <div className="h-[35px] w-full bg-layout-chrome shrink-0" data-tauri-drag-region />;
  }

  return (
    <TitlebarContainer showBorder={false}>
      {currentPlatform === 'macos' ? (
        <div data-tauri-drag-region="false" className="flex items-center pl-3 h-full">
          <MacOSButtons />
        </div>
      ) : (
        <div />
      )}

      {currentPlatform !== 'macos' ? (
        <div data-tauri-drag-region="false" className="flex items-center h-full">
          <WindowsButtons />
        </div>
      ) : (
        <div />
      )}
    </TitlebarContainer>
  );
}
