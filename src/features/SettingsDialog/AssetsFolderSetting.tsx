import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CircleCheck, LoaderCircle } from "lucide-react";

export function AssetsFolderSetting() {
  const [assetFolderUpdating, setAssetFolderUpdating] = useState(false);
  const [assetsFolder, setAssetsFolderState] = useState(() => {
    return localStorage.getItem('settings-markdown-asset-folder') || '';
  });
  const [folderNameError, setFolderNameError] = useState("");

  // Validate folder name (only a-z, A-Z, 0-9, -, _)
  const handleFolderNameChange = (value: string) => {
    const validPattern = /^[a-zA-Z0-9_-]*$/;

    if (validPattern.test(value)) {
      setAssetFolderUpdating(true);
      setAssetsFolderState(value);
      localStorage.setItem('settings-markdown-asset-folder', value);
      setFolderNameError("");
      setTimeout(() => {
        setAssetFolderUpdating(false);
      }, 300);
    } else {
      setFolderNameError("Only letters, numbers, hyphens, and underscores are allowed");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="folder-name" className="flex items-center gap-2">
        Assets Folder
        {assetFolderUpdating
          ? <LoaderCircle className="size-4 text-muted-foreground animate-spin" />
          : <CircleCheck className="size-4 text-green-300 dark:text-green-500" />}
      </Label>
      <p className="text-sm text-muted-foreground">
        Folder name for storing markdown assets (only letters, numbers, hyphens, and underscores)
      </p>
      <Input
        id="folder-name"
        type="text"
        placeholder="my-folder_name"
        value={assetsFolder}
        onChange={(e) => handleFolderNameChange(e.target.value)}
        className={folderNameError ? "border-destructive" : ""}
      />
      {folderNameError && (
        <p className="text-sm text-destructive">{folderNameError}</p>
      )}
      <p className="text-xs text-muted-foreground italic">
        Note: This only works for markdown files
      </p>
    </div>
  );
}
