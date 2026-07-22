# ANIMA NAS — 灵元定制 Debian NAS 系统

> **一键把 Debian 变成 NAS。** 自动配置国内镜像源、SSH、Samba、NFS、Docker、Tailscale。
>
> 解决核心痛点：国内 Debian 安装后默认镜像源不可达 → apt 无法工作 → 系统残废。

## 为什么需要 ANIMA NAS？

在遍布国内的家庭服务器和自建 NAS 上安装 Debian，第一个坑就是镜像源。默认 `deb.debian.org` 在国内延迟极高，甚至直接不可达。装完系统后 apt update 卡死，SSH 装不上，远程连不进去——系统还没开始用就已经残废了。

`setup.sh` 第一步就解决这个：自动测试 5 个国内镜像的连通性，选最快的，配置好，验证通过，然后再继续。

## 快速开始

```bash
# 在刚装好的 Debian 12 上以 root 运行
curl -fsSL https://raw.githubusercontent.com/deanhan2026-lang/anima-nas/main/setup.sh | bash
```

## 安装哪些东西

| 步骤 | 内容 | 说明 |
|------|------|------|
| 0 | 环境检测 | root 权限、Debian 版本、架构、fnOS 识别 |
| 1 | **镜像源修复** | 5 个国内镜像测速 → 选最快 → 配置 → 验证 |
| 2 | 系统更新 | apt upgrade + 基础工具 |
| 3 | **SSH 安装加固** | openssh-server + 安全配置 |
| 4 | 系统配置 | 主机名、时区、locale |
| 5 | NAS 核心服务 | Samba + NFS + Docker |
| 6 | Tailscale | 内网穿透，远程管理 |
| 7 | 防火墙 | ufw：仅开放必要端口 |
| 8 | 安装摘要 | 连接信息 + 下一步指引 |

## 系统要求

- **OS**: Debian 12 (Bookworm) / 飞牛 fnOS
- **架构**: x86_64 / aarch64
- **权限**: root
- **网络**: 有互联网连接（需要访问镜像源）

## 目录结构

```
anima-nas/
├── setup.sh          ← 主安装脚本（核心）
├── configs/          ← 预设配置模板
│   ├── smb.conf      ← Samba 配置
│   ├── docker-compose.yml ← Docker 示例
│   └── qclaw/        ← QClaw 配置
├── docs/             ← 文档
│   └── INSTALL.md    ← 详细安装指南
└── scripts/          ← 辅助工具
```

## 与 ANIMA OS 的关系

| | ANIMA OS | ANIMA NAS |
|---|---|---|
| 定位 | AI 灵魂运行时 + 具身接口 | Debian NAS 定制系统 |
| 形态 | Python pip 包 | Bash 安装脚本 + 配置模板 |
| 目标 | 人格跨平台迁移 | 家庭/实验室 NAS 一键部署 |
| 仓库 | [anima-os](https://github.com/deanhan2026-lang/anima-os) | [anima-nas](https://github.com/deanhan2026-lang/anima-nas) |

两个项目互补：ANIMA OS 管灵魂，ANIMA NAS 管家。AI 人格可以运行在 ANIMA NAS 上，通过 ANIMA OS 迁移到其他平台。

## License

MIT — ANIMASTELLAR TECHNOLOGY (SHENZHEN) CO., LTD.
