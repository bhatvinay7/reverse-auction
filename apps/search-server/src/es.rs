#![allow(clippy::collapsible_if)]

use elasticsearch::{
    SearchParts,
    indices::{IndicesCreateParts, IndicesExistsParts},
};
use serde_json::{Value, json};

use crate::{AppState, SearchQuery};

pub async fn setup_index(
    client: &elasticsearch::Elasticsearch,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let exists = client
        .indices()
        .exists(IndicesExistsParts::Index(&["auctions_idx"]))
        .send()
        .await?;

    if !exists.status_code().is_success() {
        eprintln!("[Search-Server] Creating index 'auctions_idx'");
        let response = client
            .indices()
            .create(IndicesCreateParts::Index("auctions_idx"))
            .body(json!({
                "settings": {
                    "analysis": {
                        "filter": {
                            "phonetic_filter": {
                                "type": "phonetic",
                                "encoder": "double_metaphone",
                                "replace": false
                            }
                        },
                        "analyzer": {
                            "phonetic_analyzer": {
                                "tokenizer": "standard",
                                "filter": ["lowercase", "phonetic_filter"]
                            }
                        }
                    }
                },
                "mappings": {
                    "properties": {
                        "id": { "type": "keyword" },
                        "title": {
                            "type": "text",
                            "analyzer": "standard",
                            "fields": {
                                "phonetic": {
                                    "type": "text",
                                    "analyzer": "phonetic_analyzer"
                                }
                            }
                        },
                        "description": { "type": "text" },
                        "item_category": { "type": "keyword" },
                        "starting_price": { "type": "double" },
                        "embedding": {
                            "type": "dense_vector",
                            "dims": 1536,
                            "index": true,
                            "similarity": "cosine"
                        }
                    }
                }
            }))
            .send()
            .await?;

        if !response.status_code().is_success() {
            let error = response.text().await?;
            eprintln!("[Search-Server] Failed to create index: {}", error);
            return Err("Index creation failed".into());
        }
    }

    Ok(())
}

pub async fn search(
    state: &AppState,
    query: SearchQuery,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let mut must_clauses = vec![];
    let mut knn_clause: Option<Value> = None;

    if let Some(cat) = &query.category {
        if !cat.is_empty() {
            must_clauses.push(json!({
                "term": { "item_category": cat }
            }));
        }
    }

    if let Some(q) = &query.q {
        if !q.is_empty() {
            // Generate embedding for semantic search
            if let Ok(embedding) =
                crate::openai::generate_embedding(&state.openai_client, &state.openai_api_key, q)
                    .await
            {
                knn_clause = Some(json!({
                    "field": "embedding",
                    "query_vector": embedding,
                    "k": 10,
                    "num_candidates": 100,
                    "boost": 0.5
                }));
            }

            // Keyword + phonetic + fuzzy
            must_clauses.push(json!({
                "bool": {
                    "should": [
                        {
                            "multi_match": {
                                "query": q,
                                "fields": ["title^3", "description"],
                                "fuzziness": "AUTO"
                            }
                        },
                        {
                            "match": {
                                "title.phonetic": {
                                    "query": q,
                                    "boost": 2.0
                                }
                            }
                        }
                    ]
                }
            }));
        }
    }

    if must_clauses.is_empty() && knn_clause.is_none() {
        must_clauses.push(json!({ "match_all": {} }));
    }

    let mut search_body = json!({
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "_source": {
            "excludes": ["embedding"]
        }
    });

    if let Some(knn) = knn_clause {
        search_body["knn"] = knn;
    }

    let response = state
        .es_client
        .search(SearchParts::Index(&["auctions_idx"]))
        .body(search_body)
        .send()
        .await?;

    let response_body = response.json::<Value>().await?;
    let hits = response_body["hits"]["hits"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|hit| hit["_source"].clone())
        .collect::<Vec<_>>();

    Ok(json!({ "results": hits }))
}
