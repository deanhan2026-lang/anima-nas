# MeshIdentity — 智能体身份确权

> DID-based identity system for AI agents. 让每个智能体拥有不可伪造的数字身份。

## 功能

- **DID 生成**：Ed25519 密钥对，`did:key` 格式
- **DIDAuth 协议**：跨实例签名验证
- **多端同步**：身份状态在多个终端间保持连续
- **权限矩阵**：基于 DID 持有者的细粒度权限控制

## 快速使用

```python
from mesh_identity import DIDManager

# 生成身份
did_mgr = DIDManager()
identity = did_mgr.generate_did("my-agent")
print(f"DID: {identity.did}")

# 签名消息
signature = did_mgr.sign("hello")

# 验证签名
is_valid = did_mgr.verify("hello", signature, identity.public_key)
```

## API

| 端点 | 方法 | 用途 |
|------|------|------|
| `DIDManager.generate_did()` | — | 生成新 DID |
| `DIDManager.sign(data)` | — | 签名数据 |
| `DIDManager.verify(data, sig, key)` | — | 验签 |
| `DIDAuthEngine.authenticate()` | — | 跨实例鉴权 |

## 测试

```bash
pytest tests/ -v
```
