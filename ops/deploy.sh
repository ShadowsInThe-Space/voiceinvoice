#!/bin/bash
set -e

TARGET=$1

if [ -z "$TARGET" ]; then
  echo "Usage: $0 <user>@<host>"
  exit 1
fi

# Check if .env exists in ops
if [ ! -f "ops/.env" ]; then
  echo "Warning: ops/.env not found. Using defaults or environment variables on server."
  echo "You should create ops/.env based on ops/.env.example before deploying."
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "Deploying to $TARGET..."

# Exclude list for rsync
RSYNC_EXCLUDE="--exclude=node_modules --exclude=.git --exclude=dist --exclude=.turbo --exclude=.next --exclude=test-results --exclude=.DS_Store"

# Create directory on server
ssh $TARGET "mkdir -p ~/voiceinvoice"

# Sync files
echo "Syncing files..."
rsync -avz $RSYNC_EXCLUDE . $TARGET:~/voiceinvoice/

# Build and start on server
echo "Building and starting containers on server..."
ssh $TARGET "cd ~/voiceinvoice/ops && docker compose up --build -d"

echo "Pruning unused images..."
ssh $TARGET "docker image prune -f"

echo "Deployment complete!"
