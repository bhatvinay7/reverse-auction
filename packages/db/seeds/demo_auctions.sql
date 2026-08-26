-- Idempotent local/demo data. Run after all Diesel migrations.
-- Dates are calculated at execution time and span day 2 through day 60.

INSERT INTO users (
    id, email, password_hash, name, company_name, role,
    rating, total_reviews, created_at, updated_at
) VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'demo.seller@example.test',
        '$2b$12$C6UzMDM.H6dfI/f/IKcEe.3gZ4Q2Z9aM9wI8BJKQnYdQxqzCGQf6K',
        'Demo Administrator',
        'Open Market Demo',
        'ADMIN', 5.0, 0, NOW(), NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'demo.bidder@example.test',
        '$2b$12$C6UzMDM.H6dfI/f/IKcEe.3gZ4Q2Z9aM9wI8BJKQnYdQxqzCGQf6K',
        'Demo Bidder',
        'Open Market Buyer',
        'CARRIER', 5.0, 0, NOW(), NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    company_name = EXCLUDED.company_name,
    role = EXCLUDED.role,
    updated_at = NOW();

DO $$
DECLARE
    titles TEXT[] := ARRAY[
        'Industrial CNC Milling Machine',
        'Commercial Kitchen Equipment Package',
        'Swiss Automatic Collector Watch',
        'Interstate Refrigerated Freight Contract',
        'Enterprise Laptop Fleet',
        'Electric Delivery Vehicle',
        'Organic Coffee Harvest Lot',
        'Corporate Event Production Contract',
        'Handcrafted Office Furniture Collection',
        'Professional Skincare Inventory',
        'Flexible Office Fit-Out Contract',
        'Automotive Semiconductor Components'
    ];
    categories TEXT[] := ARRAY[
        'Industrial Equipment', 'Commercial Kitchen', 'Luxury Collectibles',
        'Freight and Logistics', 'Computers and Electronics', 'Electric Vehicles',
        'Agriculture and Commodities', 'Events and Entertainment', 'Furniture and Interiors',
        'Beauty and Personal Care', 'Commercial Real Estate Services', 'Electronic Components'
    ];
    descriptions TEXT[] := ARRAY[
        'Production-grade CNC milling center with tooling, inspection report, and maintenance records.',
        'Complete stainless-steel restaurant kitchen package including range, refrigeration, and preparation stations.',
        'Authenticated Swiss automatic watch with original box, documentation, and recent service history.',
        'Temperature-controlled interstate transport capacity for a twelve-month distribution agreement.',
        'Fleet of business laptops securely erased, tested, graded, and ready for organizational deployment.',
        'Low-mileage electric delivery van with battery-health certificate and commercial service records.',
        'Traceable single-origin organic coffee harvest offered as a quality-graded wholesale lot.',
        'End-to-end production services for a multi-day corporate conference including staging, lighting, and sound.',
        'Coordinated collection of handcrafted desks, conference tables, storage, and ergonomic seating.',
        'Retail-ready professional skincare inventory with batch documentation and verified expiry dates.',
        'Design, supply, and installation contract for a flexible office workspace and collaboration areas.',
        'Documented lot of automotive-grade semiconductor components with traceability and test certificates.'
    ];
    images TEXT[] := ARRAY[
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/industrial.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/kitchen.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/watch.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/logistics.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/electronics.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/vehicle.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/agriculture.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/event.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/furniture.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/beauty.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/office-components.jpg',
        'https://res.cloudinary.com/a3octpto/image/upload/auction-seeds/semiconductors.jpg'
    ];
    start_offsets INTEGER[] := ARRAY[2, 7, 12, 17, 22, 27, 32, 37, 42, 48, 54, 60];
    i INTEGER;
    auction_uuid UUID;
    starts_at TIMESTAMP;
    direction auction_type;
    is_logistics BOOLEAN;
