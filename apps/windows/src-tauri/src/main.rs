#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod files;
mod storage;
mod transport;

use files::ImportGrants;
use storage::LocalStore;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, DragDropEvent, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn quick_capture(app: &AppHandle) {
    focus_main(app);
    let _ = app.emit_to("main", "akw-quick-capture", ());
}

fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "show", "打开工作台", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "快速捕获", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &capture, &exit])?;
    let mut tray = TrayIconBuilder::with_id("akw")
        .menu(&menu)
        .tooltip("AI Knowledge Workspace")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => focus_main(app),
            "capture" => quick_capture(app),
            "exit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[tauri::command]
fn read_clipboard(app: AppHandle) -> Result<String, String> {
    let text = app
        .clipboard()
        .read_text()
        .map_err(|_| "剪贴板没有可用的文本")?;
    if text.len() > 600_000 {
        return Err("剪贴板文本超过导入限制".into());
    }
    Ok(text)
}

#[tauri::command]
fn write_clipboard(app: AppHandle, text: String) -> Result<(), String> {
    if text.len() > 2 * 1024 * 1024 {
        return Err("剪贴板文本超过大小限制".into());
    }
    app.clipboard()
        .write_text(text)
        .map_err(|_| "无法写入剪贴板".into())
}

#[tauri::command]
fn show_notification(app: AppHandle, title: String, message: String) -> Result<(), String> {
    if title.chars().count() > 100 || message.chars().count() > 240 {
        return Err("通知超过大小限制".into());
    }
    app.notification()
        .builder()
        .title(title)
        .body(message)
        .show()
        .map_err(|_| "Windows 无法显示通知".into())
}

#[tauri::command]
fn set_research_activity(app: AppHandle, active: u32) {
    if let Some(tray) = app.tray_by_id("akw") {
        let caption = if active == 0 {
            "AI Knowledge Workspace".into()
        } else {
            format!("AI Knowledge Workspace · {active} 项研究运行中")
        };
        let _ = tray.set_tooltip(Some(caption));
    }
}

#[tauri::command]
async fn open_artifact_window(
    app: AppHandle,
    workspace: String,
    artifact: String,
) -> Result<(), String> {
    let workspace = Uuid::parse_str(&workspace).map_err(|_| "无效工作空间")?;
    let artifact = Uuid::parse_str(&artifact).map_err(|_| "无效文档")?;
    let label = format!("artifact-{artifact}");
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.unminimize();
        return window.set_focus().map_err(|_| "无法切换到文档窗口".into());
    }
    let destination = format!("index.html?workspace={workspace}&artifact={artifact}");
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(destination.into()))
        .title("文档 · AI Knowledge Workspace")
        .inner_size(1150.0, 800.0)
        .min_inner_size(770.0, 530.0)
        .build()
        .map_err(|_| "无法打开文档窗口")?;
    Ok(())
}

struct CaptureShortcut(Option<String>);

#[tauri::command]
fn quick_capture_shortcut(shortcut: tauri::State<'_, CaptureShortcut>) -> Option<String> {
    shortcut.0.clone()
}

fn register_capture_shortcut(app: &AppHandle) -> Option<String> {
    let preferred = std::env::var("AKW_QUICK_CAPTURE_KEY")
        .ok()
        .filter(|key| key.len() <= 64);
    let defaults = ["Ctrl+Shift+Space", "Ctrl+Alt+Shift+Space", "Ctrl+Shift+F9"];
    preferred
        .into_iter()
        .chain(defaults.map(String::from))
        .find(|text| {
            text.parse::<Shortcut>()
                .is_ok_and(|key| app.global_shortcut().register(key).is_ok())
        })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            focus_main(app)
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        quick_capture(app);
                    }
                })
                .build(),
        )
        .manage(ImportGrants::default())
        .setup(move |app| {
            let data = std::env::var_os("AKW_DESKTOP_DATA_DIR")
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_local_data_dir()?);
            std::fs::create_dir_all(&data)?;
            app.manage(LocalStore::open(&data.join("workspace.sqlite3"))?);
            app.manage(transport::Backend::new()?);
            install_tray(app)?;
            let shortcut = register_capture_shortcut(app.handle());
            if shortcut.is_none() {
                eprintln!("Quick Capture shortcut unavailable. The tray entry remains available.");
            }
            app.manage(CaptureShortcut(shortcut));
            Ok(())
        })
        .on_window_event(|window, event| {
            let grants = window.app_handle().state::<ImportGrants>();
            match event {
                WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) => {
                    let selection = grants.issue(window.label(), paths.clone());
                    let _ = window
                        .app_handle()
                        .emit_to(window.label(), "akw-file-drop", selection);
                }
                WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                WindowEvent::Destroyed => grants.discard_window(window.label()),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            transport::backend_request,
            transport::save_download,
            transport::open_public_link,
            storage::sqlite_read,
            storage::sqlite_list,
            storage::sqlite_compare_exchange,
            files::pick_import_files,
            files::read_import_file,
            files::discard_import_file,
            read_clipboard,
            write_clipboard,
            show_notification,
            set_research_activity,
            open_artifact_window,
            quick_capture_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("Desktop runtime failed");
}
