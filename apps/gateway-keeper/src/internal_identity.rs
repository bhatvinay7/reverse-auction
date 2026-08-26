use axum::http::{HeaderMap, HeaderName, HeaderValue, Method};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

use crate::{auth::Identity, error::GatewayError};

const INTERNAL_HEADERS: [&str; 5] = [
    "x-auction-user-id",
    "x-auction-user-role",
    "x-auction-auth-timestamp",
    "x-auction-auth-signature",
    "x-request-id",
];

pub struct InternalSigner {
    secret: Vec<u8>,
}

impl InternalSigner {
    pub fn from_env() -> Result<Self, GatewayError> {
        let secret = std::env::var("INTERNAL_SIGNING_KEY").map_err(|_| {
            GatewayError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "CONFIG_ERROR",
                "INTERNAL_SIGNING_KEY is required",
            )
        })?;
        if secret.len() < 32 {
            return Err(GatewayError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "CONFIG_ERROR",
                "INTERNAL_SIGNING_KEY must contain at least 32 bytes",
            ));
        }
        Ok(Self {
            secret: secret.into_bytes(),
        })
    }

    pub fn strip_untrusted(headers: &mut HeaderMap) {
        for name in INTERNAL_HEADERS {
            headers.remove(name);
        }
    }

    pub fn inject(
        &self,
        headers: &mut HeaderMap,
        identity: &Identity,
        method: &Method,
        path: &str,
    ) -> Result<(), GatewayError> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| {
                GatewayError::new(
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "CLOCK_ERROR",
                    "system clock is invalid",
                )
            })?
            .as_secs();
        let request_id = Uuid::new_v4().to_string();
        let payload = format!(
            "{}|{}|{}|{}|{}|{}",
            identity.user_id, identity.role, timestamp, request_id, method, path
        );
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.secret).map_err(|error| {
            GatewayError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "SIGNING_ERROR",
                format!("failed to initialize internal request signer: {error}"),
            )
        })?;
        mac.update(payload.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        insert(headers, "x-auction-user-id", &identity.user_id.to_string())?;
        insert(headers, "x-auction-user-role", &identity.role)?;
        insert(headers, "x-auction-auth-timestamp", &timestamp.to_string())?;
        insert(headers, "x-auction-auth-signature", &signature)?;
        insert(headers, "x-request-id", &request_id)?;
        Ok(())
    }
}

fn insert(headers: &mut HeaderMap, name: &'static str, value: &str) -> Result<(), GatewayError> {
    let value = HeaderValue::from_str(value).map_err(|_| {
        GatewayError::new(
            axum::http::StatusCode::BAD_REQUEST,
            "INVALID_HEADER",
            "identity contains an invalid header value",
        )
    })?;
    headers.insert(HeaderName::from_static(name), value);
    Ok(())
}
