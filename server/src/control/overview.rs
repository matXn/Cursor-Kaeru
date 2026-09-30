//! Implements control dashboard overview endpoints.
//! HTTP handler for the desktop overview aggregates.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::{model::Overview, Result};

use super::ControlService;

#[derive(Debug, Default, Deserialize)]
pub struct OverviewRange {
    start_ms: Option<i64>,
    end_ms: Option<i64>,
    model_hashes: Option<String>,
    bucket_ms: Option<i64>,
    /// Client UTC offset; hour and day buckets start at local boundaries.
    #[serde(default)]
    utc_offset_ms: i64,
}

pub async fn get(
    State(service): State<ControlService>,
    Query(range): Query<OverviewRange>,
) -> Result<Json<Overview>> {
    Ok(Json(
        service
            .overview(
                range.start_ms,
                range.end_ms,
                range.model_hashes.as_deref(),
                range.bucket_ms,
                range.utc_offset_ms,
            )
            .await?,
    ))
}
