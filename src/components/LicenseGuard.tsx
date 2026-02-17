import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from './ui/button';
import { showLicensePopoverAtom } from '../stores/license-popover';
import { licenseStatusAtom } from '../stores/license';

interface LicenseGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /**
   * Custom render function for the unlock button
   * @param showPopover - Function to open the license activation dialog
   */
  renderUnlockButton?: (showPopover: () => void) => React.ReactNode;
  /**
   * Optional className for the default unlock button
   */
  className?: string;
  /**
   * Button text (default: "Unlock Feature")
   */
  title?: string;
  /**
   * Tooltip text shown on hover
   */
  tooltipTitle?: string;
}

/**
 * Component to wrap premium features
 * Shows fallback or unlock button if user is not licensed
 */
export function LicenseGuard({
  children,
  fallback,
  renderUnlockButton,
  className,
  title = "Unlock Feature",
  tooltipTitle
}: LicenseGuardProps) {
  const licenseStatus = useAtomValue(licenseStatusAtom);
  const [isHovered, setIsHovered] = useState(false);
  const showPopover = useSetAtom(showLicensePopoverAtom);

  // Check if user is licensed
  const isLicensed = licenseStatus?.status === 'licensed';

  if (!isLicensed) {
    // Use custom render function if provided
    if (renderUnlockButton) {
      return <>{renderUnlockButton(showPopover)}</>;
    }

    // Use fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default unlock button with Lock/LockOpen icons
    return (
      <Button
        onClick={() => showPopover()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={tooltipTitle}
        variant="outline"
        size="sm"
        className={className || "gap-2"}
      >
        {isHovered ? (
          <LockOpen className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {title ? <span>{title}</span> : null}
      </Button>
    );
  }

  return <>{children}</>;
}
