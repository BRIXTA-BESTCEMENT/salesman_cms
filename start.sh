#!/bin/bash

# 1. Load the Client ID and Secret from the .env file into the shell
export $(grep -v '^#' .env.production | xargs)

# 2. Safety check to make sure they loaded
if [ -z "$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" ] || [ -z "$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET" ] || [ -z "$INFISICAL_PROJECT_ID" ]; then
  echo "Error: Infisical Universal Auth credentials are not set in .env"
  exit 1
fi

# 3. Start Docker Compose via Infisical
# The CLI detects the Client ID/Secret, authenticates, fetches the secrets for this specific project, and injects them.
infisical run --env=prod -- docker compose up -d

echo "Containers started successfully with secure environment variables!"