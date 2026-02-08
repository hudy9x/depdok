## What's Changed

✨ Features

- File explorer (#15) ([bde5709](../../commit/bde5709))
- Implement fade-in animations for Monaco Editor content updates, AI insertions, and external file reloads. ([e53c0bc](../../commit/e53c0bc))
- Implement robust file watching with auto-reload for editor and confirmation for preview. ([5d6854b](../../commit/5d6854b))
- Add file watcher to monaco editor first for testing ([7093f7a](../../commit/7093f7a))
- Add GitHub Actions workflow to publish releases to a public repository. ([54c6a3a](../../commit/54c6a3a))
- Bring open file item to the tab create button ([7c97a70](../../commit/7c97a70))
- File name search ([f497c4a](../../commit/f497c4a))
- Add selection to menubar ([691d600](../../commit/691d600))
- Allow to config plantuml rendering url ([14dded1](../../commit/14dded1))
- Support plantuml ([b9f4ff5](../../commit/b9f4ff5))
- Change app's icon ([ee148f8](../../commit/ee148f8))
- File-tab (#8) ([fd7291b](../../commit/fd7291b))
- Todo support with kanban + week view (#7) ([c1dcd08](../../commit/c1dcd08))
- Support theme switcher for monaco editor (#6) ([dec66a8](../../commit/dec66a8))
- Mermaid support (#5) ([0f7ae06](../../commit/0f7ae06))
- Create file (#4) ([ebdfa02](../../commit/ebdfa02))
- Drop/paste image (#3) ([e278f7e](../../commit/e278f7e))
- Add theme switcher (#2) ([0640620](../../commit/0640620))
- Markdown viewmode (#1) ([3f772fb](../../commit/3f772fb))

🐛 Bug Fixes

- Can not use wheel or touch-dragging in tab's scrollbar ([d07d8db](../../commit/d07d8db))
- Prevent dragging if clicking on interactive elements ([14fddec](../../commit/14fddec))
- Select the correct theme when user selects theme as system ([a2df0a2](../../commit/a2df0a2))
- Temporary fix the zoom function ([18e46c4](../../commit/18e46c4))

♻️ Refactoring

- Mark unused variables and imports to suppress warnings. ([c2f76c3](../../commit/c2f76c3))
- Add app icon to home page ([2e4d93a](../../commit/2e4d93a))
- Try to add app icon to window installer ([aad1568](../../commit/aad1568))
- Group the mode switcher button into a dropdown ([76e17e0](../../commit/76e17e0))
- Try to add a new theme for the whole app ([0d054a1](../../commit/0d054a1))
- Replace theme to resolvedTheme to determine the theme is dark or light in system mode ([1b5399e](../../commit/1b5399e))
- Disable autoSave time + update plantuml setting description ([629e77a](../../commit/629e77a))
- Change icon-size + style ([ab37233](../../commit/ab37233))
- Wrapping the svg content into another svg content for preventing blurry effect while zooming in ([8d4efbb](../../commit/8d4efbb))
- Move the window drag effect to a custom hook + replace zoom component to a new one ([4ecc246](../../commit/4ecc246))
- Change the icon style ([8737b81](../../commit/8737b81))
- Add max with + remove load draft content ([940c613](../../commit/940c613))
- Add <ScrollArea> component to markdown view ([6d2ca4f](../../commit/6d2ca4f))
- Style the first paragraph in markdown as a subtitle ([eda891d](../../commit/eda891d))
- Add x padding and bottom padding to Editor page ([f91a24a](../../commit/f91a24a))

📝 Documentation

- Add `mode` configuration with `kanban` option to Todo preview documentation. ([4e3f681](../../commit/4e3f681))

🔨 Other Changes

- Enhance: search file in folder (#16) ([d345c06](../../commit/d345c06))
- Refacto: set FileExplorer visibility to false ([9fbd762](../../commit/9fbd762))
- Apply backgroun accent, remove background secondary ([03dd7b0](../../commit/03dd7b0))
- Replace `dawidd6/action-download-artifact` with a custom GitHub script and unzip step for downloading Windows artifacts. ([419b2de](../../commit/419b2de))
- The counter is shrinked and has different color in dark mode ([1ad24cb](../../commit/1ad24cb))
- Display full filepath on windows but file name ([e2ffc12](../../commit/e2ffc12))
- Only highlight single comment block, but multi lines comment blocks ([da71f76](../../commit/da71f76))
- Sync macos titlebar with window titlebar ([dd25eeb](../../commit/dd25eeb))
- Remove the left border ([038680b](../../commit/038680b))
- Replace mermaid to beautiful-mermaid ([8af6040](../../commit/8af6040))
- Disable content centering on load in ZoomPanContainer. ([6cd796f](../../commit/6cd796f))
- Make the round corner bigger ([cd64294](../../commit/cd64294))
- Set border-border to command ui + change heading title ([b6ae832](../../commit/b6ae832))
- Set limited themes and add some logs for debugging ([b58f40b](../../commit/b58f40b))
- Change app icon another time ([dbd9417](../../commit/dbd9417))
- Remove the loading text in monaco editor ([a970b9d](../../commit/a970b9d))
- Auto centering ([87a2ba1](../../commit/87a2ba1))
- Remove svg-pan-zoom package ([6825b7d](../../commit/6825b7d))
- Update app's icon ([7223f10](../../commit/7223f10))
- Fix plantuml theme not working + add zoom to the plantuml preview ([a1b191a](../../commit/a1b191a))
- Hotfix: can not press copy/paste due to the prev version removed the Edit menubar item ([89435c3](../../commit/89435c3))
- Add scroll area to the tab ([5cd27f3](../../commit/5cd27f3))
- Edit file name ([acd51b8](../../commit/acd51b8))
- Improve: create content menu which has: rename, close others, close all, copy file name, copy file path ([3994b3d](../../commit/3994b3d))
- Add loading status during loading file content ([777b019](../../commit/777b019))
- Style ::selection with another background + color ([6689ddd](../../commit/6689ddd))


📋 Full Changelog: [3f772fb...d345c06](../../compare/3f772fb...d345c06)