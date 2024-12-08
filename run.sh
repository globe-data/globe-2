#!/bin/bash
cd "$(dirname "$0")"  # Change to script directory
docker compose -f app/docker-compose.yml up -d  # Start MongoDB
uvicorn app.main:app --reload 