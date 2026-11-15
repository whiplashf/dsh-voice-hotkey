#!/usr/bin/env bash
# 发版一条命令：./scripts/release.sh [patch|minor|major]
#
# 只改文档就**不要发版**——GitHub 上的 README 已经是新的，npm 页面等下次真改动一起同步。
# 这个脚本会替你检查：上一次 tag 到现在，除了文档之外有没有真改动。
set -euo pipefail
cd "$(dirname "$0")/.."

bump="${1:-patch}"
prev="$(git describe --tags --abbrev=0 2>/dev/null || true)"

if [ -n "$prev" ]; then
  code_changed=false
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      *.md | docs/* | assets/* | LICENSE | .github/*) ;;
      *) code_changed=true ;;
    esac
  done <<< "$(git diff --name-only "$prev"..HEAD)"
  if [ "$code_changed" = false ]; then
    echo "自 $prev 以来只有文档改动 —— 不用发版。" >&2
    echo "GitHub 上的文档已经是新的；npm 页面会在下一次真正发版时一起更新。" >&2
    exit 1
  fi
fi

info="$(node -p "require('./package.json').name + ' ' + require('./package.json').version")"
next="$(node -p "const v=require('./package.json').version.split('.').map(Number); v[2]+=1; v.join('.')")"
if [ "${1:-}" != "--yes" ] && [ "${2:-}" != "--yes" ] && [ "${RELEASE_YES:-}" != "1" ]; then
  printf '%s\n' "准备发版：$info → $next（$bump）" >&2
  printf '确认发？(y/N) ' >&2
  read -r answer
  case "$answer" in y | Y | yes | YES) ;; *) echo "已取消。" >&2; exit 1 ;; esac
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "工作区还有未提交的改动，先提交再来。" >&2
  exit 1
fi

# HTTP/1.1：这条线路对 HTTP/2 多路复用不稳，默认协议会时不时报
# "Error in the HTTP2 framing layer" / TLS 半途断开，退回 1.1 才推得上去。
npm version "$bump" -m "release: %s"
git -c http.version=HTTP/1.1 push origin HEAD --follow-tags
echo
echo "已推 tag $(git describe --tags --abbrev=0)。GitHub Actions 约 20 秒发布完，"
echo "之后 npm 上再等几分钟可见（发布队列 + Cloudflare 缓存，各约 5 分钟）。"
