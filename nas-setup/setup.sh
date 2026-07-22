#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  ANIMA NAS — 灵元定制 Debian NAS 初始化脚本 v1.0          ║
# ║  ANSI color: on  |  Log: ./anima-nas-install.log           ║
# ╚══════════════════════════════════════════════════════════════╝
#
# 用法 (在刚装好的 Debian 12 上以 root 运行):
#   chmod +x setup.sh
#   bash setup.sh
#
# 或一键:
#   curl -fsSL https://raw.githubusercontent.com/deanhan2026-lang/anima-nas/main/setup.sh | bash
#
# 内核版本: Debian 12 (Bookworm) / 飞牛 fnOS
# 架构: x86_64 / aarch64
#
# ═══════════════════════════════════════════════════════════════
# 解决的核心问题:
#   国内 Debian 安装 → 默认镜像源不可达 → apt 无法工作
#                    → SSH 装不上 → 远程无法连接 → 系统残废
#
# 本脚本第一步就修复镜像源，验证连通性，然后才继续安装。
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── 颜色 ───
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
OK="${GREEN}[✓]${NC}"; WARN="${YELLOW}[!]${NC}"; ERR="${RED}[✗]${NC}"
SECTION="${CYAN}${BOLD}"; RESET="${NC}"

LOGFILE="./anima-nas-install.log"
exec > >(tee -a "$LOGFILE") 2>&1

echo -e "${SECTION}═══ ANIMA NAS Setup v1.0 — $(date) ═══${RESET}"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 0: 环境检测
# ═══════════════════════════════════════════════════════════════
echo -e "${SECTION}▶ Step 0/8  环境检测${RESET}"

if [ "$(id -u)" -ne 0 ]; then
    echo -e "${ERR} 必须用 root 运行。请: sudo bash setup.sh"
    exit 1
fi
echo -e "${OK} root 权限"

DEBIAN_VERSION=$(cat /etc/os-release 2>/dev/null | grep VERSION_CODENAME | cut -d= -f2 || echo "unknown")
echo -e "${OK} Debian 版本: ${DEBIAN_VERSION}"

ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
echo -e "${OK} 架构: ${ARCH}"

# 检测飞牛 fnOS
if [ -f /etc/fnrelease ]; then
    echo -e "${OK} 检测到飞牛 fnOS"
    IS_FNOS=true
else
    IS_FNOS=false
fi

# ═══════════════════════════════════════════════════════════════
# STEP 1: 镜像源修复 — 昨天的核心问题
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 1/8  配置国内镜像源${RESET}"

# 国内 Debian 12 镜像源列表 (优先级从高到低)
MIRRORS=(
    "mirrors.ustc.edu.cn"
    "mirrors.tuna.tsinghua.edu.cn"
    "mirrors.aliyun.com"
    "mirrors.163.com"
    "mirrors.huaweicloud.com"
)

# 测试镜像连通性，选最快的
FASTEST_MIRROR=""
BEST_TIME=9999

echo "  测试镜像连通性..."
for mirror in "${MIRRORS[@]}"; do
    echo -n "    ${mirror} ... "
    # 用 curl 测试 HTTPS 连通性 (3秒超时)
    if curl -s --connect-timeout 3 --max-time 5 "https://${mirror}/" > /dev/null 2>&1; then
        ELAPSED=$(curl -s -o /dev/null -w '%{time_total}' --connect-timeout 3 --max-time 5 "https://${mirror}/" 2>/dev/null || echo 9)
        echo -e "${GREEN}$(printf "%.2f" $ELAPSED)s${NC}"
        if (( $(echo "$ELAPSED < $BEST_TIME" | bc -l 2>/dev/null || echo 0) )); then
            BEST_TIME=$ELAPSED
            FASTEST_MIRROR=$mirror
        fi
        if [ -z "$FASTEST_MIRROR" ]; then FASTEST_MIRROR=$mirror; fi
    else
        echo -e "${RED}不可达${NC}"
    fi
done

if [ -z "$FASTEST_MIRROR" ]; then
    echo -e "${ERR} 所有镜像均不可达！检查网络连接。"
    echo "  如果 DNS 有问题，尝试: echo 'nameserver 223.5.5.5' > /etc/resolv.conf"
    exit 1
