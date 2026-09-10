use crate::error::AppError;
use crate::types::CreateAuctionPayload;
use db::models::{AuctionType, NewAuction, NewAuctionConfig, NewAuctionSchedule};
use db::schema::{auction_configs, auction_schedules, auctions};
use diesel::prelude::*;
use uuid::Uuid;

#[derive(Queryable)]
struct AuctionListRow {
    id: Uuid,
    title: String,
    description: String,
    origin_address: Option<String>,
    dest_address: Option<String>,
    origin_lat: Option<f64>,
    origin_lng: Option<f64>,
    dest_lat: Option<f64>,
    dest_lng: Option<f64>,
    auction_start_time: chrono::NaiveDateTime,
    auction_end_time: chrono::NaiveDateTime,
    pickup_date: Option<chrono::NaiveDateTime>,
    starting_price: Option<f64>,
    weight: Option<f64>,
    winner_id: Option<Uuid>,
    auction_type: AuctionType,
    minimum_bid_step: f64,
    reserve_price: Option<f64>,
    item_category: Option<String>,
    item_condition: Option<String>,
    quantity: Option<f64>,
    quantity_unit: Option<String>,
    pickup_terms: Option<String>,
}

pub async fn create_auction_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    payload: CreateAuctionPayload,
    user_id: Uuid,
) -> Result<Uuid, AppError> {
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let now = chrono::Utc::now().naive_utc();

    let auction_type = match payload
        .auction_type
        .as_deref()
        .unwrap_or("REVERSE")
        .to_ascii_uppercase()
        .as_str()
    {
        "REVERSE" => AuctionType::Reverse,
        "FORWARD" => AuctionType::Forward,
        _ => {
            return Err(AppError::BadRequest(
                "auction_type must be REVERSE or FORWARD".into(),
            ))
        }
    };

    let starting_price = payload
        .starting_price
        .filter(|price| price.is_finite() && *price > 0.0)
        .ok_or_else(|| AppError::BadRequest("starting_price must be greater than zero".into()))?;
    let minimum_bid_step = payload.minimum_bid_step.unwrap_or(1.0);
    if !minimum_bid_step.is_finite() || minimum_bid_step <= 0.0 {
        return Err(AppError::BadRequest(
            "minimum_bid_step must be greater than zero".into(),
        ));
    }
    if payload
        .reserve_price
        .is_some_and(|price| !price.is_finite() || price < 0.0)
    {
        return Err(AppError::BadRequest(
            "reserve_price cannot be negative".into(),
        ));
    }
    if auction_type == AuctionType::Forward
        && payload
            .reserve_price
            .is_some_and(|price| price < starting_price)
    {
        return Err(AppError::BadRequest(
            "forward auction reserve_price cannot be below starting_price".into(),
        ));
    }
    if payload
        .quantity
        .is_some_and(|quantity| !quantity.is_finite() || quantity <= 0.0)
    {
        return Err(AppError::BadRequest(
            "quantity must be greater than zero".into(),
        ));
    }

    let start_time = payload
        .auction_start_time
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map(|dt| dt.naive_utc())
        .map_err(|_| {
            AppError::BadRequest("auction_start_time must be a valid UTC timestamp".into())
        })?;

    let requested_end_time = payload
        .auction_end_time
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map(|dt| dt.naive_utc())
        .map_err(|_| {
            AppError::BadRequest("auction_end_time must be a valid UTC timestamp".into())
        })?;

    let duration = requested_end_time - start_time;
    if duration <= chrono::Duration::zero() {
        return Err(AppError::BadRequest(
            "auction_end_time must be after auction_start_time".into(),
        ));
    }
    if duration < chrono::Duration::minutes(10) || duration > chrono::Duration::minutes(20) {
        return Err(AppError::BadRequest(
            "Auction duration must be between 10 and 20 minutes".into(),
        ));
    }
    let end_time = requested_end_time;

    let freight_type = match payload.freight_type.as_deref() {
        Some("FCL") => Some(db::models::FreightType::FCL),
        Some("LCL") => Some(db::models::FreightType::LCL),
        Some("FTL") => Some(db::models::FreightType::FTL),
        Some("LTL") => Some(db::models::FreightType::LTL),
        Some("AIR") => Some(db::models::FreightType::AIR),
        Some("OCEAN") => Some(db::models::FreightType::OCEAN),
        Some("PARCEL") => Some(db::models::FreightType::PARCEL),
        _ => None,
    };

    let item_category = payload
        .item_category
        .as_deref()
        .or(payload.freight_type.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let mut dimensions_str: Option<String> = None;
    if payload.length.is_some() || payload.width.is_some() || payload.height.is_some() {
        let l = payload.length.unwrap_or(0.0);
        let w = payload.width.unwrap_or(0.0);
        let h = payload.height.unwrap_or(0.0);
        dimensions_str = Some(format!("{}x{}x{}", l, w, h));
    }

    // Convert CreateAuctionPayload to NewAuction using safe diesel inserts
    let new_auction = NewAuction {
        id: Uuid::new_v4(),
        title: payload.title,
        description: payload.description,
        freight_type,
        weight_kg: payload.weight,
        dimensions: dimensions_str,
        origin_address: payload.origin_address,
        origin_lat: payload.origin_lat,
        origin_lng: payload.origin_lng,
        dest_address: payload.dest_address,
        dest_lat: payload.dest_lat,
        dest_lng: payload.dest_lng,
        pickup_date_start: payload
            .pickup_date_start
            .as_deref()
            .and_then(|value| value.parse::<chrono::DateTime<chrono::Utc>>().ok())
            .map(|dt| dt.naive_utc()),
        pickup_date_end: payload
            .pickup_date_end
            .as_deref()
            .and_then(|value| value.parse::<chrono::DateTime<chrono::Utc>>().ok())
            .map(|dt| dt.naive_utc()),
        starting_price: Some(starting_price),
        auction_start_time: start_time,
        auction_end_time: end_time,
        created_at: now,
        updated_at: now,
        customer_id: user_id,
        // status, etc skipped or defaults used
    };
    let new_auction_config = NewAuctionConfig {
        auction_id: new_auction.id,
        auction_type,
        minimum_bid_step,
        reserve_price: payload.reserve_price,
        item_category,
        item_condition: payload.item_condition,
        quantity: payload.quantity,
        quantity_unit: payload.quantity_unit,
        pickup_terms: payload.pickup_terms,
    };

    conn.transaction::<_, AppError, _>(|transaction_conn| {
        diesel::insert_into(auctions::table)
            .values(&new_auction)
            .execute(transaction_conn)
            .map_err(|e| {
                AppError::InternalServerError(format!("Failed to insert auction: {}", e))
            })?;

        diesel::insert_into(auction_configs::table)
            .values(&new_auction_config)
            .execute(transaction_conn)
            .map_err(|e| {
                AppError::InternalServerError(format!("Failed to insert auction config: {}", e))
            })?;

        // Insert media if present
        if let Some(media_urls) = payload.media_urls {
            use db::schema::media;
            for url in media_urls {
                let new_media = db::models::NewMedia {
                    id: Uuid::new_v4(),
                    url: url.clone(),
                    type_: if url.contains(".mp4") || url.contains(".webm") {
                        "video".to_string()
                    } else {
                        "image".to_string()
                    },
                    auction_id: new_auction.id,
                };
                diesel::insert_into(media::table)
                    .values(&new_media)
                    .execute(transaction_conn)
                    .map_err(|e| {
                        AppError::InternalServerError(format!("Failed to insert media: {}", e))
                    })?;
            }
        }

        let new_schedule = NewAuctionSchedule {
            id: Uuid::new_v4(),
            auction_id: new_auction.id,
            idempotency_key: Uuid::new_v4().to_string(), // In reality, coming from client
            state: db::models::ScheduleState::Scheduled,
            start_time,
            retry_count: 0,
        };

        diesel::insert_into(auction_schedules::table)
            .values(&new_schedule)
            .execute(transaction_conn)
            .map_err(|e| {
                AppError::InternalServerError(format!("Failed to create auction schedule: {}", e))
            })?;

        // Automatically register the creator as a participant so they get notifications
        use db::models::NewAuctionParticipant;
        use db::schema::auction_participants;
        let new_participant = NewAuctionParticipant {
            id: Uuid::new_v4(),
            auction_id: new_auction.id,
            user_id,
            joined_at: now,
        };
        diesel::insert_into(auction_participants::table)
            .values(&new_participant)
            .execute(transaction_conn)
            .map_err(|e| {
                AppError::InternalServerError(format!(
                    "Failed to insert creator as participant: {}",
                    e
                ))
            })?;

        Ok(())
    })?;

    invalidate_auction_catalog(redis_pool).await;

    Ok(new_auction.id)
}

pub async fn join_auction_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    auction_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    use db::models::NewAuctionParticipant;
    use db::schema::auction_participants;
    use db::schema::auctions::dsl::{auction_start_time, auctions};

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let auction_start: chrono::NaiveDateTime = auctions
        .filter(db::schema::auctions::id.eq(auction_id))
        .select(auction_start_time)
        .first(&mut conn)
        .map_err(|_| AppError::BadRequest("Auction not found".into()))?;

    // 3. Add to Postgres DB (Prevent duplicates)
    use db::schema::auction_participants::dsl as ap_dsl;
    use diesel::prelude::*;

    let existing_count: i64 = ap_dsl::auction_participants
        .filter(ap_dsl::auction_id.eq(auction_id))
        .filter(ap_dsl::user_id.eq(user_id))
        .count()
        .get_result(&mut conn)
        .unwrap_or(0);

    if existing_count > 0 {
        // Redis participant bits are deliberately treated as a cache. Restore a
        // persisted registration after a Redis restart before opening the socket.
        set_participant_bit(redis_pool, auction_id, user_id).await?;
        return Ok(());
    }

    let now = chrono::Utc::now().naive_utc();
    let join_deadline = auction_start - chrono::Duration::minutes(5);
    if now >= join_deadline {
        return Err(AppError::BadRequest(
            "Registration closed five minutes before the auction start time".into(),
        ));
    }

    let new_participant = NewAuctionParticipant {
        id: Uuid::new_v4(),
        auction_id,
        user_id,
        joined_at: now,
    };

    diesel::insert_into(auction_participants::table)
        .values(&new_participant)
        .execute(&mut conn)
        .map_err(|e| {
            if e.to_string().contains("unique constraint") {
                AppError::BadRequest("You have already joined this auction".into())
            } else {
                AppError::InternalServerError(format!("Failed to join auction: {}", e))
            }
        })?;

    // The bid and socket services use this bit for authorization. Do not report
    // a successful registration unless the access record is available to them.
    set_participant_bit(redis_pool, auction_id, user_id).await?;

    invalidate_auction_catalog(redis_pool).await;

    Ok(())
}

