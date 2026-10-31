FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app
