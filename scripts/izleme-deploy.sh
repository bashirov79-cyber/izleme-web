#!/bin/bash
# MEDİGROUP izleme.medigroup.az — GitHub-dan avtomatik yeniləmə (cron hər 5 dəqiqədən bir)
# Yalnız manifest.txt-də adı və SHA-256 yoxlama cəmi olan fayllar yazılır; hər yeniləmədən əvvəl köhnə nüsxə saxlanılır.
set -u
REPO="https://raw.githubusercontent.com/bashirov79-cyber/izleme-web/main"
DIR="/home/medigroupaz/izleme.medigroup.az"
STATE="/home/medigroupaz/.izleme-deploy"
mkdir -p "$STATE/backup"
TMP=$(mktemp -d) || exit 1
trap 'rm -rf "$TMP"' EXIT
curl -fsS --max-time 30 "$REPO/manifest.txt?t=$(date +%s)" -o "$TMP/manifest.txt" 2>>"$STATE/err" || exit 0
[ -s "$TMP/manifest.txt" ] || exit 0
cmp -s "$TMP/manifest.txt" "$STATE/manifest.txt" && exit 0
while read -r SUM FILE; do
  [ -z "${FILE:-}" ] && continue
  case "$FILE" in *[!A-Za-z0-9._-]*|.*) echo "$(date '+%F %T') icazəsiz fayl adı: $FILE" >> "$STATE/log"; exit 1;; esac
  curl -fsS --max-time 60 "$REPO/web/$FILE?t=$(date +%s)" -o "$TMP/$FILE" 2>>"$STATE/err" || exit 0
  echo "$SUM  $TMP/$FILE" | sha256sum -c --status || exit 0
done < "$TMP/manifest.txt"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$STATE/backup/$STAMP"
while read -r SUM FILE; do
  [ -z "${FILE:-}" ] && continue
  [ -f "$DIR/$FILE" ] && cp -p "$DIR/$FILE" "$STATE/backup/$STAMP/"
  cp "$TMP/$FILE" "$DIR/$FILE.new" && mv -f "$DIR/$FILE.new" "$DIR/$FILE"
done < "$TMP/manifest.txt"
cp "$TMP/manifest.txt" "$STATE/manifest.txt"
echo "$(date '+%F %T') yeniləndi ($STAMP): $(awk '{print $2}' "$TMP/manifest.txt" | tr '\n' ' ')" >> "$STATE/log"
ls -1dt "$STATE/backup"/*/ 2>/dev/null | tail -n +31 | xargs -r rm -rf
