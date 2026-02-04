#!/bin/bash
set -e

echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

echo "Adding user to docker group..."
sudo usermod -aG docker $USER

echo "Docker installed successfully. You might need to log out and log back in."
