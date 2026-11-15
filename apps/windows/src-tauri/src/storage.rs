use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::{path::Path, sync::Mutex};
use tauri::State;

const MAX_VALUE: usize = 16 * 1024 * 1024;
const ERROR: &str = "Windows 本地数据库不可用";

pub struct LocalStore(Mutex<Connection>);

impl LocalStore {
    pub fn open(path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let connection = Connection::open(path)?;
        connection.busy_timeout(std::time::Duration::from_secs(4))?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=FULL;
             CREATE TABLE IF NOT EXISTS cache (
                 namespace TEXT NOT NULL CHECK(namespace IN ('metadata', 'documents')),
                 key TEXT NOT NULL,
                 value TEXT NOT NULL,
                 PRIMARY KEY(namespace,key)
             );",
        )?;
        Ok(Self(Mutex::new(connection)))
    }

    fn read(&self, store: &str, key: &str) -> Result<Option<String>, String> {
        check(store, key)?;
        let db = self.0.lock().map_err(|_| ERROR)?;
        select(&db, store, key)
    }

    fn list(&self, store: &str) -> Result<Vec<String>, String> {
        check(store, "")?;
        let db = self.0.lock().map_err(|_| ERROR)?;
        let mut query = db
            .prepare("SELECT value FROM cache WHERE namespace=?1")
            .map_err(|_| ERROR)?;
        let rows = query
            .query_map([store], |row| row.get(0))
            .map_err(|_| ERROR)?;
        rows.collect::<Result<Vec<String>, _>>()
            .map_err(|_| ERROR.into())
    }

    fn compare_exchange(
        &self,
        store: &str,
        key: &str,
        expected: Option<&str>,
        value: &str,
    ) -> Result<bool, String> {
        check(store, key)?;
        if value.len() > MAX_VALUE || expected.is_some_and(|prior| prior.len() > MAX_VALUE) {
            return Err("本地记录超过大小限制".into());
        }
        let mut db = self.0.lock().map_err(|_| ERROR)?;
        let transaction = db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| ERROR)?;
        if select(&transaction, store, key)?.as_deref() != expected {
            return Ok(false);
        }
        transaction
            .execute(
                "INSERT INTO cache(namespace,key,value) VALUES(?1,?2,?3)
             ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value",
                params![store, key, value],
            )
            .map_err(|_| ERROR)?;
        transaction.commit().map_err(|_| ERROR)?;
        Ok(true)
    }
}

fn check(store: &str, key: &str) -> Result<(), String> {
    if matches!(store, "metadata" | "documents") && key.len() <= 200 {
        Ok(())
    } else {
        Err("无效的本地存储键".into())
    }
}

fn select(connection: &Connection, store: &str, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM cache WHERE namespace=?1 AND key=?2",
            params![store, key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| ERROR.into())
}

#[tauri::command]
pub fn sqlite_read(
    db: State<'_, LocalStore>,
    store: String,
    key: String,
) -> Result<Option<String>, String> {
    db.read(&store, &key)
}

#[tauri::command]
pub fn sqlite_list(db: State<'_, LocalStore>, store: String) -> Result<Vec<String>, String> {
    db.list(&store)
}

#[tauri::command]
pub fn sqlite_compare_exchange(
    db: State<'_, LocalStore>,
    store: String,
    key: String,
    expected: Option<String>,
    value: String,
) -> Result<bool, String> {
    db.compare_exchange(&store, &key, expected.as_deref(), &value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn compare_exchange_keeps_the_first_writer() {
        let store = LocalStore::open(Path::new(":memory:")).unwrap();
        assert!(store
            .compare_exchange("documents", "test", None, "draft")
            .unwrap());
        assert!(!store
            .compare_exchange("documents", "test", None, "other")
            .unwrap());
        assert!(store
            .compare_exchange("documents", "test", Some("draft"), "accepted")
            .unwrap());
        assert_eq!(
            store.read("documents", "test").unwrap().as_deref(),
            Some("accepted")
        );
        assert_eq!(store.list("documents").unwrap(), vec!["accepted"]);
    }
}
