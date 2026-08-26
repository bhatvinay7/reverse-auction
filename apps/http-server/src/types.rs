use garde::Validate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Validate)]
pub struct SignUpPayload {
    #[garde(custom(crate::helpers::validate_email_helper))]
    pub email: String,

    #[garde(length(min = 6))]
    pub password: String,

    #[garde(length(min = 2))]
    pub name: String,

    #[garde(skip)]
    pub company_name: Option<String>,

    // By default login as bidder (CARRIER), but add option to login as seller (CUSTOMER)
    // The enum strings could be mapped, but we'll accept string and parse in service
    #[garde(skip)]
    pub role_type: Option<String>,

    #[garde(length(min = 6))]
    pub otp: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SendOtpPayload {
    #[garde(email)]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SignInPayload {
    #[garde(email)]
    pub email: String,

    #[garde(length(min = 1))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ForgotPasswordPayload {
    #[garde(email)]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordPayload {
    #[garde(skip)]
    pub token: String,

    #[garde(length(min = 6))]
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub role: String,
    pub user_id: uuid::Uuid,
    pub name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAuctionPayload {
    #[garde(length(min = 3))]
    pub title: String,

    #[garde(length(min = 5))]
    pub description: String,

    #[garde(skip)]
    pub freight_type: Option<String>, // optional logistics metadata for either direction

    #[garde(skip)]
    pub auction_type: Option<String>,

    #[garde(skip)]
    pub origin_address: Option<String>,
    #[garde(skip)]
    pub origin_lat: Option<f64>,
    #[garde(skip)]
    pub origin_lng: Option<f64>,

    #[garde(skip)]
    pub dest_address: Option<String>,
    #[garde(skip)]
    pub dest_lat: Option<f64>,
    #[garde(skip)]
    pub dest_lng: Option<f64>,

    #[garde(skip)]
    pub pickup_date_start: Option<String>,
    #[garde(skip)]
    pub pickup_date_end: Option<String>,

    #[garde(skip)]
    pub auction_start_time: String,
    #[garde(skip)]
    pub auction_end_time: String,

    #[garde(skip)]
    pub weight: Option<f64>,

    #[garde(skip)]
    pub length: Option<f64>,

    #[garde(skip)]
    pub width: Option<f64>,

    #[garde(skip)]
    pub height: Option<f64>,

    #[garde(skip)]
    pub starting_price: Option<f64>,

    #[garde(skip)]
    pub minimum_bid_step: Option<f64>,

    #[garde(skip)]
    pub reserve_price: Option<f64>,

    #[garde(skip)]
    pub item_category: Option<String>,

    #[garde(skip)]
    pub item_condition: Option<String>,

    #[garde(skip)]
    pub quantity: Option<f64>,

    #[garde(skip)]
    pub quantity_unit: Option<String>,

    #[garde(skip)]
    pub pickup_terms: Option<String>,

    #[garde(skip)]
    pub media_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateListingPayload {
    #[garde(length(min = 3))]
    pub title: String,
    #[garde(length(min = 10))]
    pub description: String,
    #[garde(skip)]
    pub auction_type: String,
    #[garde(skip)]
    pub item_category: Option<String>,
    #[garde(skip)]
    pub item_condition: Option<String>,
    #[garde(skip)]
    pub quantity: Option<f64>,
    #[garde(skip)]
    pub quantity_unit: Option<String>,
    #[garde(skip)]
    pub starting_price: f64,
    #[garde(skip)]
    pub minimum_bid_step: f64,
    #[garde(skip)]
    pub reserve_price: Option<f64>,
    #[garde(skip)]
    pub origin_address: Option<String>,
    #[garde(skip)]
    pub pickup_terms: Option<String>,
    #[garde(skip)]
    pub availability_start: Option<String>,
    #[garde(skip)]
    pub availability_end: Option<String>,
    #[garde(skip)]
    pub media_urls: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewListingPayload {
    pub decision: String,
    pub feedback: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleListingPayload {
    pub auction_start_time: String,
    pub auction_end_time: String,
}
