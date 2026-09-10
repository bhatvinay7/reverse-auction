use crate::error::AppError;
use crate::types::{AuthResponse, SignInPayload, SignUpPayload};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use db::models::{NewUser, Role, User};
use db::schema::users;
use diesel::prelude::*;
use jsonwebtoken::{encode, EncodingKey, Header};

pub async fn send_otp_service(payload: crate::types::SendOtpPayload) -> Result<(), AppError> {
    let otp_str = {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let otp: u32 = rng.gen_range(100000..999999);
        otp.to_string()
    };

    let mut con = auction_redis::get_redis_connection()
        .await
        .map_err(|_| AppError::InternalServerError("Failed to connect to Redis".into()))?;

    let redis_key = format!("signup_otp:{}", payload.email);

    let _: () = redis::cmd("SETEX")
        .arg(&redis_key)
        .arg(300) // 5 minutes TTL
        .arg(&otp_str)
        .query_async(&mut con)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to store OTP".into()))?;

    let email_clone = payload.email.clone();

    // Send Real Email via Lettre
    tokio::spawn(async move {
        use lettre::{
            transport::smtp::authentication::Credentials, AsyncSmtpTransport, AsyncTransport,
            Message, Tokio1Executor,
        };

        let smtp_user = std::env::var("SMTP_USER").unwrap_or_default();
        let smtp_pass = std::env::var("SMTP_PASS").unwrap_or_default();
        let smtp_host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());

        if smtp_user.is_empty() || smtp_pass.is_empty() {
            println!(
                "SMTP credentials missing, skipping OTP email to {}",
                email_clone
            );
            return;
        }

        let from_addr: lettre::message::Mailbox =
            match format!("Auction Platform <{}>", smtp_user).parse() {
                Ok(addr) => addr,
                Err(e) => {
                    auction_observability::report_error(
                        "http-server",
                        "otp_from_address",
                        e.to_string(),
                        serde_json::json!({}),
                    );
                    return;
                }
            };

        let to_addr: lettre::message::Mailbox = match email_clone.parse() {
            Ok(addr) => addr,
            Err(e) => {
                auction_observability::report_error(
                    "http-server",
                    "otp_to_address",
                    e.to_string(),
                    serde_json::json!({}),
                );
                return;
            }
        };

        let email = match Message::builder()
            .from(from_addr)
            .to(to_addr)
            .subject("Your ProcureX Verification Code")
            .body(format!("Welcome to ProcureX!\n\nYour one-time verification code is: {}\n\nThis code will expire in 5 minutes.", otp_str)) {
            Ok(m) => m,
            Err(e) => {
                auction_observability::report_error("http-server", "otp_email_build", e.to_string(), serde_json::json!({}));
                return;
            }
        };

        let creds = Credentials::new(smtp_user.clone(), smtp_pass);
        let relay = match AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host) {
            Ok(r) => r,
            Err(e) => {
                auction_observability::report_error(
                    "http-server",
                    "otp_smtp_setup",
                    e.to_string(),
                    serde_json::json!({"smtp_host": smtp_host}),
                );
                return;
            }
        };

        let mailer: AsyncSmtpTransport<Tokio1Executor> = relay.credentials(creds).build();

        match mailer.send(email).await {
            Ok(_) => println!("Successfully sent OTP email to {}", email_clone),
            Err(e) => auction_observability::report_error(
                "http-server",
                "otp_email_send",
                e.to_string(),
                serde_json::json!({}),
            ),
        }
    });

    Ok(())
}

