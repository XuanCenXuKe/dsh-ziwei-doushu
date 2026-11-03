#!/usr/bin/env bash
# =====================================================================
# 一键部署「紫微斗数 AI 插件」依赖的本地应用（ziwei-doushu）
# 支持 macOS / Linux；Windows 请用 WSL 或手动执行等价命令
#
# 用法：
#   bash install-ziwei.sh              # 安装到 ~/ziwei-doushu 并构建
#   bash install-ziwei.sh --dry-run    # 只打印步骤，不执行
#   ZIWEI_DIR=/some/path bash install-ziwei.sh
#   bash install-ziwei.sh --no-build   # 只下载 + 装依赖，不构建
# =====================================================================
set -euo pipefail

ZIWEI_DIR="${ZIWEI_DIR:-$HOME/ziwei-doushu}"
DRY_RUN=0
NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-build) NO_BUILD=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

run() {
  if [ "$DRY_RUN" = "1" ]; then echo "  [dry-run] $*"; else eval "$@"; fi
}

echo "══════════════════════════════════════════"
echo " 紫微斗数 AI 插件 · 本地应用一键部署"
echo " 目标目录: $ZIWEI_DIR"
echo "══════════════════════════════════════════"

# ── 1. 检查 Node.js ─────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "✗ 没找到 Node.js。请先安装 Node.js ≥ 20.9："
  echo "  官网：https://nodejs.org/zh-cn/download"
  echo "  装完重新运行本脚本。"
  exit 1
fi
NODE_VER="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VER%%.*}"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node.js 版本过低（当前 $NODE_VER），需要 ≥ 20.9。请升级后重试。"
  exit 1
fi
echo "✓ Node.js $NODE_VER"

# ── 2. 下载应用（GitHub 官方归档，失败自动走镜像）────────
TARBALL="$ZIWEI_DIR.tar.gz"
URLS="
https://codeload.github.com/Renhuai123/ziwei-doushu/tar.gz/refs/heads/main
https://ghproxy.net/https://github.com/Renhuai123/ziwei-doushu/archive/refs/heads/main.tar.gz
https://gh-proxy.com/https://github.com/Renhuai123/ziwei-doushu/archive/refs/heads/main.tar.gz
"
mkdir -p "$(dirname "$ZIWEI_DIR")"
if [ ! -d "$ZIWEI_DIR" ]; then
  ok=0
  for u in $URLS; do
    echo "→ 下载: $u"
    if run "curl -fL --max-time 300 '$u' -o '$TARBALL'"; then ok=1; break; fi
    echo "  （该地址失败，换镜像重试）"
  done
  [ "$ok" = "1" ] || { echo "✗ 下载失败，请检查网络后重试"; exit 1; }
  run "mkdir -p '$ZIWEI_DIR' && tar -xzf '$TARBALL' -C '$ZIWEI_DIR' --strip-components=1"
  run "rm -f '$TARBALL'"
  echo "✓ 已下载到 $ZIWEI_DIR"
else
  echo "✓ 目录已存在，跳过下载: $ZIWEI_DIR"
fi

# ── 3. 安装依赖 ────────────────────────────────────────
echo "→ 安装依赖（npm ci）…"
run "cd '$ZIWEI_DIR' && npm ci --no-audit --no-fund"
echo "✓ 依赖安装完成"

# ── 4. 环境变量 ────────────────────────────────────────
if [ ! -f "$ZIWEI_DIR/.env.local" ]; then
  run "cd '$ZIWEI_DIR' && cp .env.example .env.local"
  echo "✓ 已生成 .env.local（AI 解读可在此填自己的模型 Key，可选）"
fi

# ── 5. 构建 ────────────────────────────────────────────
if [ "$NO_BUILD" = "1" ]; then
  echo "（按 --no-build 跳过构建）"
else
  echo "→ 构建生产版本（约 10-30 秒）…"
  run "cd '$ZIWEI_DIR' && npm run build"
  echo "✓ 构建完成"
fi

# ── 6. 收尾提示 ────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "✓ 应用部署完成！"
echo ""
echo "最后一步：安装 DSH 插件"
echo "  1) 打开 DeepSeek Harness → Discover 搜索「紫微斗数」安装"
echo "  2) 或让 Agent 执行："
echo "     plugin_manager install_bundle(target='github:XuanCenXuKe/dsh-ziwei-doushu#875eebb')"
echo ""
echo "装好后左侧栏会出现「紫微斗数」图标，点击即可使用。"
echo "如需让插件自动找到应用，保持目录在 ~/ziwei-doushu 即可（或设置 ZIWEI_APP_DIR）。"
echo "══════════════════════════════════════════"
