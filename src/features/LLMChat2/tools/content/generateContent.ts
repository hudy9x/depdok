export interface GenerateContentArgs {
  topic: string;
  style?: string;
  language?: string;
  content_model?: string;
}

export interface GenerateContentResult {
  topic: string;
  style: string;
  language: string;
  modelUsed: string;
  content: string;
}

export async function generateContentTool(
  args: GenerateContentArgs
): Promise<GenerateContentResult> {
  const modelToUse = args.content_model || "gemma2:9b";
  const style = args.style || "informative and engaging markdown";
  const language = args.language || "English";

  const systemPrompt = `You are an expert creative writer, editor, and documentation specialist.
Write rich, engaging, well-structured Markdown content.
Target Style: ${style}
Target Language: ${language}
Provide high-quality prose with appropriate headers, bullet points, formatting, and clear explanations.`;

  const userPrompt = `Topic / Request:\n${args.topic}\n\nPlease generate complete, high-quality markdown content now.`;

  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Content model (${modelToUse}) error (HTTP ${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const generatedContent = json.message?.content || "";

  return {
    topic: args.topic,
    style,
    language,
    modelUsed: modelToUse,
    content: generatedContent,
  };
}
