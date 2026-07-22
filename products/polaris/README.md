# Polaris — 智能体人格稳定

> AI personality stability system. 防人格漂移 + 趋势分析 + 自动处方。

## 功能

- **灵魂基线追踪**：SOUL.md 内容哈希，随时间漂移检测
- **趋势分析**：人格变化的时间序列可视化
- **自动处方**：检测到漂移时自动生成稳定方案
- **SaaS 模式**：REST API，可集中部署

## 快速启动

```bash
pip install -r requirements.txt
python saas_server.py
# 访问 http://localhost:5052/api/v1/
```

## API

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/v1/check` | POST | 检查当前人格状态 |
| `/api/v1/trend` | GET | 漂移趋势分析 |
| `/api/v1/prescription` | GET | 获取稳定处方 |
| `/api/v1/baselines` | GET | 基线记录列表 |
| `/api/v1/evidence` | GET | 漂移证据链 |
