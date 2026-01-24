/**
 * Determines the Monaco Editor language based on file extension
 * @param fileExtension - The file extension (without the dot)
 * @returns The Monaco language identifier
 */
export function getMonacoLanguage(fileExtension: string | null | undefined): string {
  if (!fileExtension) return "plaintext";

  const ext = fileExtension.toLowerCase();

  // Markdown files
  if (["md", "txt", "todo"].includes(ext)) {
    return "markdown";
  }

  // PlantUML files
  if (["puml", "pu"].includes(ext)) {
    return "plantuml";
  }

  // Mermaid files
  if (["mmd", "mermaid"].includes(ext)) {
    return "mermaid";
  }

  return "plaintext";
}
