import { getDefaultStore } from "jotai";
import { readFileContent, writeFileContent } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { resolveTargetFilePath, getParentDir } from "../common/pathHelper";

export interface UpsertMarkdownSectionArgs {
  path?: string;
  heading?: string;
  target_text?: string;
  replacement_content: string;
}

export interface UpsertMarkdownSectionResult {
  success: boolean;
  path: string;
  fileName: string;
  target: string;
  action: "updated" | "appended" | "replaced";
  message: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function upsertMarkdownSectionTool(
  args: UpsertMarkdownSectionArgs
): Promise<UpsertMarkdownSectionResult> {
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
    let actionType: "updated" | "appended" | "replaced" = "updated";

    if (args.heading) {
      const cleanHeading = args.heading.replace(/^#+\s*/, "").trim();

      // Find the heading line and its level
      const headingFinder = new RegExp(`^(#{1,6})\\s+${escapeRegex(cleanHeading)}\\s*$`, "im");
      const match = headingFinder.exec(originalContent);

      if (match) {
        // Heading exists -> Replace the section
        targetDescription = `heading '${cleanHeading}'`;
        actionType = "updated";

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
      } else {
        // Heading does not exist -> Append as new section
        targetDescription = `new section '${cleanHeading}'`;
        actionType = "appended";

        // Check if there are invisible DEPDOK_COMMENT blocks at the bottom of the document
        const commentMatch = /\n*<!--\s*DEPDOK_COMMENT_/.exec(originalContent);
        let insertIndex: number;
        if (commentMatch) {
          insertIndex = commentMatch.index;
        } else {
          insertIndex = originalContent.length;
        }

        const before = originalContent.slice(0, insertIndex).trimEnd();
        const after = originalContent.slice(insertIndex);

        let sectionContent = args.replacement_content.trim();
        // If content doesn't already start with '#', prepend heading tag
        if (!sectionContent.startsWith("#")) {
          sectionContent = `## ${cleanHeading}\n\n${sectionContent}`;
        }

        if (before.length > 0) {
          updatedContent = `${before}\n\n${sectionContent}\n\n${after.trimStart()}`.trimEnd() + "\n";
        } else {
          updatedContent = `${sectionContent}\n\n${after.trimStart()}`.trimEnd() + "\n";
        }
      }
    } else if (args.target_text) {
      targetDescription = `target text snippet`;
      actionType = "replaced";
      if (!originalContent.includes(args.target_text)) {
        throw new Error(
          `Target text not found in '${fileName}'. Please verify exact phrasing with 'read_markdown'.`
        );
      }

      updatedContent = originalContent.replace(args.target_text, args.replacement_content);
    } else {
      throw new Error("Either 'heading' or 'target_text' must be provided to update or append a markdown section.");
    }

    await writeFileContent(fullPath, updatedContent);

    const store = getDefaultStore();
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    const message = actionType === "appended"
      ? `Successfully added section '${targetDescription}' to '${fileName}'.`
      : `Successfully updated ${targetDescription} in '${fileName}'.`;

    return {
      success: true,
      path: fullPath,
      fileName,
      target: targetDescription,
      action: actionType,
      message,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to upsert section in '${fullPath}': ${errorMsg}`);
  }
}
