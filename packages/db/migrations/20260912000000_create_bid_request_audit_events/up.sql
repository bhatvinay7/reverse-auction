CREATE TABLE bid_request_audit_events (
    source_topic VARCHAR NOT NULL,
    source_partition INTEGER NOT NULL CHECK (source_partition >= 0),
    source_offset BIGINT NOT NULL CHECK (source_offset >= 0),
    request_id UUID NOT NULL,
    auction_id UUID NOT NULL,
    bidder_id UUID NOT NULL,
    username VARCHAR,
    amount DOUBLE PRECISION NOT NULL CHECK (amount > 0 AND amount < 'Infinity'::float8),
    submitted_at TIMESTAMP NOT NULL,
    payload TEXT NOT NULL,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_topic, source_partition, source_offset)
);

CREATE INDEX bid_request_audit_auction_order_idx
    ON bid_request_audit_events (auction_id, source_partition, source_offset);
CREATE INDEX bid_request_audit_request_idx ON bid_request_audit_events (request_id);

COMMENT ON TABLE bid_request_audit_events IS
    'Append-only Kafka bid requests, archived independently of Redis and decision processing. Kafka position deduplicates redelivery while preserving repeated submissions with the same request ID.';

CREATE FUNCTION prevent_bid_request_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'bid_request_audit_events is append-only';
END;
$$;

CREATE TRIGGER bid_request_audit_events_append_only
BEFORE UPDATE OR DELETE ON bid_request_audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_bid_request_audit_mutation();
