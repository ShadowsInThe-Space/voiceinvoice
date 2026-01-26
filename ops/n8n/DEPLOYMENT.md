# n8n Hetzner Deployment Guide

## 🚀 Quick Start

### 1. Server vorbereiten

```bash
# SSH in deinen Hetzner Server
ssh root@***.***.***.***

# Docker & Docker Compose installieren (falls noch nicht vorhanden)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose installieren
apt install docker-compose -y
```

### 2. Projekt hochladen

```bash
# Vom lokalen Rechner
cd /home/user/Development/invoice_finance_app
scp -r ops/n8n root@***.***.***.***:/opt/

# Auf dem Server
cd /opt/n8n
```

### 3. Environment konfigurieren

```bash
# .env.production erstellen
cp .env.production.example .env.production
nano .env.production

# Setze diese Werte:
# N8N_BASIC_AUTH_PASSWORD=<sicheres-passwort>
# N8N_ENCRYPTION_KEY=<generiert mit: openssl rand -hex 32>
```

### 4. n8n starten

```bash
docker-compose -f docker-compose.production.yml up -d
```

### 5. Logs überprüfen

```bash
docker logs -f n8n-production
```

---

## 📦 Workflows & Credentials migrieren

### A. Workflows exportieren (lokal)

```bash
# Von deinem lokalen n8n
# http://localhost:5678 → Settings → Import/Export
# → Export All Workflows → workflows-backup.json speichern
```

### B. Auf Hetzner importieren

```bash
# Workflows hochladen
scp workflows-backup.json root@***.***.***.***:/opt/n8n/

# Auf dem Server: In n8n UI importieren
# https://n8n.shadowsinthe.space → Settings → Import/Export → Import
```

### C. Credentials neu eintragen

**Wichtig:** Credentials werden NICHT exportiert (Sicherheit).

Du musst alle Credentials neu eintragen:

1. **Google Gemini API**
   - API Key: 

2. **Google OAuth2**
   - Client ID: 
   - Client Secret: 
   - Scopes: (siehe ops/n8n/google-oauth2-scopes.txt)

3. **Slack API**
   - Access Token: 

4. **Supabase** (für RAG Workflows)
   - URL: `https://supabase-studio.*******`
   - Service Role Key: (aus Supabase Dashboard)

---

## 🔒 SSL/HTTPS Setup

### Option 1: Nginx Reverse Proxy + Let's Encrypt

```bash
# Nginx installieren
apt install nginx certbot python3-certbot-nginx -y

# SSL Zertifikat holen
certbot --nginx -d n8n.***

# Nginx Config
cat > /etc/nginx/sites-available/n8n <<'EOF'
server {
    listen 80;
    server_name n8n.***;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name n8n.***;

    ssl_certificate /etc/letsencrypt/live/n8n.***/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.***/privkey.pem;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Option 2: Traefik (bereits im docker-compose)

Wenn du Traefik nutzt, ist SSL automatisch via Let's Encrypt konfiguriert.

---

## 📊 Monitoring & Backups

### Logs

```bash
# Live logs
docker logs -f n8n-production

# Letzte 100 Zeilen
docker logs --tail 100 n8n-production
```

### Backup

```bash
# Automatisches Backup-Skript
cat > /opt/n8n/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/n8n/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker exec n8n-production sqlite3 /home/node/.n8n/database.sqlite ".backup '/tmp/backup.db'"
docker cp n8n-production:/tmp/backup.db $BACKUP_DIR/n8n-backup-$DATE.db

# Keep only last 7 days
find $BACKUP_DIR -name "n8n-backup-*.db" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/n8n-backup-$DATE.db"
EOF

chmod +x /opt/n8n/backup.sh

# Cron job für tägliches Backup
crontab -e
# Füge hinzu:
0 2 * * * /opt/n8n/backup.sh >> /var/log/n8n-backup.log 2>&1
```

### Restore

```bash
# Backup wiederherstellen
docker stop n8n-production
docker cp backup.db n8n-production:/home/node/.n8n/database.sqlite
docker start n8n-production
```

---

## 🔧 Troubleshooting

### n8n startet nicht

```bash
# Logs prüfen
docker logs n8n-production

# Container neu starten
docker-compose -f docker-compose.production.yml restart

# Komplett neu bauen
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Webhooks funktionieren nicht

1. Prüfe WEBHOOK_URL in docker-compose.production.yml
2. Prüfe SSL/HTTPS Setup
3. Teste Webhook: `curl -X POST https://n8n.***webhook/test`

### Credentials fehlen nach Migration

→ Normale! Credentials müssen manuell neu eingetragen werden (Sicherheit).

---

## 📝 Post-Deployment Checklist

- [ ] n8n erreichbar unter https://n8n.***
- [ ] Basic Auth funktioniert
- [ ] Alle Workflows importiert
- [ ] Alle Credentials neu eingetragen
- [ ] Webhooks testen (z.B. mit curl)
- [ ] RAG Workflows importiert
- [ ] Supabase Connection testen
- [ ] Backup-Cron job läuft
- [ ] SSL-Zertifikat gültig
- [ ] Desktop App mit Production Webhooks verbunden

---

## 🎯 Nächste Schritte

1. **Test durchführen**: Ein kompletter Workflow End-to-End
2. **.env aktualisieren**: Production URLs statt localhost
3. **Desktop App testen**: Gegen Production Webhooks
4. **Monitoring einrichten**: Optional Grafana/Prometheus
