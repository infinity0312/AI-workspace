use reqwest::{redirect::Policy, Client, Method, Response, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

const MAX_JSON: usize = 12 * 1024 * 1024;
const MAX_DOWNLOAD: usize = 68 * 1024 * 1024;
const BACKEND_UNAVAILABLE: &str = "本地 API 暂不可用，已保存的草稿仍留在此设备";

pub struct Backend {
    client: Client,
    base: Url,
}

impl Backend {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let port = std::env::var("AKW_DESKTOP_API_PORT")
            .ok()
            .map(|value| value.parse::<u16>())
            .transpose()?
            .unwrap_or(4100);
        let base = Url::parse(&format!("http://127.0.0.1:{port}"))?;
        let client = Client::builder()
            .redirect(Policy::none())
            .no_proxy()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(20))
            .build()?;
        Ok(Self { client, base })
    }

    fn url(&self, path: &str) -> Result<Url, String> {
        if !path.starts_with("/v1/")
            || path.len() > 4096
            || path.contains("..")
            || !path
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"/-_.?&=%:".contains(&byte))
        {
            return Err("无效的 API 路径".into());
        }
        let target = self.base.join(path).map_err(|_| "无效的 API 路径")?;
        if target.origin() != self.base.origin() || !target.path().starts_with("/v1/") {
            return Err("无效的 API 路径".into());
        }
        Ok(target)
    }
}

#[derive(Deserialize)]
pub struct BackendRequest {
    path: String,
    method: String,
    body: Option<String>,
    key: Option<String>,
}

#[derive(Serialize)]
pub struct BackendResponse {
    status: u16,
    body: String,
}

async fn receive(mut response: Response, limit: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err("本地 API 响应超过大小限制".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| BACKEND_UNAVAILABLE)? {
        if bytes.len() + chunk.len() > limit {
            return Err("本地 API 响应超过大小限制".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn backend_request(
    state: State<'_, Backend>,
    request: BackendRequest,
) -> Result<BackendResponse, String> {
    let method = match request.method.as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PATCH" => Method::PATCH,
        _ => return Err("无效的 API 请求方法".into()),
    };
    let mut builder = state.client.request(method, state.url(&request.path)?);
    if let Some(body) = request.body {
        if body.len() > MAX_JSON {
            return Err("API 请求超过大小限制".into());
        }
        builder = builder
            .header("Content-Type", "application/json")
            .body(body);
    }
    if let Some(key) = request.key {
        if key.len() > 128
            || !key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"._:-".contains(&byte))
        {
            return Err("无效的请求幂等键".into());
        }
        builder = builder.header("Idempotency-Key", key);
    }
    let response = builder.send().await.map_err(|_| BACKEND_UNAVAILABLE)?;
    let status = response.status().as_u16();
    let body = String::from_utf8(receive(response, MAX_JSON).await?)
        .map_err(|_| "本地 API 响应无法读取")?;
    Ok(BackendResponse { status, body })
}

fn download_path(path: &str) -> bool {
    let parts: Vec<&str> = path.split('/').collect();
    matches!(parts.as_slice(), ["", "v1", "assets" | "exports", id, "download"] if Uuid::parse_str(id).is_ok())
}

fn suggested_name(response: &Response) -> String {
    let disposition = response
        .headers()
        .get("content-disposition")
        .and_then(|header| header.to_str().ok())
        .unwrap_or("");
    let name = disposition
        .split(';')
        .find_map(|field| {
            let field = field.trim();
            if let Some(value) = field.strip_prefix("filename*=UTF-8''") {
                return Some(
                    percent_encoding::percent_decode_str(value)
                        .decode_utf8_lossy()
                        .into_owned(),
                );
            }
            field
                .strip_prefix("filename=")
                .map(|value| value.trim_matches('"').to_string())
        })
        .unwrap_or_else(|| "download".into());
    let safe: String = name
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .take(180)
        .collect();
    let safe = safe.trim_matches(&[' ', '.'][..]);
    if safe.is_empty() {
        "download".into()
    } else {
        safe.into()
    }
}

#[tauri::command]
pub async fn save_download(
    app: AppHandle,
    window: WebviewWindow,
    path: String,
) -> Result<bool, String> {
    if !download_path(&path) {
        return Err("无效的下载地址".into());
    }
    let backend = app.state::<Backend>();
    let response = backend
        .client
        .get(backend.url(&path)?)
        .send()
        .await
        .map_err(|_| BACKEND_UNAVAILABLE)?;
    if !response.status().is_success() {
        return Err("文件暂不可下载".into());
    }
    let name = suggested_name(&response);
    let bytes = receive(response, MAX_DOWNLOAD).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_file_name(name)
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = file.into_path().map_err(|_| "保存路径不可用")?;
        std::fs::write(path, bytes).map_err(|_| "写入文件失败")?;
        Ok(true)
    })
    .await
    .map_err(|_| "保存操作未完成")?
}

#[tauri::command]
pub fn open_public_link(url: String) -> Result<(), String> {
    let url = Url::parse(&url).map_err(|_| "链接格式无效")?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("只支持普通网页链接".into());
    }
    tauri_plugin_opener::open_url(url.as_str(), None::<&str>).map_err(|_| "无法打开链接".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn api_target_stays_within_loopback_v1() {
        let backend = Backend::new().unwrap();
        assert!(backend.url("/v1/sync/changes?cursor=0").is_ok());
        assert!(backend.url("/workspaces").is_err());
        assert!(backend.url("https://example.com/v1/health").is_err());
        assert!(!download_path("/v1/health"));
    }
}
