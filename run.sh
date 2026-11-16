#!/usr/bin/env bash
# bash run.sh render   -> post.json 으로 캐러셀 7장 + 릴스 mp4 렌더
# bash run.sh publish  -> posts/<슬롯>/ 로 복사·푸시 후 인스타 게시 (캐러셀+릴스 둘 다 끝난 슬롯이면 종료)
set -euo pipefail
cd "$(dirname "$0")"
D=$(date +%F)-$( [ "$(date +%H)" -lt 12 ] && echo am || echo pm )  # PC 시계 = KST
case "${1:-}" in
  render)
    [ -d node_modules ] || npm ci --silent
    node render.js && node reel.js ;;
  publish)
    if [ -f "posts/$D/published.json" ] && grep -q '"reel"' "posts/$D/published.json"; then echo "이미 게시됨: $D"; exit 0; fi
    mkdir -p "posts/$D"; cp out/0*.png out/reel.mp4 out/reel-cover.png out/caption.txt out/reel-caption.txt post.json "posts/$D/"
    git add "posts/$D" && git commit -qm "post: $D" && git push -q origin HEAD:main || true
    rc=0; node publish.js "posts/$D" || rc=$?
    git add "posts/$D" && git commit -qm "published: $D" && git push -q origin HEAD:main || true
    exit $rc ;;
  *) echo "사용법: bash run.sh render|publish"; exit 1 ;;
esac
