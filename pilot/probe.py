"""Pilot static probe: regex heuristics over cloned MCP server repos.

Reads source as text only (never imports or runs it). Emits candidate hits per
rule so a human can confirm true positives. Usage:
    python3 -I probe.py <corpus_dir> > probe.json
"""

import json
import os
import re
import sys
from collections import defaultdict

SRC_EXT = {".ts", ".tsx", ".js", ".mjs", ".py", ".go", ".cs"}
SKIP_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "vendor",
    "__tests__",
    "tests",
    "test",
    "e2e",
    "docs",
    "examples",
    "fixtures",
    "__pycache__",
    ".venv",
}

TOOL_DEF = [
    re.compile(r"""\.(?:tool|registerTool)\(\s*["'`]([A-Za-z0-9_.\-]+)["'`]"""),  # TS SDK
    re.compile(r"""mcp\.NewTool\(\s*"([A-Za-z0-9_.\-]+)\""""),  # Go mcp-go
    re.compile(r"""@(?:mcp|server|app)\.tool\((?:[^)]*name\s*=\s*["']([A-Za-z0-9_.\-]+)["'])?"""),  # Py FastMCP
    re.compile(r"""\bTool\(\s*name\s*=\s*["']([A-Za-z0-9_.\-]+)["']"""),  # Py low-level
    re.compile(
        r"""^\s*name:\s*["'`]([a-z][a-z0-9_]+(?:_[a-z0-9]+)+)["'`],\s*$"""
    ),  # TS tool objects {name: "x_y", ...}
]
DISPATCH_PARAM = re.compile(
    r"""["'`]?\b(action|operation|method|op|command|subcommand|mode|intent|resource_type)\b["'`]?\s*[:=,(]\s*(?:z\.enum|z\.literal|z\.union|mcp\.Enum|Literal\[|\{\s*type:\s*["']string["'],\s*enum)"""
)
DISPATCH_PARAM_GO = re.compile(r"""mcp\.With(?:String)\(\s*"(action|operation|method|op|command|mode)\"""")
GO_ENUM = re.compile(r"""mcp\.Enum\(([^)]*)\)""")
SYNC_TS = re.compile(r"""\b(execSync|spawnSync|execFileSync)\s*\(""")
SYNC_PY = re.compile(r"""\b(subprocess\.(?:run|check_output|check_call|call)|os\.system|time\.sleep)\s*\(""")
LONG_HINT = re.compile(
    r"""(--wait\b|rollout status|helm (?:install|upgrade)|docker build|build_image|render|bake|crawl|timeout\s*[:=]\s*\d{5,})""",
    re.I,
)
SANITIZE = re.compile(
    r"""\b(sanitiz\w*|escapeHtml|untrusted|prompt[_ ]?injection|strip(?:Hidden|Invisible)\w*|filterContent|content[_ ]?filter)\b""",
    re.I,
)
THROW_TS = re.compile(r"""\bthrow new (?:Mcp)?Error\(""")
IS_ERROR = re.compile(r"""\bisError\s*[:=]\s*true|isError=True|NewToolResultError""")
DESC = [
    re.compile(r"""\bdescription\s*[:=]\s*["'`]([^"'`\n]{0,400})["'`]"""),
    re.compile(r"""WithDescription\(\s*"([^"\n]{0,400})"\)"""),
]


def walk(root):
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".")]
        for f in files:
            if os.path.splitext(f)[1] in SRC_EXT and not re.search(r"(\.test\.|\.spec\.|_test\.go|test_)", f):
                yield os.path.join(d, f)


def main(corpus):
    report = {}
    for repo in sorted(os.listdir(corpus)):
        root = os.path.join(corpus, repo)
        r = defaultdict(list)
        for path in walk(root):
            rel = os.path.relpath(path, root)
            try:
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    lines = fh.read().splitlines()
            except OSError:
                continue
            for i, line in enumerate(lines, 1):
                loc = f"{rel}:{i}"
                for rx in TOOL_DEF:
                    m = rx.search(line)
                    if m:
                        r["tool_defs"].append([loc, m.group(1) or "?"])
                        break
                if DISPATCH_PARAM.search(line) or DISPATCH_PARAM_GO.search(line):
                    window = " ".join(lines[i - 1 : i + 6])
                    enum = GO_ENUM.search(window) or re.search(
                        r"""(?:enum\(\[|enum:\s*\[|Literal\[)([^\]]*)\]""", window
                    )
                    vals = re.findall(r"""["']([^"']+)["']""", enum.group(1)) if enum else []
                    r["dispatch_params"].append([loc, line.strip()[:160], vals])
                if SYNC_TS.search(line) or SYNC_PY.search(line):
                    r["sync_calls"].append([loc, line.strip()[:160]])
                if LONG_HINT.search(line):
                    r["long_hints"].append([loc, line.strip()[:160]])
                if SANITIZE.search(line):
                    r["sanitize_mentions"].append([loc, line.strip()[:160]])
                if THROW_TS.search(line):
                    r["throws"].append(loc)
                if IS_ERROR.search(line):
                    r["is_error"].append(loc)
                for rx in DESC:
                    for m in rx.finditer(line):
                        r["descriptions"].append([loc, m.group(1)])
        report[repo] = r
    json.dump(report, sys.stdout, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
