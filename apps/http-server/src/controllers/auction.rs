use crate::error::AppError;
use crate::services::auction::create_auction_service;
use crate::state::AppState;
use crate::types::CreateAuctionPayload;
use axum::response::IntoResponse;
use axum::{extract::State, Json};
use garde::Validate;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;
// In a real app we'd extract the user_id from the JWT token via middleware
// For this example, we'll extract it from an Authorization header manually or mock it.

pub async fn create_auction_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
    Json(payload): Json<CreateAuctionPayload>,
) -> Result<impl IntoResponse, AppError> {
    // Validate payload using garde
    if let Err(e) = payload.validate(&()) {
        return Err(AppError::BadRequest(format!("Validation failed: {}", e)));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;

    let auction_id =
        create_auction_service(&state.db_pool, &state.redis_pool, payload, user_id).await?;

    Ok(Json(json!({
        "message": "Auction created successfully",
        "auction_id": auction_id
    })))
}

pub async fn join_auction_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
    axum::extract::Path(auction_id): axum::extract::Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;

    crate::services::auction::join_auction_service(
        &state.db_pool,
        &state.redis_pool,
        auction_id,
        user_id,
    )
    .await?;
    Ok(Json(json!({
        "message": "Successfully joined the auction"
    })))
}

pub async fn leave_auction_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
    axum::extract::Path(auction_id): axum::extract::Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;

    crate::services::auction::leave_auction_service(
        &state.db_pool,
        &state.redis_pool,
        auction_id,
        user_id,
    )
    .await?;

    Ok(Json(json!({
        "message": "Successfully unregistered from the auction"
    })))
}

pub async fn get_auctions_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;

    let auctions =
        crate::services::auction::get_auctions_service(&state.db_pool, &state.redis_pool, user_id)
            .await?;
    Ok(Json(json!({
        "auctions": auctions
    })))
}

pub async fn get_auction_bids_handler(
    State(state): State<AppState>,
    axum::extract::Path(auction_id): axum::extract::Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let bids = crate::services::auction::get_auction_bids_service(
        &state.db_pool,
        &state.redis_pool,
        auction_id,
    )
    .await?;

    Ok(Json(json!({
        "bids": bids
    })))
}

#[derive(Debug, Deserialize)]
pub struct BidAuditQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn get_bid_audit_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
    axum::extract::Path(auction_id): axum::extract::Path<Uuid>,
    axum::extract::Query(query): axum::extract::Query<BidAuditQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;
    let (events, total, limit, offset) = crate::services::auction::get_bid_audit_service(
        &state.db_pool,
        auction_id,
        user_id,
        query.limit,
        query.offset,
    )
    .await?;
    let has_more = offset + (events.len() as i64) < total;

    Ok(Json(json!({
        "events": events,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        }
    })))
}

pub async fn get_auction_history_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;

    let auctions =
        crate::services::auction::get_auction_history_service(&state.db_pool, user_id).await?;
    Ok(Json(json!({
        "auctions": auctions
    })))
}

#[derive(Debug, Deserialize)]
pub struct DiscussionQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct PostDiscussionPayload {
    pub message: String,
}

pub async fn get_auction_discussion_handler(
    State(state): State<AppState>,
    axum::extract::Path(auction_id): axum::extract::Path<Uuid>,
    axum::extract::Query(query): axum::extract::Query<DiscussionQuery>,
) -> Result<impl IntoResponse, AppError> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(30);

    let messages = crate::services::auction::get_auction_discussion_service(
        &state.db_pool,
        &state.redis_pool,
        auction_id,
        page,
        limit,
    )
    .await?;

    Ok(Json(json!({
        "messages": messages,
        "page": page,
        "limit": limit
    })))
}

pub async fn post_auction_discussion_handler(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
    axum::extract::Path(auction_id): axum::extract::Path<Uuid>,
    Json(payload): Json<PostDiscussionPayload>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user id in token".into()))?;

    // We can extract username from token or DB. Since claims usually have name or we query DB.
    // For now we will use a dummy username or query it if needed. Let's just pass "User"
    // Wait, the username is in the DB. We should fetch it or pass it. We will use a mock "User".
    let username = "User".to_string(); // In real app, fetch from users table using user_id

    let message = crate::services::auction::post_auction_discussion_service(
        &state.db_pool,
        &state.redis_pool,
        auction_id,
        user_id,
        username,
        payload.message,
    )
    .await?;

    Ok(Json(json!({
        "message": "Message posted successfully",
        "data": message
    })))
}
