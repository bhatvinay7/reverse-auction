#!/bin/bash

# Find the project root
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT="${SCRIPT_DIR}/.."

echo "Starting Docker services..."

# Start all services defined in docker-compose.test.yaml in detached mode
docker compose -f "$PROJECT_ROOT/docker-compose.test.yaml" up -d

echo "----------------------------------------"
echo "✅ Services have been started in the background!"
echo "To view logs, you can run: docker compose -f docker-compose.test.yaml logs -f"
echo "To stop services, run: docker compose -f docker-compose.test.yaml down"
