# Database demo data

Apply all Diesel migrations, then load the idempotent auction fixtures:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/seeds/demo_auctions.sql
```

The script creates twelve auctions in twelve different categories, scheduled
from two days after execution through day sixty. Forward and reverse auctions
alternate, logistics fields are populated only for the logistics example, and
every auction uses a distinct image stored in Cloudinary under `auction-seeds/`.
