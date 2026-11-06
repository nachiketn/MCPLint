# Sandbox for capturing MCP server tool lists.
# Servers run as an unprivileged user with dummy credentials; nothing from the
# host is visible except the /out folder you mount.

# GitHub's official server is a Go binary, so build it in a separate stage.
FROM golang:1.27-bookworm AS github
ARG GITHUB_MCP_VERSION=latest
RUN go install github.com/github/github-mcp-server/v2/cmd/github-mcp-server@${GITHUB_MCP_VERSION}

FROM node:22-bookworm
# Distro python3 tracks the base image; Dependabot bumps the base image.
# hadolint ignore=DL3008
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /usr/local/bin/
COPY --from=github /go/bin/github-mcp-server /usr/local/bin/

# Run as the image's built-in unprivileged "node" user (uid 1000).
RUN mkdir -p /out /home/node/app && chown 1000:1000 /out /home/node/app
USER 1000
WORKDIR /home/node/app
COPY --chown=1000:1000 package.json package-lock.json collect.mjs servers.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

ENV CONCURRENCY=3
ENTRYPOINT ["node", "collect.mjs", "servers.json", "/out"]
