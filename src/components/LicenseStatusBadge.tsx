import { useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { BadgeCheck, Clock, BadgeX } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
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
  const licenseStatus = useAtomValue(licenseStatusAtom);
  const gracePeriodInfo = useAtomValue(gracePeriodInfoAtom);
  const [popoverOpen, setPopoverOpen] = useAtom(licensePopoverOpenAtom);
  const refreshStatus = useSetAtom(refreshLicenseStatusAtom);

  // Refresh license status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  if (!licenseStatus) {
    return null;
  }

  const handleClick = () => {
    setPopoverOpen(true);
  };

  // Licensed status
  if (licenseStatus.status === 'licensed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent border-0"
              onClick={handleClick}
            >
              <BadgeCheck className="h-4 w-4 text-green-600" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Licensed</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Grace period
  if (licenseStatus.status === 'grace_period' && gracePeriodInfo) {
    const daysLeft = gracePeriodInfo.days_remaining;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent border-0"
              onClick={handleClick}
            >
              <Clock className="h-4 w-4 text-yellow-600" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Expired
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent border-0"
            onClick={handleClick}
          >
            <BadgeX className="h-4 w-4 text-red-600" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>License Expired</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
