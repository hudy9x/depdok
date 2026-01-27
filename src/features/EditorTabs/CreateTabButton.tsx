import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewTabDialog } from './NewTabDialog';

export function CreateTabButton() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-[35px] w-8 p-0 rounded-none border-r border-border hover:bg-background"
        onClick={() => setShowDialog(true)}
        title="Create new file"
      >
        <Plus className="w-4 h-4" />
      </Button>

      {showDialog && (
        <NewTabDialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
