FROM rust:1.94-slim-bookworm AS chef
ENV CARGO_BUILD_JOBS=6
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cmake g++ make pkg-config libssl-dev curl ca-certificates libpq-dev libcurl4-openssl-dev libsasl2-dev && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y curl xz-utils && curl -Ls "https://github.com/LukeMathWalker/cargo-chef/releases/latest/download/cargo-chef-x86_64-unknown-linux-gnu.tar.xz" | tar -xJ -C /usr/local/bin --strip-components=1 cargo-chef-x86_64-unknown-linux-gnu/cargo-chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependent packages first (cached layer)
RUN cargo chef cook --release --jobs 1 --recipe-path recipe.json
COPY . .
RUN cargo build --release --jobs 1 --bin gateway-keeper

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates libpq5 libcurl4 libsasl2-2 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/gateway-keeper /usr/local/bin/gateway-keeper
RUN useradd -m appuser
USER appuser
CMD ["gateway-keeper"]
