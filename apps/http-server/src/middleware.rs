use axum::{extract::Request, http::header, middleware::Next, response::Response};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

use crate::error::AppError;
use crate::types::Claims;

pub async fn auth_middleware(mut req: Request, next: Next) -> Result<Response, AppError> {
    let auth_header = req.headers().get(header::AUTHORIZATION);
    let auth_header = match auth_header {
        Some(header) => header
            .to_str()
            .map_err(|_| AppError::Unauthorized("Invalid authorization header".into()))?,
        None => {
            return Err(AppError::Unauthorized(
                "Missing authorization header".into(),
            ))
        }
    };

    if !auth_header.starts_with("Bearer ") {
        return Err(AppError::Unauthorized(
            "Invalid authorization format. Use Bearer <token>".into(),
        ));
    }

    let token = &auth_header[7..];

    let secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "super_secret_key_change_me".to_string());

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|e| {
        tracing::error!("JWT validation failed: {}", e);
        match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                AppError::Unauthorized("validation failed relogin".into())
            }
            jsonwebtoken::errors::ErrorKind::InvalidToken => {
                AppError::Unauthorized("validation failed relogin".into())
            }
            _ => AppError::Unauthorized("validation failed relogin".into()),
        }
    })?;

    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}

pub async fn require_customer(req: Request, next: Next) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or_else(|| AppError::Unauthorized("Not authenticated".into()))?;

    if claims.role != "CUSTOMER" && claims.role != "ADMIN" {
        return Err(AppError::Unauthorized(
            "Access denied: Customers only".into(),
        ));
    }

    Ok(next.run(req).await)
}

pub async fn require_carrier(req: Request, next: Next) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or_else(|| AppError::Unauthorized("Not authenticated".into()))?;

    if claims.role != "CARRIER" && claims.role != "ADMIN" {
        return Err(AppError::Unauthorized(
            "Access denied: Carriers only".into(),
        ));
    }

    Ok(next.run(req).await)
}

pub async fn require_admin(req: Request, next: Next) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or_else(|| AppError::Unauthorized("Not authenticated".into()))?;

    if claims.role != "ADMIN" {
        return Err(AppError::Forbidden(
            "Access denied: Administrators only".into(),
        ));
    }

    Ok(next.run(req).await)
}
