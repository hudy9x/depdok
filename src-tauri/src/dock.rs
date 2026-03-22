//! macOS dock right-click menu using objc2 msg_send! with raw pointers.
//!
//! We work entirely with *mut AnyObject / *const AnyClass raw pointers so we
//! never hit the MainThreadOnly / AnyThread trait constraints of the high-level
//! objc2-app-kit wrapper types.

use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

use objc2::ffi::{
    class_addMethod, objc_allocateClassPair, objc_getClass, objc_registerClassPair,
    object_getClass, sel_registerName,
};
use objc2::runtime::{AnyClass, AnyObject, Sel};
use objc2::msg_send;

static DOCK_FOLDERS: Mutex<Vec<String>> = Mutex::new(Vec::new());
static DOCK_APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
/// The DockActionTarget instance as a raw usize (avoids Send/Sync issues).
static DOCK_TARGET_PTR: OnceLock<usize> = OnceLock::new();

const TAG_NEW_WINDOW: isize = -1;

// ─── Public API ───────────────────────────────────────────────────────────────

pub fn setup(app_handle: &AppHandle) {
    let _ = DOCK_APP_HANDLE.set(app_handle.clone());
    unsafe { init_dock() };
}

pub fn rebuild(_app_handle: &AppHandle, recent_folders: &[String]) {
    *DOCK_FOLDERS.lock().unwrap() = recent_folders.to_vec();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Wraps sel_registerName and unwraps the Option<Sel> — panics if name is invalid
/// (which would indicate a programmer error in a constant string literal).
unsafe fn sel(name: &std::ffi::CStr) -> Sel {
    sel_registerName(name.as_ptr().cast()).expect("sel_registerName returned None")
}

/// Cast objc_msgSend to the desired fn-pointer type via a pointer-sized integer
/// to avoid the "non-primitive cast" error on the function item directly.
macro_rules! objc_msg_send_fn {
    ($ty:ty) => {{
        let raw: usize = objc2::ffi::objc_msgSend as usize;
        std::mem::transmute::<usize, $ty>(raw)
    }};
}

// ─── Implementation ───────────────────────────────────────────────────────────

unsafe fn init_dock() {
    // 1. Register DockActionTarget ObjC class with dockAction: method
    let ns_object: *const AnyClass = objc_getClass(c"NSObject".as_ptr().cast());
    let target_cls: *mut AnyClass = objc_allocateClassPair(
        ns_object,
        c"DockActionTarget".as_ptr().cast(),
        0,
    );

    if !target_cls.is_null() {
        // Add dockAction:  (IMP signature: void fn(id self, SEL _cmd, id sender))
        unsafe extern "C-unwind" fn dock_action_imp(
            _self: *mut AnyObject,
            _cmd: Sel,
            sender: *mut AnyObject,
        ) {
            // Read the NSMenuItem tag (returns isize).
            type FnTag = unsafe extern "C-unwind" fn(*mut AnyObject, Sel) -> isize;
            let tag = {
                let fn_ptr: FnTag = objc_msg_send_fn!(FnTag);
                let sel_tag = sel_registerName(c"tag".as_ptr().cast())
                    .expect("sel_registerName: tag");
                fn_ptr(sender, sel_tag)
            };

            let Some(app) = DOCK_APP_HANDLE.get() else { return };
            if tag == TAG_NEW_WINDOW {
                let _ = app.emit("menu://new-window", ());
            } else if tag >= 0 {
                let folders = DOCK_FOLDERS.lock().unwrap();
                if let Some(path) = folders.get(tag as usize).cloned() {
                    drop(folders);
                    let _ = app.emit("menu://open-recent-folder", path);
                }
            }
        }

        let sel_dock_action = sel(c"dockAction:");
        class_addMethod(
            target_cls,
            sel_dock_action,
            std::mem::transmute::<
                unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject),
                unsafe extern "C-unwind" fn(),
            >(dock_action_imp),
            c"v@:@".as_ptr().cast(),
        );

        objc_registerClassPair(target_cls);
    }

    // 2. Alloc+init a DockActionTarget instance and keep it alive forever.
    let target_cls_ref: &AnyClass = {
        let p: *const AnyClass = objc_getClass(c"DockActionTarget".as_ptr().cast());
        &*p
    };
    let target_obj: *mut AnyObject = msg_send![target_cls_ref, alloc];
    let target_obj: *mut AnyObject = msg_send![target_obj, init];
    let raw_ptr = target_obj as usize;
    let _ = DOCK_TARGET_PTR.set(raw_ptr);
    // DO NOT release — intentionally leaked so it lives forever.

    // 3. Add applicationDockTileMenu: to the existing NSApplicationDelegate.
    let ns_app_cls: *const AnyClass = objc_getClass(c"NSApplication".as_ptr().cast());
    let ns_app: *mut AnyObject = msg_send![&*ns_app_cls, sharedApplication];
    let delegate: *mut AnyObject = msg_send![&*ns_app, delegate];
    if delegate.is_null() { return; }

    let delegate_cls: *const AnyClass = object_getClass(delegate);
    if delegate_cls.is_null() { return; }

    unsafe extern "C-unwind" fn application_dock_tile_menu(
        _self: *mut AnyObject,
        _cmd: Sel,
        _app: *mut AnyObject,
    ) -> *mut AnyObject {
        build_menu_raw()
    }

    let sel_adtm = sel(c"applicationDockTileMenu:");
    class_addMethod(
        delegate_cls as *mut AnyClass,
        sel_adtm,
        std::mem::transmute::<
            unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject) -> *mut AnyObject,
            unsafe extern "C-unwind" fn(),
        >(application_dock_tile_menu),
        c"@@:@".as_ptr().cast(),
    );
}

