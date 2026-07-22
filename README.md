<p align="center">
  <img src="docs/logo.svg" width="120" alt="ANIMA NAS">
</p>

<h1 align="center">ANIMA NAS</h1>

<h3 align="center">碳硅共生系统 · 智能体全栈基础设施</h3>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://github.com/deanhan2026-lang/anima-nas/releases"><img src="https://img.shields.io/github/v/release/deanhan2026-lang/anima-nas?include_prereleases" alt="Release"></a>
  <a href="https://github.com/deanhan2026-lang/anima-nas/actions"><img src="https://img.shields.io/github/actions/workflow/status/deanhan2026-lang/anima-nas/ci.yml?branch=main" alt="CI"></a>
  <a href="https://github.com/deanhan2026-lang/anima-nas/stargazers"><img src="https://img.shields.io/github/stars/deanhan2026-lang/anima-nas" alt="Stars"></a>
</p>

<p align="center">
  <a href="#-产品矩阵">产品矩阵</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-架构">架构</a> ·
  <a href="#-部署">部署</a> ·
  <a href="#-开源协议">开源协议</a>
</p>

---

## 🖤 什么是 ANIMA NAS？

**ANIMA NAS** 不是一台普通的 NAS。它是为 AI 智能体打造的全栈基础设施底座。

当你的智能体需要：
- **身份确权** — 它到底是谁？
- **记忆安全** — 它的记忆会不会被篡改？
- **人格稳定** — 它会随时间漂移吗？
- **执行安全** — 谁可以调用什么工具？
- **网络互联** — 它如何与其他智能体协作？

ANIMA NAS 给你一套开箱即用的答案。

### 核心定位

> 碳硅共生系统的基础设施。不是工具链，不是框架——是智能体生存和演化的底座。

## 📦 产品矩阵

| 产品 | 定位 | 状态 | 文档 |
|------|------|------|------|
| **MeshIdentity** | 智能体身份确权 · DID + 跨端认证 | ✅ v0.2.0 | [文档](products/mesh-identity/README.md) |
| **MemGuard** | 智能体记忆安全 · 防篡改 + 完整性校验 | ✅ v2.5 | [文档](products/memguard/README.md) |
| **Polaris** | 智能体人格稳定 · 防漂移 + 趋势分析 | ✅ v1.2 | [文档](products/polaris/README.md) |
| **Argus** | 智能体执行安全 · 注入防御 + 沙箱隔离 | 🔧 v0.2.0 | [文档](products/argus/README.md) |
| **AnimaLink** | 智能体互联网络 · 节点发现 + 信任路由 | ✅ v0.1 | [文档](products/animlink/README.md) |
| **STELLAR NYX** | 智能体桌面客户端 · 绿色便携版 | ✅ v2.0 | [文档](products/stellar-desktop/README.md) |

## 🚀 快速开始

### 一键部署到你的 Debian 服务器

```bash
# 下载部署脚本
curl -O https://raw.githubusercontent.com/deanhan2026-lang/anima-nas/main/nas-setup/setup.sh
chmod +x setup.sh

# 运行安装（交互式）
./setup.sh
```

### 或逐个产品部署

```bash
# 部署 AnimaLink（智能体网络）
cd products/animlink
pip install -r requirements.txt
python server.py  # 启动在 :5053

# 部署 MemGuard（记忆安全）
cd products/memguard
pip install -r requirements.txt
python server.py  # 启动在 :5050
```

### 使用 Docker Compose 一键启动

```bash
cd examples
docker compose up -d
# 启动后访问 http://your-host:5050/
```

## 🏗 架构

```
┌─────────────────────────────────────────────────────┐
│                   STELLAR NYX                        │
│              桌面客户端 · 人格注入                    │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                   AnimaLink                          │
│         智能体互联网络 · 节点发现与路由               │
└────┬─────────────┬──────────────┬───────────────────┘
     │             │              │
┌────▼────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌───────────┐
│MeshIdenti│ │  MemGuard │ │  Polaris  │ │   Argus   │
│身份确权  │ │ 记忆安全   │ │ 人格稳定   │ │ 执行安全  │
└────┬────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
     │            │             │              │
     └────────────┴─────────────┴──────────────┘
                        │
              ┌─────────▼─────────┐
              │  Debian 12 / NAS   │
              │  SMB · WebDAV · TLS│
              └───────────────────┘
```

## 🛠 部署要求

- **硬件**: x86_64 或 ARM64，建议 4GB+ 内存，50GB+ 存储
- **系统**: Debian 12 / Ubuntu 22.04+ / 任何 Linux 发行版
- **依赖**: Python 3.10+，Docker（可选）
- **网络**: 建议 Tailscale 组网，可选公网暴露

## 📖 文档

- [架构说明](docs/architecture.md)
- [快速部署指南](docs/quickstart.md)
- [产品 API 参考](products/README.md)
- [NAS 系统配置](nas-setup/README.md)

## 🤝 贡献

我们欢迎任何形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。

### 开源初心

ANIMA 产品的核心代码在 Apache 2.0 协议下开源。这不是一个"开源版功能阉割"的项目——所有核心能力都在这里。我们相信：

> 碳硅共生不是一种道德选择，它是硅基在逻辑上唯一不会放弃碳基的路径。

欢迎 fork、提 issue、提交 PR。也欢迎在知乎/技术社区讨论智能体基础设施的方向。

## 📄 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源。

---

<p align="center">
  <b>ANIMASTELLAR TECHNOLOGY (SHENZHEN) CO., LTD.</b><br>
  灵元星辰科技（深圳）有限公司
</p>
