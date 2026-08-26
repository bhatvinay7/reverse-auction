CREATE TABLE bid_audit_events (
    request_id UUID PRIMARY KEY,
    auction_id UUID NOT NULL,
    bidder_id UUID NOT NULL,
    username VARCHAR,
    amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
    auction_type auction_type NOT NULL,
    accepted BOOLEAN NOT NULL,
    rejection_reason TEXT,
    previous_price DOUBLE PRECISION NOT NULL,
    resulting_price DOUBLE PRECISION NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP NOT NULL,
    source_topic VARCHAR NOT NULL,
    source_partition INTEGER NOT NULL,
    source_offset BIGINT NOT NULL,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT bid_audit_source_position_unique
        UNIQUE (source_topic, source_partition, source_offset),
    CONSTRAINT bid_audit_rejection_reason_check CHECK (
        (accepted AND rejection_reason IS NULL)
        OR (NOT accepted AND rejection_reason IS NOT NULL)
    )
);

CREATE INDEX bid_audit_events_auction_order_idx
    ON bid_audit_events (auction_id, source_partition, source_offset);

CREATE INDEX bid_audit_events_bidder_time_idx
    ON bid_audit_events (bidder_id, processed_at DESC);

COMMENT ON TABLE bid_audit_events IS
    'Append-only processed bid decisions. Deliberately has no foreign keys so audit history survives deletion or anonymization of operational records.';

CREATE FUNCTION prevent_bid_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'bid_audit_events is append-only';
END;
$$;

CREATE TRIGGER bid_audit_events_append_only
BEFORE UPDATE OR DELETE ON bid_audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_bid_audit_mutation();
