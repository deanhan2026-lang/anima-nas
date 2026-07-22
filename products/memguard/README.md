# MemGuard — 智能体记忆安全

> Memory integrity protection for AI agents. 记忆防篡改 + 完整性校验 + 审计追踪。

## 功能

- **记忆完整性校验**：SHA-256 基线 + 实时检测篡改
- **签名管理**：Ed25519 签名，防抵赖
- **审计日志**：所有记忆操作可追溯
- **WEB 管理面板**：可视化完整性状态
- **核心文件保护**：SOUL.md / IDENTITY.md / MEMORY.md 等灵魂文件

## 快速启动

```bash
pip install -r requirements.txt
python server.py
# 访问 http://localhost:5050/
```

## API

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/v1/verify` | POST | 校验文件完整性 |
| `/api/v1/baseline` | GET | 查看基线状态 |
| `/api/v1/audit` | GET | 审计日志 |
| `/api/v1/freeze` | POST | 冻结/解冻节点 |

## 部署

```bash
# Docker
docker compose -f ../../examples/docker-compose.yml up memguard
```
