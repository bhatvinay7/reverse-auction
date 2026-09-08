use reqwest::Client;
use serde_json::json;

pub async fn generate_embedding(
    client: &Client,
    api_key: &str,
    text: &str,
) -> Result<Vec<f32>, Box<dyn std::error::Error + Send + Sync>> {
    let response = client
        .post("https://api.openai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": "text-embedding-3-small",
            "input": text,
        }))
        .send()
        .await?;

    if !response.status().is_success() {
        let err = response.text().await?;
        eprintln!("[Search-Server] OpenAI Error: {}", err);
        return Err("Failed to generate embedding".into());
    }

    let json: serde_json::Value = response.json().await?;
    let embedding = json["data"][0]["embedding"]
        .as_array()
        .ok_or("Invalid embedding format")?
        .iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect::<Vec<f32>>();

    Ok(embedding)
}
