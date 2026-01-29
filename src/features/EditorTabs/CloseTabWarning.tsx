import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isDummyPath, extractFilenameFromDummyPath, type Tab } from '@/stores/TabStore';
import { draftService } from '@/lib/indexeddb';

interface CloseTabWarningProps {
  tab: Tab;
  onClose: (action: 'save' | 'discard' | 'cancel') => void;
}

export function CloseTabWarning({ tab, onClose }: CloseTabWarningProps) {
  const displayName = isDummyPath(tab.filePath)
    ? extractFilenameFromDummyPath(tab.filePath)
    : tab.fileName;

  const handleDiscard = async () => {
    // Remove draft from IndexedDB
    await draftService.removeDraft(tab.filePath);
    onClose('discard');
  };

  return (
    <AlertDialog open={true} onOpenChange={() => onClose('cancel')}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            "{displayName}" has unsaved changes. Do you want to save them before closing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose('cancel')}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscard}
            className="bg-destructive hover:bg-destructive/90"
          >
            Don't Save
          </AlertDialogAction>
          <AlertDialogAction onClick={() => onClose('save')}>
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
