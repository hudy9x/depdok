import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RecoveryDialogProps {
  onUseDraft: () => void;
  onUseFile: () => void;
}

export function RecoveryDialog({ onUseDraft, onUseFile }: RecoveryDialogProps) {
  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved Changes Detected</DialogTitle>
          <DialogDescription>
            We found unsaved changes for this file. Would you like to recover them?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onUseFile}>
            Discard Draft
          </Button>
          <Button onClick={onUseDraft}>
            Recover Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
