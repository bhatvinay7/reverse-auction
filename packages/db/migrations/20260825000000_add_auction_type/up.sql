CREATE TYPE auction_type AS ENUM ('REVERSE', 'FORWARD');

ALTER TABLE shipments RENAME TO auctions;
ALTER TABLE bids RENAME COLUMN shipment_id TO auction_id;
ALTER TABLE media RENAME COLUMN shipment_id TO auction_id;

ALTER TABLE auctions
    ALTER COLUMN freight_type DROP NOT NULL,
    ALTER COLUMN origin_address DROP NOT NULL,
    ALTER COLUMN origin_lat DROP NOT NULL,
    ALTER COLUMN origin_lng DROP NOT NULL,
    ALTER COLUMN dest_address DROP NOT NULL,
    ALTER COLUMN dest_lat DROP NOT NULL,
    ALTER COLUMN dest_lng DROP NOT NULL,
    ALTER COLUMN pickup_date_start DROP NOT NULL,
    ALTER COLUMN pickup_date_end DROP NOT NULL;

CREATE TABLE auction_configs (
    auction_id UUID PRIMARY KEY REFERENCES auctions(id) ON DELETE CASCADE,
    auction_type auction_type NOT NULL DEFAULT 'REVERSE',
    minimum_bid_step DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    reserve_price DOUBLE PRECISION,
    item_category VARCHAR,
    item_condition VARCHAR,
    quantity DOUBLE PRECISION,
    quantity_unit VARCHAR,
    pickup_terms TEXT,
    CONSTRAINT auction_configs_minimum_bid_step_positive CHECK (minimum_bid_step > 0),
    CONSTRAINT auction_configs_reserve_price_non_negative CHECK (reserve_price IS NULL OR reserve_price >= 0),
    CONSTRAINT auction_configs_quantity_positive CHECK (quantity IS NULL OR quantity > 0)
);

INSERT INTO auction_configs (auction_id, auction_type, minimum_bid_step)
SELECT id, 'REVERSE', 1.0 FROM auctions;
