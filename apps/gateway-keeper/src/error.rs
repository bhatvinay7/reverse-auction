use axum::{
    Json,
    http::{HeaderValue, StatusCode, header::RETRY_AFTER},
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug)]
pub struct GatewayError {
    status: StatusCode,
    code: &'static str,
    message: String,
    retry_after: Option<u64>,
}

impl GatewayError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            retry_after: None,
        }
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "UNAUTHORIZED", message)
    }

    pub fn unavailable(service: &'static str) -> Self {
        Self::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "CIRCUIT_OPEN",
            format!("{service} is temporarily unavailable"),
        )
        .with_retry_after(5)
    }

    pub fn with_retry_after(mut self, seconds: u64) -> Self {
        self.retry_after = Some(seconds);
        self
    }
}

impl std::fmt::Display for GatewayError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for GatewayError {}

impl IntoResponse for GatewayError {
    fn into_response(self) -> Response {
        if self.status.is_server_error() {
            auction_observability::report_error(
                "gateway-keeper",
                self.code,
                self.message.clone(),
                json!({"http_status": self.status.as_u16()}),
            );
        }
        let mut response = (
            self.status,
            Json(json!({"code": self.code, "message": self.message})),
        )
            .into_response();
        if let Some(seconds) = self.retry_after
            && let Ok(value) = HeaderValue::from_str(&seconds.to_string()) {
                response.headers_mut().insert(RETRY_AFTER, value);
            }
        response
    }
}
