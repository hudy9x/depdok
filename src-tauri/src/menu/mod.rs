use tauri::{App, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder};

pub fn init(app: &mut App) -> tauri::Result<()> {
    let handle = app.handle();

    // --- File Menu ---
    let new_file_submenu = SubmenuBuilder::new(handle, "New file")
        .text("new_file_md", "Markdown")
        .text("new_file_mmd", "Mermaid")
        .text("new_file_todo", "Todo")
        .text("new_file_pu", "PlantUML")
        .text("new_file_txt", "Text")
        .build()?;
    
    let file_submenu = SubmenuBuilder::new(handle, "File")
        .item(&new_file_submenu)
        .text("open_file", "Open File")
        .text("open_folder", "Open Folder")
        .separator()
        .text("back", "Back")
        .separator()
        .text("quit", "Quit")
        .build()?;

    // --- Edit Menu ---
    let edit_submenu = SubmenuBuilder::new(handle, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // --- Selection Menu ---
    let selection_submenu = SubmenuBuilder::new(handle, "Selection")
        .item(&MenuItemBuilder::with_id("select_all", "Select All")
            .accelerator("CmdOrCtrl+A")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("expand_selection", "Expand Selection")
            .accelerator("Alt+Shift+Right")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("shrink_selection", "Shrink Selection")
            .accelerator("Alt+Shift+Left")
            .build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("copy_line_up", "Copy Line Up")
            .accelerator("Alt+Shift+Up")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("copy_line_down", "Copy Line Down")
            .accelerator("Alt+Shift+Down")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("move_line_up", "Move Line Up")
            .accelerator("Alt+Up")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("move_line_down", "Move Line Down")
            .accelerator("Alt+Down")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("duplicate_selection", "Duplicate Selection")
            .accelerator("Shift+CmdOrCtrl+D")
            .build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("add_cursor_above", "Add Cursor Above")
            .accelerator("Alt+CmdOrCtrl+Up")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("add_cursor_below", "Add Cursor Below")
            .accelerator("Alt+CmdOrCtrl+Down")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("add_cursors_to_line_ends", "Add Cursors to Line Ends")
            .accelerator("Shift+Alt+I")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("add_next_occurrence", "Add Next Occurrence")
            .accelerator("CmdOrCtrl+D")
            .build(handle)?)
        .text("add_previous_occurrence", "Add Previous Occurrence")
        .item(&MenuItemBuilder::with_id("select_all_occurrences", "Select All Occurrences")
            .accelerator("Shift+CmdOrCtrl+L")
            .build(handle)?)
        .separator()
        .text("column_selection_mode", "Column Selection Mode")
        .build()?;


    let menu = MenuBuilder::new(app)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&selection_submenu)
        .build()?;
    
    app.set_menu(menu)?;
    
    // Handle menu events
    app.on_menu_event(move |app_handle, event| {
        match event.id().0.as_str() {
             // File Menu
            "new_file_md" => { let _ = app_handle.emit("menu://new-file-md", ()); }
            "new_file_mmd" => { let _ = app_handle.emit("menu://new-file-mmd", ()); }
            "new_file_todo" => { let _ = app_handle.emit("menu://new-file-todo", ()); }
            "new_file_pu" => { let _ = app_handle.emit("menu://new-file-pu", ()); }
            "new_file_txt" => { let _ = app_handle.emit("menu://new-file-txt", ()); }
            "open_file" => { let _ = app_handle.emit("menu://open-file", ()); }
            "open_folder" => { let _ = app_handle.emit("menu://open-folder", ()); }
            "back" => { let _ = app_handle.emit("menu://back", ()); }
            "quit" => { app_handle.exit(0); }

            // Selection Menu
            "select_all" => { let _ = app_handle.emit("menu://selection/select-all", ()); }
            "expand_selection" => { let _ = app_handle.emit("menu://selection/expand", ()); }
            "shrink_selection" => { let _ = app_handle.emit("menu://selection/shrink", ()); }
            "copy_line_up" => { let _ = app_handle.emit("menu://selection/copy-line-up", ()); }
            "copy_line_down" => { let _ = app_handle.emit("menu://selection/copy-line-down", ()); }
            "move_line_up" => { let _ = app_handle.emit("menu://selection/move-line-up", ()); }
            "move_line_down" => { let _ = app_handle.emit("menu://selection/move-line-down", ()); }
            "duplicate_selection" => { let _ = app_handle.emit("menu://selection/duplicate", ()); }
            "add_cursor_above" => { let _ = app_handle.emit("menu://selection/add-cursor-above", ()); }
            "add_cursor_below" => { let _ = app_handle.emit("menu://selection/add-cursor-below", ()); }
            "add_cursors_to_line_ends" => { let _ = app_handle.emit("menu://selection/add-cursors-to-line-ends", ()); }
            "add_next_occurrence" => { let _ = app_handle.emit("menu://selection/add-next-occurrence", ()); }
            "add_previous_occurrence" => { let _ = app_handle.emit("menu://selection/add-previous-occurrence", ()); }
            "select_all_occurrences" => { let _ = app_handle.emit("menu://selection/select-all-occurrences", ()); }
            "column_selection_mode" => { let _ = app_handle.emit("menu://selection/column-selection-mode", ()); }

            _ => {}
        }
    });

    Ok(())
}
