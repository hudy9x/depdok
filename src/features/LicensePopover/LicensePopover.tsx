import { useAtom, useAtomValue } from 'jotai';
import { licenseStatusAtom } from '@/stores/license';
import { licensePopoverOpenAtom } from '@/stores/license-popover';
import { LicenseActivationDialog } from './LicenseActivationDialog';
import { LicenseManagementDialog } from './LicenseManagementDialog';

export function LicensePopover() {
  const [open, setOpen] = useAtom(licensePopoverOpenAtom);
  const licenseStatus = useAtomValue(licenseStatusAtom);

  // Don't render if no status yet
  if (!licenseStatus) {
    return null;
  }

  const isLicensed = licenseStatus.status === 'licensed';
  const isGracePeriod = licenseStatus.status === 'grace_period';

  // Show different dialogs based on license status
  if (isLicensed) {
    return <LicenseManagementDialog open={open} onOpenChange={setOpen} />;
  }

  // Grace period or expired - show activation dialog
  return <LicenseActivationDialog open={open} onOpenChange={setOpen} isGracePeriod={isGracePeriod} />;
}