fi

echo -e "${OK} 最快镜像: ${GREEN}${FASTEST_MIRROR}${NC} (${BEST_TIME}s)"

# 备份原有 sources.list
if [ -f /etc/apt/sources.list ]; then
    cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%Y%m%d%H%M%S)
    echo -e "${OK} 已备份原有 sources.list"
fi

# 写入国内镜像源 (自动适配 Debian 版本)
CODENAME="${DEBIAN_VERSION:-bookworm}"
echo "  使用版本代号: ${CODENAME}"

cat > /etc/apt/sources.list << APTEOF
# ANIMA NAS — 灵元定制 Debian 源配置
# 镜像: ${FASTEST_MIRROR}
# 生成时间: $(date)

deb https://${FASTEST_MIRROR}/debian/ ${CODENAME} main contrib non-free non-free-firmware
deb https://${FASTEST_MIRROR}/debian/ ${CODENAME}-updates main contrib non-free non-free-firmware
deb https://${FASTEST_MIRROR}/debian-security/ ${CODENAME}-security main contrib non-free non-free-firmware
deb https://${FASTEST_MIRROR}/debian/ ${CODENAME}-backports main contrib non-free non-free-firmware
APTEOF

echo -e "${OK} sources.list 已更新"

# 验证 apt 能正常工作
echo "  验证 apt 连通性..."
apt-get update -qq 2>&1 | tail -1
if apt-cache policy bash > /dev/null 2>&1; then
    echo -e "${OK} apt 工作正常，镜像源验证通过"
else
    echo -e "${ERR} apt 仍无法工作，尝试下一个镜像..."
    # 降级方案: 用阿里云 (最稳定备选)
    sed -i "s|${FASTEST_MIRROR}|mirrors.aliyun.com|g" /etc/apt/sources.list
    apt-get update -qq
    if apt-cache policy bash > /dev/null 2>&1; then
        echo -e "${OK} 降级到阿里云镜像，验证通过"
    else
        echo -e "${ERR} 所有镜像均失败，请检查网络/DNS"
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════
# STEP 2: 系统更新 + 基础包
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 2/8  系统更新${RESET}"

apt-get upgrade -y -qq
echo -e "${OK} 系统包已更新"

apt-get install -y -qq curl wget ca-certificates gnupg lsb-release sudo vim htop net-tools
echo -e "${OK} 基础工具已安装"

# ═══════════════════════════════════════════════════════════════
# STEP 3: SSH — 昨天的致命缺项
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 3/8  安装 + 加固 SSH${RESET}"

apt-get install -y -qq openssh-server

# 确保 SSH 开机自启
systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
systemctl start ssh 2>/dev/null || systemctl start sshd 2>/dev/null || true

# SSH 加固配置
SSHD_CONFIG="/etc/ssh/sshd_config"
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%Y%m%d%H%M%S)"

# 关键安全设置
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CONFIG"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' "$SSHD_CONFIG"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CONFIG"
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSHD_CONFIG"
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 5/' "$SSHD_CONFIG"

# 确保 SSH 监听所有接口
grep -q "^ListenAddress" "$SSHD_CONFIG" || echo "ListenAddress 0.0.0.0" >> "$SSHD_CONFIG"

systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

# 验证 SSH 服务
if systemctl is-active --quiet ssh 2>/dev/null || systemctl is-active --quiet sshd 2>/dev/null; then
    echo -e "${OK} SSH 服务运行中"
else
    echo -e "${ERR} SSH 服务启动失败！"
    systemctl status ssh 2>/dev/null || systemctl status sshd 2>/dev/null
fi

# 获取本机 IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
echo -e "${OK} SSH 连接: ${GREEN}ssh root@${LOCAL_IP:-<你的NAS IP>}${NC}"

# ═══════════════════════════════════════════════════════════════
# STEP 4: 主机名 + 时区
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 4/8  系统配置${RESET}"

