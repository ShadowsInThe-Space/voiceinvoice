#!/bin/bash
# VoiceInvoice Proxy Server - Hetzner Deployment Script
# Usage: ./deploy.sh [server-ip] [ssh-key-path]

set -e

# Configuration
SERVER_IP="${1:-138.199.166.219}"
SSH_PORT="${SSH_PORT:-22222}"
SSH_KEY="${2:-$HOME/.ssh/id_ed25519}"
REMOTE_USER="${REMOTE_USER:-sonny}"
APP_DIR="/opt/voiceinvoice"
IMAGE_NAME="voiceinvoice/proxy-server:latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Validate inputs
if [ -z "$SERVER_IP" ]; then
    error "Server IP required. Set HETZNER_SERVER_IP or pass as argument."
fi

SSH_OPTS="-p $SSH_PORT"
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

log "Deploying VoiceInvoice Proxy Server to $SERVER_IP"

# Step 1: Build Docker image locally
log "Building Docker image..."
cd "$(dirname "$0")/../.."
docker build -t $IMAGE_NAME -f apps/proxy-server/Dockerfile .

# Step 2: Save and transfer image
log "Saving Docker image..."
docker save $IMAGE_NAME | gzip > /tmp/voiceinvoice-proxy.tar.gz

log "Transferring to server..."
scp -P $SSH_PORT ${SSH_KEY:+-i $SSH_KEY} /tmp/voiceinvoice-proxy.tar.gz $REMOTE_USER@$SERVER_IP:/tmp/

# Step 3: Setup remote server
log "Setting up remote server..."
ssh $SSH_OPTS $REMOTE_USER@$SERVER_IP << 'REMOTE_SCRIPT'
set -e

# Create app directory
mkdir -p /opt/voiceinvoice

# Load Docker image
echo "Loading Docker image..."
gunzip -c /tmp/voiceinvoice-proxy.tar.gz | docker load
rm /tmp/voiceinvoice-proxy.tar.gz

# Stop existing container if running
docker stop voiceinvoice-proxy 2>/dev/null || true
docker rm voiceinvoice-proxy 2>/dev/null || true

# Check for .env file
if [ ! -f /opt/voiceinvoice/.env ]; then
    echo "WARNING: /opt/voiceinvoice/.env not found!"
    echo "Please create it with: GOOGLE_API_KEY=your_key"
fi

# Start new container
echo "Starting container..."
docker run -d \
    --name voiceinvoice-proxy \
    --restart unless-stopped \
    -p 3001:3001 \
    --env-file /opt/voiceinvoice/.env 2>/dev/null || \
docker run -d \
    --name voiceinvoice-proxy \
    --restart unless-stopped \
    -p 3001:3001 \
    -e NODE_ENV=production \
    voiceinvoice/proxy-server:latest

# Wait for health check
echo "Waiting for health check..."
sleep 5
curl -sf http://localhost:3001/health && echo "Health check passed!" || echo "Health check failed"

docker ps | grep voiceinvoice-proxy
REMOTE_SCRIPT

log "Deployment complete!"
log "Server running at http://$SERVER_IP:3001"

# Cleanup local temp file
rm -f /tmp/voiceinvoice-proxy.tar.gz
