import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { Button } from './ui/button';
import { showLicensePopoverAtom } from '../stores/license-popover';
import { isLicensed } from '../api-client/license';

interface LicenseGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component to wrap premium features
 * Shows fallback or unlock button if user is not licensed
 */
export function LicenseGuard({ children, fallback }: LicenseGuardProps) {
  const [licensed, setLicensed] = useState(false);
  const [loading, setLoading] = useState(true);
  const showPopover = useSetAtom(showLicensePopoverAtom);

  useEffect(() => {
    isLicensed()
      .then(setLicensed)
      .catch(() => setLicensed(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return null; // Or a loading spinner
  }

  if (!licensed) {
    return fallback ?? (
      <Button
        onClick={() => showPopover()}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <span className="text-lg">🔒</span>
        <span>Unlock Feature</span>
      </Button>
    );
  }

  return <>{children}</>;
}