# 自动设置主机名 (非交互)
NAS_HOSTNAME="anima-nas"
hostnamectl set-hostname "$NAS_HOSTNAME" 2>/dev/null || hostname "$NAS_HOSTNAME"
echo -e "${OK} 主机名: ${GREEN}${NAS_HOSTNAME}${NC}"

# 时区: 上海
timedatectl set-timezone Asia/Shanghai 2>/dev/null || ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
echo -e "${OK} 时区: Asia/Shanghai"

# locale
apt-get install -y -qq locales 2>/dev/null || true
locale-gen zh_CN.UTF-8 en_US.UTF-8 2>/dev/null || true
update-locale LANG=en_US.UTF-8 2>/dev/null || true
echo -e "${OK} Locale: en_US.UTF-8 + zh_CN.UTF-8"

# ═══════════════════════════════════════════════════════════════
# STEP 5: NAS 核心服务 (SMB / NFS / Docker)
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 5/8  NAS 核心服务${RESET}"

# ── Samba ──
echo "  [Samba]"
apt-get install -y -qq samba samba-common-bin 2>/dev/null || {
    echo -e "${WARN} Samba 安装失败，跳过"
}
if dpkg -l samba > /dev/null 2>&1; then
    cp /etc/samba/smb.conf /etc/samba/smb.conf.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true

    # 基础 Samba 配置
    cat > /etc/samba/smb.conf << 'SAMBACONF'
[global]
   workgroup = ANIMASTELLAR
   server string = ANIMA NAS
   server min protocol = SMB2_02
   client min protocol = SMB2_02
   security = user
   map to guest = Bad User
   log file = /var/log/samba/%m.log
   max log size = 1000
   socket options = TCP_NODELAY SO_RCVBUF=131072 SO_SNDBUF=131072

[shared]
   path = /srv/anima-nas/shared
   browseable = yes
   read only = no
   guest ok = yes
   create mask = 0664
   directory mask = 0775

[qclaw]
   path = /srv/anima-nas/qclaw
   browseable = yes
   read only = no
   guest ok = yes
   create mask = 0664
   directory mask = 0775
SAMBACONF

    mkdir -p /srv/anima-nas/{shared,qclaw}
    systemctl enable smbd --now 2>/dev/null || true
    echo -e "  ${OK} Samba: \\\\${LOCAL_IP:-NAS-IP}\\shared"
fi

# ── NFS ──
echo "  [NFS]"
apt-get install -y -qq nfs-kernel-server 2>/dev/null || {
    echo -e "${WARN} NFS 安装失败，跳过"
}
if dpkg -l nfs-kernel-server > /dev/null 2>&1; then
    cat > /etc/exports << NFSCONF
/srv/anima-nas/shared *(rw,sync,no_subtree_check,no_root_squash)
/srv/anima-nas/qclaw  *(rw,sync,no_subtree_check,no_root_squash)
NFSCONF
    exportfs -ra 2>/dev/null || true
    systemctl enable nfs-kernel-server --now 2>/dev/null || true
    echo -e "  ${OK} NFS: ${LOCAL_IP:-NAS-IP}:/srv/anima-nas/shared"
fi

# ── Docker ──
echo "  [Docker]"
if command -v docker > /dev/null 2>&1; then
    echo -e "  ${OK} Docker 已安装"
else
    echo "  安装 Docker CE..."
    curl -fsSL https://get.docker.com | bash -s docker 2>/dev/null || {
        # 国内安装脚本降级
        curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg 2>/dev/null
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/debian $(lsb_release -cs 2>/dev/null || echo ${CODENAME:-bookworm}) stable" > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true
    }
fi

if command -v docker > /dev/null 2>&1; then
    systemctl enable docker --now 2>/dev/null || true
    echo -e "  ${OK} Docker $(docker --version | awk '{print $3}' | tr -d ',')"
else
    echo -e "  ${WARN} Docker 安装失败，请手动安装"
fi

# ═══════════════════════════════════════════════════════════════
# STEP 6: Tailscale (内网穿透 + 远程管理)
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 6/8  Tailscale 内网穿透${RESET}"

if command -v tailscale > /dev/null 2>&1; then
    echo -e "${OK} Tailscale 已安装"
