use crate::error::AppError;
use crate::types::{CreateAuctionPayload, CreateListingPayload};
use chrono::NaiveDateTime;
use db::models::AuctionType;
use db::schema::{auction_listing_status_history, auction_listings, users};
use diesel::prelude::*;
use serde::Serialize;
use uuid::Uuid;

type DbPool = diesel::r2d2::Pool<diesel::r2d2::ConnectionManager<PgConnection>>;

#[derive(Queryable, Selectable, Serialize)]
#[diesel(table_name = auction_listings)]
pub struct Listing {
    pub id: Uuid,
    pub seller_id: Uuid,
    pub auction_id: Option<Uuid>,
    pub status: String,
    pub auction_type: AuctionType,
    pub title: String,
    pub description: String,
    pub item_category: Option<String>,
    pub item_condition: Option<String>,
    pub quantity: Option<f64>,
    pub quantity_unit: Option<String>,
    pub starting_price: f64,
    pub minimum_bid_step: f64,
    pub reserve_price: Option<f64>,
    pub origin_address: Option<String>,
    pub pickup_terms: Option<String>,
    pub availability_start: Option<NaiveDateTime>,
    pub availability_end: Option<NaiveDateTime>,
    pub media_urls: Vec<Option<String>>,
    pub admin_feedback: Option<String>,
    pub reviewed_by: Option<Uuid>,
    pub submitted_at: NaiveDateTime,
    pub reviewed_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Queryable, Selectable, Serialize)]
#[diesel(table_name = auction_listing_status_history)]
pub struct ListingHistory {
    pub id: Uuid,
    pub listing_id: Uuid,
    pub from_status: Option<String>,
    pub to_status: String,
    pub actor_id: Option<Uuid>,
    pub note: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = auction_listing_status_history)]
struct NewListingHistory {
    id: Uuid,
    listing_id: Uuid,
    from_status: Option<String>,
    to_status: String,
    actor_id: Option<Uuid>,
    note: Option<String>,
    created_at: NaiveDateTime,
}

#[derive(Serialize)]
pub struct AdminListing {
    #[serde(flatten)]
    pub listing: Listing,
    pub seller_name: String,
    pub seller_email: String,
    pub seller_company: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = auction_listings)]
