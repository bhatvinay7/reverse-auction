use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use diesel::r2d2::{ConnectionManager, Pool};
use diesel::PgConnection;
use redis::AsyncCommands;
use serde_json::json;
use std::env;
use tower::ServiceExt; // for `oneshot`

use http_server::routes::app_router;
use http_server::state::AppState;

async fn setup_state() -> AppState {
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@127.0.0.1:5432/auction_test".to_string()
    });
    let manager = ConnectionManager::<PgConnection>::new(db_url);
    let pool = Pool::builder().build(manager).unwrap();

    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let redis_manager = bb8_redis::RedisConnectionManager::new(redis_url).unwrap();
    let redis_pool = bb8::Pool::builder().build(redis_manager).await.unwrap();
    AppState {
        db_pool: pool,
        redis_pool,
    }
}

async fn set_signup_otp(state: &AppState, email: &str) {
    let mut connection = state.redis_pool.get().await.unwrap();
    let _: () = connection
        .set_ex(format!("signup_otp:{email}"), "123456", 300)
        .await
        .unwrap();
}

#[tokio::test]
async fn test_create_auction_unauthorized() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let req = Request::builder()
        .uri("/api/auction/create")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "title": "Test Shipment",
                "description": "Test Description",
                "freight_type": "LTL",
                "origin_address": "NY",
                "origin_lat": 40.7128,
                "origin_lng": -74.0060,
                "dest_address": "LA",
                "dest_lat": 34.0522,
                "dest_lng": -118.2437,
                "pickup_date_start": "2024-01-01T00:00:00Z",
                "pickup_date_end": "2024-01-02T00:00:00Z",
                "auction_start_time": "2024-01-01T00:00:00Z",
                "auction_end_time": "2024-01-01T01:00:00Z"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_auction_success() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let email = format!("auction_creator_{}@example.com", uuid::Uuid::new_v4());

    // Set OTP in Redis
    set_signup_otp(&state, &email).await;

    let req_signup = Request::builder()
        .uri("/api/auth/signup")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": &email,
                "password": "password123",
                "name": "Test Auction User",
                "otp": "123456"
            }))
            .unwrap(),
        ))
        .unwrap();

    let app_clone1 = app_router().with_state(state.clone());
    let response_signup = app_clone1.oneshot(req_signup).await.unwrap();
    assert_eq!(response_signup.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response_signup.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let auth_resp: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    let user_id = auth_resp.get("user_id").unwrap().as_str().unwrap();
    let token = auth_resp.get("token").unwrap().as_str().unwrap();

    let req = Request::builder()
        .uri("/api/auction/create")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .header("Authorization", format!("Bearer {}", token))
        .header("x-user-id", user_id)
        .body(Body::from(
            serde_json::to_vec(&json!({
                "title": "Test Shipment",
                "description": "Test Description",
                "freight_type": "LTL",
                "origin_address": "NY",
                "origin_lat": 40.7128,
                "origin_lng": -74.0060,
                "dest_address": "LA",
                "dest_lat": 34.0522,
                "dest_lng": -118.2437,
                "pickup_date_start": "2024-01-01T00:00:00Z",
                "pickup_date_end": "2024-01-02T00:00:00Z",
                "auction_start_time": "2024-01-01T00:00:00Z",
                "auction_end_time": "2024-01-01T01:00:00Z",
                "weight": 1500.5,
                "length": 10.0,
                "width": 5.5,
                "height": 5.0,
                "starting_price": 500.0,
                "media_urls": ["http://example.com/image.jpg", "http://example.com/video.mp4"]
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    let status = response.status();
    let body_bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
        .await
        .unwrap();
    println!(
        "CREATE AUCTION RESPONSE: {:?}",
        std::str::from_utf8(&body_bytes)
    );

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn test_sign_up_validation_error() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let req = Request::builder()
        .uri("/api/auth/signup")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": "invalidemail", // Invalid email
                "password": "pass",      // Too short
                "name": "a",              // Too short
                "otp": "12"              // Too short
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_sign_in_validation_error() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let req = Request::builder()
        .uri("/api/auth/signin")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": "invalidemail",
                "password": ""
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_sign_up_success() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let email = format!("test_{}@example.com", uuid::Uuid::new_v4());

    // Set OTP in Redis
    set_signup_otp(&state, &email).await;

    let req = Request::builder()
        .uri("/api/auth/signup")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": email,
                "password": "password123",
                "name": "Test User",
                "company_name": "Test Company",
                "role_type": "SELLER",
                "otp": "123456"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();

    let status = response.status();
    if status != StatusCode::OK {
        let body_bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .unwrap();
        panic!(
            "Signup failed with status {}: {:?}",
            status,
            std::str::from_utf8(&body_bytes)
        );
    }
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn test_sign_in_success() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let email = format!("test_signin_{}@example.com", uuid::Uuid::new_v4());

    // Set OTP in Redis
    set_signup_otp(&state, &email).await;

    let req_signup = Request::builder()
        .uri("/api/auth/signup")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": &email,
                "password": "password123",
                "name": "Test User",
                "otp": "123456"
            }))
            .unwrap(),
        ))
        .unwrap();

    let app_clone = app_router().with_state(state.clone());
    let _ = app_clone.oneshot(req_signup).await.unwrap();

    let req_signin = Request::builder()
        .uri("/api/auth/signin")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": email,
                "password": "password123"
            }))
            .unwrap(),
        ))
        .unwrap();

    let response = app.oneshot(req_signin).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_upload_missing_env_error() {
    // We expect this to fail gracefully with 500 if env vars are missing or invalid
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let body = "--boundary\r\n\
                Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\
                Content-Type: text/plain\r\n\r\n\
                Hello World\r\n\
                --boundary--\r\n";

    let req = Request::builder()
        .uri("/api/upload")
        .method("POST")
        .header(
            header::CONTENT_TYPE,
            "multipart/form-data; boundary=boundary",
        )
        .body(Body::from(body))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    // Since the route is protected, we expect an Unauthorized (401) because no token is provided.
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_join_auction_success() {
    let state = setup_state().await;
    let app = app_router().with_state(state.clone());

    let email = format!("join_test_{}@example.com", uuid::Uuid::new_v4());

    // Set OTP in Redis
    set_signup_otp(&state, &email).await;

    let req_signup = Request::builder()
        .uri("/api/auth/signup")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&json!({
                "email": &email,
                "password": "password123",
                "name": "Join Test User",
                "otp": "123456"
            }))
            .unwrap(),
        ))
        .unwrap();

    let app_clone1 = app_router().with_state(state.clone());
    let response_signup = app_clone1.oneshot(req_signup).await.unwrap();
    let signup_status = response_signup.status();
    let body_bytes = axum::body::to_bytes(response_signup.into_body(), 1024 * 1024)
        .await
        .unwrap();
    if signup_status != StatusCode::OK {
        panic!("Signup failed: {:?}", std::str::from_utf8(&body_bytes));
    }
    let auth_resp: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    let user_id = auth_resp.get("user_id").unwrap().as_str().unwrap();
    let token = auth_resp.get("token").unwrap().as_str().unwrap();

    // Create an auction starting in 10 minutes (so it's valid to join)
    let future_start = chrono::Utc::now() + chrono::Duration::minutes(10);
    let start_time_str = future_start.format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let req_create = Request::builder()
        .uri("/api/auction/create") // Updated to correct route
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .header("Authorization", format!("Bearer {}", token))
        .header("x-user-id", user_id)
        .body(Body::from(
            serde_json::to_vec(&json!({
                "title": "Join Test Shipment",
                "description": "Test Description",
                "freight_type": "LTL",
                "origin_address": "NY",
                "origin_lat": 40.7128,
                "origin_lng": -74.0060,
                "dest_address": "LA",
                "dest_lat": 34.0522,
                "dest_lng": -118.2437,
                "pickup_date_start": "2024-01-01T00:00:00Z",
                "pickup_date_end": "2024-01-02T00:00:00Z",
                "auction_start_time": start_time_str,
                "auction_end_time": start_time_str,
                "weight": 1500.5,
                "length": 10.0,
                "width": 5.5,
                "height": 5.0,
                "starting_price": 500.0,
                "media_urls": ["http://example.com/image.jpg"]
            }))
            .unwrap(),
        ))
        .unwrap();

    let app_clone2 = app_router().with_state(state.clone());
    let response_create = app_clone2.oneshot(req_create).await.unwrap();

    let create_status = response_create.status();
    let create_body_bytes = axum::body::to_bytes(response_create.into_body(), 1024 * 1024)
        .await
        .unwrap();
    if create_status != StatusCode::OK {
        panic!(
            "Create auction failed: {:?}",
            std::str::from_utf8(&create_body_bytes)
        );
    }

    let create_resp: serde_json::Value = serde_json::from_slice(&create_body_bytes).unwrap();
    let auction_id = create_resp.get("auction_id").unwrap().as_str().unwrap();

    // Join the auction
    let req_join = Request::builder()
        .uri(format!("/api/auction/{}/join", auction_id))
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .header("Authorization", format!("Bearer {}", token))
        .header("x-user-id", user_id)
        .body(Body::empty())
        .unwrap();

    let response_join = app.oneshot(req_join).await.unwrap();
    let status = response_join.status();
    let body_bytes = axum::body::to_bytes(response_join.into_body(), 1024 * 1024)
        .await
        .unwrap();
    println!(
        "JOIN AUCTION RESPONSE: {:?}",
        std::str::from_utf8(&body_bytes)
    );

    assert_eq!(status, StatusCode::OK);
}
