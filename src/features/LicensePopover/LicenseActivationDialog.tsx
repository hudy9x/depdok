import { useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { BadgeCheck, BadgeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    if (!licenseKey.trim()) return;

    try {
      await activateLicense(licenseKey.trim());
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGracePeriod ? (
              <>
                <BadgeCheck className="h-6 w-6 text-green-600" />
                Welcome to Depdok!
              </>
            ) : (
              <>
                <BadgeX className="h-6 w-6 text-red-600" />
                Trial Ended
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isGracePeriod ? (
              <span>You have {daysLeft} {daysLeft === 1 ? 'day' : 'days'} of full access!</span>
            ) : (
              <span>Enter your license key to unlock premium features</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="license-key">License Key</Label>
              {import.meta.env.DEV && (
                <span className="text-xs text-muted-foreground">
                  Dev: test-key-12345
                </span>
              )}
            </div>
            <Input
              id="license-key"
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleActivate();
                }
              }}
              disabled={isLoading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleActivate}
            disabled={isLoading || !licenseKey.trim()}
          >
            {isLoading ? 'Validating...' : 'Activate'}
          </Button>
          <Button variant="outline">
            <a href="https://buy.polar.sh/polar_cl_U3UBP2JYQwZI8so7QUvd6JcCMKr1ie6Fr9THW3I1T7m" target="_blank">
              Buy License
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
