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