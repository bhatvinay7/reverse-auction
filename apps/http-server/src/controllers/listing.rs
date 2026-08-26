use crate::error::AppError;
use crate::state::AppState;
use crate::types::{Claims, CreateListingPayload, ReviewListingPayload, ScheduleListingPayload};
use axum::{
    extract::{Extension, Path, State},
    Json,
};
use garde::Validate;
use serde_json::json;
use uuid::Uuid;

fn user_id(claims: &Claims) -> Result<Uuid, AppError> {
    Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))
}

pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateListingPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    payload
        .validate(&())
        .map_err(|e| AppError::BadRequest(format!("Validation failed: {e}")))?;
    let listing =
        crate::services::listing::create_listing(&state.db_pool, user_id(&claims)?, payload)?;
    Ok(Json(
        json!({"message":"Listing submitted for review","listing":listing}),
    ))
}

pub async fn mine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(
        json!({"listings":crate::services::listing::seller_listings(&state.db_pool, user_id(&claims)?)?}),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateListingPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    payload
        .validate(&())
        .map_err(|e| AppError::BadRequest(format!("Validation failed: {e}")))?;
    let listing =
        crate::services::listing::update_listing(&state.db_pool, id, user_id(&claims)?, payload)?;
    Ok(Json(json!({"message":"Listing updated","listing":listing})))
}

pub async fn resubmit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let listing =
        crate::services::listing::resubmit_listing(&state.db_pool, id, user_id(&claims)?)?;
    Ok(Json(
        json!({"message":"Listing resubmitted","listing":listing}),
    ))
}

pub async fn history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let events = crate::services::listing::listing_history(
        &state.db_pool,
        id,
        user_id(&claims)?,
        claims.role == "ADMIN",
    )?;
    Ok(Json(json!({"history":events})))
}

pub async fn all(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(
        json!({"listings":crate::services::listing::admin_listings(&state.db_pool)?}),
    ))
}

pub async fn review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReviewListingPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    let listing = crate::services::listing::review_listing(
        &state.db_pool,
        id,
        user_id(&claims)?,
        &payload.decision,
        payload.feedback,
    )?;
    Ok(Json(json!({"message":"Review saved","listing":listing})))
}

pub async fn schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ScheduleListingPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (listing, auction_id) = crate::services::listing::schedule_listing(
        &state.db_pool,
        &state.redis_pool,
        id,
        user_id(&claims)?,
        payload.auction_start_time,
        payload.auction_end_time,
    )
    .await?;
    Ok(Json(
        json!({"message":"Auction scheduled","auction_id":auction_id,"listing":listing}),
    ))
}
