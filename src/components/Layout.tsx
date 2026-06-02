import { ReactNode } from 'react';
import { Titlebar } from '@/features/Titlebar';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-layout-chrome text-foreground select-none">
      {/* Header - fixed height custom titlebar */}
      <Titlebar />

      {/* Body - takes remaining vertical space */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        {children}
      </main>

      {/* Footer - fixed height interactive status bar */}
      <Footer />
    </div>
  );
}