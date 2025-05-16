#!/usr/bin/env bash
set -e

# Install each workspace’s deps
(cd ../frontend && npm install)
(cd ../backend  && npm install)
(cd ../crawler  && npm install)
