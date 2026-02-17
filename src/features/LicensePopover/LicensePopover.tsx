import { useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  licenseStatusAtom,
  gracePeriodInfoAtom,
  activateLicenseAtom,
  removeLicenseAtom,
  isLoadingLicenseAtom,
  licenseErrorAtom,
} from '@/stores/license';
import {
  licensePopoverOpenAtom,
  dismissLicensePopoverAtom,
} from '@/stores/license-popover';

export function LicensePopover() {
  const [open, setOpen] = useAtom(licensePopoverOpenAtom);
  const licenseStatus = useAtomValue(licenseStatusAtom);
  const gracePeriodInfo = useAtomValue(gracePeriodInfoAtom);
  const isLoading = useAtomValue(isLoadingLicenseAtom);
  const error = useAtomValue(licenseErrorAtom);
  const activateLicense = useSetAtom(activateLicenseAtom);
  const removeLicense = useSetAtom(removeLicenseAtom);
  const dismissPopover = useSetAtom(dismissLicensePopoverAtom);

  const [licenseKey, setLicenseKey] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;

    try {
      await activateLicense(licenseKey.trim());
      setShowSuccess(true);
      setLicenseKey('');

      // Auto-close after 3 seconds
      setTimeout(() => {
        setOpen(false);
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      // Error is handled by the atom
    }
  };

  const handleRemove = async () => {
    if (confirm('Are you sure you want to remove your license?')) {
      try {
        await removeLicense();
        // Close the dialog after successful removal
        setOpen(false);
      } catch (err) {
        // Error is handled by the atom
      }
    }
  };

  const handleDismiss = () => {
    dismissPopover();
  };

  // Don't render if no status yet
  if (!licenseStatus) {
    return null;
  }

  // Licensed view
  if (showSuccess || licenseStatus.status === 'licensed') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Activated!
            </DialogTitle>
            {licenseStatus.customer_email && (
              <DialogDescription>
                Licensed to: {licenseStatus.customer_email}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={isLoading}
            >
              Remove License
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Grace period or expired view
  const isGracePeriod = licenseStatus.status === 'grace_period';
  const daysLeft = gracePeriodInfo?.days_remaining ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGracePeriod ? (
              <>
                <span className="text-2xl">🎉</span>
                Welcome to Depdok!
              </>
            ) : (
              <>
                <span className="text-2xl">⚠️</span>
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
            className=""
          >
            {isLoading ? 'Validating...' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open('https://polar.sh/hudy9x/depdok', '_blank')}
          >
            Buy License
          </Button>
          {/* {isGracePeriod && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="w-full sm:w-auto"
            >
              Dismiss
            </Button>
          )} */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
