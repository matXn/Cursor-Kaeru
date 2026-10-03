//! Persists Cursor's own models and which of them are passed on to Cursor.
use std::collections::HashSet;

use sqlx::Row;

use crate::{model::CursorModel, Error, Result};

use super::Store;

impl Store {
    pub async fn cursor_models(&self) -> Result<Vec<CursorModel>> {
        let rows = sqlx::query(
            "SELECT name, display_name, enabled FROM cursor_models ORDER BY sort_order",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| CursorModel {
                name: row.get("name"),
                display_name: row.get("display_name"),
                enabled: row.get("enabled"),
            })
            .collect())
    }

    pub async fn disabled_cursor_models(&self) -> Result<HashSet<String>> {
        let names = sqlx::query_scalar("SELECT name FROM cursor_models WHERE enabled = 0")
            .fetch_all(&self.pool)
            .await?;
        Ok(names.into_iter().collect())
    }

    /// Replaces the list with what Cursor's server just offered. Models keep their switch;
    /// new ones start on, and ones no longer offered are forgotten.
    pub async fn record_cursor_models(&self, offered: &[(String, String)]) -> Result<()> {
        let current = self.cursor_models().await?;
        let unchanged = current.len() == offered.len()
            && current
                .iter()
                .zip(offered)
                .all(|(model, (name, display_name))| {
                    &model.name == name && &model.display_name == display_name
                });
        if unchanged {
            return Ok(());
        }
        let _write = self.writes.lock().await;
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "CREATE TEMP TABLE IF NOT EXISTS offered_cursor_models (name TEXT PRIMARY KEY)",
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("DELETE FROM offered_cursor_models")
            .execute(&mut *tx)
            .await?;
        for (order, (name, display_name)) in offered.iter().enumerate() {
            sqlx::query(
                "INSERT INTO cursor_models (name, display_name, sort_order) VALUES (?, ?, ?)
                 ON CONFLICT(name) DO UPDATE SET display_name = excluded.display_name, sort_order = excluded.sort_order",
            )
            .bind(name)
            .bind(display_name)
            .bind(order as i64)
            .execute(&mut *tx)
            .await?;
            sqlx::query("INSERT OR IGNORE INTO offered_cursor_models (name) VALUES (?)")
                .bind(name)
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query(
            "DELETE FROM cursor_models WHERE name NOT IN (SELECT name FROM offered_cursor_models)",
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Switches one of Cursor's models, or all of them when `name` is `None`.
    pub async fn set_cursor_model_enabled(&self, name: Option<&str>, enabled: bool) -> Result<()> {
        let _write = self.writes.lock().await;
        let result = match name {
            Some(name) => {
                sqlx::query("UPDATE cursor_models SET enabled = ? WHERE name = ?")
                    .bind(enabled)
                    .bind(name)
                    .execute(&self.pool)
                    .await?
            }
            None => {
                sqlx::query("UPDATE cursor_models SET enabled = ?")
                    .bind(enabled)
                    .execute(&self.pool)
                    .await?
            }
        };
        if let (Some(name), 0) = (name, result.rows_affected()) {
            return Err(Error::RunNotFound(format!("Cursor model {name}")));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::model_fixtures::store;

    fn offered(names: &[&str]) -> Vec<(String, String)> {
        names
            .iter()
            .map(|name| (name.to_string(), name.to_uppercase()))
            .collect()
    }

    #[tokio::test]
    async fn switches_survive_a_new_list_and_vanished_models_are_forgotten() {
        let (_directory, store) = store().await;
        store
            .record_cursor_models(&offered(&["a", "b", "c"]))
            .await
            .unwrap();
        store
            .set_cursor_model_enabled(Some("b"), false)
            .await
            .unwrap();
        store
            .record_cursor_models(&offered(&["c", "b", "d"]))
            .await
            .unwrap();

        let models = store.cursor_models().await.unwrap();
        let names = models
            .iter()
            .map(|model| model.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(names, ["c", "b", "d"]);
        assert!(!models[1].enabled);
        assert!(models[2].enabled);
        assert_eq!(
            store.disabled_cursor_models().await.unwrap(),
            HashSet::from(["b".to_string()])
        );

        store.set_cursor_model_enabled(None, false).await.unwrap();
        assert_eq!(store.disabled_cursor_models().await.unwrap().len(), 3);
    }
}
