# AnimaLink — 智能体互联网络

> Agent mesh network. 节点发现 + 信任路由 + 令牌系统。

## 功能

- **节点发现**：自动注册和心跳保活
- **信任路由**：信任分机制，增量更新
- **令牌系统**：任务委派、信任握手、心跳三种令牌
- **网络可视化**：3 页面 Web UI（拓扑 / 节点 / 令牌）
- **品牌站集成**：ANIMASTELLAR 技术博客和产品展示

## 快速启动

```bash
pip install -r requirements.txt
python server.py
# 访问 http://localhost:5053/animlink/
```

## API

| 端点 | 方法 | 用途 |
|------|------|------|
| `/animlink/api/network` | GET | 网络快照 |
| `/animlink/api/nodes` | GET | 节点列表 |
| `/animlink/api/nodes/register` | POST | 注册节点 |
| `/animlink/api/trust` | GET | 信任分表 |
| `/animlink/api/trust/send` | POST | 信任握手 |
| `/animlink/api/tokens` | GET | 令牌历史 |
| `/animlink/api/tokens/send` | POST | 发令牌 |

## 可视化页面

| 页面 | 路径 |
|------|------|
| 网络拓扑 | `/animlink/` |
| 节点状态 | `/animlink/nodes` |
| 令牌中心 | `/animlink/tokens` |