/// Build the dock NSMenu, returning a +1-retained raw pointer for Cocoa.
unsafe fn build_menu_raw() -> *mut AnyObject {
    let target_raw = match DOCK_TARGET_PTR.get() {
        Some(&p) => p as *mut AnyObject,
        None => return std::ptr::null_mut(),
    };

    // NSMenu *menu = [[NSMenu alloc] initWithTitle:@""]
    let ns_menu_cls: *const AnyClass = objc_getClass(c"NSMenu".as_ptr().cast());
    let empty_nsstr: *mut AnyObject = make_nsstring("");
    let menu: *mut AnyObject = {
        let alloc: *mut AnyObject = msg_send![&*ns_menu_cls, alloc];
        msg_send![alloc, initWithTitle: empty_nsstr]
    };

    let folders = DOCK_FOLDERS.lock().unwrap().clone();

    for (i, folder) in folders.iter().enumerate().take(10) {
        let name = folder.split(['/', '\\'])
            .filter(|s| !s.is_empty())
            .last()
            .unwrap_or(folder.as_str());
        let item = make_nsmi(name, c"dockAction:".as_ptr().cast(), target_raw, i as isize);
        let _: () = msg_send![menu, addItem: item];
    }

    if !folders.is_empty() {
        let sep = separator_item();
        let _: () = msg_send![menu, addItem: sep];
    }

    let nw = make_nsmi("New Window", c"dockAction:".as_ptr().cast(), target_raw, TAG_NEW_WINDOW);
    let _: () = msg_send![menu, addItem: nw];

    // Retain +1 so the autorelease pool doesn't collect it before Cocoa uses it.
    let _: *mut AnyObject = msg_send![menu, retain];
    menu
}

// ─── ObjC construction helpers ────────────────────────────────────────────────

unsafe fn make_nsstring(s: &str) -> *mut AnyObject {
    let cls: *const AnyClass = objc_getClass(c"NSString".as_ptr().cast());
    let cstr = std::ffi::CString::new(s).unwrap_or_default();
    let sel_suwu8s = sel(c"stringWithUTF8String:");
    // stringWithUTF8String: returns autoreleased — transmute to call with C-unwind ABI.
    type FnStrPtr = unsafe extern "C-unwind" fn(*const AnyClass, Sel, *const std::ffi::c_char) -> *mut AnyObject;
    let f: FnStrPtr = objc_msg_send_fn!(FnStrPtr);
    f(cls, sel_suwu8s, cstr.as_ptr())
}

/// Build an autoreleased NSMenuItem (raw pointer, caller does not own it).
unsafe fn make_nsmi(
    title: &str,
    action_cstr: *const i8,
    target: *mut AnyObject,
    tag: isize,
) -> *mut AnyObject {
    let cls: *const AnyClass = objc_getClass(c"NSMenuItem".as_ptr().cast());
    let ns_title = make_nsstring(title);
    let ns_empty  = make_nsstring("");
    let action_sel = sel_registerName(action_cstr.cast())
        .expect("sel_registerName: action");

    // [[NSMenuItem alloc] initWithTitle:action:keyEquivalent:]
    let alloc: *mut AnyObject = msg_send![&*cls, alloc];
    let item: *mut AnyObject = msg_send![
        alloc,
        initWithTitle: ns_title,
        action: action_sel,
        keyEquivalent: ns_empty,
    ];

    // setTag: and setTarget:
    let _: () = msg_send![item, setTag: tag];
    let _: () = msg_send![item, setTarget: target];
    item
}

unsafe fn separator_item() -> *mut AnyObject {
    let cls: *const AnyClass = objc_getClass(c"NSMenuItem".as_ptr().cast());
    // separatorItem returns an autoreleased object
    msg_send![&*cls, separatorItem]
}
