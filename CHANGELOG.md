## What's Changed

✨ Features

- Implement Tiptap drag handle for block reordering in the Markdown preview. ([00e9f1e](../../commit/00e9f1e))
- Add Tiptap placeholder and gap cursor extensions to the markdown editor. ([0273ab0](../../commit/0273ab0))
- Add highlight, link, subscript, and superscript editor functionality with corresponding UI controls. ([0b1b2d8](../../commit/0b1b2d8))

🐛 Bug Fixes

- Fallback to assignee alias for name display in TodoItemActions. ([c2152e9](../../commit/c2152e9))

♻️ Refactoring

- Adjust Markdown drag handle placement to `left-start`, add a vertical offset, and center its icon. ([cac60e6](../../commit/cac60e6))
- Reimplement active heading detection using scroll position and integrate it with the markdown preview and outline components. ([97f4aa7](../../commit/97f4aa7))
- Integrate Tiptap TableOfContents extension for improved markdown outline management. ([e31e795](../../commit/e31e795))
- Automatically open newly created files in the editor and navigate to the editor view. ([b1b10a5](../../commit/b1b10a5))
- Automatically scroll the active editor tab into view using `useRef` and `useEffect`. ([8249880](../../commit/8249880))
- Remove placeholder's `showOnlyWhenEditable` option and add autofocus to the editor. ([d75c1bd](../../commit/d75c1bd))
- Extract file and local link handling logic into dedicated custom hooks. ([804c716](../../commit/804c716))
- Add Mod-Enter keybind to exit tables and insert a new paragraph in the editor. ([e4b4747](../../commit/e4b4747))

🔨 Other Changes

- Change arrow color + text color ([1d53d7d](../../commit/1d53d7d))
- Upgrade version 0.20.1 ([aa94678](../../commit/aa94678))
- Upgrade version 0.20.1 ([83fc900](../../commit/83fc900))


📋 Full Changelog: [83fc900...cac60e6](../../compare/83fc900...cac60e6)