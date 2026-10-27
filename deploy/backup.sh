#!/bin/sh
# Daily backup of the production config and data into a tar.gz.
# Installed on the server as /usr/local/bin/chrapa-poll-backup and run by root
# from /etc/cron.d/chrapa-poll-backup. Read-only towards the app: it only packs
# files, it never touches docker compose.
#
# Retention: every archive of the last KEEP_DAYS days (today included), plus
# the first archive of each month for the newest KEEP_MONTHS months.
#
# Usage: [BACKUP_OWNER=user] chrapa-poll-backup [APP_DIR] [DEST_DIR] [KEEP_DAYS] [KEEP_MONTHS]
# BACKUP_OWNER (default root) gets ownership of DEST_DIR and the archives.
set -eu

APP_DIR=${1:-/opt/chrapa-poll}
DEST_DIR=${2:-/var/backups/chrapa-poll}
KEEP_DAYS=${3:-30}
KEEP_MONTHS=${4:-120}
OWNER=${BACKUP_OWNER:-root}
PREFIX=chrapa-poll-backup-

mkdir -p "$DEST_DIR"
ts=$(date -u +%Y%m%d-%H%M%S)
f="$DEST_DIR/$PREFIX$ts.tar.gz"
tmp="$f.part"

tar czf "$tmp" -C "$APP_DIR" config data
tar tzf "$tmp" >/dev/null
mv "$tmp" "$f"
chown -R "$OWNER:" "$DEST_DIR"

# Names sort by time (UTC timestamp), so the oldest archive comes first.
cd "$DEST_DIR"
cutoff=$(date -u -d "$((KEEP_DAYS - 1)) days ago" +%Y%m%d)
start=$((${#PREFIX} + 1))
monthly=$(ls -1 "$PREFIX"*.tar.gz | sort \
	| awk -v s="$start" '{ m = substr($0, s, 6); if (m != last) { print; last = m } }' \
	| tail -n "$KEEP_MONTHS")

ls -1 "$PREFIX"*.tar.gz | while read -r old; do
	day=$(echo "$old" | cut -c"$start"-"$((start + 7))")
	[ "$day" -ge "$cutoff" ] && continue
	echo "$monthly" | grep -qxF "$old" && continue
	rm -f "$old"
done

echo "backup ok: $f ($(du -h "$f" | cut -f1))"
