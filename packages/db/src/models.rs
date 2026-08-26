use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::users)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub company_name: Option<String>,
    pub role: Role,
    pub rating: f64,
    pub total_reviews: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::users)]
pub struct NewUser {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub company_name: Option<String>,
    pub role: Role,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default,
)]
#[ExistingTypePath = "crate::schema::sql_types::Role"]
#[DbValueStyle = "SCREAMING_SNAKE_CASE"]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Role {
    #[default]
    Customer,
    Carrier,
    Admin,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::auctions)]
pub struct Auction {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub weight_kg: Option<f64>,
    pub dimensions: Option<String>,

    pub origin_address: Option<String>,
    pub origin_lat: Option<f64>,
    pub origin_lng: Option<f64>,

    pub dest_address: Option<String>,
    pub dest_lat: Option<f64>,
    pub dest_lng: Option<f64>,
    pub distance_miles: Option<f64>,

    pub pickup_date_start: Option<NaiveDateTime>,
    pub pickup_date_end: Option<NaiveDateTime>,
    pub delivery_date_start: Option<NaiveDateTime>,
    pub delivery_date_end: Option<NaiveDateTime>,

    pub starting_price: Option<f64>,
    pub auction_start_time: NaiveDateTime,
    pub auction_end_time: NaiveDateTime,

    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub customer_id: Uuid,
}

#[derive(
    diesel_derive_enum::DbEnum, Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default,
)]
#[ExistingTypePath = "crate::schema::sql_types::AuctionType"]
#[DbValueStyle = "SCREAMING_SNAKE_CASE"]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AuctionType {
    #[default]
    Reverse,
    Forward,
}

#[derive(diesel_derive_enum::DbEnum, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[ExistingTypePath = "crate::schema::sql_types::FreightType"]
#[DbValueStyle = "SCREAMING_SNAKE_CASE"]
pub enum FreightType {
    FCL,
    LCL,
    FTL,
    LTL,
    AIR,
    OCEAN,
    PARCEL,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::auctions)]
pub struct NewAuction {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub freight_type: Option<FreightType>,
    pub weight_kg: Option<f64>,
    pub dimensions: Option<String>,

    pub origin_address: Option<String>,
    pub origin_lat: Option<f64>,
    pub origin_lng: Option<f64>,

    pub dest_address: Option<String>,
    pub dest_lat: Option<f64>,
    pub dest_lng: Option<f64>,

    pub pickup_date_start: Option<NaiveDateTime>,
    pub pickup_date_end: Option<NaiveDateTime>,

    pub starting_price: Option<f64>,

    pub auction_start_time: NaiveDateTime,
    pub auction_end_time: NaiveDateTime,

    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub customer_id: Uuid,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Debug)]
#[diesel(primary_key(auction_id))]
#[diesel(belongs_to(Auction, foreign_key = auction_id))]
#[diesel(table_name = crate::schema::auction_configs)]
pub struct AuctionConfig {
    pub auction_id: Uuid,
    pub auction_type: AuctionType,
    pub minimum_bid_step: f64,
    pub reserve_price: Option<f64>,
    pub item_category: Option<String>,
    pub item_condition: Option<String>,
    pub quantity: Option<f64>,
    pub quantity_unit: Option<String>,
    pub pickup_terms: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::auction_configs)]
pub struct NewAuctionConfig {
    pub auction_id: Uuid,
    pub auction_type: AuctionType,
    pub minimum_bid_step: f64,
    pub reserve_price: Option<f64>,
    pub item_category: Option<String>,
    pub item_condition: Option<String>,
    pub quantity: Option<f64>,
    pub quantity_unit: Option<String>,
    pub pickup_terms: Option<String>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Debug)]
#[diesel(belongs_to(User, foreign_key = carrier_id))]
#[diesel(belongs_to(Auction, foreign_key = auction_id))]
#[diesel(table_name = crate::schema::bids)]
pub struct Bid {
    pub id: Uuid,
    pub amount: f64,
    pub created_at: NaiveDateTime,
    pub carrier_id: Uuid,
    pub auction_id: Uuid,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::bids)]
pub struct NewBid {
    pub id: Uuid,
    pub amount: f64,
    pub created_at: NaiveDateTime,
    pub carrier_id: Uuid,
    pub auction_id: Uuid,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize, Debug)]
#[diesel(primary_key(request_id))]
#[diesel(table_name = crate::schema::bid_audit_events)]
pub struct BidAuditEvent {
    pub request_id: Uuid,
    pub auction_id: Uuid,
    pub bidder_id: Uuid,
    pub username: Option<String>,
    pub amount: f64,
    pub auction_type: AuctionType,
    pub accepted: bool,
    pub rejection_reason: Option<String>,
    pub previous_price: f64,
    pub resulting_price: f64,
    pub submitted_at: NaiveDateTime,
    pub processed_at: NaiveDateTime,
    pub source_topic: String,
    pub source_partition: i32,
    pub source_offset: i64,
    pub archived_at: NaiveDateTime,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::bid_audit_events)]
pub struct NewBidAuditEvent {
    pub request_id: Uuid,
    pub auction_id: Uuid,
    pub bidder_id: Uuid,
    pub username: Option<String>,
    pub amount: f64,
    pub auction_type: AuctionType,
    pub accepted: bool,
    pub rejection_reason: Option<String>,
    pub previous_price: f64,
    pub resulting_price: f64,
    pub submitted_at: NaiveDateTime,
    pub processed_at: NaiveDateTime,
    pub source_topic: String,
    pub source_partition: i32,
    pub source_offset: i64,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Debug)]
#[diesel(belongs_to(Auction, foreign_key = auction_id))]
#[diesel(table_name = crate::schema::media)]
pub struct Media {
    pub id: Uuid,
    pub url: String,
    pub type_: String,
    pub auction_id: Uuid,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::media)]
pub struct NewMedia {
    pub id: Uuid,
    pub url: String,
    #[diesel(column_name = type_)]
    pub type_: String,
    pub auction_id: Uuid,
}

#[derive(diesel_derive_enum::DbEnum, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[ExistingTypePath = "crate::schema::sql_types::ScheduleState"]
#[DbValueStyle = "SCREAMING_SNAKE_CASE"]
pub enum ScheduleState {
    Scheduled,
    Closed,
    Error,
    Success,
    Started,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Debug)]
#[diesel(belongs_to(Auction, foreign_key = auction_id))]
#[diesel(table_name = crate::schema::auction_schedules)]
pub struct AuctionSchedule {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub idempotency_key: String,
    pub state: ScheduleState,
    pub start_time: NaiveDateTime,
    pub retry_count: i32,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::auction_schedules)]
pub struct NewAuctionSchedule {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub idempotency_key: String,
    pub state: ScheduleState,
    pub start_time: NaiveDateTime,
    pub retry_count: i32,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Debug)]
#[diesel(belongs_to(Auction, foreign_key = auction_id))]
#[diesel(belongs_to(User))]
#[diesel(table_name = crate::schema::auction_participants)]
pub struct AuctionParticipant {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub user_id: Uuid,
    pub joined_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::auction_participants)]
pub struct NewAuctionParticipant {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub user_id: Uuid,
    pub joined_at: NaiveDateTime,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Debug)]
#[diesel(belongs_to(Auction, foreign_key = auction_id))]
#[diesel(belongs_to(User, foreign_key = user_id))]
#[diesel(table_name = crate::schema::auction_messages)]
pub struct AuctionMessage {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub message: String,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::auction_messages)]
pub struct NewAuctionMessage {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub message: String,
    pub created_at: NaiveDateTime,
}
