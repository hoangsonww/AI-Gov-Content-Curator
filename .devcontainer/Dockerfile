# .devcontainer/Dockerfile
ARG VARIANT="18-bullseye"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT}

# Install MongoDB CLI for direct DB access if desired
RUN apt-get update && apt-get install -y mongodb-clients

# Install global tools
RUN npm install -g ts-node typescript

WORKDIR /workspace
