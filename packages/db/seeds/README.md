# Database demo data

## How it works

The seed script is for local development and repeatable test environments. It inserts a fixed set of representative auctions only after Diesel migrations have created the required schema. The fixtures are idempotent, so rerunning the script does not create duplicate records. They provide scheduled forward and reverse auctions for exercising marketplace discovery, registration, live-state scheduling, history, and search indexing.

Apply all Diesel migrations, then load the idempotent auction fixtures:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/seeds/demo_auctions.sql
```

The script creates twelve auctions in twelve different categories, scheduled
from two days after execution through day sixty. Forward and reverse auctions
alternate, logistics fields are populated only for the logistics example, and
every auction uses a distinct image stored in Cloudinary under `auction-seeds/`.
