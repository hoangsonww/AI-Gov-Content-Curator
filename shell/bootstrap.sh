#!/usr/bin/env bash
set -e

# Install root deps and workspace deps
npm install
./shell/deps.sh
