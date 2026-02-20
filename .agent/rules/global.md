---
trigger: always_on
---

## Global Rules
- Always use **pnpm**.

## Frontend UI/UX
- **UI Components**: Use `shadcn/ui` for everything in `./src`.
- **Styling**: Use Tailwind CSS exclusively.
- **Storage**: Abstract `localStorage`, `IndexedDB`, and caching in `./lib`. Use the interface; do not access them directly.

## Coding Principles
- **Decouple Logic**: Keep logic separate for better maintainability.
- **Co-location**: Group feature-specific stores, hooks, and components in the same folder.

## Integration (Tauri)
- **API Client**: Wrap `@tauri-apps/api` calls (`invoke`, `listen`) in `./src/api-client`. Do not call them directly.

## Security
- Follow guidelines in `./docs/license-guard.md`.

## React Refactoring
- **Functional Components**: Use arrow functions and strictly follow Hooks rules.
- **Prop Drilling**: Avoid deep nesting; use Context API or a State Manager for shared data.
- **Component Size**: Break down large components (>150 lines) into smaller, reusable atoms.
- **Performance**: Use `useMemo` and `useCallback` only when necessary to prevent expensive re-renders.
- **Clean JSX**: Keep logic out of the return statement; use helper functions or variables for complex conditions.