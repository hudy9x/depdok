import { ReferenceArtwork } from "./ReferenceArtwork";

export function StepName({ name, onChange, onNext }: { name: string; onChange: (name: string) => void; onNext: () => void }): JSX.Element {
  return (
    <div className="flex w-full max-w-[620px] flex-col items-center text-center">
      <ReferenceArtwork kind="name" />
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d76b4a]">Step 1 of 5 · Your name</p>
      <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">What should we<br /><span className="text-[#d76b4a]">call you?</span></h2>
      <p className="mt-5 max-w-[420px] text-sm leading-6 text-[#79757b] sm:text-base">This is how your teammates will see you in shared docs.</p>
      <label htmlFor="onboarding-name" className="sr-only">Your name</label>
      <input id="onboarding-name" value={name} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onNext()} placeholder="Your Name Here" autoFocus className="mt-8 h-auto w-full max-w-[480px] !border-0 !bg-transparent px-3 py-2 text-center text-4xl font-bold tracking-[-.04em] !shadow-none outline-none placeholder:text-[#b9b6b9] focus-visible:ring-0 sm:text-5xl" />
    </div>
  );
}
