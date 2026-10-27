#!/bin/sh
# Daily backup of the production config and data into a tar.gz.
# Installed on the server as /usr/local/bin/chrapa-poll-backup and run by root
# from /etc/cron.d/chrapa-poll-backup. Read-only towards the app: it only packs
# files, it never touches docker compose.
#
# Usage: chrapa-poll-backup [APP_DIR] [DEST_DIR] [KEEP]
set -eu

APP_DIR=${1:-/opt/chrapa-poll}
DEST_DIR=${2:-/home/lukasvotypka/backups/chrapa-poll}
KEEP=${3:-30}
OWNER=lukasvotypka

mkdir -p "$DEST_DIR"
ts=$(date -u +%Y%m%d-%H%M%S)
f="$DEST_DIR/chrapa-poll-backup-$ts.tar.gz"
tmp="$f.part"

tar czf "$tmp" -C "$APP_DIR" config data
tar tzf "$tmp" >/dev/null
mv "$tmp" "$f"
chown -R "$OWNER:" "$DEST_DIR"

# Keep only the newest $KEEP archives.
ls -1t "$DEST_DIR"/chrapa-poll-backup-*.tar.gz | tail -n +"$((KEEP + 1))" | while read -r old; do
	rm -f "$old"
done

echo "backup ok: $f ($(du -h "$f" | cut -f1))"
