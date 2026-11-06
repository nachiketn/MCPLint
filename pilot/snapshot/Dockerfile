# Sandbox for capturing MCP server tool lists.
# Servers run as an unprivileged user with dummy credentials; nothing from the
# host is visible except the /out folder you mount.

# GitHub's official server is a Go binary, so build it in a separate stage.
FROM golang:1.27-bookworm AS github
RUN go install github.com/github/github-mcp-server/v2/cmd/github-mcp-server@latest

FROM node:22-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /usr/local/bin/
COPY --from=github /go/bin/github-mcp-server /usr/local/bin/

RUN useradd --create-home runner && mkdir /out && chown runner /out
USER runner
WORKDIR /home/runner/app
COPY --chown=runner package.json collect.mjs servers.json ./
RUN npm install --omit=dev --no-audit --no-fund

ENV CONCURRENCY=3
ENTRYPOINT ["node", "collect.mjs", "servers.json", "/out"]