BEGIN
    FOR i IN 1..array_length(titles, 1) LOOP
        auction_uuid := uuid_generate_v5(
            '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            'bookit-demo-auction-' || i
        );
        starts_at := CURRENT_DATE + (start_offsets[i] * INTERVAL '1 day') + INTERVAL '14 hours';
        direction := CASE WHEN i % 2 = 0 THEN 'REVERSE'::auction_type ELSE 'FORWARD'::auction_type END;
        is_logistics := categories[i] = 'Freight and Logistics';

        INSERT INTO auctions (
            id, title, description, freight_type, weight_kg, dimensions,
            origin_address, origin_lat, origin_lng,
            dest_address, dest_lat, dest_lng, distance_miles,
            pickup_date_start, pickup_date_end,
            delivery_date_start, delivery_date_end,
            status, starting_price, auction_start_time, auction_end_time,
            created_at, updated_at, customer_id
        ) VALUES (
            auction_uuid,
            titles[i],
            descriptions[i],
            CASE WHEN is_logistics THEN 'LTL'::freight_type ELSE NULL END,
            CASE WHEN is_logistics THEN 750 + (i * 40) ELSE NULL END,
            NULL,
            CASE WHEN is_logistics THEN 'Origin hub ' || i ELSE NULL END,
            CASE WHEN is_logistics THEN 12.9716 + (i * 0.01) ELSE NULL END,
            CASE WHEN is_logistics THEN 77.5946 + (i * 0.01) ELSE NULL END,
            CASE WHEN is_logistics THEN 'Destination hub ' || i ELSE NULL END,
            CASE WHEN is_logistics THEN 13.0827 + (i * 0.01) ELSE NULL END,
            CASE WHEN is_logistics THEN 80.2707 + (i * 0.01) ELSE NULL END,
            CASE WHEN is_logistics THEN 220 + (i * 8) ELSE NULL END,
            CASE WHEN is_logistics THEN starts_at + INTERVAL '2 days' ELSE NULL END,
            CASE WHEN is_logistics THEN starts_at + INTERVAL '3 days' ELSE NULL END,
            NULL, NULL,
            'UPCOMING',
            500 + (i * 75),
            starts_at,
            starts_at + INTERVAL '2 hours',
            NOW(), NOW(),
            '10000000-0000-0000-0000-000000000001'
        )
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = 'UPCOMING',
            starting_price = EXCLUDED.starting_price,
            auction_start_time = EXCLUDED.auction_start_time,
            auction_end_time = EXCLUDED.auction_end_time,
            customer_id = EXCLUDED.customer_id,
            updated_at = NOW();

        INSERT INTO auction_configs (
            auction_id, auction_type, minimum_bid_step, reserve_price,
            item_category, item_condition, quantity, quantity_unit, pickup_terms
        ) VALUES (
            auction_uuid,
            direction,
            10 + ((i % 5) * 5),
            CASE WHEN direction = 'FORWARD' THEN 650 + (i * 75) ELSE NULL END,
            categories[i],
            CASE WHEN categories[i] IN ('Luxury Collectibles', 'Electric Vehicles', 'Industrial Equipment') THEN 'Used - inspected' ELSE 'As described' END,
            CASE WHEN categories[i] IN ('Agriculture and Commodities', 'Electronic Components') THEN 100 ELSE 1 END,
            CASE WHEN categories[i] IN ('Agriculture and Commodities', 'Electronic Components') THEN 'lot' ELSE 'item' END,
            CASE WHEN is_logistics THEN 'Pickup and delivery details supplied to the winner' ELSE 'Fulfilment terms supplied by the auctioneer' END
        )
        ON CONFLICT (auction_id) DO UPDATE SET
            auction_type = EXCLUDED.auction_type,
            minimum_bid_step = EXCLUDED.minimum_bid_step,
            reserve_price = EXCLUDED.reserve_price,
            item_category = EXCLUDED.item_category,
            item_condition = EXCLUDED.item_condition,
            quantity = EXCLUDED.quantity,
            quantity_unit = EXCLUDED.quantity_unit,
            pickup_terms = EXCLUDED.pickup_terms;

        INSERT INTO media (id, url, type, auction_id)
        VALUES (
            uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'bookit-demo-media-' || i),
            images[i],
            'image',
            auction_uuid
        )
        ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url;

        INSERT INTO auction_schedules (
            id, auction_id, idempotency_key, state, start_time, retry_count
        ) VALUES (
            uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'bookit-demo-schedule-' || i),
            auction_uuid,
            'bookit-demo-schedule-' || i,
            'SCHEDULED',
            starts_at,
            0
        )
        ON CONFLICT (idempotency_key) DO UPDATE SET
            state = 'SCHEDULED',
            start_time = EXCLUDED.start_time,
            retry_count = 0;

        INSERT INTO auction_participants (id, auction_id, user_id, joined_at)
        VALUES (
            uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'bookit-demo-participant-' || i),
            auction_uuid,
            '10000000-0000-0000-0000-000000000002',
            NOW()
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
