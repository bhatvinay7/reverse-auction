CREATE TABLE auction_listing_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES auction_listings(id) ON DELETE CASCADE,
    from_status VARCHAR,
    to_status VARCHAR NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX auction_listing_history_listing_idx
    ON auction_listing_status_history (listing_id, created_at ASC);

CREATE OR REPLACE FUNCTION prevent_listing_history_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'auction listing status history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auction_listing_history_no_update
    BEFORE UPDATE OR DELETE ON auction_listing_status_history
    FOR EACH ROW EXECUTE FUNCTION prevent_listing_history_mutation();
