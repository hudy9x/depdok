import { useState } from "react";
import {
  FileText,
  FolderTree,
  PenTool,
  Sparkles,
  Database,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export interface QuickPromptChipsProps {
  onSelectPrompt: (prompt: string) => void;
}

interface ExamplePrompt {
  id: string;
  category: "knowledgeBase" | "markdown" | "content" | "fileSystem" | "database";
  label: string;
  prompt: string;
  badge: string;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  // Knowledge Base Suite
  {
    id: "search_docs",
    category: "knowledgeBase",
    label: "Search notes on markdown pagination",
    prompt: "Search our knowledge base for information about markdown pagination and layout rules",
    badge: "search_knowledge_base 🔍",
  },
  {
    id: "search_embeddings",
    category: "knowledgeBase",
    label: "Search notes on vector embeddings & sqlite-vec",
    prompt: "Search the knowledge base for how vector embeddings and sqlite-vec work in this project",
    badge: "search_knowledge_base 🧠",
  },
  // Markdown Suite
  {
    id: "read_markdown",
    category: "markdown",
    label: "Review active document structure & outline",
    prompt: "Read active markdown and review its structure, grammar, and outline",
    badge: "read_markdown 🔍",
  },
  {
    id: "upsert_section",
    category: "markdown",
    label: "Add or update Conclusion section",
    prompt: "Add the Conclusion section in active markdown with 3 key takeaways",
    badge: "upsert_markdown_section ✏️",
  },
  {
    id: "add_comment",
    category: "markdown",
    label: "Add inline review comment to target text",
    prompt: "Add an inline review comment on the first heading in active markdown suggesting improvements",
    badge: "add_markdown_comment 💬",
  },

  // Content Specialist (Gemma 2:9b)
  {
    id: "generate_tutorial",
    category: "content",
    label: "Write in-depth tutorial with code samples",
    prompt: "Generate a comprehensive tutorial about TypeScript generics with code examples and best practices",
    badge: "generate_content ✍️",
  },
  {
    id: "generate_release_notes",
    category: "content",
    label: "Draft release notes & changelog",
    prompt: "Draft a professional release notes markdown document for Depdok v2.0 covering all new tools",
    badge: "generate_content 🚀",
  },

  // File System & Traversal
  {
    id: "list_files_recursive",
    category: "fileSystem",
    label: "Traverse and list all files in workspace",
    prompt: "List all files and subdirectories in the workspace recursively",
    badge: "list_files 📂",
  },
  {
    id: "create_file",
    category: "fileSystem",
    label: "Create file 'notes_demo.md'",
    prompt: "Create a file named notes_demo.md with an outline on system architecture",
    badge: "create_file 📄",
  },
  {
    id: "create_folder",
    category: "fileSystem",
    label: "Create new folder 'archive/docs'",
    prompt: "Create a new folder named archive/docs",
    badge: "create_folder 📁",
  },
  {
    id: "move_files",
    category: "fileSystem",
    label: "Move files into archive folder",
    prompt: "Move notes_demo.md into archive/docs folder",
    badge: "move_files_or_folders 📦",
  },

  // Database & Parallel Lookups
  {
    id: "user_lookup",
    category: "database",
    label: "Lookup user details for Alice Smith",
    prompt: "What is the age, country, and DOB of Alice Smith?",
    badge: "Parallel tools ⚡",
  },
  {
    id: "sum_digits",
    category: "database",
    label: "Calculate sum of 4 numbers",
    prompt: "Calculate the sum of 125, 340, 560, and 780",
    badge: "sum_four_digits 🧮",
  },
];

const CATEGORIES: { id: ExamplePrompt["category"] | "all"; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles className="h-3 w-3" /> },
  { id: "knowledgeBase", label: "Knowledge Base", icon: <BookOpen className="h-3 w-3" /> },
  { id: "markdown", label: "Markdown", icon: <FileText className="h-3 w-3" /> },
  { id: "content", label: "Writer (Gemma)", icon: <PenTool className="h-3 w-3" /> },
  { id: "fileSystem", label: "File System", icon: <FolderTree className="h-3 w-3" /> },
  { id: "database", label: "Database / Math", icon: <Database className="h-3 w-3" /> },
];

export const QuickPromptChips: React.FC<QuickPromptChipsProps> = ({ onSelectPrompt }) => {
  const [selectedCategory, setSelectedCategory] = useState<ExamplePrompt["category"] | "all">("all");

  const filteredPrompts =
    selectedCategory === "all"
      ? EXAMPLE_PROMPTS
      : EXAMPLE_PROMPTS.filter((p) => p.category === selectedCategory);

  return (
    <div className="w-full space-y-2.5 pt-2">
      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                isSelected
                  ? "bg-sky-500/15 text-sky-400 border-sky-500/30 font-semibold"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Prompts list */}
      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
        {filteredPrompts.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectPrompt(item.prompt)}
            className="text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-sky-500/30 text-xs text-foreground transition-all cursor-pointer flex items-center justify-between group"
            title="Click to insert prompt into input"
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <ArrowRight className="h-3 w-3 text-sky-400 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            <span className="text-[10px] text-sky-500 font-medium shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              {item.badge}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
