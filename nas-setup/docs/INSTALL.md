# ANIMA NAS 详细安装指南

## 适用场景

- 自建 NAS 服务器（从空硬盘到可用 NAS）
- 飞牛 fnOS 系统重装
- 旧电脑/树莓派改造成 NAS
- 实验室 AI 训练节点基础环境

## 前置条件

### 1. 制作 Debian 安装 U 盘

```bash
# 在 Windows 上: 用 Rufus 或 balenaEtcher
# 在 macOS 上:
sudo dd if=debian-12-bookworm-amd64-netinst.iso of=/dev/sdX bs=4M status=progress

# ISO 下载: https://mirrors.ustc.edu.cn/debian-cd/current/amd64/iso-cd/
# 推荐用 netinst（网络安装版，~600MB）
```

### 2. 最小化安装

Debian 安装过程中：
- **语言**: English（避免 tty 中文乱码）
- **软件选择**: 只选 "SSH server" 和 "standard system utilities"
- **桌面环境**: **不选**（NAS 不需要 GUI）
- **镜像源**: 随便选，setup.sh 会覆盖

> ⚠️ **昨天的教训**：如果在安装过程中选了桌面环境或大量软件包，在镜像源不通的情况下会卡死。最小化安装，剩下的交给 setup.sh。

### 3. 确认网络连接

```bash
# 安装完成后，登录 root，确认有 IP
ip addr show

# 确认能 ping 通外网（不通就先解决网络问题）
ping -c 3 223.5.5.5
```

---

## 安装步骤

### 一键安装（推荐）

```bash
# 1. 以 root 登录 Debian
# 2. 下载安装脚本
curl -O https://raw.githubusercontent.com/deanhan2026-lang/anima-nas/main/setup.sh

# 3. 执行
chmod +x setup.sh
bash setup.sh
```

脚本会自动：
1. 测试 5 个国内镜像速度，选最快的
2. 配置 apt 源
3. 安装 SSH + Samba + NFS + Docker + Tailscale
4. 输出连接信息

全程约 5-10 分钟（取决于网速和硬件）。

### 手动安装（如果网络太差）

```bash
# 1. 先手动换源（临时方案）
cat > /etc/apt/sources.list << 'EOF'
deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware
deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware
EOF

# 2. 更新
apt-get update

# 3. 安装 SSH（至少先把远程管理打通）
apt-get install -y openssh-server

# 4. 从远程 SSH 进来后，再运行 setup.sh
```

---

## 安装后操作

### 1. 修改密码

```bash
passwd root
```

### 2. 创建普通用户

```bash
adduser weihan
usermod -aG sudo,docker weihan
```

### 3. 配置 Tailscale

```bash
tailscale up
# 打开输出的 URL，用 Google/Microsoft/GitHub 账号登录
# 之后所有加入同一 Tailscale 网络的设备可以互相访问
```

### 4. 从 Windows/Mac 访问 NAS

```
# Windows 文件浏览器
\\100.65.105.57\shared

# macOS Finder
smb://100.65.105.57/shared

# Linux NFS
mount -t nfs 100.65.105.57:/srv/anima-nas/shared /mnt/nas
```

### 5. 部署 QClaw（Docker）

```bash
mkdir -p /srv/anima-nas/qclaw
cd /srv/anima-nas/qclaw

# 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  qclaw:
    image: openclaw/openclaw:latest
    container_name: qclaw
    restart: unless-stopped
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    ports:
      - "5050:5050"
    environment:
      - TZ=Asia/Shanghai
EOF

docker compose up -d
```

---

## 故障排查

### apt update 卡住 / 超时

```bash
# 手动测试镜像
curl -v https://mirrors.ustc.edu.cn/

# DNS 问题
echo 'nameserver 223.5.5.5' > /etc/resolv.conf

# 换阿里云（最稳备选）
sed -i 's|deb https://[^/]*/|deb https://mirrors.aliyun.com/|g' /etc/apt/sources.list
apt-get update
```

### SSH 连不上

```bash
# 检查 SSH 状态
systemctl status sshd

# 检查端口
ss -tlnp | grep 22

# 检查防火墙
ufw status

# 如果 ufw 挡了 SSH
ufw allow 22/tcp
```

### Docker 安装失败

```bash
# 手动安装（阿里云镜像）
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 飞牛 fnOS 特殊处理

fnOS 基于 Debian，但有自己的包管理。安装时注意：

```bash
# 先确认是 Debian 几
cat /etc/os-release

# 如果是 Debian 11 (Bullseye)，脚本会自动适配
# 如果 fnOS 锁了 sources.list，先解锁
chattr -i /etc/apt/sources.list  # 如果有不可变属性
```

---

## 版本更新

```bash
# 重新运行安装脚本（idempotent，可安全重复执行）
bash setup.sh

# 或只更新特定组件
apt-get update && apt-get upgrade
docker compose pull  # 更新 Docker 镜像
```

---

## 安全建议

- [ ] 修改默认 SSH 端口（`/etc/ssh/sshd_config` 中改 `Port 2222`）
- [ ] 配置 SSH Key 登录，禁用密码登录
- [ ] 启用 fail2ban：`apt-get install fail2ban`
- [ ] 定期 `apt-get update && apt-get upgrade`
- [ ] Samba 不要暴露到公网

---

ANIMA NAS v1.0 — ANIMASTELLAR TECHNOLOGY
