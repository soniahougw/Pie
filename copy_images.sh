#!/usr/bin/env bash
set -euo pipefail

SRC="$1"
DEST="assets/images/a-is-for-apple-pie"

if [ -z "$SRC" ]; then
  echo "Usage: $0 /path/to/source/images"
  exit 1
fi

mkdir -p "$DEST"

echo "Copying images from $SRC -> $DEST ..."
rsync -av --exclude='.*' "$SRC"/ "$DEST"/

echo "Building manifest.json ..."
shopt -s nullglob
arr=()
for f in "$DEST"/*.{jpg,jpeg,png,gif,webp}; do
  [ -f "$f" ] || continue
  arr+=("$(basename "$f")")
done

# write simple JSON array (use python3 to ensure proper escaping)
printf '[]' > "$DEST/manifest.json"
if [ ${#arr[@]} -gt 0 ]; then
  printf '[' > "$DEST/manifest.json"
  first=true
  for name in "${arr[@]}"; do
    if [ "$first" = true ]; then first=false; else printf ',' >> "$DEST/manifest.json"; fi
    printf '%s' "$(printf '%s' "$name" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().strip()))')" >> "$DEST/manifest.json"
  done
  printf ']' >> "$DEST/manifest.json"
fi

echo "Done. ${#arr[@]} images copied and manifest.json created at $DEST/manifest.json"
