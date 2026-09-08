# Stage 1: Chef
FROM rust:1.94-bookworm AS chef
ENV CARGO_BUILD_JOBS=6
USER root
RUN apt-get update && apt-get install -y curl xz-utils && curl -Ls "https://github.com/LukeMathWalker/cargo-chef/releases/latest/download/cargo-chef-x86_64-unknown-linux-gnu.tar.xz" | tar -xJ -C /usr/local/bin --strip-components=1 cargo-chef-x86_64-unknown-linux-gnu/cargo-chef
WORKDIR /app

# Stage 2: Planner
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Builder
FROM chef AS builder
WORKDIR /app
ARG DATABASE_URL
ARG REDIS_URL
ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_URL=$REDIS_URL
RUN apt-get update && apt-get install -y cmake pkg-config libssl-dev protobuf-compiler libpq-dev libcurl4-openssl-dev libsasl2-dev zlib1g-dev libzstd-dev
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
# Build application
RUN cargo build --release -p auction-engine

# Stage 4: Runner
FROM debian:bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y libssl3 ca-certificates libpq-dev && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/auction-engine /usr/local/bin/app
CMD ["app"]