async fn set_participant_bit(
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    auction_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    let offset = (user_id.as_u128() % (1 << 31)) as usize;
    // Use the cluster hash-tagged key shared with scheduler, ws-server, and
    // gateway-keeper. Keeping this in the redis package prevents one service
    // from granting access in a key that another service never reads.
    let bitmap_key = auction_redis::format_participants_key(&auction_id.to_string());
    let mut redis_conn = redis_pool.get().await.map_err(|error| {
        AppError::InternalServerError(format!("Registration access store is unavailable: {error}"))
    })?;
    let _: bool = redis::AsyncCommands::setbit(&mut *redis_conn, &bitmap_key, offset, true)
        .await
        .map_err(|error| {
            AppError::InternalServerError(format!("Failed to grant auction access: {error}"))
        })?;
    println!(
        "[http-server] Set participant bit for user {} (offset {}) in auction {}",
        user_id, offset, auction_id
    );
    Ok(())
}

pub async fn leave_auction_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    auction_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    use db::schema::auction_participants::dsl as ap_dsl;
    use db::schema::auctions::dsl::{auction_start_time, auctions};
    use diesel::prelude::*;

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    // 1. Validate if we are at least 5 minutes before the auction starts
    let auction_start: chrono::NaiveDateTime = auctions
        .filter(db::schema::auctions::id.eq(auction_id))
        .select(auction_start_time)
        .first(&mut conn)
        .map_err(|_| AppError::BadRequest("Auction not found".into()))?;

    let now = chrono::Utc::now().naive_utc();
    if now >= auction_start {
        return Err(AppError::BadRequest(
            "Too late to unregister from the auction".into(),
        ));
    }

    // 2. Remove from Postgres DB
    let deleted = diesel::delete(
        ap_dsl::auction_participants
            .filter(ap_dsl::auction_id.eq(auction_id))
            .filter(ap_dsl::user_id.eq(user_id)),
    )
    .execute(&mut conn)
    .map_err(|e| AppError::InternalServerError(format!("Failed to leave auction: {}", e)))?;

    if deleted == 0 {
        return Err(AppError::BadRequest(
            "You are not registered for this auction".into(),
        ));
    }

    // 3. Clear the participant bit in Redis
    let offset = (user_id.as_u128() % (1 << 31)) as usize;
    let bitmap_key = auction_redis::format_participants_key(&auction_id.to_string());
    let legacy_bitmap_key = auction_redis::format_legacy_participants_key(&auction_id.to_string());
    if let Ok(mut redis_conn) = redis_pool.get().await {
        let _: redis::RedisResult<bool> =
            redis::AsyncCommands::setbit(&mut *redis_conn, &bitmap_key, offset, false).await;
        let _: redis::RedisResult<bool> =
            redis::AsyncCommands::setbit(&mut *redis_conn, &legacy_bitmap_key, offset, false).await;
    }

    // 4. Invalidate the auction catalog cache for this user
    invalidate_auction_catalog(redis_pool).await;

    Ok(())
}

