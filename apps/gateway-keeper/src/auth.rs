use axum::http::{
    HeaderMap,
    header::{AUTHORIZATION, COOKIE},
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::GatewayError;

#[derive(Clone)]
pub struct AuthConfig {
    secret: String,
    issuer: Option<String>,
    audience: Option<String>,
}

#[derive(Clone, Debug)]
pub struct Identity {
    pub user_id: Uuid,
    pub role: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct Claims {
    sub: String,
    role: String,
    exp: usize,
    #[serde(default)]
    iss: Option<String>,
    #[serde(default)]
    aud: Option<String>,
}

impl AuthConfig {
    pub fn from_env() -> Result<Self, GatewayError> {
        let secret = std::env::var("JWT_SECRET").map_err(|_| {
            GatewayError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "CONFIG_ERROR",
                "JWT_SECRET is required",
            )
        })?;
        if secret.len() < 32 {
            return Err(GatewayError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "CONFIG_ERROR",
                "JWT_SECRET must contain at least 32 bytes",
            ));
        }
        Ok(Self {
            secret,
            issuer: std::env::var("JWT_ISSUER").ok().filter(|v| !v.is_empty()),
            audience: std::env::var("JWT_AUDIENCE").ok().filter(|v| !v.is_empty()),
        })
    }

    pub fn authenticate(&self, headers: &HeaderMap) -> Result<Identity, GatewayError> {
        let token = bearer(headers)
            .or_else(|| cookie_token(headers))
            .ok_or_else(|| {
                GatewayError::unauthorized("A bearer token or secure token cookie is required")
            })?;
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        if let Some(issuer) = &self.issuer {
            validation.set_issuer(&[issuer]);
        }
        if let Some(audience) = &self.audience {
            validation.set_audience(&[audience]);
        }
        let claims = decode::<Claims>(
            &token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .map_err(|_| GatewayError::unauthorized("The access token is invalid or expired"))?
        .claims;
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| GatewayError::unauthorized("The access token subject is invalid"))?;
        let role = claims.role.to_ascii_uppercase();
        if !matches!(role.as_str(), "CUSTOMER" | "CARRIER" | "ADMIN") {
            return Err(GatewayError::unauthorized(
                "The access token role is invalid",
            ));
        }
        Ok(Identity { user_id, role })
    }
}

fn bearer(headers: &HeaderMap) -> Option<String> {
    headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::to_owned)
}

fn cookie_token(headers: &HeaderMap) -> Option<String> {
    let cookies = headers.get(COOKIE)?.to_str().ok()?;
    cookies.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        matches!(name, "auction_token" | "access_token" | "token").then(|| value.to_owned())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_supported_cookie() {
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, "x=1; auction_token=abc".parse().unwrap());
        assert_eq!(cookie_token(&headers).as_deref(), Some("abc"));
    }
}
