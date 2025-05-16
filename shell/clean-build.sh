#!/usr/bin/env bash
set -e

# Remove only build/output directories
rm -rf ../frontend/.next ../frontend/dist
rm -rf ../backend/dist
rm -rf ../crawler/dist
