import { FolderOpen } from "lucide-react";

export function StepFolder({ onChoose }: { onChoose: () => void }): JSX.Element {
  return <div
    className="flex w-full max-w-[650px] flex-col items-center text-center">
    <img src="/document-shelf.png" alt="" aria-hidden="true" className="mx-auto mb-5 h-36 w-56 object-contain" />
    <p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">Step 5 of 5 · Your folder</p>
    <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">Where should your<br /><span className="text-primary">docs live?</span></h2>
    <p className="mt-5 max-w-[450px] text-sm leading-6 text-muted-foreground sm:text-base">Choose the documentation folder you want to work in.</p>
    <button type="button" onClick={onChoose}
      className="mt-9 flex w-full max-w-[360px] cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-5 text-left text-muted-foreground transition hover:border-primary">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-xl"><FolderOpen className="h-5 w-5" /></span><span><span className="block text-sm font-semibold">Choose another folder to get started</span><span className="mt-1 block text-xs">A local folder on this computer</span></span></button>
  </div>;
}
