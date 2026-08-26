use crate::error::AppError;
use crate::services::auth::{send_otp_service, sign_in_service, sign_up_service};
use crate::state::AppState;
use crate::types::{SendOtpPayload, SignInPayload, SignUpPayload};
use axum::response::IntoResponse;
use axum::{extract::State, Json};
use garde::Validate;

pub async fn send_otp_handler(
    State(_state): State<AppState>,
    Json(payload): Json<SendOtpPayload>,
) -> Result<impl IntoResponse, AppError> {
    if let Err(e) = payload.validate(&()) {
        return Err(AppError::BadRequest(format!("Validation failed: {}", e)));
    }
    send_otp_service(payload).await?;
    Ok(Json(
        serde_json::json!({ "message": "OTP sent successfully" }),
    ))
}

pub async fn sign_up_handler(
    State(state): State<AppState>,
    Json(payload): Json<SignUpPayload>,
) -> Result<impl IntoResponse, AppError> {
    // Validate payload using garde
    if let Err(e) = payload.validate(&()) {
        return Err(AppError::BadRequest(format!("Validation failed: {}", e)));
    }

    let response = sign_up_service(&state.db_pool, payload).await?;

    Ok(Json(response))
}

pub async fn sign_in_handler(
    State(state): State<AppState>,
    Json(payload): Json<SignInPayload>,
) -> Result<impl IntoResponse, AppError> {
    // Validate payload using garde
    if let Err(e) = payload.validate(&()) {
        return Err(AppError::BadRequest(format!("Validation failed: {}", e)));
    }

    let response = sign_in_service(&state.db_pool, payload).await?;

    Ok(Json(response))
}

pub async fn forgot_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<crate::types::ForgotPasswordPayload>,
) -> Result<impl IntoResponse, AppError> {
    if let Err(e) = payload.validate(&()) {
        return Err(AppError::BadRequest(format!("Validation failed: {}", e)));
    }

    crate::services::auth::forgot_password_service(&state.db_pool, payload).await?;

    Ok(Json(
        serde_json::json!({ "message": "If the email is registered, a password reset link has been sent." }),
    ))
}

pub async fn reset_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<crate::types::ResetPasswordPayload>,
) -> Result<impl IntoResponse, AppError> {
    if let Err(e) = payload.validate(&()) {
        return Err(AppError::BadRequest(format!("Validation failed: {}", e)));
    }

    crate::services::auth::reset_password_service(&state.db_pool, payload).await?;

    Ok(Json(
        serde_json::json!({ "message": "Password successfully reset." }),
    ))
}

pub async fn me_handler(
    axum::extract::Extension(claims): axum::extract::Extension<crate::types::Claims>,
) -> Result<impl IntoResponse, AppError> {
    Ok(Json(
        serde_json::json!({ "userId": claims.sub, "role": claims.role }),
    ))
}
