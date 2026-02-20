---
trigger: always_on
---

## Global Rules
- Alway use pnpm 

## Frontend UI/UX
- Must use shadcn-ui for all ui block in `./src` folder
- Must use tailwind css for all styling 
- Must create localStorage, indexDB, cached in /lib folder and use the interface. Do not use them directly

## Coding Principle
- Must decouple the logic for easy to maintain. 
- Place features with stores, hooks, component in the same folder for management with ease

## Frontend Guard
- Refer `./docs/license-guard.md`



## Communicate between frontend and backend (Rust)
- Do not call `invoke` and `listen` from  `@tauri-apps/api` directly, but create files, function in `./src/api-client` folder
-