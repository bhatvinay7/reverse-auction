# AquaBid Web UI

This is the Next.js frontend application for AquaBid.

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

This frontend interacts with the `gateway-keeper` and `ws-server` via the environment variables defined in `.env.local`.

## Search Feature
The search bar uses `elasticsearch` and `openai` embeddings on the backend, routed through `gateway-keeper` to the `search-server` api.
