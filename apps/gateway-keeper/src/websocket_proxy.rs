use std::{
    collections::HashMap,
    net::SocketAddr,
    time::{Duration, Instant},
};

use axum::{
    Json,
    extract::{
        ConnectInfo, OriginalUri, Query, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::HeaderMap,
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite};
use uuid::Uuid;

use crate::{
    auction_access,
    error::GatewayError,
    state::{GatewayState, SocketTicket},
};

#[derive(Deserialize)]
pub struct TicketRequest {
    auction_id: Uuid,
}

#[derive(Serialize)]
pub struct TicketResponse {
    ticket: String,
    expires_in: u64,
}

pub async fn create_ticket(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Json(request): Json<TicketRequest>,
) -> Result<Json<TicketResponse>, GatewayError> {
    let identity = state.auth.authenticate(&headers)?;
    state
        .limiter
        .check(
            &format!("socket-ticket:{}", identity.user_id),
            30,
            Duration::from_secs(60),
        )
        .await?;
    auction_access::require_participant(&state.redis_pool, request.auction_id, &identity).await?;

    let now = Instant::now();
    state
        .socket_tickets
        .retain(|_, ticket| ticket.expires_at > now);
    let value = Uuid::new_v4().to_string();
    state.socket_tickets.insert(
        value.clone(),
        SocketTicket {
            user_id: identity.user_id.to_string(),
            role: identity.role,
            expires_at: now + Duration::from_secs(30),
        },
    );
    Ok(Json(TicketResponse {
        ticket: value,
        expires_in: 30,
    }))
}

pub async fn socket_proxy(
    State(state): State<GatewayState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    OriginalUri(uri): OriginalUri,
    Query(query): Query<HashMap<String, String>>,
    ws: WebSocketUpgrade,
) -> Result<Response, GatewayError> {
    state
        .limiter
        .check(
            &format!("socket-ip:{}", peer.ip()),
            60,
            Duration::from_secs(60),
        )
        .await?;

    let ticket_value = query
        .get("ticket")
        .ok_or_else(|| GatewayError::unauthorized("A socket ticket is required"))?;
    let (_, ticket) = state.socket_tickets.remove(ticket_value).ok_or_else(|| {
        GatewayError::unauthorized("The socket ticket is invalid or already used")
    })?;
    if ticket.expires_at <= Instant::now() {
        return Err(GatewayError::unauthorized("The socket ticket has expired"));
    }
    tracing::debug!(user_id = %ticket.user_id, role = %ticket.role, "accepted socket ticket");
    if !state.socket_breaker.allow_request() {
        return Err(GatewayError::unavailable(state.socket_breaker.name()));
    }
    let upstream = upstream_url(
        &state.socket_server_url,
        uri.path_and_query()
            .map(|value| value.as_str())
            .unwrap_or("/socket.io"),
    );
    let breaker = state.socket_breaker.clone();
    Ok(ws.on_upgrade(move |downstream| bridge(downstream, upstream, breaker)))
}

fn upstream_url(base: &str, path_and_query: &str) -> String {
    let base = base.trim_end_matches('/');
    let base = base
        .strip_prefix("https://")
        .map(|value| format!("wss://{value}"))
        .or_else(|| {
            base.strip_prefix("http://")
                .map(|value| format!("ws://{value}"))
        })
        .unwrap_or_else(|| base.to_owned());
    format!("{base}{path_and_query}")
}

async fn bridge(
    downstream: WebSocket,
    upstream_url: String,
    breaker: crate::circuit_breaker::CircuitBreaker,
) {
    let upstream = connect_async(&upstream_url).await;
    let Ok((upstream, _)) = upstream else {
        breaker.record_failure();
        tracing::warn!(service = breaker.name(), %upstream_url, "socket upstream connection failed");
        return;
    };
    breaker.record_success();
    let (mut downstream_tx, mut downstream_rx) = downstream.split();
    let (mut upstream_tx, mut upstream_rx) = upstream.split();

    let to_upstream = async {
        while let Some(Ok(message)) = downstream_rx.next().await {
            let message = match message {
                Message::Text(value) => tungstenite::Message::Text(value.to_string().into()),
                Message::Binary(value) => tungstenite::Message::Binary(value.to_vec().into()),
                Message::Ping(value) => tungstenite::Message::Ping(value.to_vec().into()),
                Message::Pong(value) => tungstenite::Message::Pong(value.to_vec().into()),
                Message::Close(_) => tungstenite::Message::Close(None),
            };
            if upstream_tx.send(message).await.is_err() {
                break;
            }
        }
        let _ = upstream_tx.close().await;
    };

    let to_downstream = async {
        while let Some(Ok(message)) = upstream_rx.next().await {
            let message = match message {
                tungstenite::Message::Text(value) => Message::Text(value.to_string().into()),
                tungstenite::Message::Binary(value) => Message::Binary(value.to_vec().into()),
                tungstenite::Message::Ping(value) => Message::Ping(value.to_vec().into()),
                tungstenite::Message::Pong(value) => Message::Pong(value.to_vec().into()),
                tungstenite::Message::Close(_) => Message::Close(None),
                tungstenite::Message::Frame(_) => continue,
            };
            if downstream_tx.send(message).await.is_err() {
                break;
            }
        }
        let _ = downstream_tx.close().await;
    };

    tokio::select! { _ = to_upstream => {}, _ = to_downstream => {} }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn converts_http_socket_url() {
        assert_eq!(
            upstream_url("http://ws-server:8081/", "/socket.io/?EIO=4"),
            "ws://ws-server:8081/socket.io/?EIO=4"
        );
    }
}
