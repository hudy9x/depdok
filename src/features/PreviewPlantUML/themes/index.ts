import lightgrayTheme from "./puml-theme-lightgray.puml?raw";
import hackerTheme from "./puml-theme-hacker.puml?raw";
import marsTheme from "./puml-theme-mars.puml?raw";

export const PLANTUML_THEMES: Record<string, { label: string; content: string }> = {
  default: {
    label: "Default (Transparent)",
    content: "",
  },
  lightgray: {
    label: "Light Gray",
    content: lightgrayTheme,
  },
  hacker: {
    label: "Hacker",
    content: hackerTheme,
  },
  mars: {
    label: "Mars",
    content: marsTheme,
  },
};
