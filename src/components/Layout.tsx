import { ReactNode } from 'react';
import { Titlebar } from '@/features/Titlebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-layout-chrome text-foreground select-none">
      {/* Header - fixed overlay titlebar */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <Titlebar />
      </div>

      {/* Body - takes full height */}
      <main className="h-full w-full relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}