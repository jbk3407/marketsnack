#!/usr/bin/env bash
# bash run.sh render   -> post.json 으로 out/01~04.png 렌더
# bash run.sh publish  -> posts/<슬롯>/ 로 복사·푸시 후 인스타 게시 (이미 게시된 슬롯이면 종료)
set -euo pipefail
cd "$(dirname "$0")"
D=$(date +%F)-$( [ "$(date +%H)" -lt 12 ] && echo am || echo pm )  # PC 시계 = KST
case "${1:-}" in
  render) node render.js ;;
  publish)
    if [ -f "posts/$D/published.json" ]; then echo "이미 게시됨: $D"; exit 0; fi
    mkdir -p "posts/$D"; cp out/0*.png out/caption.txt post.json "posts/$D/"
    git add "posts/$D" && git commit -qm "post: $D" && git push -q origin HEAD:main
    node publish.js "posts/$D"
    git add "posts/$D" && git commit -qm "published: $D" && git push -q origin HEAD:main
    ;;
  *) echo "사용법: bash run.sh render|publish"; exit 1 ;;
esac
