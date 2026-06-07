import { useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  gracePeriodInfoAtom,
  activateLicenseAtom,
  isLoadingLicenseAtom,
  licenseErrorAtom,
} from '@/stores/license';

interface LicenseActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGracePeriod: boolean;
}

export function LicenseActivationDialog({ open, onOpenChange, isGracePeriod }: LicenseActivationDialogProps) {
  const gracePeriodInfo = useAtomValue(gracePeriodInfoAtom);
  const isLoading = useAtomValue(isLoadingLicenseAtom);
  const error = useAtomValue(licenseErrorAtom);
  const activateLicense = useSetAtom(activateLicenseAtom);

  const [licenseKey, setLicenseKey] = useState('');

  const handleActivate = async () => {
    const trimmedLicenseKey = licenseKey.trim();
    if (!trimmedLicenseKey) return;

    try {
      await activateLicense(trimmedLicenseKey);
      setLicenseKey('');

      // Close dialog immediately and show success toast
      onOpenChange(false);
      toast.success('License activated successfully!');
    } catch (err) {
      // Show error toast
      toast.error(error || 'Failed to activate license');
    }
  };

  const daysLeft = gracePeriodInfo?.days_remaining ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-layout-content overflow-hidden border-0 p-0 sm:max-w-[430px]">
        <DialogHeader className="relative overflow-hidden bg-gradient-to-b from-[#f5c5a3] via-[#fddfce] to-white px-6 pb-3 pt-8 text-center">
          <div className="pointer-events-none absolute left-4 top-[-52px] h-[220%] w-[3px] rotate-[24deg] bg-white/25" />
          <div className="pointer-events-none absolute left-16 top-[-44px] h-[210%] w-[2px] rotate-[24deg] bg-white/20" />
          <div className="pointer-events-none absolute right-10 top-[-40px] h-[220%] w-[2px] rotate-[24deg] bg-white/20" />
          <div className="pointer-events-none absolute right-4 top-[-52px] h-[220%] w-[3px] rotate-[24deg] bg-white/20" />

          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#b46432]/25" />

          <div className="relative z-10 mb-5 flex justify-center">
            <div className="flex p-0.5 items-center justify-center rounded-[18px] bg-white/30 backdrop-blur-xs shadow-[0_10px_28px_rgba(180,80,30,0.3)]">
              <img src="/app-icon.png" alt="Depdok app icon" className="h-16 w-16 object-contain" />
            </div>
          </div>

          <DialogTitle className="relative z-10 text-center text-[34px] font-semibold tracking-tight text-[#3d1f0a]">
            {isGracePeriod ? 'Welcome to Pro' : 'Upgrade to Pro'}
          </DialogTitle>
          <DialogDescription className="relative z-10 mt-1 text-center text-base leading-relaxed text-muted-foreground">
            {isGracePeriod
              ? `You have ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} of full access. Activate your key to keep all features unlocked.`
              : 'Unlock all premium features and continue your workflow without limits.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-3">
          <div className="space-y-2">
            {/* <div className="flex items-center justify-between">
              <Label
                htmlFor="license-key"
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
              >
                License key
              </Label>
              {import.meta.env.DEV && (
                <span className="text-xs text-muted-foreground">Dev: test-key-12345</span>
              )}
            </div> */}

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="license-key"
                type="text"
                placeholder="Paste your license key here"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleActivate();
                  }
                }}
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
                aria-invalid={Boolean(error)}
                className={error
                  ? 'h-14 rounded-[22px] border-red-500 bg-transparent pl-12 text-lg tracking-[0.1em] placeholder:text-slate-300 focus-visible:ring-red-500/40'
                  : 'h-14 rounded-[22px] border-border bg-transparent pl-12 text-lg tracking-[0.1em] placeholder:text-slate-300 focus-visible:ring-[#d97757]/25'}
              />
            </div>
          </div>


          {error && (
            <div className="text-red-400 text-xs text-center">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-1 gap-2.5 px-6 pb-6 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={handleActivate}
            disabled={isLoading || !licenseKey.trim()}
            className="h-[50px] rounded-[22px] border-[#f2b792] bg-transparent text-base font-semibold text-[#c05f38] hover:bg-[#d97757]/10 hover:text-[#9a5535]"
          >
            {isLoading ? 'Validating...' : 'Activate key'}
          </Button>

          <Button
            asChild
            className="h-[50px] rounded-[22px] border-0 bg-[#de7a4f] text-base font-semibold text-white hover:bg-[#cf6c43]"
          >
            <a
              href="https://buy.polar.sh/polar_cl_U3UBP2JYQwZI8so7QUvd6JcCMKr1ie6Fr9THW3I1T7m"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              Get License Key
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
