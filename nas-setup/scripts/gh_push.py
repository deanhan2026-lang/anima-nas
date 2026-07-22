# -*- coding: utf-8 -*-
"""Push anima-nas to GitHub via REST API."""
import json, base64, urllib.request, urllib.error, subprocess, time
from pathlib import Path

REPO = "deanhan2026-lang/anima-nas"
ROOT = Path(r"C:\Users\Administrator\.qclaw\workspace-agent-d9479bde\anima-nas")

def get_token():
    r = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
    return r.stdout.strip().rstrip("\r\n")

def api(method, path, data=None):
    token = get_token()
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
        body = e.read().decode()
        print(f"  HTTP {e.code}: {body[:150]}")
        return None

# Step 0: init repo with README
print("Initializing empty repo...")
content_b64 = base64.b64encode("# ANIMA NAS\n".encode()).decode()
r = api("PUT", "/contents/README.md", {
    "message": "chore: repo init — ANIMA NAS",
    "content": content_b64,
})
if not r:
    print("Failed to init!")
    exit(1)
print(f"  OK: {r['commit']['sha'][:8]}")
time.sleep(2)

# Step 1: create blobs
blobs = {}
skip = {".git", "__pycache__"}
for f in sorted(ROOT.rglob("*")):
    if not f.is_file(): continue
    if any(d in f.parts for d in skip): continue
    rel = str(f.relative_to(ROOT)).replace("\\", "/")
    b64 = base64.b64encode(f.read_bytes()).decode()
    r = api("POST", "/git/blobs", {"content": b64, "encoding": "base64"})
    if r:
        blobs[rel] = r["sha"]
        print(f"  blob {r['sha'][:8]} {rel} ({len(b64)}B)")
    else:
        print(f"  FAIL {rel}")

print(f"\n{len(blobs)} blobs, building tree...")

# Step 2: tree
tree_data = [{"path": p, "mode": "100644", "type": "blob", "sha": s} for p, s in blobs.items()]
r = api("POST", "/git/trees", {"tree": tree_data})
if not r:
    print("Tree failed!")
    exit(1)
tree_sha = r["sha"]
print(f"  tree {tree_sha[:10]}")

# Step 3: get parent
ref = api("GET", "/git/ref/heads/main")
parent_sha = ref["object"]["sha"] if ref else None
print(f"  parent {parent_sha[:10] if parent_sha else 'none'}")

# Step 4: commit
commit_data = {
    "message": "v1.0.0: ANIMA NAS — 灵元定制 Debian NAS 系统\n\n"
               "- setup.sh: 一键安装脚本 (8步: 镜像源修复→SSH→Samba→NFS→Docker→Tailscale→防火墙)\n"
               "- 镜像源自动测速: USTC/TUNA/Aliyun/163/HuaweiCloud → 选最快\n"
               "- SSH 安装+加固: PermitRootLogin prohibit-password\n"
               "- NAS 核心: Samba + NFS + Docker CE\n"
               "- 完整安装文档 + 故障排查指南\n"
               "- Docker Compose 模板 + Samba 配置模板",
    "tree": tree_sha,
}
if parent_sha:
    commit_data["parents"] = [parent_sha]

r = api("POST", "/git/commits", commit_data)
if not r:
    print("Commit failed!")
    exit(1)
commit_sha = r["sha"]
print(f"  commit {commit_sha[:10]}")

# Step 5: update ref
r = api("PATCH", "/git/refs/heads/main", {"sha": commit_sha, "force": True})
if r:
    print(f"\n✅ Pushed {len(blobs)} files to {REPO}")
    print(f"   https://github.com/{REPO}")
else:
    print("\n❌ Failed")