pub async fn sign_up_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    payload: SignUpPayload,
) -> Result<AuthResponse, AppError> {
    // 1. Verify OTP
    let mut con = auction_redis::get_redis_connection()
        .await
        .map_err(|_| AppError::InternalServerError("Failed to connect to Redis".into()))?;

    let redis_key = format!("signup_otp:{}", payload.email);
    let stored_otp: Option<String> = redis::cmd("GET")
        .arg(&redis_key)
        .query_async(&mut con)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to read OTP".into()))?;

    if let Some(valid_otp) = stored_otp {
        if valid_otp != payload.otp {
            return Err(AppError::BadRequest("Invalid OTP".into()));
        }
    } else {
        return Err(AppError::BadRequest(
            "OTP expired or not found. Please request a new one.".into(),
        ));
    }

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    // Check if user exists
    let existing_user = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AppError::InternalServerError("Database error".into()))?;

    if existing_user.is_some() {
        return Err(AppError::BadRequest("Email already in use".into()));
    }

    let hashed_password = hash(payload.password, DEFAULT_COST)
        .map_err(|_| AppError::InternalServerError("Failed to hash password".into()))?;

    let role = match payload
        .role_type
        .unwrap_or_else(|| "CARRIER".to_string())
        .to_ascii_uppercase()
        .as_str()
    {
        "SELLER" | "CUSTOMER" => Role::Customer,
        _ => Role::Carrier,
    };

    let now = chrono::Utc::now().naive_utc();
    let new_user = NewUser {
        id: uuid::Uuid::new_v4(),
        email: payload.email,
        password_hash: hashed_password,
        name: payload.name,
        company_name: payload.company_name,
        role,
        created_at: now,
        updated_at: now,
    };

    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to insert user: {}", e)))?;

    // Delete OTP after successful signup
    let _: () = redis::cmd("DEL")
        .arg(&redis_key)
        .query_async(&mut con)
        .await
        .unwrap_or_default();

    let secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "super_secret_key_change_me".to_string());

    // Generate JWT
    let claims = crate::types::Claims {
        sub: new_user.id.to_string(),
        role: match role {
            Role::Customer => "CUSTOMER",
            Role::Carrier => "CARRIER",
            Role::Admin => "ADMIN",
        }
        .to_string(),
        exp: (Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
    };

    let header = Header {
        alg: jsonwebtoken::Algorithm::HS256,
        ..Default::default()
    };

    let token = encode(&header, &claims, &EncodingKey::from_secret(secret.as_ref()))
        .map_err(|_| AppError::InternalServerError("Failed to generate token".into()))?;

    Ok(AuthResponse {
        token,
        role: claims.role,
        user_id: new_user.id,
        name: new_user.name,
    })
}

pub async fn sign_in_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    payload: SignInPayload,
) -> Result<AuthResponse, AppError> {
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let user = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AppError::InternalServerError("Database error".into()))?
        .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;

    if !verify(&payload.password, &user.password_hash).unwrap_or(false) {
        return Err(AppError::Unauthorized("Invalid credentials".into()));
    }

    let claims = crate::types::Claims {
        sub: user.id.to_string(),
        role: match user.role {
            Role::Customer => "CUSTOMER",
            Role::Carrier => "CARRIER",
            Role::Admin => "ADMIN",
        }
        .to_string(),
        exp: (Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
    };

    let header = Header {
        alg: jsonwebtoken::Algorithm::HS256,
        ..Default::default()
    };

    let secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "super_secret_key_change_me".to_string());

    let token = encode(&header, &claims, &EncodingKey::from_secret(secret.as_ref()))
        .map_err(|_| AppError::InternalServerError("Failed to generate token".into()))?;

    Ok(AuthResponse {
        token,
        role: claims.role,
        user_id: user.id,
        name: user.name,
    })
}

