// import './App.css';

import { BrowserRouter, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from "@/components/ui/sonner"
import { settingsService } from '@/lib/settings';
import { isOnboarded } from '@/lib/userProfile';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Checking from './pages/Checking';
import Onboarding from './pages/Onboarding';
import { Layout } from './components/Layout';
import Empty from './pages/Empty';
import { AppMenuListener } from './components/AppMenuListener';
import { CLIListener } from './components/CLIListener';
import { LicensePopover } from './features/LicensePopover';
import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { refreshLicenseStatusAtom } from './stores/license';
import { useSyncRecentFoldersToDock } from './hooks/useSyncRecentFoldersToDock';
import { useProjectStateSync } from './hooks/useProjectStateSync';
import { LLMChatPanel } from './features/LLMChat';
import { LLMChat2Panel } from './features/LLMChat2';

function LayoutRoute() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (!isOnboarded() && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function App() {
  const savedTheme = settingsService.getSettings().theme;
  const refreshLicenseStatus = useSetAtom(refreshLicenseStatusAtom);
  useSyncRecentFoldersToDock();
  useProjectStateSync();

  // Check license status on app startup
  useEffect(() => {
    refreshLicenseStatus();
  }, [refreshLicenseStatus]);

  return (
    <ThemeProvider attribute="class" defaultTheme={savedTheme} enableSystem>
      <>
        <BrowserRouter>
          <OnboardingGuard>
            <AppMenuListener />
            <CLIListener />
            <Toaster position="bottom-right" richColors />
            <LicensePopover />
            <LLMChatPanel />
            <LLMChat2Panel />
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<LayoutRoute />}>
                <Route path="/" element={<Checking />} />
                <Route path="/editor" element={<Editor />} />
                <Route path="/empty" element={<Empty />} />
              </Route>
            </Routes>
          </OnboardingGuard>
        </BrowserRouter>
      </>
    </ThemeProvider>
  );
}

export default App;
