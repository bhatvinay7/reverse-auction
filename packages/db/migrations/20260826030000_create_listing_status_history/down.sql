DROP TRIGGER IF EXISTS auction_listing_history_no_update ON auction_listing_status_history;
DROP FUNCTION IF EXISTS prevent_listing_history_mutation();
DROP TABLE IF EXISTS auction_listing_status_history;
