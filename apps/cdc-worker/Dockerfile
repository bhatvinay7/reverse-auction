FROM rust:1.94-slim-bookworm AS chef
ENV CARGO_BUILD_JOBS=6
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev protobuf-compiler lld clang curl ca-certificates xz-utils && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://github.com/LukeMathWalker/cargo-chef/releases/latest/download/cargo-chef-installer.sh | sh
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Install cmake and required dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    libssl-dev \
    pkg-config \
    libcurl4-openssl-dev \
    libsasl2-dev \
    zlib1g-dev \
    libzstd-dev \
    && rm -rf /var/lib/apt/lists/*

# Build dependent packages first
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin cdc

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates libpq5 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/cdc /usr/local/bin/cdc
RUN useradd -m appuser
USER appuser
EXPOSE 9103
CMD ["cdc"]
