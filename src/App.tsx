// import './App.css';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from "@/components/ui/sonner"
import { settingsService } from '@/lib/settings';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Checking from './pages/Checking';
import { Layout } from './components/Layout';
import Empty from './pages/Empty';
import { AppMenuListener } from './components/AppMenuListener';

function App() {
  const savedTheme = settingsService.getSettings().theme;

  return (
    <ThemeProvider attribute="class" defaultTheme={savedTheme} enableSystem>
      <>
        <BrowserRouter>
          <AppMenuListener />
          <Layout>
            <Toaster position="bottom-right" richColors />
            <Routes>
              <Route path="/" element={<Checking />} />
              <Route path="/home" element={<Home />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/empty" element={<Empty />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </>
    </ThemeProvider>
  );
}

export default App;
