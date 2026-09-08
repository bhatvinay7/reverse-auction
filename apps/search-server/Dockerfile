FROM rust:1.94-slim-bookworm AS chef
ENV CARGO_BUILD_JOBS=6
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev protobuf-compiler lld clang curl ca-certificates xz-utils cmake build-essential libcurl4-openssl-dev libsasl2-dev zlib1g-dev libzstd-dev && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://github.com/LukeMathWalker/cargo-chef/releases/latest/download/cargo-chef-installer.sh | sh
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependent packages first (cached layer)
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin search-server

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates libpq5 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/search-server /usr/local/bin/search-server
RUN useradd -m appuser
USER appuser
EXPOSE 8084
CMD ["search-server"]