pub async fn get_auctions_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    user_id: Uuid,
) -> Result<Vec<serde_json::Value>, AppError> {
    use db::schema::auctions::dsl::*;
    use redis::AsyncCommands;

    let cache_version = auction_catalog_version(redis_pool).await;
    let cache_key = auction_redis::format_auction_catalog_key(cache_version, &user_id.to_string());
    if let Ok(mut redis_conn) = redis_pool.get().await {
        let cached: redis::RedisResult<Option<String>> = redis_conn.get(&cache_key).await;
        if let Ok(Some(payload)) = cached {
            if let Ok(cached_auctions) = serde_json::from_str::<Vec<serde_json::Value>>(&payload) {
                return Ok(cached_auctions);
            }
        }
    }

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let now = chrono::Utc::now().naive_utc();

    let results = auctions
        .inner_join(auction_configs::table)
        .filter(auction_end_time.gt(now))
        .select((
            id,
            title,
            description,
            origin_address,
            dest_address,
            origin_lat,
            origin_lng,
            dest_lat,
            dest_lng,
            auction_start_time,
            auction_end_time,
            pickup_date_start,
            starting_price,
            weight_kg,
            winner_id,
            auction_configs::auction_type,
            auction_configs::minimum_bid_step,
            auction_configs::reserve_price,
            auction_configs::item_category,
            auction_configs::item_condition,
            auction_configs::quantity,
            auction_configs::quantity_unit,
            auction_configs::pickup_terms,
        ))
        .order(created_at.desc())
        .limit(20)
        .load::<AuctionListRow>(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch auctions: {}", e)))?;

    // Fetch media URLs
    use db::schema::media::dsl as media_dsl;
    let auction_ids: Vec<Uuid> = results.iter().map(|row| row.id).collect();

    let media_results = media_dsl::media
        .filter(media_dsl::auction_id.eq_any(&auction_ids))
        .select((media_dsl::auction_id, media_dsl::url))
        .load::<(Uuid, String)>(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to fetch media".into()))?;

    let mut media_map: std::collections::HashMap<Uuid, Vec<String>> =
        std::collections::HashMap::new();
    for (sid, url) in media_results {
        media_map.entry(sid).or_default().push(url);
    }

    use db::schema::auction_participants::dsl as ap_dsl;
    use diesel::dsl::count;

    // Fetch participants counts
    let participants_results = ap_dsl::auction_participants
        .filter(ap_dsl::auction_id.eq_any(&auction_ids))
        .group_by(ap_dsl::auction_id)
        .select((ap_dsl::auction_id, count(ap_dsl::user_id)))
        .load::<(Uuid, i64)>(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to fetch participants".into()))?;

    let mut participants_map: std::collections::HashMap<Uuid, i64> =
        std::collections::HashMap::new();
    for (sid, c) in participants_results {
        participants_map.insert(sid, c);
    }

    // Check which auctions the user is registered for
    let user_participations = ap_dsl::auction_participants
        .filter(ap_dsl::auction_id.eq_any(&auction_ids))
        .filter(ap_dsl::user_id.eq(user_id))
        .select(ap_dsl::auction_id)
        .load::<Uuid>(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to fetch user participations".into()))?;

    let user_participations_set: std::collections::HashSet<Uuid> =
        user_participations.into_iter().collect();

    let json_results = results.into_iter().map(|s| {
        let empty_media = Vec::new();
        let media_urls = media_map.get(&s.id).unwrap_or(&empty_media);
        let participants_count = participants_map.get(&s.id).unwrap_or(&0);
        let is_registered = user_participations_set.contains(&s.id);

        serde_json::json!({
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "origin_address": s.origin_address,
            "dest_address": s.dest_address,
            "origin_lat": s.origin_lat,
            "origin_lng": s.origin_lng,
            "dest_lat": s.dest_lat,
            "dest_lng": s.dest_lng,
            "auction_start_time": s.auction_start_time.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "auction_end_time": s.auction_end_time.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "pickup_date": s.pickup_date.map(|value| value.format("%Y-%m-%dT%H:%M:%SZ").to_string()),
            "starting_price": s.starting_price,
            "weight": s.weight,
            "winner_id": s.winner_id,
            "auction_type": s.auction_type,
            "minimum_bid_step": s.minimum_bid_step,
            "reserve_price": s.reserve_price,
            "item_category": s.item_category,
            "item_condition": s.item_condition,
            "quantity": s.quantity,
            "quantity_unit": s.quantity_unit,
            "pickup_terms": s.pickup_terms,
            "media_urls": media_urls,
            "participants_count": participants_count,
            "is_registered": is_registered,
        })
    }).collect();

    if let Ok(payload) = serde_json::to_string(&json_results) {
        if let Ok(mut redis_conn) = redis_pool.get().await {
            let _: redis::RedisResult<()> = redis_conn
                .set_ex(
                    &cache_key,
                    payload,
                    auction_redis::AUCTION_CATALOG_CACHE_TTL_SECS,
                )
                .await;
        }
    }

    Ok(json_results)
}

async fn auction_catalog_version(redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>) -> u64 {
    use redis::AsyncCommands;
    let Ok(mut redis_conn) = redis_pool.get().await else {
        return 0;
    };
    redis_conn
        .get::<_, Option<u64>>(auction_redis::AUCTION_CATALOG_VERSION_KEY)
        .await
        .ok()
        .flatten()
        .unwrap_or(0)
}

async fn invalidate_auction_catalog(redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>) {
    use redis::AsyncCommands;
    if let Ok(mut redis_conn) = redis_pool.get().await {
        let _: redis::RedisResult<u64> = redis_conn
            .incr(auction_redis::AUCTION_CATALOG_VERSION_KEY, 1_u64)
            .await;
    }
}

pub async fn get_auction_history_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    user_id: Uuid,
) -> Result<Vec<serde_json::Value>, AppError> {
    use db::schema::auction_participants::dsl as ap_dsl;
    use db::schema::auctions::dsl::*;

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    // 1. Get user's participated auction IDs
    let user_participations = ap_dsl::auction_participants
        .filter(ap_dsl::user_id.eq(user_id))
        .select(ap_dsl::auction_id)
        .load::<Uuid>(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to fetch user participations".into()))?;

    if user_participations.is_empty() {
        return Ok(Vec::new());
    }

    // 2. Fetch those auctions (both active and completed)
    let results = auctions
        .inner_join(auction_configs::table)
        .filter(id.eq_any(&user_participations))
        .select((
            id,
            title,
            description,
            origin_address,
            dest_address,
            origin_lat,
            origin_lng,
            dest_lat,
            dest_lng,
            auction_start_time,
            auction_end_time,
            pickup_date_start,
            starting_price,
            weight_kg,
            winner_id,
            auction_configs::auction_type,
            auction_configs::minimum_bid_step,
            auction_configs::reserve_price,
            auction_configs::item_category,
            auction_configs::item_condition,
            auction_configs::quantity,
            auction_configs::quantity_unit,
            auction_configs::pickup_terms,
        ))
        .order(created_at.desc())
        .limit(50)
        .load::<AuctionListRow>(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch auctions: {}", e)))?;

    // Fetch media URLs
    use db::schema::media::dsl as media_dsl;
    let auction_ids: Vec<Uuid> = results.iter().map(|row| row.id).collect();

    let media_results = media_dsl::media
        .filter(media_dsl::auction_id.eq_any(&auction_ids))
        .select((media_dsl::auction_id, media_dsl::url))
        .load::<(Uuid, String)>(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to fetch media".into()))?;

    let mut media_map: std::collections::HashMap<Uuid, Vec<String>> =
        std::collections::HashMap::new();
    for (sid, url) in media_results {
        media_map.entry(sid).or_default().push(url);
    }

    use diesel::dsl::count;

    // Fetch participants counts
    let participants_results = ap_dsl::auction_participants
        .filter(ap_dsl::auction_id.eq_any(&auction_ids))
        .group_by(ap_dsl::auction_id)
        .select((ap_dsl::auction_id, count(ap_dsl::user_id)))
        .load::<(Uuid, i64)>(&mut conn)
        .map_err(|_| AppError::InternalServerError("Failed to fetch participants".into()))?;

    let mut participants_map: std::collections::HashMap<Uuid, i64> =
        std::collections::HashMap::new();
    for (sid, c) in participants_results {
        participants_map.insert(sid, c);
    }

    let now = chrono::Utc::now().naive_utc();

    let json_results = results.into_iter().map(|s| {
        let empty_media = Vec::new();
        let media_urls = media_map.get(&s.id).unwrap_or(&empty_media);
        let participants_count = participants_map.get(&s.id).unwrap_or(&0);

        let is_closed = now > s.auction_end_time;
        let winner_id_str = s.winner_id.map(|u| u.to_string());

        serde_json::json!({
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "origin_address": s.origin_address,
            "dest_address": s.dest_address,
            "origin_lat": s.origin_lat,
            "origin_lng": s.origin_lng,
            "dest_lat": s.dest_lat,
            "dest_lng": s.dest_lng,
            "auction_start_time": s.auction_start_time.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "auction_end_time": s.auction_end_time.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "pickup_date": s.pickup_date.map(|value| value.format("%Y-%m-%dT%H:%M:%SZ").to_string()),
            "starting_price": s.starting_price,
            "weight": s.weight,
            "auction_type": s.auction_type,
            "minimum_bid_step": s.minimum_bid_step,
            "reserve_price": s.reserve_price,
            "item_category": s.item_category,
            "item_condition": s.item_condition,
            "quantity": s.quantity,
            "quantity_unit": s.quantity_unit,
            "pickup_terms": s.pickup_terms,
            "media_urls": media_urls,
            "participants_count": participants_count,
            "is_registered": true, 
            "is_closed": is_closed,
            "winner_id": winner_id_str
        })
    }).collect();

    Ok(json_results)
}

pub async fn get_auction_bids_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    auction_id: Uuid,
) -> Result<Vec<serde_json::Value>, AppError> {
    use redis::AsyncCommands;

    let auction_id_str = auction_id.to_string();
    let zset_key = auction_redis::format_zset_key(&auction_id_str);

    if let Ok(mut redis_conn) = redis_pool.get().await {
        let current_bids: Result<Vec<String>, _> = redis_conn.zrange(&zset_key, 0, -1).await;
        if let Ok(bids_str) = current_bids {
            if !bids_str.is_empty() {
                let mut redis_bids: Vec<serde_json::Value> = bids_str
                    .into_iter()
                    .filter_map(|b| {
                        let parsed: serde_json::Value = serde_json::from_str(&b).ok()?;
                        Some(parsed["bid"].clone())
                    })
                    .collect();

                // Sort chronologically for the bid history graph
                redis_bids.sort_by_key(|b| b["timestamp"].as_i64().unwrap_or(0));

                return Ok(redis_bids);
            }
        }
    }

    // Fallback to DB
    use db::schema::{bids, users};
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let db_bids = bids::table
        .inner_join(users::table)
        .filter(bids::auction_id.eq(auction_id))
        .order(bids::created_at.asc())
        .select((bids::all_columns, users::name))
        .load::<(db::models::Bid, String)>(&mut conn)
        .map_err(|e| {
            AppError::InternalServerError(format!("Failed to fetch bids from DB: {}", e))
        })?;

    let json_bids = db_bids
        .into_iter()
        .map(|(b, username)| {
            serde_json::json!({
                "bidder_id": b.carrier_id.to_string(),
                "username": username,
                "amount": b.amount,
                "timestamp": b.created_at.and_utc().timestamp_millis(),
            })
        })
        .collect();

    Ok(json_bids)
}

pub async fn get_bid_audit_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    requested_auction_id: Uuid,
    user_id: Uuid,
    requested_limit: Option<i64>,
    requested_offset: Option<i64>,
) -> Result<(Vec<db::models::BidAuditEvent>, i64, i64, i64), AppError> {
    use db::schema::{auction_participants, auctions, bid_audit_events};

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let owner_id = auctions::table
        .filter(auctions::id.eq(requested_auction_id))
        .select(auctions::customer_id)
        .first::<Uuid>(&mut conn)
        .optional()
        .map_err(|error| {
            AppError::InternalServerError(format!("Failed to authorize audit access: {error}"))
        })?
        .ok_or_else(|| AppError::NotFound("Auction not found".into()))?;

    let is_participant = auction_participants::table
        .filter(auction_participants::auction_id.eq(requested_auction_id))
        .filter(auction_participants::user_id.eq(user_id))
        .select(auction_participants::id)
        .first::<Uuid>(&mut conn)
        .optional()
        .map_err(|error| {
            AppError::InternalServerError(format!("Failed to authorize audit access: {error}"))
        })?
        .is_some();
    if owner_id != user_id && !is_participant {
        return Err(AppError::Unauthorized(
            "Only the auction owner or a participant can view bid audit history".into(),
        ));
    }

    let (limit, offset) = normalize_audit_page(requested_limit, requested_offset);
    let total = bid_audit_events::table
        .filter(bid_audit_events::auction_id.eq(requested_auction_id))
        .count()
        .get_result::<i64>(&mut conn)
        .map_err(|error| {
            AppError::InternalServerError(format!("Failed to count bid audit events: {error}"))
        })?;
    let events = bid_audit_events::table
        .filter(bid_audit_events::auction_id.eq(requested_auction_id))
        .order((
            bid_audit_events::source_partition.asc(),
            bid_audit_events::source_offset.asc(),
            bid_audit_events::request_id.asc(),
        ))
        .limit(limit)
        .offset(offset)
        .select(db::models::BidAuditEvent::as_select())
        .load::<db::models::BidAuditEvent>(&mut conn)
        .map_err(|error| {
            AppError::InternalServerError(format!("Failed to fetch bid audit events: {error}"))
        })?;

    Ok((events, total, limit, offset))
}

fn normalize_audit_page(limit: Option<i64>, offset: Option<i64>) -> (i64, i64) {
    (
        limit.unwrap_or(100).clamp(1, 500),
        offset.unwrap_or(0).max(0),
    )
}

pub async fn post_auction_discussion_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    auction_id: Uuid,
    user_id: Uuid,
    username: String,
    message: String,
) -> Result<serde_json::Value, AppError> {
    use db::models::NewAuctionMessage;
    use db::schema::auction_messages;
    use redis::AsyncCommands;

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let now = chrono::Utc::now().naive_utc();
    let msg_id = Uuid::new_v4();

    let new_msg = NewAuctionMessage {
        id: msg_id,
        auction_id,
        user_id,
        username: username.clone(),
        message: message.clone(),
        created_at: now,
    };

    diesel::insert_into(auction_messages::table)
        .values(&new_msg)
        .execute(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to post message: {}", e)))?;

    let json_msg = serde_json::json!({
        "id": msg_id,
        "auction_id": auction_id,
        "user_id": user_id,
        "username": username,
        "message": message,
        "created_at": now.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
    });

    let redis_key = auction_redis::format_discussion_key(&auction_id.to_string());
    if let Ok(mut redis_conn) = redis_pool.get().await {
        let msg_str = serde_json::to_string(&json_msg).unwrap_or_default();
        let _: redis::RedisResult<()> = redis_conn.lpush(&redis_key, msg_str).await;
        let _: redis::RedisResult<()> = redis_conn.ltrim(&redis_key, 0, 29).await;
        let _: redis::RedisResult<()> = redis_conn.expire(&redis_key, 86400).await;
    }

    Ok(json_msg)
}

pub async fn get_auction_discussion_service(
    pool: &diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    target_auction_id: Uuid,
    page: i64,
    limit: i64,
) -> Result<Vec<serde_json::Value>, AppError> {
    use db::schema::auction_messages::dsl::*;
    use redis::AsyncCommands;

    // Check Redis if page == 1
    if page == 1 {
        let redis_key = auction_redis::format_discussion_key(&target_auction_id.to_string());
        if let Ok(mut redis_conn) = redis_pool.get().await {
            let cached: redis::RedisResult<Vec<String>> =
                redis_conn.lrange(&redis_key, 0, (limit - 1) as isize).await;
            if let Ok(cached_msgs) = cached {
                if !cached_msgs.is_empty() {
                    let mut json_msgs = Vec::new();
                    for msg in cached_msgs {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&msg) {
                            json_msgs.push(parsed);
                        }
                    }
                    return Ok(json_msgs);
                }
            }
        }
    }

    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;

    let offset = (page - 1) * limit;

    let results = auction_messages
        .filter(db::schema::auction_messages::dsl::auction_id.eq(target_auction_id))
        .order(db::schema::auction_messages::dsl::created_at.desc())
        .limit(limit)
        .offset(offset)
        .load::<db::models::AuctionMessage>(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch messages: {}", e)))?;

    let json_results: Vec<serde_json::Value> = results
        .into_iter()
        .map(|m| {
            serde_json::json!({
                "id": m.id,
                "auction_id": m.auction_id,
                "user_id": m.user_id,
                "username": m.username,
                "message": m.message,
                "created_at": m.created_at.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            })
        })
        .collect();

    Ok(json_results)
}

#[cfg(test)]
mod audit_tests {
    use super::normalize_audit_page;

    #[test]
    fn audit_page_is_bounded() {
        assert_eq!(normalize_audit_page(None, None), (100, 0));
        assert_eq!(normalize_audit_page(Some(5_000), Some(-10)), (500, 0));
        assert_eq!(normalize_audit_page(Some(0), Some(25)), (1, 25));
    }
}
