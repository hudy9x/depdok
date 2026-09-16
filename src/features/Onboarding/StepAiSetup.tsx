import { useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { Check, Clipboard } from "lucide-react";
import { Claude, OpenAI } from "@lobehub/icons";
import { ReferenceArtwork } from "./ReferenceArtwork";

type Provider = "Claude" | "OpenAI" | "OpenRouter";
type SupportedOs = "macos" | "linux" | "windows";

function normalizeOs(value: string): SupportedOs {
  if (value === "windows") return "windows";
  if (value === "linux") return "linux";
  return "macos";
}

function ProviderIcon({ provider }: { provider: Provider }): JSX.Element {
  if (provider === "Claude") return <Claude className="size-5" />;
  if (provider === "OpenAI") return <OpenAI className="size-5" />;
  return <span className="text-base font-bold">◎</span>;
}

export function StepAiSetup(): JSX.Element {
  const [tab, setTab] = useState<"ollama" | "byok">("ollama");
  const [provider, setProvider] = useState<Provider>("OpenAI");
  const [selectedOs] = useState<SupportedOs>(() => normalizeOs(platform()));
  const [copied, setCopied] = useState(false);

  const command = selectedOs === "windows"
    ? "irm https://ollama.com/install.ps1 | iex"
    : "curl -fsSL https://ollama.com/install.sh | sh";
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy Ollama command:", error);
    }
  };

  return (
    <div className="flex w-full max-w-[680px] flex-col items-center text-center">
      <ReferenceArtwork kind="ai" />
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">Step 4 of 5 · Optional</p>
      <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">
        A helpful <span className="text-primary">sidekick.</span>
      </h2>
      <p className="mt-4 max-w-[490px] text-sm leading-6 text-muted-foreground sm:text-base">
        Keep help private with Ollama, or connect a cloud provider with your own key.
      </p>

      <div className="mt-7 flex w-full max-w-[560px] gap-1 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => setTab("ollama")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === "ollama" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Ollama
        </button>
        <button type="button" onClick={() => setTab("byok")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === "byok" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Bring your own key
        </button>
      </div>

      {tab === "ollama" ? (
        <div className="mt-2 w-full max-w-[560px] p-1 text-left">
          <div className="mt-4 mx-auto w-[430px] flex items-center gap-2 rounded-xl bg-muted px-3 py-3 font-mono text-xs text-foreground">
            <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{command}</code>
            <button type="button" onClick={() => void copy()} className="shrink-0 text-primary" aria-label="Copy install command">
              {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
            </button>
          </div>
          <p className="my-4 text-center text-xs text-muted-foreground">or</p>

          <div className="mt-4 flex items-center justify-center">
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
              Download installer
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-2 w-full max-w-[560px] p-1 flex flex-col items-center">
          <div className="mt-5 flex flex-wrap gap-2">
            {(["Claude", "OpenAI", "OpenRouter"] as Provider[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setProvider(item)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${provider === item ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/25" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
              >
                <ProviderIcon provider={item} />
                {item}
              </button>
            ))}
          </div>
          <label htmlFor="api-key" className="mt-5 block text-xs font-semibold">API key</label>
          <input id="api-key" placeholder="Paste your key here" className="mt-4 w-[400px] rounded-xl text-center bg-muted px-3 py-3 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
      )}
      {/* <p className="mt-4 text-xs text-muted-foreground">You can change this later in Settings.</p> */}
    </div>
  );
}
