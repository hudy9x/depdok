export interface AskUserArgs {
  question: string;
  options?: string[] | string;
  allow_custom?: boolean;
}

export interface AskUserResult {
  question: string;
  selected: string;
  custom_input?: boolean;
}

interface PendingQuestionEntry {
  resolve: (res: AskUserResult) => void;
  reject: (err: Error) => void;
  args: AskUserArgs;
}

// In-memory map of pending question requests awaiting user selection
const pendingQuestionsMap = new Map<string, PendingQuestionEntry>();

export function normalizeAskOptions(rawOptions: unknown): string[] {
  if (!rawOptions) return [];
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((o) => String(o).trim()).filter(Boolean);
  }
  if (typeof rawOptions === "string") {
    const trimmed = rawOptions.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((o) => String(o).trim()).filter(Boolean);
        }
      } catch {
        // fallback
      }
    }
    return trimmed
      .replace(/^[\[\(\{"']+|[\]\)\}"']+$/g, "")
      .split(",")
      .map((o) => o.trim().replace(/^['"]+|['"]+$/g, ""))
      .filter(Boolean);
  }
  return [];
}

/**
 * Executes the ask_user tool by creating a pending Promise that waits
 * for the user to click a prefilled option or enter a custom answer.
 */
export async function askUserTool(
  args: AskUserArgs,
  requestId: string
): Promise<AskUserResult> {
  const question = args.question?.trim();
  if (!question) {
    throw new Error("Question parameter must not be empty.");
  }

  // If a pending request with the same ID already exists, reject it first
  if (pendingQuestionsMap.has(requestId)) {
    const existing = pendingQuestionsMap.get(requestId);
    existing?.reject(new Error("Superseded by new question request"));
    pendingQuestionsMap.delete(requestId);
  }

  return new Promise<AskUserResult>((resolve, reject) => {
    pendingQuestionsMap.set(requestId, {
      resolve,
      reject,
      args,
    });
  });
}

/**
 * Called by UI components when the user clicks an option chip or submits custom text.
 */
export function submitUserAnswer(
  requestId: string,
  answer: string,
  customInput = false
): boolean {
  const entry = pendingQuestionsMap.get(requestId);
  if (!entry) {
    console.warn(`[askUserTool] No pending question found for requestId: ${requestId}`);
    return false;
  }

  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer) return false;

  pendingQuestionsMap.delete(requestId);
  entry.resolve({
    question: entry.args.question,
    selected: trimmedAnswer,
    custom_input: customInput,
  });
  return true;
}

/**
 * Cancels a pending question (e.g. if the user cancels the generation turn).
 */
export function cancelUserQuestion(requestId: string, reason = "User question cancelled"): boolean {
  const entry = pendingQuestionsMap.get(requestId);
  if (!entry) return false;

  pendingQuestionsMap.delete(requestId);
  entry.reject(new Error(reason));
  return true;
}

export function isQuestionPending(requestId: string): boolean {
  return pendingQuestionsMap.has(requestId);
}
