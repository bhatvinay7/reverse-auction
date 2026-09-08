#!/bin/bash

# Find the absolute path to the .env file (one level up from the script)
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ENV_FILE="${SCRIPT_DIR}/../.env"

# Fetch database URL from .env (and remove any quotes)
RAW_DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$RAW_DB_URL" ]; then
    echo "Error: DATABASE_URL not found in $ENV_FILE"
    exit 1
fi

# Remove '-pooler' from the URL because logical replication requires a direct connection
NEON_DATABASE_URL="${RAW_DB_URL/-pooler/}"
PUBLICATION_NAME="auction_cdc_pub"
SLOT_NAME="auction_cdc_slot"
PLUGIN_NAME="pgoutput" # Standard logical decoding plugin for Postgres

# Tables that the CDC worker is tracking
TABLES=("auctions" "auction_listings")

echo "Starting logical replication setup for tables: ${TABLES[*]}"

# Wrapper to use docker for psql so we don't need it installed locally
function run_psql() {
    docker run --rm postgres:15 psql "$NEON_DATABASE_URL" -c "$1" "$@"
}

# 1. Set Replica Identity for all tracked tables
echo "Setting REPLICA IDENTITY to FULL for all tracked tables..."
for TABLE in "${TABLES[@]}"; do
    run_psql "ALTER TABLE $TABLE REPLICA IDENTITY FULL;"
done

# 2. Create the Publication for the specific tables
echo "Creating publication '$PUBLICATION_NAME'..."
run_psql "DROP PUBLICATION IF EXISTS $PUBLICATION_NAME;"

# Join tables with comma for publication command
TABLES_CSV=$(IFS=,; echo "${TABLES[*]}")
run_psql "CREATE PUBLICATION $PUBLICATION_NAME FOR TABLE $TABLES_CSV;"

# 3. Create the Logical Replication Slot
echo "Checking for existing replication slot '$SLOT_NAME'..."
SLOT_EXISTS=$(docker run --rm postgres:15 psql "$NEON_DATABASE_URL" -t -c "SELECT count(*) FROM pg_replication_slots WHERE slot_name = '$SLOT_NAME';" | xargs)

if [ "$SLOT_EXISTS" -eq "1" ]; then
    echo "Slot '$SLOT_NAME' already exists. Dropping it first..."
    run_psql "SELECT pg_drop_replication_slot('$SLOT_NAME');"
fi

echo "Creating logical replication slot '$SLOT_NAME'..."
run_psql "SELECT pg_create_logical_replication_slot('$SLOT_NAME', '$PLUGIN_NAME');"

echo "✅ Setup complete!"
echo "Publication: $PUBLICATION_NAME (Tables: $TABLES_CSV)"
echo "Slot Name: $SLOT_NAME"
