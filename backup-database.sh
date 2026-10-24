#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="$HOME/apartment-management"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%F_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/apartment_${TIMESTAMP}.sql"
CONTAINER_TMP="/tmp/apartment_backup.sql"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Xuất database vào file tạm bên trong container
docker compose exec -T db sh -c \
  'pg_dump -w -U "$POSTGRES_USER" "$POSTGRES_DB" > /tmp/apartment_backup.sql'

# Sao chép file backup từ container ra Ubuntu
DB_CONTAINER=$(docker compose ps -q db)
if [ -z "$DB_CONTAINER" ]; then
  echo "LỖI: Không tìm thấy container database."
  exit 1
fi

docker cp "${DB_CONTAINER}:${CONTAINER_TMP}" "$BACKUP_FILE"

# Kiểm tra file backup
if [ ! -s "$BACKUP_FILE" ] ||
   ! grep -q '^-- PostgreSQL database dump' "$BACKUP_FILE"; then
  rm -f "$BACKUP_FILE"
  echo "LỖI: File backup không hợp lệ."
  exit 1
fi

chmod 600 "$BACKUP_FILE"

# Chỉ giữ lại 7 bản backup mới nhất
mapfile -t OLD_BACKUPS < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    -name 'apartment_*.sql' -printf '%T@ %p\n' |
    sort -rn |
    awk 'NR > 7 {sub(/^[^ ]+ /, ""); print}'
)

for file in "${OLD_BACKUPS[@]}"; do
  rm -f -- "$file"
done

echo "BACKUP THÀNH CÔNG: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
