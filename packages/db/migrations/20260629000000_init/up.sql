CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE role AS ENUM ('CUSTOMER', 'CARRIER', 'ADMIN');
CREATE TYPE auction_status AS ENUM ('DRAFT', 'UPCOMING', 'LIVE', 'AWARDED', 'COMPLETED', 'CANCELLED');
CREATE TYPE freight_type AS ENUM ('FCL', 'LCL', 'FTL', 'LTL', 'AIR', 'OCEAN', 'PARCEL');
CREATE TYPE schedule_state AS ENUM ('SCHEDULED', 'CLOSED', 'ERROR', 'SUCCESS','STARTED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    company_name VARCHAR,
    role role NOT NULL DEFAULT 'CUSTOMER',
    rating DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    freight_type freight_type NOT NULL,
    weight_kg DOUBLE PRECISION,
    dimensions VARCHAR,
    
    origin_address VARCHAR NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lng DOUBLE PRECISION NOT NULL,
    
    dest_address VARCHAR NOT NULL,
    dest_lat DOUBLE PRECISION NOT NULL,
    dest_lng DOUBLE PRECISION NOT NULL,
    distance_miles DOUBLE PRECISION,
    
    pickup_date_start TIMESTAMP NOT NULL,
    pickup_date_end TIMESTAMP NOT NULL,
    delivery_date_start TIMESTAMP,
    delivery_date_end TIMESTAMP,
    
    status auction_status NOT NULL DEFAULT 'DRAFT',
    starting_price DOUBLE PRECISION,
    auction_start_time TIMESTAMP NOT NULL,
    auction_end_time TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    carrier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE
);

CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE
);

CREATE TABLE auction_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    idempotency_key VARCHAR NOT NULL UNIQUE,
    state schedule_state NOT NULL DEFAULT 'SCHEDULED',
    start_time TIMESTAMP NOT NULL
);
