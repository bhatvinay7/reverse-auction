// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "auction_status"))]
    pub struct AuctionStatus;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "auction_type"))]
    pub struct AuctionType;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "freight_type"))]
    pub struct FreightType;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "role"))]
    pub struct Role;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "schedule_state"))]
    pub struct ScheduleState;
}

diesel::table! {
    bid_request_audit_events (source_topic, source_partition, source_offset) {
        source_topic -> Varchar,
        source_partition -> Int4,
        source_offset -> Int8,
        request_id -> Uuid,
        auction_id -> Uuid,
        bidder_id -> Uuid,
        username -> Nullable<Varchar>,
        amount -> Float8,
        submitted_at -> Timestamp,
        payload -> Text,
        archived_at -> Timestamp,
    }
}

diesel::table! {
    auction_listing_status_history (id) {
        id -> Uuid,
        listing_id -> Uuid,
        from_status -> Nullable<Varchar>,
        to_status -> Varchar,
        actor_id -> Nullable<Uuid>,
        note -> Nullable<Text>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::AuctionType;

    auction_listings (id) {
        id -> Uuid,
        seller_id -> Uuid,
        auction_id -> Nullable<Uuid>,
        status -> Varchar,
        auction_type -> AuctionType,
        title -> Varchar,
        description -> Text,
        item_category -> Nullable<Varchar>,
        item_condition -> Nullable<Varchar>,
        quantity -> Nullable<Float8>,
        quantity_unit -> Nullable<Varchar>,
        starting_price -> Float8,
        minimum_bid_step -> Float8,
        reserve_price -> Nullable<Float8>,
        origin_address -> Nullable<Varchar>,
        pickup_terms -> Nullable<Text>,
        availability_start -> Nullable<Timestamp>,
        availability_end -> Nullable<Timestamp>,
        media_urls -> Array<Nullable<Text>>,
        admin_feedback -> Nullable<Text>,
        reviewed_by -> Nullable<Uuid>,
        submitted_at -> Timestamp,
        reviewed_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::AuctionType;

    auction_configs (auction_id) {
        auction_id -> Uuid,
        auction_type -> AuctionType,
        minimum_bid_step -> Float8,
        reserve_price -> Nullable<Float8>,
        item_category -> Nullable<Varchar>,
        item_condition -> Nullable<Varchar>,
        quantity -> Nullable<Float8>,
        quantity_unit -> Nullable<Varchar>,
        pickup_terms -> Nullable<Text>,
    }
}

diesel::table! {
    auction_messages (id) {
        id -> Uuid,
        auction_id -> Uuid,
        user_id -> Uuid,
        username -> Varchar,
        message -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    auction_participants (id) {
        id -> Uuid,
        auction_id -> Uuid,
        user_id -> Uuid,
        joined_at -> Timestamp,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ScheduleState;

    auction_schedules (id) {
        id -> Uuid,
        auction_id -> Uuid,
        idempotency_key -> Varchar,
        state -> ScheduleState,
        start_time -> Timestamp,
        retry_count -> Int4,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::FreightType;
    use super::sql_types::AuctionStatus;

    auctions (id) {
        id -> Uuid,
        title -> Varchar,
        description -> Text,
        freight_type -> Nullable<FreightType>,
        weight_kg -> Nullable<Float8>,
        dimensions -> Nullable<Varchar>,
        origin_address -> Nullable<Varchar>,
        origin_lat -> Nullable<Float8>,
        origin_lng -> Nullable<Float8>,
        dest_address -> Nullable<Varchar>,
        dest_lat -> Nullable<Float8>,
        dest_lng -> Nullable<Float8>,
        distance_miles -> Nullable<Float8>,
        pickup_date_start -> Nullable<Timestamp>,
        pickup_date_end -> Nullable<Timestamp>,
        delivery_date_start -> Nullable<Timestamp>,
        delivery_date_end -> Nullable<Timestamp>,
        status -> AuctionStatus,
        starting_price -> Nullable<Float8>,
        auction_start_time -> Timestamp,
        auction_end_time -> Timestamp,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        customer_id -> Uuid,
        winner_id -> Nullable<Uuid>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::AuctionType;

    bid_audit_events (request_id) {
        request_id -> Uuid,
        auction_id -> Uuid,
        bidder_id -> Uuid,
        username -> Nullable<Varchar>,
        amount -> Float8,
        auction_type -> AuctionType,
        accepted -> Bool,
        rejection_reason -> Nullable<Text>,
        previous_price -> Float8,
        resulting_price -> Float8,
        submitted_at -> Timestamp,
        processed_at -> Timestamp,
        source_topic -> Varchar,
        source_partition -> Int4,
        source_offset -> Int8,
        archived_at -> Timestamp,
    }
}

diesel::table! {
    bids (id) {
        id -> Uuid,
        amount -> Float8,
        created_at -> Timestamp,
        carrier_id -> Uuid,
        auction_id -> Uuid,
    }
}

diesel::table! {
    media (id) {
        id -> Uuid,
        url -> Varchar,
        #[sql_name = "type"]
        type_ -> Varchar,
        auction_id -> Uuid,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::Role;

    users (id) {
        id -> Uuid,
        email -> Varchar,
        password_hash -> Varchar,
        name -> Varchar,
        company_name -> Nullable<Varchar>,
        role -> Role,
        rating -> Float8,
        total_reviews -> Int4,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::joinable!(auction_configs -> auctions (auction_id));
diesel::joinable!(auction_listings -> auctions (auction_id));
diesel::joinable!(auction_listing_status_history -> auction_listings (listing_id));
diesel::joinable!(auction_messages -> auctions (auction_id));
diesel::joinable!(auction_messages -> users (user_id));
diesel::joinable!(auction_participants -> auctions (auction_id));
diesel::joinable!(auction_participants -> users (user_id));
diesel::joinable!(auction_schedules -> auctions (auction_id));
diesel::joinable!(auctions -> users (customer_id));
diesel::joinable!(bids -> auctions (auction_id));
diesel::joinable!(bids -> users (carrier_id));
diesel::joinable!(media -> auctions (auction_id));

diesel::allow_tables_to_appear_in_same_query!(
    auction_configs,
    auction_listing_status_history,
    auction_listings,
    auction_messages,
    auction_participants,
    auction_schedules,
    auctions,
    bid_audit_events,
    bid_request_audit_events,
    bids,
    media,
    users,
);
