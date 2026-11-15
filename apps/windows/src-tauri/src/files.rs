use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant, SystemTime},
};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

const MAX_BYTES: u64 = 8 * 1024 * 1024;
const MAX_FILES: usize = 24;
const EXTENSIONS: &[&str] = &[
    "pdf", "txt", "md", "html", "htm", "docx", "pptx", "xlsx", "png", "jpg", "jpeg",
];

#[derive(Clone, Serialize)]
pub struct NativeFile {
    id: String,
    name: String,
    size: u64,
}

#[derive(Clone, Default, Serialize)]
pub struct Selection {
    pub files: Vec<NativeFile>,
    pub skipped: usize,
}

#[derive(Clone)]
struct Grant {
    window: String,
    path: PathBuf,
    size: u64,
    modified: SystemTime,
    expires: Instant,
}

#[derive(Default)]
pub struct ImportGrants(Mutex<HashMap<String, Grant>>);

fn valid_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            EXTENSIONS
                .iter()
                .any(|supported| ext.eq_ignore_ascii_case(supported))
        })
}

impl ImportGrants {
    pub fn issue(&self, window: &str, paths: Vec<PathBuf>) -> Selection {
        let Ok(mut store) = self.0.lock() else {
            return Selection {
                files: vec![],
                skipped: paths.len(),
            };
        };
        store.retain(|_, grant| grant.expires > Instant::now());
        let mut selection = Selection::default();
        let mut seen = std::collections::HashSet::new();
        for path in paths {
            if selection.files.len() >= MAX_FILES
                || store.len() >= MAX_FILES * 6
                || !valid_extension(&path)
            {
                selection.skipped += 1;
                continue;
            }
            let Some(name) = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
            else {
                selection.skipped += 1;
                continue;
            };
            let Ok(path) = path.canonicalize() else {
                selection.skipped += 1;
                continue;
            };
            if !seen.insert(path.clone()) {
                continue;
            }
            let Ok(metadata) = path.metadata() else {
                selection.skipped += 1;
                continue;
            };
            let Ok(modified) = metadata.modified() else {
                selection.skipped += 1;
                continue;
            };
            if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_BYTES {
                selection.skipped += 1;
                continue;
            }
            let id = Uuid::new_v4().to_string();
            let size = metadata.len();
            store.insert(
                id.clone(),
                Grant {
                    window: window.into(),
                    path,
                    size,
                    modified,
                    expires: Instant::now() + Duration::from_secs(900),
                },
            );
            selection.files.push(NativeFile { id, name, size });
        }
        selection
    }

    fn allowed(&self, window: &str, id: &str) -> Result<Grant, String> {
        let store = self.0.lock().map_err(|_| "文件授权不可用")?;
        store
            .get(id)
            .filter(|grant| grant.window == window && grant.expires > Instant::now())
            .cloned()
            .ok_or_else(|| "文件授权已失效，请重新选择文件".into())
    }

    fn discard(&self, window: &str, id: &str) {
        if let Ok(mut store) = self.0.lock() {
            if store.get(id).is_some_and(|grant| grant.window == window) {
                store.remove(id);
            }
        }
    }

    pub fn discard_window(&self, window: &str) {
        if let Ok(mut store) = self.0.lock() {
            store.retain(|_, grant| grant.window != window);
        }
    }
}

fn directory_files(path: &Path) -> Result<(Vec<PathBuf>, usize), String> {
    let mut paths = Vec::new();
    let mut skipped = 0;
    for (index, entry) in fs::read_dir(path)
        .map_err(|_| "无法读取所选文件夹")?
        .enumerate()
    {
        if index >= 250 {
            skipped += 1;
            break;
        }
        let Ok(entry) = entry else {
            skipped += 1;
            continue;
        };
        if !entry.file_type().is_ok_and(|kind| kind.is_file()) || !valid_extension(&entry.path()) {
            continue;
        }
        if paths.len() >= MAX_FILES {
            skipped += 1;
            continue;
        }
        paths.push(entry.path());
    }
    paths.sort();
    Ok((paths, skipped))
}

#[tauri::command]
pub async fn pick_import_files(
    app: AppHandle,
    window: WebviewWindow,
    directory: bool,
) -> Result<Selection, String> {
    let label = window.label().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let dialog = app.dialog().file().set_parent(&window);
        let (paths, skipped) = if directory {
            let Some(path) = dialog.set_title("选择资料文件夹").blocking_pick_folder()
            else {
                return Ok(Selection::default());
            };
            directory_files(&path.into_path().map_err(|_| "文件夹路径不可用")?)?
        } else {
            let paths = dialog
                .set_title("选择要导入的资料")
                .add_filter("知识资料", EXTENSIONS)
                .blocking_pick_files()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|path| path.into_path().ok())
                .collect();
            (paths, 0)
        };
        let mut selection = app.state::<ImportGrants>().issue(&label, paths);
        selection.skipped += skipped;
        Ok(selection)
    })
    .await
    .map_err(|_| "文件选择器未完成")?
}

#[tauri::command]
pub async fn read_import_file(
    app: AppHandle,
    window: WebviewWindow,
    id: String,
) -> Result<String, String> {
    let grant = app.state::<ImportGrants>().allowed(window.label(), &id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let file = File::open(&grant.path).map_err(|_| "无法读取所选文件")?;
        let metadata = file.metadata().map_err(|_| "无法检查所选文件")?;
        if metadata.len() != grant.size || metadata.modified().ok() != Some(grant.modified) {
            return Err("所选文件已变化，请重新选择".into());
        }
        let mut bytes = Vec::with_capacity(grant.size as usize);
        file.take(MAX_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "读取资料失败")?;
        if bytes.len() as u64 != grant.size {
            return Err("所选文件已变化，请重新选择".into());
        }
        Ok(STANDARD.encode(bytes))
    })
    .await
    .map_err(|_| "读取资料未完成")?
}

#[tauri::command]
pub fn discard_import_file(window: WebviewWindow, grants: State<'_, ImportGrants>, id: String) {
    grants.discard(window.label(), &id);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn grant_is_scoped_to_the_issuing_window_and_can_be_revoked() {
        let path = std::env::temp_dir().join(format!("akw-{}.txt", Uuid::new_v4()));
        fs::write(&path, "sample").unwrap();
        let grants = ImportGrants::default();
        let selected = grants.issue("main", vec![path.clone()]);
        let id = &selected.files[0].id;
        assert!(grants.allowed("main", id).is_ok());
        assert!(grants.allowed("different-window", id).is_err());
        grants.discard_window("main");
        assert!(grants.allowed("main", id).is_err());
        fs::remove_file(path).unwrap();
    }
}
