import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { readFileContent, writeFileContent } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { resolveTargetFilePath, getParentDir } from "../common/pathHelper";

export interface UpdateMarkdownSectionArgs {
  path?: string;
  heading?: string;
  target_text?: string;
  replacement_content: string;
}

export interface UpdateMarkdownSectionResult {
  success: boolean;
  path: string;
  fileName: string;
  target: string;
  message: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function updateMarkdownSectionTool(
  args: UpdateMarkdownSectionArgs
): Promise<UpdateMarkdownSectionResult> {
  const fullPath = resolveTargetFilePath(args.path);
  if (!fullPath) {
    throw new Error("No file path specified and no active markdown document is currently open.");
  }

  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
  const parentDir = getParentDir(fullPath);

  try {
    const originalContent = await readFileContent(fullPath);
    let updatedContent = originalContent;
    let targetDescription = "";

    if (args.heading) {
      const cleanHeading = args.heading.replace(/^#+\s*/, "").trim();
      targetDescription = `heading '${cleanHeading}'`;

      // Find the heading line and its level
      const headingFinder = new RegExp(`^(#{1,6})\\s+${escapeRegex(cleanHeading)}\\s*$`, "im");
      const match = headingFinder.exec(originalContent);

      if (!match) {
        throw new Error(
          `Heading '${cleanHeading}' not found in '${fileName}'. Available headings can be checked using 'read_markdown'.`
        );
      }

      const headingLevel = match[1].length;
      const startIndex = match.index;

      // Find where this section ends: next heading of equal or higher level (1..headingLevel) or EOF
      const restOfDoc = originalContent.slice(startIndex + match[0].length);
      const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, "m");
      const nextMatch = nextHeadingRegex.exec(restOfDoc);

      let endIndex: number;
      if (nextMatch) {
        endIndex = startIndex + match[0].length + nextMatch.index;
      } else {
        // If there are HTML comment blocks at bottom, preserve them
        const commentMatch = /\n*<!--\s*DEPDOK_COMMENT_/.exec(restOfDoc);
        if (commentMatch) {
          endIndex = startIndex + match[0].length + commentMatch.index;
        } else {
          endIndex = originalContent.length;
        }
      }

      const before = originalContent.slice(0, startIndex);
      const after = originalContent.slice(endIndex);
      const replacement = args.replacement_content.trim();

      updatedContent = `${before}${replacement}\n\n${after.trimStart()}`.trimEnd() + "\n";
    } else if (args.target_text) {
      targetDescription = `target text snippet`;
      if (!originalContent.includes(args.target_text)) {
        throw new Error(
          `Target text not found in '${fileName}'. Please verify exact phrasing with 'read_markdown'.`
        );
      }

      updatedContent = originalContent.replace(args.target_text, args.replacement_content);
    } else {
      throw new Error("Either 'heading' or 'target_text' must be provided to update a markdown section.");
    }

    await writeFileContent(fullPath, updatedContent);

    const store = getDefaultStore();
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Updated ${targetDescription} in ${fileName}`);

    return {
      success: true,
      path: fullPath,
      fileName,
      target: targetDescription,
      message: `Successfully updated ${targetDescription} in '${fileName}'.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to update markdown section: ${errorMsg}`);
    throw new Error(`Failed to update section in '${fullPath}': ${errorMsg}`);
  }
}
