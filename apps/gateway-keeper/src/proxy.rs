use std::{net::SocketAddr, time::Duration};

use axum::{
    body::{Body, Bytes},
    extract::{ConnectInfo, OriginalUri, State},
    http::{
        HeaderMap, Method, StatusCode,
        header::{CONNECTION, HOST, TRANSFER_ENCODING},
    },
    response::{IntoResponse, Response},
};
use tracing::{error, warn};

use crate::{error::GatewayError, internal_identity::InternalSigner, state::GatewayState};

pub async fn health() -> impl IntoResponse {
    (
        StatusCode::OK,
        axum::Json(serde_json::json!({"status": "ok"})),
    )
}

pub async fn ready(State(state): State<GatewayState>) -> Result<impl IntoResponse, GatewayError> {
    let mut connection = state
        .redis_pool
        .get()
        .await
        .map_err(|_| GatewayError::unavailable("redis"))?;
    let pong: String = redis::cmd("PING")
        .query_async(&mut *connection)
        .await
        .map_err(|_| GatewayError::unavailable("redis"))?;
    Ok((
        StatusCode::OK,
        axum::Json(serde_json::json!({"status": "ready", "redis": pong})),
    ))
}

pub async fn http_proxy(
    State(state): State<GatewayState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    mut headers: HeaderMap,
    body: Bytes,
) -> Result<Response, GatewayError> {
    state
        .limiter
        .check(&format!("ip:{}", peer.ip()), 240, Duration::from_secs(60))
        .await?;
    InternalSigner::strip_untrusted(&mut headers);

    let is_public_auth = uri.path().starts_with("/api/auth/") && uri.path() != "/api/auth/me";
    if !is_public_auth {
        let identity = state.auth.authenticate(&headers)?;
        state
            .limiter
            .check(
                &format!("user:{}", identity.user_id),
                120,
                Duration::from_secs(60),
            )
            .await?;
        state
            .signer
            .inject(&mut headers, &identity, &method, uri.path())?;
    }

    proxy_http(
        &state,
        &state.http_server_url,
        &state.http_breaker,
        method,
        uri.path_and_query()
            .map(|value| value.as_str())
            .unwrap_or(uri.path()),
        headers,
        body,
    )
    .await
}

pub async fn search_proxy(
    State(state): State<GatewayState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    mut headers: HeaderMap,
    body: Bytes,
) -> Result<Response, GatewayError> {
    state
        .limiter
        .check(&format!("ip:{}", peer.ip()), 240, Duration::from_secs(60))
        .await?;
    InternalSigner::strip_untrusted(&mut headers);

    proxy_http(
        &state,
        &state.search_server_url,
        &state.search_breaker,
        method,
        uri.path_and_query()
            .map(|value| value.as_str())
            .unwrap_or(uri.path()),
        headers,
        body,
    )
    .await
}

pub async fn proxy_http(
    state: &GatewayState,
    base_url: &str,
    breaker: &crate::circuit_breaker::CircuitBreaker,
    method: Method,
    path_and_query: &str,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, GatewayError> {
    if !breaker.allow_request() {
        return Err(GatewayError::unavailable(breaker.name()));
    }
    let url = format!("{}{}", base_url.trim_end_matches('/'), path_and_query);
    let mut request = state.http_client.request(method, url);
    for (name, value) in &headers {
        if name != HOST && name != CONNECTION && name != TRANSFER_ENCODING {
            request = request.header(name, value);
        }
    }
    let downstream = match request.body(body).send().await {
        Ok(response) => response,
        Err(error) => {
            breaker.record_failure();
            error!(service = breaker.name(), %error, "downstream request failed");
            return Err(GatewayError::unavailable(breaker.name()));
        }
    };
    let status = downstream.status();
    if status.is_server_error() {
        breaker.record_failure();
        warn!(service = breaker.name(), %status, "downstream returned server error");
    } else {
        breaker.record_success();
    }
    let mut response = Response::builder().status(status);
    for (name, value) in downstream.headers() {
        if name != CONNECTION
            && name != TRANSFER_ENCODING
            && !name.as_str().starts_with("access-control-")
        {
            response = response.header(name, value);
        }
    }
    response
        .body(Body::from_stream(downstream.bytes_stream()))
        .map_err(|_| {
            GatewayError::new(
                StatusCode::BAD_GATEWAY,
                "INVALID_DOWNSTREAM_RESPONSE",
                "Downstream response could not be forwarded",
            )
        })
}
