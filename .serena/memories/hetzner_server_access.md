# Hetzner Server SSH Zugriff

## SSH Konfiguration

- **Host:** shadowsinthe.space (alle Subdomains laufen auf diesem Server)
- **User:** sonny
- **Port:** 22222
- **Standard Port 22:** NICHT verwenden!

## Domains auf diesem Server

- proxy.shadowsinthe.space - Proxy-Server (Fastify)
- n8n.shadowsinthe.space - n8n Workflow Automation
- supabase.shadowsinthe.space - Supabase Vector DB

## SSH Verbindung

```bash
ssh -p 22222 sonny@shadowsinthe.space
```

## Projekt-Pfad

```
/home/sonny/voiceinvoice/
├── apps/
│   ├── desktop/
│   └── proxy-server/  ← Proxy-Server hier
├── packages/
└── ...
```

## PM2 Services

- `proxy-server` - Fastify Backend
- `n8n` - n8n Docker Container (via docker-compose)
- `supabase` - Supabase Stack (via docker-compose)

## WICHTIG

- Verwende IMMER Port 22222 für SSH-Zugriffe
- Projekt liegt in /home/sonny/voiceinvoice/ (NICHT /root/invoice_finance_app/)