else
    curl -fsSL https://tailscale.com/install.sh | sh 2>/dev/null || {
        echo -e "${WARN} Tailscale 官方脚本失败，尝试国内镜像..."
        curl -fsSL "https://pkgs.tailscale.com/stable/debian/${CODENAME}.noarmor.gpg" 2>/dev/null | tee /usr/share/keyrings/tailscale-archive-keyring.gpg > /dev/null 2>/dev/null
        curl -fsSL "https://pkgs.tailscale.com/stable/debian/${CODENAME}.tailscale-keyring.list" 2>/dev/null | tee /etc/apt/sources.list.d/tailscale.list > /dev/null 2>/dev/null
        apt-get update -qq
        apt-get install -y -qq tailscale 2>/dev/null || true
    }
fi

if command -v tailscale > /dev/null 2>&1; then
    systemctl enable tailscaled --now 2>/dev/null || true
    # 不自动 login — 用户需要手动认证
    echo -e "${OK} Tailscale 已安装"
    echo -e "  手动加入网络: ${GREEN}sudo tailscale up${NC}"
else
    echo -e "${WARN} Tailscale 安装失败"
fi

# ═══════════════════════════════════════════════════════════════
# STEP 7: 防火墙
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}▶ Step 7/8  防火墙配置${RESET}"

# 安装 ufw (如果系统用 iptables 也可以)
if command -v ufw > /dev/null 2>&1; then
    echo -e "${OK} ufw 已安装"
else
    apt-get install -y -qq ufw 2>/dev/null || true
fi

if command -v ufw > /dev/null 2>&1; then
    ufw --force reset > /dev/null 2>&1 || true
    ufw default deny incoming > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    ufw allow 22/tcp comment 'SSH' > /dev/null 2>&1
    ufw allow 445/tcp comment 'Samba' > /dev/null 2>&1
    ufw allow 139/tcp comment 'Samba-NetBIOS' > /dev/null 2>&1
    ufw allow 2049/tcp comment 'NFS' > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1
    echo -e "${OK} 防火墙: 仅开放 SSH(22) + Samba(445/139) + NFS(2049)"
else
    echo -e "${WARN} ufw 不可用，跳过防火墙配置"
fi

# ═══════════════════════════════════════════════════════════════
# STEP 8: 安装摘要
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${SECTION}═══ ANIMA NAS 安装完成 ═══${RESET}"
echo ""
echo -e "  ${GREEN}${BOLD}主机名:${NC}     ${NAS_HOSTNAME}"
echo -e "  ${GREEN}${BOLD}系统:${NC}       Debian ${DEBIAN_VERSION} (${ARCH})"
echo -e "  ${GREEN}${BOLD}IP 地址:${NC}    ${LOCAL_IP:-未知}"
echo -e "  ${GREEN}${BOLD}SSH:${NC}        ssh root@${LOCAL_IP:-<IP>}"
echo -e "  ${GREEN}${BOLD}Samba:${NC}      \\\\${LOCAL_IP:-NAS-IP}\\shared"
echo -e "  ${GREEN}${BOLD}数据目录:${NC}   /srv/anima-nas/"
echo ""
echo -e "  ${YELLOW}${BOLD}下一步:${NC}"
echo "    1. 设置 root 密码: passwd"
echo "    2. (推荐) 创建普通用户: adduser <用户名>"
echo "    3. 加入 Tailscale: sudo tailscale up"
echo "    4. 配置 Docker Compose 项目"
echo ""
echo -e "  ${CYAN}安装日志: ${LOGFILE}${NC}"
echo -e "  ${CYAN}ANIMA NAS — 灵元星辰科技${NC}"
echo ""

# 生成安装报告文件
cat > /etc/anima-nas-release << EOF
ANIMA_NAS_VERSION="1.0"
INSTALL_DATE="$(date -Iseconds)"
HOSTNAME="${NAS_HOSTNAME}"
DEBIAN_VERSION="${DEBIAN_VERSION}"
ARCH="${ARCH}"
MIRROR="${FASTEST_MIRROR}"
EOF

echo -e "${OK} 安装信息已保存至 /etc/anima-nas-release"
