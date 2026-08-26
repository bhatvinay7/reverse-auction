use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use reqwest::multipart;
use serde::Serialize;
use sha1::{Digest, Sha1};
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct UploadResponse {
    pub secure_url: String,
}

pub async fn upload_media(
    State(_state): State<AppState>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let cloud_name = env::var("CLOUDINARY_CLOUD_NAME")
        .map_err(|_| AppError::InternalServerError("Missing cloud_name".into()))?;
    let api_key = env::var("CLOUDINARY_API_KEY")
        .map_err(|_| AppError::InternalServerError("Missing api_key".into()))?;
    let api_secret = env::var("CLOUDINARY_API_SECRET")
        .map_err(|_| AppError::InternalServerError("Missing api_secret".into()))?;

    let mut file_data = None;
    let mut file_name = String::new();
    let mut content_type = String::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        if field.name() == Some("file") {
            if let Some(name) = field.file_name() {
                file_name = name.to_string();
            }
            if let Some(ct) = field.content_type() {
                content_type = ct.to_string();
            }
            let data = field
                .bytes()
                .await
                .map_err(|_| AppError::InternalServerError("Failed to read file".into()))?;
            file_data = Some(data);
        }
    }

    let data = file_data.ok_or_else(|| AppError::InternalServerError("No file provided".into()))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string();

    let string_to_sign = format!("timestamp={}{}", timestamp, api_secret);
    let mut hasher = Sha1::new();
    hasher.update(string_to_sign.as_bytes());
    let signature = hex::encode(hasher.finalize());

    let file_part = if !content_type.is_empty() {
        multipart::Part::bytes(data.to_vec())
            .file_name(file_name.clone())
            .mime_str(&content_type)
            .unwrap_or_else(|_| multipart::Part::bytes(data.to_vec()).file_name(file_name.clone()))
    } else {
        multipart::Part::bytes(data.to_vec()).file_name(file_name)
    };

    let form = multipart::Form::new()
        .text("api_key", api_key)
        .text("timestamp", timestamp)
        .text("signature", signature)
        .part("file", file_part);

    let client = reqwest::Client::new();
    let url = format!("https://api.cloudinary.com/v1_1/{}/auto/upload", cloud_name);

    let res = client
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|_| AppError::InternalServerError("Cloudinary request failed".into()))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        tracing::error!("Cloudinary error: {}", err_text);
        return Err(AppError::InternalServerError(
            "Upload to Cloudinary failed".into(),
        ));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|_| AppError::InternalServerError("Invalid Cloudinary response".into()))?;

    let secure_url = json["secure_url"]
        .as_str()
        .ok_or_else(|| {
            AppError::InternalServerError("No secure_url in Cloudinary response".into())
        })?
        .to_string();

    Ok(Json(UploadResponse { secure_url }))
}
