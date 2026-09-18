import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { HomeTitlebar } from "@/features/Titlebar";
import { openFolderDialog } from "@/features/FileExplorer/api";
import { openWorkspaceAtom } from "@/features/FileExplorer/store";
import { StepAiSetup } from "@/features/Onboarding/StepAiSetup";
import { StepAvatar } from "@/features/Onboarding/StepAvatar";
import { StepComplete } from "@/features/Onboarding/StepComplete";
import { StepFolder } from "@/features/Onboarding/StepFolder";
import { StepName } from "@/features/Onboarding/StepName";
import { StepTheme } from "@/features/Onboarding/StepTheme";
import type { OnboardingStep } from "@/features/Onboarding/types";
import { settingsService } from "@/lib/settings";
import { getUserProfile, saveUserProfile, setOnboarded } from "@/lib/userProfile";

export default function Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const [step, setStep] = useState<OnboardingStep>(0);
  const [name, setName] = useState(getUserProfile().name);
  const [avatar, setAvatar] = useState(getUserProfile().avatar || "writer");
  const [folder, setFolder] = useState("~/Documents/Depdok");
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const isFinishing = useRef(false);
  const save = (nextName = name, nextAvatar = avatar): void => { saveUserProfile({ name: nextName.trim(), avatar: nextAvatar }); };
  const next = (): void => { save(); setStep((value) => Math.min(6, value + 1) as OnboardingStep); };
  const back = (): void => setStep((value) => Math.max(0, value - 1) as OnboardingStep);
  const chooseFolder = async (): Promise<void> => { try { const selected = await openFolderDialog(); if (!selected) return; setFolderPath(selected); setFolder(selected); setStep(6); } catch (error) { console.error("Failed to choose onboarding folder:", error); } };
  const finishOnboarding = useCallback((): void => { if (!folderPath || isFinishing.current) return; isFinishing.current = true; saveUserProfile({ name: name.trim(), avatar }); setOnboarded(true); void openWorkspace(folderPath).then(() => navigate("/editor")).catch((error: unknown) => { console.error("Failed to open onboarding workspace:", error); navigate("/home"); }); }, [avatar, folderPath, name, navigate, openWorkspace]);
  const selectTheme = (value: "light" | "dark" | "system"): void => { setTheme(value); settingsService.updateSettings({ theme: value }); };
  const chapterFor = (screen: number): number => screen <= 2 ? 0 : screen === 3 ? 1 : screen === 4 ? 2 : 3;
  const showProgress = step > 0 && step < 6;
  const doneChapter = (chapter: number): boolean => showProgress && chapter < chapterFor(step);

  return <div className="min-h-[100dvh] w-full bg-card text-foreground"><HomeTitlebar /><main className="flex min-h-[calc(100dvh-40px)] items-center justify-center p-3 sm:p-6 md:p-8"><section className="relative flex min-h-[calc(100dvh-64px)] w-full max-w-[1220px] flex-col overflow-hidden rounded-[30px] bg-card md:min-h-[760px]"><header className={`relative z-10 flex items-center justify-center px-5 py-5 sm:px-8 md:px-10 md:py-7 ${showProgress ? "" : "invisible"}`}><div className="flex w-32 gap-1.5 sm:w-40 md:w-48" aria-label="Setup progress">{["Profile", "Look", "Assistant", "Folder"].map((label, index) => <button key={label} type="button" disabled={!doneChapter(index)} onClick={() => doneChapter(index) && setStep((index === 0 ? 1 : index === 1 ? 3 : index === 2 ? 4 : 5) as OnboardingStep)} aria-label={label} className={`h-2 min-w-7 flex-1 rounded-full transition ${doneChapter(index) || (showProgress && chapterFor(step) === index) ? "bg-primary shadow-[0_3px_8px_rgba(215,107,74,.2)]" : "bg-muted"}`} />)}</div></header><div className="relative flex flex-1 items-center justify-center px-5 pb-4 sm:px-8 md:px-10"><div className="flex w-full justify-center">{step === 0 && <div className="flex w-full max-w-[620px] flex-col items-center text-center"><img src="/app-icon.png" alt="Depdok" className="mb-8 size-28 object-contain sm:size-28" /><p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">Welcome to Depdok</p><h1 className="mt-3 text-[38px] font-bold leading-[.98] tracking-[-.06em] sm:text-[48px]">A calmer place<br />for <span className="text-primary">documentation.</span></h1><p className="mt-5 max-w-[420px] text-sm leading-6 text-muted-foreground sm:text-base">Let’s set up your little corner of the docs. It takes about two minutes.</p><Button onClick={next} className="mt-8 rounded-xl px-8 py-3.5 shadow-[0_8px_18px_rgba(215,107,74,.22)]">Let’s get started <span>→</span></Button></div>}{step === 1 && <StepName name={name} onChange={(value) => { setName(value); save(value, avatar); }} onNext={next} />}{step === 2 && <StepAvatar selectedAvatarId={avatar} onSelectAvatar={(value) => { setAvatar(value); save(name, value); }} />}{step === 3 && <StepTheme currentTheme={theme} onSelectTheme={selectTheme} />}{step === 4 && <StepAiSetup />}{step === 5 && <StepFolder onChoose={() => void chooseFolder()} />}{step === 6 && <StepComplete name={name} avatar={({ developer: "Software Engineer", writer: "Product Manager", rocket: "DevOps Engineer", sparkles: "UX/UI Designer", ninja: "QA Engineer", cat: "Business Analyst" }[avatar] ?? avatar)} theme={theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"} folder={folder} onClose={finishOnboarding} />}</div></div><footer className={`relative z-10 flex items-center justify-between px-5 pb-5 sm:px-8 md:px-10 md:pb-8 ${step === 0 || step === 6 ? "invisible" : ""}`}><button type="button" onClick={back} className="px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground">← Back</button><Button type="button" onClick={step === 5 ? () => void chooseFolder() : next} className="ml-auto rounded-xl px-6 py-3.5 shadow-[0_8px_18px_rgba(215,107,74,.22)]">{step === 4 ? "Continue" : step === 5 ? "Choose folder" : "Continue"} <span>→</span></Button></footer></section></main></div>;
}
