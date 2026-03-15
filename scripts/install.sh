#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yaml"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check_command() {
    command -v "$1" >/dev/null 2>&1
}

generate_env() {
    ENV_FILE="$PROJECT_ROOT/.env"

    if [[ -f "$ENV_FILE" ]]; then
        echo ".env already exists. Skipping generation."
        return
    fi

    echo "Generating .env..."
    DB_PASSWORD=$(openssl rand -hex 16)
    API_SECRET=$(openssl rand -hex 32)

    cat > "$ENV_FILE" <<EOT
POSTGRES_USER=viivuser
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=viivdb
API_ENV=production
API_SECRET=${API_SECRET}
EOT

    chmod 600 "$ENV_FILE"
}

create_api_source() {
    API_DIR="$PROJECT_ROOT/api"
    mkdir -p "$API_DIR"

    if [[ -f "$API_DIR/Dockerfile" ]]; then
        echo "API source already exists."
        return
    fi

    cat > "$API_DIR/Dockerfile" <<EOT
FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn
COPY main.py .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
EOT

    cat > "$API_DIR/main.py" <<EOT
from fastapi import FastAPI

app = FastAPI()

@app.get("/healthz")
def health():
    return {"status": "ok"}
EOT
}

wait_for_health() {
    echo "Waiting for API to become healthy..."
    for i in {1..30}; do
        if docker compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
            return 0
        fi
        sleep 4
    done
    return 1
}

main() {
    check_command docker || { echo -e "${RED}Docker not found${NC}"; exit 1; }
    docker compose version >/dev/null 2>&1 || { echo -e "${RED}Docker Compose plugin missing${NC}"; exit 1; }

    generate_env
    create_api_source

    docker compose \
     --project-directory "$PROJECT_ROOT" \
      -f "$COMPOSE_FILE" down --remove-orphans || true
    docker compose \
      --project-directory "$PROJECT_ROOT" \
      -f "$COMPOSE_FILE" up -d --build --remove-orphans

    if wait_for_health; then
        echo -e "${GREEN}Deployment SUCCESS${NC}"
    else
        echo -e "${RED}Deployment FAILED${NC}"
        exit 1
    fi
}

main
