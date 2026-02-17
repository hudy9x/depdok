import { useSetAtom, useAtomValue } from 'jotai';
import { BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  licenseStatusAtom,
  removeLicenseAtom,
  isLoadingLicenseAtom,
  licenseErrorAtom,
} from '@/stores/license';

interface LicenseManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LicenseManagementDialog({ open, onOpenChange }: LicenseManagementDialogProps) {
  const licenseStatus = useAtomValue(licenseStatusAtom);
  const isLoading = useAtomValue(isLoadingLicenseAtom);
  const error = useAtomValue(licenseErrorAtom);
  const removeLicense = useSetAtom(removeLicenseAtom);

  const handleRemove = async () => {
    // Close dialog immediately
    onOpenChange(false);

    try {
      await removeLicense();
      toast.success('License removed successfully');
    } catch (err) {
      // Show error toast
      toast.error(error || 'Failed to remove license');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-green-600" />
            License Active
          </DialogTitle>
          {licenseStatus?.customer_email && (
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
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
