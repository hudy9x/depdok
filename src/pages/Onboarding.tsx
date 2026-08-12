import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai';
import { useTheme } from 'next-themes';
import {
  User,
  Palette,
  Folder,
  ArrowRight,
  ArrowLeft,
  Check,
  Sun,
  Moon,
  Laptop,
  Edit3,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { HomeTitlebar } from '@/features/Titlebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { settingsService } from '@/lib/settings';
import {
  getUserProfile,
  saveUserProfile,
  setOnboarded,
  AVATAR_PRESETS,
} from '@/lib/userProfile';
import { openFolderDialog } from '@/features/FileExplorer/api';
import { openWorkspaceAtom } from '@/features/FileExplorer/store';
import { createUntitledTabAtom, tabsAtom } from '@/stores/TabStore';

export default function Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const initialProfile = getUserProfile();
  const [userName, setUserName] = useState(initialProfile.name || 'Developer');
  const [selectedAvatar, setSelectedAvatar] = useState(
    initialProfile.avatar || 'avatar-1'
  );

  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const createUntitledTab = useSetAtom(createUntitledTabAtom);
  const tabs = useAtomValue(tabsAtom);

  const handleProfileNext = () => {
    const trimmedName = userName.trim() || 'Developer';
    saveUserProfile({ name: trimmedName, avatar: selectedAvatar });
    setStep(2);
  };

  const handleSelectTheme = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme);
    settingsService.updateSettings({ theme: selectedTheme });
  };

  const handleThemeNext = () => {
    saveUserProfile({ name: userName.trim() || 'Developer', avatar: selectedAvatar });
    setStep(3);
  };

  const handleOpenFolder = async () => {
    try {
      saveUserProfile({ name: userName.trim() || 'Developer', avatar: selectedAvatar });
      setOnboarded(true);
      const folderPath = await openFolderDialog();
      if (folderPath) {
        await openWorkspace(folderPath);
        navigate('/editor');
      } else {
        // If user cancelled folder picker, navigate to home or editor
        navigate('/home');
      }
    } catch (error) {
      console.error('Failed to open folder during onboarding:', error);
      toast.error('Failed to open folder');
    }
  };

  const handleStartWriting = () => {
    saveUserProfile({ name: userName.trim() || 'Developer', avatar: selectedAvatar });
    setOnboarded(true);
    if (tabs.length === 0) {
      createUntitledTab('Untitled.md');
    }
    navigate('/editor');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-layout-chrome">
      <HomeTitlebar />

      <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-xl flex flex-col items-center">
          {/* Header Badge & Title */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to Depdok</span>
          </div>

          {/* Progress Indicator */}
          <div className="w-full max-w-sm flex items-center justify-between mb-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
              style={{
                width: step === 1 ? '0%' : step === 2 ? '50%' : '100%',
              }}
            />

            {/* Step Nodes */}
            {[
              { num: 1, label: 'Profile', icon: User },
              { num: 2, label: 'Theme', icon: Palette },
              { num: 3, label: 'Get Started', icon: Folder },
            ].map(({ num, label, icon: Icon }) => (
              <div
                key={num}
                className="relative z-10 flex flex-col items-center gap-1.5"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${
                    step >= num
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {step > num ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    step >= num ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Step 1: Profile Setup */}
          {step === 1 && (
            <Card className="w-full p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 border-border shadow-lg">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-foreground">Set Up Your Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Your name and avatar will be displayed in document comments.
                </p>
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Your Name</label>
                <Input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name..."
                  className="h-10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleProfileNext();
                  }}
                />
              </div>

              {/* Avatar Grid */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Choose an Avatar</label>
                <div className="grid grid-cols-3 gap-3">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = selectedAvatar === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedAvatar(preset.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                            : 'border-border bg-card hover:border-border/80 hover:bg-accent/40'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border ${preset.colorClass}`}
                        >
                          {preset.emoji}
                        </div>
                        <span className="text-xs font-medium text-foreground truncate">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleProfileNext} className="gap-2">
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2: Theme Selection */}
          {step === 2 && (
            <Card className="w-full p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 border-border shadow-lg">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-foreground">Choose Your Theme</h2>
                <p className="text-sm text-muted-foreground">
                  Select how Depdok looks to customize your reading & editing experience.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
                  { id: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
                  { id: 'system', label: 'System', icon: Laptop, desc: 'Match OS setting' },
                ].map(({ id, label, icon: Icon, desc }) => {
                  const isSelected = theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectTheme(id as 'light' | 'dark' | 'system')}
                      className={`flex flex-col items-center justify-center p-5 rounded-xl border gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-border bg-card hover:border-border/80 hover:bg-accent/40'
                      }`}
                    >
                      <div className={`p-3 rounded-full ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
                <Button onClick={handleThemeNext} className="gap-2">
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 3: Get Started */}
          {step === 3 && (
            <Card className="w-full p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 border-border shadow-lg text-center">
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <Folder className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">You're All Set!</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Open a documentation folder to start organizing your Markdown files, or jump straight into writing a document.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button size="lg" onClick={handleOpenFolder} className="gap-2.5">
                  <Folder className="w-5 h-5" />
                  <span>Open Folder to Get Started</span>
                </Button>

                <Button size="lg" variant="outline" onClick={handleStartWriting} className="gap-2.5">
                  <Edit3 className="w-5 h-5" />
                  <span>Start Writing Immediately</span>
                </Button>
              </div>

              <div className="pt-2 flex justify-start">
                <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
