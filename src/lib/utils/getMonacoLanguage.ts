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

  // TypeScript/JavaScript files
  // Monaco Editor uses 'typescript' for both .ts and .tsx
  // and 'javascript' for both .js and .jsx
  if (["tsx", "ts"].includes(ext)) {
    return "typescript";
  }

  if (["jsx", "js"].includes(ext)) {
    return "javascript";
  }

  // Web languages
  if (ext === "html" || ext === "htm") {
    return "html";
  }

  if (ext === "css") {
    return "css";
  }

  // Python files
  if (ext === "py") {
    return "python";
  }

  // JSON files
  if (ext === "json") {
    return "json";
  }

  console.log("fileExtension", fileExtension);

  return "plaintext";
}
