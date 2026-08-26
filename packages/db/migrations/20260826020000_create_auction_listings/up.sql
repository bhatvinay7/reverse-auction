CREATE TABLE auction_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auction_id UUID REFERENCES auctions(id) ON DELETE SET NULL,
    status VARCHAR NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SCHEDULED', 'CANCELLED')),
    auction_type auction_type NOT NULL DEFAULT 'FORWARD',
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    item_category VARCHAR,
    item_condition VARCHAR,
    quantity DOUBLE PRECISION,
    quantity_unit VARCHAR,
    starting_price DOUBLE PRECISION NOT NULL,
    minimum_bid_step DOUBLE PRECISION NOT NULL DEFAULT 1,
    reserve_price DOUBLE PRECISION,
    origin_address VARCHAR,
    pickup_terms TEXT,
    availability_start TIMESTAMP,
    availability_end TIMESTAMP,
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    admin_feedback TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX auction_listings_seller_id_idx ON auction_listings (seller_id, updated_at DESC);
CREATE INDEX auction_listings_status_idx ON auction_listings (status, submitted_at ASC);
