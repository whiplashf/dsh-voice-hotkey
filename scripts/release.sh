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

if [ -n "$(git status --porcelain)" ]; then
  echo "工作区还有未提交的改动，先提交再来。" >&2
  exit 1
fi

npm version "$bump" -m "release: %s"
git push origin HEAD --follow-tags
echo
echo "已推 tag $(git describe --tags --abbrev=0)。发布不会自己发生："
echo "去 GitHub 的 Actions 里点一次批准，才会真正 npm publish。"
echo "批准后再等几分钟，npm 上才可见（发布队列 + CDN 缓存，各约 5 分钟）。"
