#!/usr/bin/env bash
set -e

# Remove node_modules and build output
rm -rf node_modules
rm -rf ../frontend/node_modules ../frontend/.next ../frontend/dist
rm -rf ../backend/node_modules  ../backend/dist
rm -rf ../crawler/node_modules  ../crawler/dist
