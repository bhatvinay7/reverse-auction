# AquaBid Web UI

This is the Next.js frontend application for AquaBid.

## How it works

The web app is the browser client for the AquaBid marketplace. It uses Gateway Keeper as the public API boundary and never connects directly to internal Rust services, Redis, Kafka, PostgreSQL, or Elasticsearch.

- Marketplace and dashboard data are loaded through the authenticated auction API.
- Search requests are sent to Gateway Keeper, which forwards them to the search service and Elasticsearch.
- A user registers for an auction before its join deadline. When it is live, the app requests a short-lived socket ticket and opens a Socket.IO connection through Gateway Keeper.
- Accepted bid updates are received in the auction room and rendered from the real-time state maintained by the auction engine.
- The auction details, media, and map UI are loaded only for scheduled or completed auction views; the live route prioritizes the bidding console.

The shared header search control is displayed on Home, Dashboard, and Admin routes only. The route-level loading state on `/auction/[id]` gives immediate feedback while an auction view is being loaded.

## Getting Started

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This frontend interacts with `gateway-keeper` through the environment variables defined in `.env.local`. In production, the WebSocket endpoint is also Gateway Keeper; it proxies upgrades to `ws-server` after ticket validation.

## Search Feature
The search bar uses Elasticsearch and OpenAI embeddings on the backend, routed through Gateway Keeper to the search-server API. The dashboard's schedules and filters remain sourced from the auction API; search results are sourced from the search service.