struct NewListing {
    id: Uuid,
    seller_id: Uuid,
    status: String,
    auction_type: AuctionType,
    title: String,
    description: String,
    item_category: Option<String>,
    item_condition: Option<String>,
    quantity: Option<f64>,
    quantity_unit: Option<String>,
    starting_price: f64,
    minimum_bid_step: f64,
    reserve_price: Option<f64>,
    origin_address: Option<String>,
    pickup_terms: Option<String>,
    availability_start: Option<NaiveDateTime>,
    availability_end: Option<NaiveDateTime>,
    media_urls: Vec<Option<String>>,
    submitted_at: NaiveDateTime,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

fn parse_time(value: Option<String>) -> Result<Option<NaiveDateTime>, AppError> {
    value
        .map(|time| {
            time.parse::<chrono::DateTime<chrono::Utc>>()
                .map(|time| time.naive_utc())
                .map_err(|_| AppError::BadRequest("Availability must be a valid ISO date".into()))
        })
        .transpose()
}

pub fn create_listing(
    pool: &DbPool,
    seller_id: Uuid,
    payload: CreateListingPayload,
) -> Result<Listing, AppError> {
    if payload.starting_price <= 0.0 || payload.minimum_bid_step <= 0.0 {
        return Err(AppError::BadRequest(
            "Price and bid step must be greater than zero".into(),
        ));
    }
    let auction_type = match payload.auction_type.to_ascii_uppercase().as_str() {
        "FORWARD" => AuctionType::Forward,
        "REVERSE" => AuctionType::Reverse,
        _ => {
            return Err(AppError::BadRequest(
                "auction_type must be FORWARD or REVERSE".into(),
            ))
        }
    };
    let now = chrono::Utc::now().naive_utc();
    let row = NewListing {
        id: Uuid::new_v4(),
        seller_id,
        status: "SUBMITTED".into(),
        auction_type,
        title: payload.title,
        description: payload.description,
        item_category: payload.item_category,
        item_condition: payload.item_condition,
        quantity: payload.quantity,
        quantity_unit: payload.quantity_unit,
        starting_price: payload.starting_price,
        minimum_bid_step: payload.minimum_bid_step,
        reserve_price: payload.reserve_price,
        origin_address: payload.origin_address,
        pickup_terms: payload.pickup_terms,
        availability_start: parse_time(payload.availability_start)?,
        availability_end: parse_time(payload.availability_end)?,
        media_urls: payload.media_urls.into_iter().map(Some).collect(),
        submitted_at: now,
        created_at: now,
        updated_at: now,
    };
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    conn.transaction(|conn| {
        let listing = diesel::insert_into(auction_listings::table)
            .values(&row)
            .returning(Listing::as_returning())
            .get_result(conn)?;
        insert_history(
            conn,
            row.id,
            None,
            "SUBMITTED",
            Some(seller_id),
            Some("Listing submitted".into()),
        )?;
        Ok(listing)
    })
    .map_err(|e: diesel::result::Error| {
        AppError::InternalServerError(format!("Failed to submit listing: {e}"))
    })
}

pub fn seller_listings(pool: &DbPool, seller_id: Uuid) -> Result<Vec<Listing>, AppError> {
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    auction_listings::table
        .filter(auction_listings::seller_id.eq(seller_id))
        .order(auction_listings::updated_at.desc())
        .select(Listing::as_select())
        .load(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to load listings: {e}")))
}

pub fn admin_listings(pool: &DbPool) -> Result<Vec<AdminListing>, AppError> {
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    let rows = auction_listings::table
        .inner_join(users::table.on(users::id.eq(auction_listings::seller_id)))
        .order(auction_listings::submitted_at.asc())
        .select((
            Listing::as_select(),
            users::name,
            users::email,
            users::company_name,
        ))
        .load::<(Listing, String, String, Option<String>)>(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to load review queue: {e}")))?;
    Ok(rows
        .into_iter()
        .map(
            |(listing, seller_name, seller_email, seller_company)| AdminListing {
                listing,
                seller_name,
                seller_email,
                seller_company,
            },
        )
        .collect())
}

fn insert_history(
    conn: &mut PgConnection,
    listing_id: Uuid,
    from: Option<&str>,
    to: &str,
    actor_id: Option<Uuid>,
    note: Option<String>,
) -> QueryResult<usize> {
    diesel::insert_into(auction_listing_status_history::table)
        .values(NewListingHistory {
            id: Uuid::new_v4(),
            listing_id,
            from_status: from.map(str::to_owned),
            to_status: to.to_owned(),
            actor_id,
            note,
            created_at: chrono::Utc::now().naive_utc(),
        })
        .execute(conn)
}

pub fn listing_history(
    pool: &DbPool,
    listing_id: Uuid,
    user_id: Uuid,
    is_admin: bool,
) -> Result<Vec<ListingHistory>, AppError> {
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    let allowed = if is_admin {
        auction_listings::table
            .find(listing_id)
            .select(auction_listings::id)
            .first::<Uuid>(&mut conn)
            .optional()
    } else {
        auction_listings::table
            .find(listing_id)
            .filter(auction_listings::seller_id.eq(user_id))
            .select(auction_listings::id)
            .first::<Uuid>(&mut conn)
            .optional()
    }
    .map_err(|_| AppError::InternalServerError("Failed to verify listing access".into()))?
    .is_some();
    if !allowed {
        return Err(AppError::Forbidden(
            "You cannot view this listing history".into(),
        ));
    }
    auction_listing_status_history::table
        .filter(auction_listing_status_history::listing_id.eq(listing_id))
        .order(auction_listing_status_history::created_at.asc())
        .select(ListingHistory::as_select())
        .load(&mut conn)
        .map_err(|e| AppError::InternalServerError(format!("Failed to load listing history: {e}")))
}

pub fn update_listing(
    pool: &DbPool,
    id: Uuid,
    seller_id: Uuid,
    payload: CreateListingPayload,
) -> Result<Listing, AppError> {
    if payload.starting_price <= 0.0 || payload.minimum_bid_step <= 0.0 {
        return Err(AppError::BadRequest(
            "Price and bid step must be greater than zero".into(),
        ));
    }
    let auction_type = match payload.auction_type.to_ascii_uppercase().as_str() {
        "FORWARD" => AuctionType::Forward,
        "REVERSE" => AuctionType::Reverse,
        _ => {
            return Err(AppError::BadRequest(
                "auction_type must be FORWARD or REVERSE".into(),
            ))
        }
    };
    let now = chrono::Utc::now().naive_utc();
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    let updated = diesel::update(
        auction_listings::table
            .filter(auction_listings::id.eq(id))
            .filter(auction_listings::seller_id.eq(seller_id))
            .filter(auction_listings::status.eq_any(["DRAFT", "CHANGES_REQUESTED"])),
    )
    .set((
        auction_listings::auction_type.eq(auction_type),
        auction_listings::title.eq(payload.title),
        auction_listings::description.eq(payload.description),
        auction_listings::item_category.eq(payload.item_category),
        auction_listings::item_condition.eq(payload.item_condition),
        auction_listings::quantity.eq(payload.quantity),
        auction_listings::quantity_unit.eq(payload.quantity_unit),
        auction_listings::starting_price.eq(payload.starting_price),
        auction_listings::minimum_bid_step.eq(payload.minimum_bid_step),
        auction_listings::reserve_price.eq(payload.reserve_price),
        auction_listings::origin_address.eq(payload.origin_address),
        auction_listings::pickup_terms.eq(payload.pickup_terms),
        auction_listings::availability_start.eq(parse_time(payload.availability_start)?),
        auction_listings::availability_end.eq(parse_time(payload.availability_end)?),
        auction_listings::media_urls.eq(payload
            .media_urls
            .into_iter()
            .map(Some)
            .collect::<Vec<_>>()),
        auction_listings::updated_at.eq(now),
    ))
    .returning(Listing::as_returning())
    .get_result(&mut conn)
    .map_err(|_| {
        AppError::BadRequest("Only your drafts or change-requested listings can be edited".into())
    })?;
    insert_history(
        &mut conn,
        id,
        Some(&updated.status),
        &updated.status,
        Some(seller_id),
        Some("Listing details updated".into()),
    )
    .map_err(|e| AppError::InternalServerError(format!("Failed to record listing update: {e}")))?;
    Ok(updated)
}

pub fn resubmit_listing(pool: &DbPool, id: Uuid, seller_id: Uuid) -> Result<Listing, AppError> {
    let now = chrono::Utc::now().naive_utc();
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    conn.transaction(|conn| {
        let listing = diesel::update(
            auction_listings::table
                .filter(auction_listings::id.eq(id))
                .filter(auction_listings::seller_id.eq(seller_id))
                .filter(auction_listings::status.eq_any(["DRAFT", "CHANGES_REQUESTED"])),
        )
        .set((
            auction_listings::status.eq("SUBMITTED"),
            auction_listings::admin_feedback.eq::<Option<String>>(None),
            auction_listings::submitted_at.eq(now),
            auction_listings::updated_at.eq(now),
        ))
        .returning(Listing::as_returning())
        .get_result(conn)?;
        insert_history(
            conn,
            id,
            Some("CHANGES_REQUESTED"),
            "SUBMITTED",
            Some(seller_id),
            Some("Listing resubmitted".into()),
        )?;
        Ok(listing)
    })
    .map_err(|_: diesel::result::Error| {
        AppError::BadRequest("Only drafts or change-requested listings can be resubmitted".into())
    })
}

pub fn review_listing(
    pool: &DbPool,
    id: Uuid,
    admin_id: Uuid,
    decision: &str,
    feedback: Option<String>,
) -> Result<Listing, AppError> {
    let status = match decision.to_ascii_uppercase().as_str() {
        "APPROVE" => "APPROVED",
        "REQUEST_CHANGES" => "CHANGES_REQUESTED",
        "REJECT" => "REJECTED",
        _ => {
            return Err(AppError::BadRequest(
                "decision must be APPROVE, REQUEST_CHANGES, or REJECT".into(),
            ))
        }
    };
    if status != "APPROVED" && feedback.as_deref().unwrap_or("").trim().is_empty() {
        return Err(AppError::BadRequest(
            "Feedback is required for changes or rejection".into(),
        ));
    }
    let now = chrono::Utc::now().naive_utc();
    let mut conn = pool
        .get()
        .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
    let old_status = auction_listings::table
        .find(id)
        .select(auction_listings::status)
        .first::<String>(&mut conn)
        .map_err(|_| AppError::BadRequest("Listing is not available for review".into()))?;
    conn.transaction(|conn| {
        let listing = diesel::update(
            auction_listings::table
                .filter(auction_listings::id.eq(id))
                .filter(auction_listings::status.eq_any([
                    "SUBMITTED",
                    "UNDER_REVIEW",
                    "CHANGES_REQUESTED",
                ])),
        )
        .set((
            auction_listings::status.eq(status),
            auction_listings::admin_feedback.eq(feedback),
            auction_listings::reviewed_by.eq(admin_id),
            auction_listings::reviewed_at.eq(Some(now)),
            auction_listings::updated_at.eq(now),
        ))
        .returning(Listing::as_returning())
        .get_result(conn)?;
        insert_history(
            conn,
            id,
            Some(&old_status),
            status,
            Some(admin_id),
            listing.admin_feedback.clone(),
        )?;
        Ok(listing)
    })
    .map_err(|_: diesel::result::Error| {
        AppError::BadRequest("Listing is not available for review".into())
    })
}

pub async fn schedule_listing(
    pool: &DbPool,
    redis_pool: &bb8::Pool<bb8_redis::RedisConnectionManager>,
    id: Uuid,
    admin_id: Uuid,
    start: String,
    end: String,
) -> Result<(Listing, Uuid), AppError> {
    let listing = {
        let mut conn = pool
            .get()
            .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
        auction_listings::table
            .filter(auction_listings::id.eq(id))
            .filter(auction_listings::status.eq("APPROVED"))
            .select(Listing::as_select())
            .first(&mut conn)
            .map_err(|_| AppError::BadRequest("Only approved listings can be scheduled".into()))?
    };
    let payload = CreateAuctionPayload {
        title: listing.title.clone(),
        description: listing.description.clone(),
        freight_type: None,
        auction_type: Some(
            match listing.auction_type {
                AuctionType::Forward => "FORWARD",
                AuctionType::Reverse => "REVERSE",
            }
            .into(),
        ),
        origin_address: listing.origin_address.clone(),
        origin_lat: None,
        origin_lng: None,
        dest_address: None,
        dest_lat: None,
        dest_lng: None,
        pickup_date_start: None,
        pickup_date_end: None,
        auction_start_time: start,
        auction_end_time: end,
        weight: None,
        length: None,
        width: None,
        height: None,
        starting_price: Some(listing.starting_price),
        minimum_bid_step: Some(listing.minimum_bid_step),
        reserve_price: listing.reserve_price,
        item_category: listing.item_category.clone(),
        item_condition: listing.item_condition.clone(),
        quantity: listing.quantity,
        quantity_unit: listing.quantity_unit.clone(),
        pickup_terms: listing.pickup_terms.clone(),
        media_urls: Some(listing.media_urls.iter().flatten().cloned().collect()),
    };
    let auction_id = crate::services::auction::create_auction_service(
        pool,
        redis_pool,
        payload,
        listing.seller_id,
    )
    .await?;
    let now = chrono::Utc::now().naive_utc();
    let updated = {
        let mut conn = pool
            .get()
            .map_err(|_| AppError::InternalServerError("Failed to get DB connection".into()))?;
        let listing = diesel::update(auction_listings::table.find(id))
            .set((
                auction_listings::status.eq("SCHEDULED"),
                auction_listings::auction_id.eq(Some(auction_id)),
                auction_listings::updated_at.eq(now),
            ))
            .returning(Listing::as_returning())
            .get_result(&mut conn)
            .map_err(|e| {
                AppError::InternalServerError(format!(
                    "Auction created but listing update failed: {e}"
                ))
            })?;
        insert_history(
            &mut conn,
            id,
            Some("APPROVED"),
            "SCHEDULED",
            Some(admin_id),
            Some("Auction scheduled".into()),
        )
        .map_err(|e| {
            AppError::InternalServerError(format!("Failed to record schedule history: {e}"))
        })?;
        listing
    };
    Ok((updated, auction_id))
}
