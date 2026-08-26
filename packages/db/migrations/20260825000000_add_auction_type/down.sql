DROP TABLE IF EXISTS auction_configs;

UPDATE auctions SET
    freight_type = COALESCE(freight_type, 'LTL'),
    origin_address = COALESCE(origin_address, ''),
    origin_lat = COALESCE(origin_lat, 0),
    origin_lng = COALESCE(origin_lng, 0),
    dest_address = COALESCE(dest_address, ''),
    dest_lat = COALESCE(dest_lat, 0),
    dest_lng = COALESCE(dest_lng, 0),
    pickup_date_start = COALESCE(pickup_date_start, auction_end_time),
    pickup_date_end = COALESCE(pickup_date_end, auction_end_time);

ALTER TABLE auctions
    ALTER COLUMN freight_type SET NOT NULL,
    ALTER COLUMN origin_address SET NOT NULL,
    ALTER COLUMN origin_lat SET NOT NULL,
    ALTER COLUMN origin_lng SET NOT NULL,
    ALTER COLUMN dest_address SET NOT NULL,
    ALTER COLUMN dest_lat SET NOT NULL,
    ALTER COLUMN dest_lng SET NOT NULL,
    ALTER COLUMN pickup_date_start SET NOT NULL,
    ALTER COLUMN pickup_date_end SET NOT NULL;

ALTER TABLE bids RENAME COLUMN auction_id TO shipment_id;
ALTER TABLE media RENAME COLUMN auction_id TO shipment_id;
ALTER TABLE auctions RENAME TO shipments;

DROP TYPE IF EXISTS auction_type;
