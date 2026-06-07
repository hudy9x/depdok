import { useEffect, useState, useMemo } from 'react';
import { useAtom } from 'jotai';
import { GitBranch, Tag, Plus, Terminal, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { workspaceRootAtom } from '@/features/FileExplorer/store';
import {
  getGitRefs,
  createBranch,
  checkoutDetached,
  switchBranch,
  GitRefInfo,
} from '@/lib/gitUtils';
import { branchSelectorOpenAtom } from './store';

type Step = 'select' | 'create-branch' | 'checkout-detached-input';

export function BranchSelectorDialog() {
  const [open, setOpen] = useAtom(branchSelectorOpenAtom);
  const [workspaceRoot] = useAtom(workspaceRootAtom);

  const [step, setStep] = useState<Step>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [refs, setRefs] = useState<GitRefInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load Git refs (branches & tags)
  const fetchRefs = async () => {
    if (!workspaceRoot) return;
    setIsLoading(true);
    try {
      const gitRefs = await getGitRefs(workspaceRoot);
      setRefs(gitRefs);
    } catch (err) {
      console.error('Error loading git refs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && workspaceRoot) {
      fetchRefs();
      setStep('select');
      setSearchQuery('');
    }
  }, [open, workspaceRoot]);

  // Handle escape / back logic on keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && step !== 'select') {
      e.preventDefault();
      e.stopPropagation();
      setStep('select');
      setSearchQuery('');
    }
  };

  // Filter local branches and tags
  const branches = useMemo(() => refs.filter((r) => r.ref_type === 'branch'), [refs]);
  const tags = useMemo(() => refs.filter((r) => r.ref_type === 'tag'), [refs]);

  // Branch name validation
  const isValidBranchName = useMemo(() => {
    if (!searchQuery) return false;
    const invalidChars = /[ ~^:?*\[\\]/;
    const doubleDot = /\.\./;
    const endsWithDot = /\.$/;
    const leadingSlash = /^\//;
    const trailingSlash = /\/$/;
    const consecutiveSlashes = /\/\//;
    const atCurly = /@\{/;

    return (
      !invalidChars.test(searchQuery) &&
      !doubleDot.test(searchQuery) &&
      !endsWithDot.test(searchQuery) &&
      !leadingSlash.test(searchQuery) &&
      !trailingSlash.test(searchQuery) &&
      !consecutiveSlashes.test(searchQuery) &&
      !atCurly.test(searchQuery)
    );
  }, [searchQuery]);

  const handleCheckoutRef = async (refName: string) => {
    if (!workspaceRoot) return;
    const toastId = toast.loading(`Checking out ${refName}...`);
    const success = await switchBranch(workspaceRoot, refName);
    if (success) {
      toast.success(`Successfully checked out ${refName}`, { id: toastId });
      setOpen(false);
    } else {
      toast.error(`Failed to checkout ${refName}`, { id: toastId });
    }
  };

  const handleCreateBranch = async (name: string) => {
    if (!workspaceRoot) return;
    const toastId = toast.loading(`Creating branch ${name}...`);
    const result = await createBranch(workspaceRoot, name);
    if (result.success) {
      toast.success(result.output || `Created and switched to branch ${name}`, { id: toastId });
      setOpen(false);
    } else {
      toast.error(`Failed to create branch: ${result.output}`, { id: toastId });
    }
  };

  const handleCheckoutDetached = async (name: string) => {
    if (!workspaceRoot) return;
    const toastId = toast.loading(`Checking out ${name} detached...`);
    const result = await checkoutDetached(workspaceRoot, name);
    if (result.success) {
      toast.success(result.output || `Checked out ${name} detached`, { id: toastId });
      setOpen(false);
    } else {
      toast.error(`Failed to checkout: ${result.output}`, { id: toastId });
    }
  };

  // Determine placeholder based on current step
  const placeholder = useMemo(() => {
    if (step === 'checkout-detached-input') {
      return 'Enter branch, tag or commit hash to checkout detached...';
    }
    return 'Select a branch or tag to checkout';
  }, [step]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      shouldFilter={step === 'select'}
      showCloseButton={false}
      title="Branch Selector"
      description="Select, create, or switch Git branches and tags"
      className="!top-12 !translate-y-0 max-w-[550px] border border-border bg-popover shadow-2xl rounded-lg overflow-hidden p-0"
    >
      <div onKeyDown={handleKeyDown} className="relative flex flex-col w-full h-full">
        {step === 'create-branch' ? (
          <div className="flex flex-col w-full">
            <input
              autoFocus
              placeholder="Branch name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isValidBranchName) {
                    handleCreateBranch(searchQuery);
                  } else if (searchQuery) {
                    toast.error('Invalid branch name format');
                  }
                } else if (e.key === 'Escape') {
                  setStep('select');
                  setSearchQuery('');
                }
              }}
              className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/45 border-b border-border/30"
            />
            <div className="px-4 py-2.5 text-[11px] text-muted-foreground/75 bg-muted/5 select-none font-sans">
              Please provide a new branch name (Press 'Enter' to confirm or 'Escape' to cancel)
            </div>
          </div>
        ) : (
          <>
            <CommandInput
              placeholder={placeholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />

            <CommandList className="max-h-[320px] overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                  <span>Loading branches & tags...</span>
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4 text-muted-foreground/60" />
                    <span>No matching references found.</span>
                  </CommandEmpty>

                  {step === 'select' && (
                    <>
                      <CommandGroup heading="Actions" className="p-1">
                        <CommandItem
                          onSelect={() => {
                            setStep('create-branch');
                            setSearchQuery('');
                          }}
                          className="cursor-pointer text-xs flex items-center gap-2 py-2 px-3 rounded-md hover:bg-accent transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold text-foreground/80">Create new branch...</span>
                        </CommandItem>
                        <CommandItem
                          onSelect={() => {
                            setStep('checkout-detached-input');
                            setSearchQuery('');
                          }}
                          className="cursor-pointer text-xs flex items-center gap-2 py-2 px-3 rounded-md hover:bg-accent transition-colors"
                        >
                          <Terminal className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold text-foreground/80">Checkout detached...</span>
                        </CommandItem>
                      </CommandGroup>

                      {branches.length > 0 && (
                        <CommandGroup heading="Branches" className="p-1 border-t border-border/10">
                          {branches.map((b) => (
                            <CommandItem
                              key={`branch-${b.name}`}
                              value={b.name}
                              onSelect={() => handleCheckoutRef(b.name)}
                              className="cursor-pointer py-2 px-3 flex items-center justify-between rounded-md hover:bg-accent transition-colors text-xs"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <GitBranch className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0 gap-0.5">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="font-medium text-foreground text-xs">{b.name}</span>
                                    <span className="text-[10px] text-muted-foreground/75 font-mono">{b.date}</span>
                                  </div>
                                  <div className="text-[10.5px] text-muted-foreground/80 font-mono truncate">
                                    <span className="font-semibold text-muted-foreground/90">{b.author}</span>
                                    {b.subject && <span className="ml-1.5 text-muted-foreground/60">• {b.subject}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground/65 bg-muted/40 px-1.5 py-0.5 rounded font-mono border border-border/20 self-center">
                                branches
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {tags.length > 0 && (
                        <CommandGroup heading="Tags" className="p-1 border-t border-border/10">
                          {tags.map((t) => (
                            <CommandItem
                              key={`tag-${t.name}`}
                              value={t.name}
                              onSelect={() => handleCheckoutRef(t.name)}
                              className="cursor-pointer py-2 px-3 flex items-center justify-between rounded-md hover:bg-accent transition-colors text-xs"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <Tag className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0 gap-0.5">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="font-medium text-foreground text-xs">{t.name}</span>
                                    <span className="text-[10px] text-muted-foreground/75 font-mono">{t.date}</span>
                                  </div>
                                  <div className="text-[10.5px] text-muted-foreground/80 font-mono truncate">
                                    <span className="font-semibold text-muted-foreground/90">{t.author}</span>
                                    {t.subject && <span className="ml-1.5 text-muted-foreground/60">• {t.subject}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground/65 bg-muted/40 px-1.5 py-0.5 rounded font-mono border border-border/20 self-center">
                                tags
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </>
                  )}

                  {step === 'checkout-detached-input' && (
                    <>
                      {searchQuery && (
                        <CommandGroup heading="Detached Checkout" className="p-1">
                          <CommandItem
                            onSelect={() => handleCheckoutDetached(searchQuery)}
                            className="cursor-pointer py-2.5 px-3 flex items-center gap-2 rounded-md hover:bg-accent transition-colors text-xs"
                          >
                            <Terminal className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-semibold text-foreground/80">
                              Checkout <span className="font-mono text-primary font-bold">{searchQuery}</span> detached
                            </span>
                          </CommandItem>
                        </CommandGroup>
                      )}

                      {branches.length > 0 && (
                        <CommandGroup heading="Existing Branches" className="p-1 border-t border-border/10">
                          {branches.map((b) => (
                            <CommandItem
                              key={`detached-branch-${b.name}`}
                              value={b.name}
                              onSelect={() => handleCheckoutDetached(b.name)}
                              className="cursor-pointer py-2 px-3 flex items-center justify-between rounded-md hover:bg-accent transition-colors text-xs"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <GitBranch className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span className="font-medium text-foreground text-xs">{b.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {tags.length > 0 && (
                        <CommandGroup heading="Existing Tags" className="p-1 border-t border-border/10">
                          {tags.map((t) => (
                            <CommandItem
                              key={`detached-tag-${t.name}`}
                              value={t.name}
                              onSelect={() => handleCheckoutDetached(t.name)}
                              className="cursor-pointer py-2 px-3 flex items-center justify-between rounded-md hover:bg-accent transition-colors text-xs"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <Tag className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                                <span className="font-medium text-foreground text-xs">{t.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </>
              )}
            </CommandList>
          </>
        )}
      </div>
    </CommandDialog>
  );
}
