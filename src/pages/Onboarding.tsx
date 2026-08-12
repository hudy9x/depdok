import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai';
import { useTheme } from 'next-themes';
import { HomeTitlebar } from '@/features/Titlebar';
import { settingsService } from '@/lib/settings';
import {
  getUserProfile,
  saveUserProfile,
  setOnboarded,
} from '@/lib/userProfile';
import { openFolderDialog } from '@/features/FileExplorer/api';
import { openWorkspaceAtom } from '@/features/FileExplorer/store';
import { createUntitledTabAtom, tabsAtom } from '@/stores/TabStore';

import { type OnboardingStep, ONBOARDING_STEPS } from '@/features/Onboarding/types';
import { OnboardingSidebar } from '@/features/Onboarding/OnboardingSidebar';
import { StepProfile } from '@/features/Onboarding/StepProfile';
import { StepTheme } from '@/features/Onboarding/StepTheme';
import { StepGetStarted } from '@/features/Onboarding/StepGetStarted';

export default function Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [step, setStep] = useState<OnboardingStep>(0);
  const initialProfile = getUserProfile();
  const [userName, setUserName] = useState(initialProfile.name || '');
  const [selectedAvatarId, setSelectedAvatarId] = useState(
    initialProfile.avatar || 'writer'
  );

  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const createUntitledTab = useSetAtom(createUntitledTabAtom);
  const tabs = useAtomValue(tabsAtom);

  const handleSelectAvatar = (id: string) => {
    setSelectedAvatarId(id);
    saveUserProfile({ name: userName.trim(), avatar: id });
  };

  const handleNameChange = (val: string) => {
    setUserName(val);
    saveUserProfile({ name: val, avatar: selectedAvatarId });
  };

  const handleSelectTheme = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme);
    settingsService.updateSettings({ theme: selectedTheme });
  };

  const handleNext = () => {
    saveUserProfile({ name: userName.trim(), avatar: selectedAvatarId });
    if (step < 2) setStep((s) => (s + 1) as OnboardingStep);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => (s - 1) as OnboardingStep);
  };

  const handleOpenFolder = async () => {
    try {
      saveUserProfile({ name: userName.trim(), avatar: selectedAvatarId });
      setOnboarded(true);
      const folderPath = await openFolderDialog();
      if (folderPath) {
        await openWorkspace(folderPath);
        navigate('/editor');
      } else {
        navigate('/home');
      }
    } catch (error) {
      console.error('Failed to open folder during onboarding:', error);
      navigate('/home');
    }
  };

  const handleStartWriting = () => {
    saveUserProfile({ name: userName.trim(), avatar: selectedAvatarId });
    setOnboarded(true);
    if (tabs.length === 0) {
      createUntitledTab('Untitled.md');
    }
    navigate('/editor');
  };

  const currentStepItem = ONBOARDING_STEPS[step];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-layout-chrome text-foreground">
      <HomeTitlebar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-[1040px] bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-5 min-h-[580px]">
            {/* Left Steps Navigation Sidebar */}
            <OnboardingSidebar currentStep={step} onSelectStep={setStep} />

            {/* Right Step Content Panel */}
            <div className="md:col-span-3 bg-muted/40 p-6 sm:p-8 flex flex-col justify-between min-h-[520px]">
              <div className="flex-1 flex flex-col">
                {/* Step Counter Badge & Title */}
                <p className="text-xs font-semibold tracking-wide text-primary uppercase mb-1.5">
                  Step {step + 1} of 3
                </p>
                <h2 className="text-2xl font-bold text-foreground leading-tight mb-1">
                  {currentStepItem.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {currentStepItem.desc}
                </p>

                {/* Dynamic Step Component */}
                {step === 0 && (
                  <StepProfile
                    userName={userName}
                    selectedAvatarId={selectedAvatarId}
                    onNameChange={handleNameChange}
                    onSelectAvatar={handleSelectAvatar}
                    onNext={handleNext}
                  />
                )}

                {step === 1 && (
                  <StepTheme
                    userName={userName}
                    selectedAvatarId={selectedAvatarId}
                    currentTheme={theme}
                    onSelectTheme={handleSelectTheme}
                    onBack={handleBack}
                    onNext={handleNext}
                  />
                )}

                {step === 2 && (
                  <StepGetStarted
                    userName={userName}
                    selectedAvatarId={selectedAvatarId}
                    onBack={handleBack}
                    onOpenFolder={handleOpenFolder}
                    onStartWriting={handleStartWriting}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
