#!/bin/bash
# scripts/dev-lan.sh
# 探测 Mac 当前 LAN IP,写进 .env 文件,方便手机/平板访问 dev server
# **不改 Mac 系统网络配置**,Mac 保持 DHCP,日常使用不受影响

set -e

# 切到项目根
cd "$(dirname "$0")/.."

# 探测当前 Mac 的 LAN IP(WiFi / Ethernet 第一个非 127.0.0.1 的)
IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{print $2}')

if [ -z "$IP" ]; then
  echo "❌ 找不到 LAN IP(可能没连 WiFi / Ethernet)"
  exit 1
fi

# 简单 sanity check:不是公网 IP 才更新
case "$IP" in
  10.*|172.16.*|172.17.*|172.18.*|172.19.*|172.20.*|172.21.*|172.22.*|172.23.*|172.24.*|172.25.*|172.26.*|172.27.*|172.28.*|172.29.*|172.30.*|172.31.*|192.168.*)
    : # private IP,ok
    ;;
  *)
    echo "⚠️  $IP 看起来像公网 IP,不写入 .env(避免暴露)"
    exit 1
    ;;
esac

echo "📡 当前 Mac LAN IP: $IP"
echo ""

# 1. 更新 frontend/.env.local
mkdir -p frontend
cat > frontend/.env.local <<EOF
# 自动生成 — 探测到 Mac 当前 LAN IP
# 跑 scripts/dev-lan.sh 重新生成;Mac 保持 DHCP,换 WiFi 没事
VITE_API_BASE=http://$IP:3000/api
EOF
echo "✅ frontend/.env.local: VITE_API_BASE=http://$IP:3000/api"

# 2. 更新 backend/.env ALLOWED_ORIGINS(只追加,不去旧 IP)
ORIGIN="http://$IP:5173"
if [ -f backend/.env ]; then
  if grep -q "^ALLOWED_ORIGINS=" backend/.env; then
    if grep -q "$ORIGIN" backend/.env; then
      echo "✅ backend/.env: ALLOWED_ORIGINS 已含 $ORIGIN(无需改)"
    else
      # 追加到行尾
      sed -i '' "s|^ALLOWED_ORIGINS=.*|&,$ORIGIN|" backend/.env
      echo "✅ backend/.env: ALLOWED_ORIGINS 追加 $ORIGIN"
    fi
  else
    echo "" >> backend/.env
    echo "# 自动追加 — 当前 LAN IP" >> backend/.env
    echo "ALLOWED_ORIGINS=$ORIGIN" >> backend/.env
    echo "✅ backend/.env: 新增 ALLOWED_ORIGINS=$ORIGIN"
  fi
fi

echo ""
echo "🚀 现在手机可以访问: http://$IP:5173/"
echo ""
echo "下一步:在两个终端跑 npm run dev(或新加的 npm run dev:lan 自动跑这个脚本)"
