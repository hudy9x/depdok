import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FolderOpen } from "lucide-react"
import { useSetAtom } from "jotai"
import { openWorkspaceAtom } from "./store"
import { openFolderDialog } from "./api"

export function EmptyExplorer() {
  const openWorkspace = useSetAtom(openWorkspaceAtom)

  const handleOpenFolder = async () => {
    const folderPath = await openFolderDialog()
    if (folderPath) {
      try {
        await openWorkspace(folderPath)
      } catch (error) {
        console.error("Failed to open workspace:", error)
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-4">

      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen className="text-muted-foreground size-4" />
          </EmptyMedia>
          <EmptyTitle>No Folder Opened</EmptyTitle>
          <EmptyDescription>
            You haven&apos;t opened any folder yet. Open a folder to start working on your project.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button onClick={handleOpenFolder}>Open Folder</Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
