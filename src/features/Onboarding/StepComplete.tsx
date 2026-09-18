import { Check, FolderOpen, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface StepCompleteProps {
  name: string;
  avatar: string;
  theme: string;
  folder: string;
  onClose: () => void;
}

export function StepComplete({
  name,
  avatar,
  theme,
  folder,
  onClose,
}: StepCompleteProps): JSX.Element {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    const timeout = window.setTimeout(onClose, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onClose]);

  return (
    <div className="flex w-full max-w-[620px] flex-col items-center text-center">
      <img
        src="/complete.png"
        alt="Setup complete"
        className="mb-5 h-36 w-56 object-contain"
      />
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">
        All tucked in
      </p>
      <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">
        Your desk is
        <br />
        <span className="text-primary">ready.</span>
      </h2>
      <p className="mt-5 max-w-[430px] text-sm leading-6 text-muted-foreground sm:text-base">
        Welcome,{" "}
        <strong className="text-foreground">
          {name.split(" ")[0] || "there"}
        </strong>
        . Depdok is set up and waiting for your first note.
      </p>
      <div className="mt-8 w-full max-w-[500px] space-y-3 rounded-2xl border border-border bg-card p-4 text-left text-card-foreground">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
          </span>
          Profile saved as <strong>{avatar}</strong>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          Reading room set to <strong>{theme}</strong>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <FolderOpen className="h-4 w-4" />
          </span>
          Watching <strong className="font-mono text-xs">{folder}</strong>
        </div>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Opening your workspace in {countdown}{" "}
        {countdown === 1 ? "second" : "seconds"}.
      </p>
      <Button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-xl px-8 py-3.5"
      >
        Close
      </Button>
    </div>
  );
}