pub async fn forgot_password_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    payload: crate::types::ForgotPasswordPayload,
) -> Result<(), AppError> {
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let user = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AppError::InternalServerError("Database error".into()))?;

    if let Some(user) = user {
        // Generate reset token (in real app, save to DB with expiry)
        let claims = crate::types::Claims {
            sub: user.id.to_string(),
            role: "RESET".to_string(),
            exp: (Utc::now() + chrono::Duration::hours(1)).timestamp() as usize,
        };

        let header = Header {
            alg: jsonwebtoken::Algorithm::HS256,
            ..Default::default()
        };
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "super_secret_key_change_me".to_string());

        if let Ok(reset_token) =
            encode(&header, &claims, &EncodingKey::from_secret(secret.as_ref()))
        {
            let email_clone = payload.email.clone();
            tokio::spawn(async move {
                use lettre::{
                    transport::smtp::authentication::Credentials, AsyncSmtpTransport,
                    AsyncTransport, Message, Tokio1Executor,
                };

                let smtp_user = std::env::var("SMTP_USER").unwrap_or_default();
                let smtp_pass = std::env::var("SMTP_PASS").unwrap_or_default();
                let smtp_host =
                    std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());

                if smtp_user.is_empty() || smtp_pass.is_empty() {
                    println!(
                        "SMTP credentials missing, skipping reset email to {}",
                        email_clone
                    );
                    return;
                }

                let frontend_url = std::env::var("FRONTEND_URL")
                    .unwrap_or_else(|_| "http://localhost:3000".to_string());
                let reset_link = format!("{}/reset-password?token={}", frontend_url, reset_token);

                let from_addr: lettre::message::Mailbox =
                    match format!("Auction Platform <{}>", smtp_user).parse() {
                        Ok(addr) => addr,
                        Err(e) => {
                            auction_observability::report_error(
                                "http-server",
                                "reset_from_address",
                                e.to_string(),
                                serde_json::json!({}),
                            );
                            return;
                        }
                    };

                let to_addr: lettre::message::Mailbox = match email_clone.parse() {
                    Ok(addr) => addr,
                    Err(e) => {
                        auction_observability::report_error(
                            "http-server",
                            "reset_to_address",
                            e.to_string(),
                            serde_json::json!({}),
                        );
                        return;
                    }
                };

                let email = match Message::builder()
                    .from(from_addr)
                    .to(to_addr)
                    .subject("Password Reset Request")
                    .body(format!(
                        "Please use the following link to reset your password:\n\n{}",
                        reset_link
                    )) {
                    Ok(m) => m,
                    Err(e) => {
                        auction_observability::report_error(
                            "http-server",
                            "reset_email_build",
                            e.to_string(),
                            serde_json::json!({}),
                        );
                        return;
                    }
                };

                let creds = Credentials::new(smtp_user.clone(), smtp_pass);

                let relay = match AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host) {
                    Ok(r) => r,
                    Err(e) => {
                        auction_observability::report_error(
                            "http-server",
                            "reset_smtp_setup",
                            e.to_string(),
                            serde_json::json!({"smtp_host": smtp_host}),
                        );
                        return;
                    }
                };

                let mailer: AsyncSmtpTransport<Tokio1Executor> = relay.credentials(creds).build();

                match mailer.send(email).await {
                    Ok(_) => println!("Successfully sent reset email to {}", email_clone),
                    Err(e) => auction_observability::report_error(
                        "http-server",
                        "reset_email_send",
                        e.to_string(),
                        serde_json::json!({}),
                    ),
                }
            });
        }
    }

    Ok(())
}

pub async fn reset_password_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    payload: crate::types::ResetPasswordPayload,
) -> Result<(), AppError> {
    let secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "super_secret_key_change_me".to_string());

    // Decode token
    let token_data = jsonwebtoken::decode::<crate::types::Claims>(
        &payload.token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_ref()),
        &jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256),
    )
    .map_err(|_| AppError::Unauthorized("Invalid or expired reset token".into()))?;

    if token_data.claims.role != "RESET" {
        return Err(AppError::Unauthorized("Invalid token type".into()));
    }

    let user_uuid = uuid::Uuid::parse_str(&token_data.claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID in token".into()))?;

    let hashed_password = hash(payload.new_password, DEFAULT_COST)
        .map_err(|_| AppError::InternalServerError("Failed to hash password".into()))?;

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    diesel::update(users::table.filter(users::id.eq(user_uuid)))
        .set(users::password_hash.eq(hashed_password))
        .execute(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to update password".into()))?;

    Ok(())
}
