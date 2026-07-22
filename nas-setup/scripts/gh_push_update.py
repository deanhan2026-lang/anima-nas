# -*- coding: utf-8 -*-
import json, base64, urllib.request, urllib.error, subprocess
from pathlib import Path

REPO = "deanhan2026-lang/anima-nas"
ROOT = Path(r"C:\Users\Administrator\.qclaw\workspace-agent-d9479bde\anima-nas")

r = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
token = r.stdout.strip()

def api(method, path, data=None):
    url = f"https://api.github.com/repos/{REPO}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:150]}")
        return None

# Get parent
ref = api("GET", "/git/ref/heads/main")
if not ref or "object" not in ref:
    print("No ref found")
    exit(1)
parent_sha = ref["object"]["sha"]
print(f"Parent: {parent_sha[:10]}")

# Build blobs
blobs = {}
skip = {".git", "__pycache__"}
for f in sorted(ROOT.rglob("*")):
    if not f.is_file():
        continue
    if any(d in f.parts for d in skip):
        continue
    rel = str(f.relative_to(ROOT)).replace("\\", "/")
    b64 = base64.b64encode(f.read_bytes()).decode()
    result = api("POST", "/git/blobs", {"content": b64, "encoding": "base64"})
    if result and "sha" in result:
        blobs[rel] = result["sha"]
        print(f"  blob {result['sha'][:8]} {rel}")
    else:
        print(f"  FAIL {rel}")

print(f"\n{len(blobs)} blobs")

# Tree
tree_list = [{"path": p, "mode": "100644", "type": "blob", "sha": s} for p, s in blobs.items()]
result = api("POST", "/git/trees", {"tree": tree_list})
if not result:
    print("Tree failed")
    exit(1)
tree_sha = result["sha"]
print(f"tree {tree_sha[:10]}")

# Commit
result = api("POST", "/git/commits", {
    "message": "fix: auto-detect Debian version + non-interactive mode",
    "tree": tree_sha,
    "parents": [parent_sha],
})
if not result:
    print("Commit failed")
    exit(1)
commit_sha = result["sha"]
print(f"commit {commit_sha[:10]}")

# Update ref
result = api("PATCH", "/git/refs/heads/main", {"sha": commit_sha, "force": False})
print(f"pushed: {result is not None}")
