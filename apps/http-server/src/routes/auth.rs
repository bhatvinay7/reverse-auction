use crate::controllers::auth::{
    forgot_password_handler, me_handler, reset_password_handler, send_otp_handler, sign_in_handler,
    sign_up_handler,
};
use crate::middleware::auth_middleware;
use crate::state::AppState;
use axum::middleware;
use axum::{
    routing::{get, post},
    Router,
};

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/send-otp", post(send_otp_handler))
        .route("/signup", post(sign_up_handler))
        .route("/signin", post(sign_in_handler))
        .route("/forgot-password", post(forgot_password_handler))
        .route("/reset-password", post(reset_password_handler))
        .route(
            "/me",
            get(me_handler).route_layer(middleware::from_fn(auth_middleware)),
        )
}
