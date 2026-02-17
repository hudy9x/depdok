import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Badge } from './ui/badge';
import {
  licenseStatusAtom,
  gracePeriodInfoAtom,
  refreshLicenseStatusAtom,
} from '../stores/license';
import { licensePopoverOpenAtom } from '../stores/license-popover';

/**
 * License status badge for titlebar
 * Shows current license status with color coding
 */
export function LicenseStatusBadge() {
  const [licenseStatus, setLicenseStatus] = useAtom(licenseStatusAtom);
  const gracePeriodInfo = useAtomValue(gracePeriodInfoAtom);
  const [popoverOpen, setPopoverOpen] = useAtom(licensePopoverOpenAtom);
  const refreshStatus = useAtomValue(refreshLicenseStatusAtom);

  // Refresh license status on mount
  useEffect(() => {
    refreshStatus;
  }, []);

  if (!licenseStatus) {
    return null;
  }

  const handleClick = () => {
    setPopoverOpen(true);
  };

  // Licensed status
  if (licenseStatus.status === 'licensed') {
    return (
      <Badge
        variant="default"
        className="cursor-pointer bg-green-600 hover:bg-green-700 text-white"
        onClick={handleClick}
      >
        ✅ Licensed
      </Badge>
    );
  }

  // Grace period
  if (licenseStatus.status === 'grace_period' && gracePeriodInfo) {
    const daysLeft = gracePeriodInfo.days_remaining;
    return (
      <Badge
        variant="secondary"
        className="cursor-pointer bg-yellow-500 hover:bg-yellow-600 text-white"
        onClick={handleClick}
      >
        ⏳ {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
      </Badge>
    );
  }

  // Expired
  return (
    <Badge
      variant="destructive"
      className="cursor-pointer"
      onClick={handleClick}
    >
      ❌ Expired
    </Badge>
  );
}
