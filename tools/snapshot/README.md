# Capturing live tool lists with Docker

This starts each MCP server in `servers.json` inside a throwaway Docker
container, asks it for its tools, resources and prompts (exactly what an agent
sees), and saves one JSON file per server to `snapshots/` (at the repo root). It never calls
a tool, and every credential it passes is a dummy.

## Why Docker

The servers are third-party code. Docker runs them in an isolated box: they
cannot see your files, SSH keys, browser sessions or cloud credentials. The only
thing shared with your computer is the `snapshots/` (at the repo root) folder where results
are written. When the run ends, the container is deleted.

## One-time setup (about 10 minutes)

1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
   (Mac, Windows, or Linux). Start it and wait until it says "Engine running".
   - Windows: when asked, allow it to use WSL 2.
2. Check it works. In a terminal (Mac: Terminal app; Windows: PowerShell):
   ```
   docker run --rm hello-world
   ```
   You should see "Hello from Docker!".
3. Get this branch:
   ```
   git clone https://github.com/nachiketn/MCPLint.git
   cd MCPLint
   git checkout claude/project-thread-4hz0ye
   ```

## Each run

Mac or Linux:

```
./tools/snapshot/run.sh
```

Windows (PowerShell), from the repo folder:

```
docker build -t mcpsmell-snapshot tools/snapshot
docker run --rm --cap-drop ALL --security-opt no-new-privileges --memory 4g --cpus 2 -v "${PWD}/snapshots:/out" mcpsmell-snapshot
```

The first build takes 5 to 10 minutes (it downloads Node, Python and builds
GitHub's server). The run then prints one line per server, for example:

```
github                   43 tools
azure-all                FAILED  timeout after 240000 ms: connect
```

Failures are expected for a few servers that insist on real credentials; the
error is saved in that server's JSON so we can decide what to do.

To capture only some servers: `./tools/snapshot/run.sh github azure`.

## Sending results back

`snapshots/` is git-ignored, so results never land in the repository by
accident. Zip the folder and share the zip in the project thread:

```
zip -r snapshots.zip snapshots
```

On Windows: right-click the `snapshots` folder, **Send to → Compressed (zipped)
folder**.

## Troubleshooting

- `permission denied` writing to `/out` on Linux: run
  `sudo chown 1000 snapshots` once.
- `Cannot connect to the Docker daemon`: Docker Desktop is not running.
- Apple Silicon Macs work as is; the images are multi-architecture.

## Scaling up later (Azure)

The same image runs unchanged on an Azure VM or Azure Container Instances.
That is only worth it past a few hundred servers or for the tool-selection
benchmark, which needs long unattended runs.
