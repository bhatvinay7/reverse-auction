use crate::types::NotificationPayload;

pub async fn send(email_addr: &str, payload: &NotificationPayload) -> bool {
    use lettre::{
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
        transport::smtp::authentication::Credentials,
    };

    let smtp_user = std::env::var("SMTP_USER").unwrap_or_default();
    let smtp_pass = std::env::var("SMTP_PASS").unwrap_or_default();
    let smtp_host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());

    if smtp_user.is_empty() || smtp_pass.is_empty() {
        println!(
            "SMTP credentials missing, skipping real email to {}",
            email_addr
        );
        return true;
    }

    let from_addr: lettre::message::Mailbox =
        match format!("Auction Platform <{}>", smtp_user).parse() {
            Ok(addr) => addr,
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "email_from_address",
                    error.to_string(),
                    serde_json::json!({}),
                );
                return false;
            }
        };
    let to_addr: lettre::message::Mailbox = match email_addr.parse() {
        Ok(addr) => addr,
        Err(error) => {
            auction_observability::report_error(
                "notification-worker",
                "email_to_address",
                error.to_string(),
                serde_json::json!({}),
            );
            return false;
        }
    };
    use lettre::message::header::ContentType;
    let email = match Message::builder()
        .from(from_addr)
        .to(to_addr)
        .subject(if payload.event_type.as_deref() == Some("user_signup") {
            "Welcome to Auquid Auction!"
        } else {
            "Auction Notification"
        })
        .header(ContentType::TEXT_HTML)
        .body(payload.message.clone())
    {
        Ok(email) => email,
        Err(error) => {
            auction_observability::report_error(
                "notification-worker",
                "email_build",
                error.to_string(),
                serde_json::json!({}),
            );
            return false;
        }
    };
    let mailer: AsyncSmtpTransport<Tokio1Executor> =
        match AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host) {
            Ok(mailer) => mailer
                .credentials(Credentials::new(smtp_user, smtp_pass))
                .build(),
            Err(error) => {
                auction_observability::report_error(
                    "notification-worker",
                    "smtp_setup",
                    error.to_string(),
                    serde_json::json!({"smtp_host": smtp_host}),
                );
                return false;
            }
        };
    match mailer.send(email).await {
        Ok(_) => true,
        Err(error) => {
            auction_observability::report_error(
                "notification-worker",
                "email_send",
                error.to_string(),
                serde_json::json!({}),
            );
            false
        }
    }
}
