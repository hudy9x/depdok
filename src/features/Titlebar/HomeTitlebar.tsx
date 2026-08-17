import { MacOSButtons } from './MacOSButtons';
import { WindowsButtons } from './WindowsButtons';
import { TitlebarContainer } from './TitlebarContainer';
import { usePlatform } from '@/lib/platform';

export function HomeTitlebar() {
  const { isMacOS } = usePlatform();

  return (
    <TitlebarContainer showBorder={false}>
      {isMacOS ? (
        <div data-tauri-drag-region="false" className="flex items-center pl-3 h-full">
          <MacOSButtons />
        </div>
      ) : (
        <div />
      )}

      {/* Center Section: Transparent drag area */}
      <div 
        data-tauri-drag-region 
        className="flex-1 min-w-0 h-full"
      />

      {!isMacOS ? (
        <div data-tauri-drag-region="false" className="flex items-center h-full">
          <WindowsButtons />
        </div>
      ) : (
        <div />
      )}
    </TitlebarContainer>
  );
}
