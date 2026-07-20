import { readFileContent } from "@/lib/fileOperations";

export async function buildPromptPayload(text: string, taggedFiles: { name: string; path: string }[]): Promise<string> {
  let contextStr = "";
  if (taggedFiles.length > 0) {
    for (const file of taggedFiles) {
      try {
        const content = await readFileContent(file.path);
        contextStr += `\n\n---\n**Attached File Context:**\nFile: \`${file.name}\`\nPath: \`${file.path}\`\n\`\`\`\n${content}\n\`\`\``;
      } catch (err) {
        console.error(`Failed to read file ${file.path}:`, err);
      }
    }
  }

  let reinforcedText = text;
  if (contextStr) {
    const systemInstruction = `\n\nIMPORTANT: The user has attached the above file(s). If the user asks you to edit, write, modify, or update a file, you MUST apply the changes by doing BOTH of the following:
1. If your model supports tool calling, use the \`write_file\` tool with the correct \`path\` and the full, complete updated \`content\`.
2. ALWAYS output the full updated file content in your text response using the following format:
[FILE:path/to/file]
\`\`\`language
full file content goes here
\`\`\`
Replace 'path/to/file' with the absolute path of the file you are editing. Ensure there is no space between 'FILE:' and the path, and that you output the entire file content, not just diffs. Keep existing code structure unless modified.`;
    reinforcedText = text + contextStr + systemInstruction;
  }
  
  return reinforcedText;
}
