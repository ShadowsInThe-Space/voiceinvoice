# Netlify Deployment für Doxygen-Dokumentation

**Netlify ist komplett kostenlos für Open-Source-Projekte** und bietet automatisches Deployment aus GitHub.

## 🚀 Quick Start (5 Minuten)

### Methode 1: Netlify Drop (Super Einfach)

1. **Dokumentation lokal generieren:**

   ```bash
   pnpm install
   pnpm run docs:generate
   ```

2. **Zu Netlify Drop gehen:**
   - Öffne https://app.netlify.com/drop
   - Ziehe den Ordner `docs/api/html` in das Browser-Fenster
   - Fertig! ✅

3. **Deine URL:**
   - Du bekommst eine URL wie: `https://random-name-123456.netlify.app`
   - Diese kannst du in den Einstellungen umbenennen zu: `voiceinvoice-docs.netlify.app`

### Methode 2: GitHub Integration (Automatisch bei jedem Commit)

1. **Bei Netlify anmelden:**
   - Gehe zu https://app.netlify.com
   - Melde dich mit deinem GitHub-Account an (kostenlos)

2. **Neues Site erstellen:**
   - Klicke auf **"Add new site"** → **"Import an existing project"**
   - Wähle **GitHub** als Provider
   - Autorisiere Netlify (nur Lese-Zugriff)
   - Wähle dein Repository: `invoice_finance_app`

3. **Build-Einstellungen konfigurieren:**

   Netlify erkennt die `netlify.toml` automatisch, aber zur Sicherheit:
   - **Base directory:** (leer lassen)
   - **Build command:** `pnpm install && pnpm run docs:generate`
   - **Publish directory:** `docs/api/html`
   - **Advanced:** Environment Variable hinzufügen:
     - `PNPM_VERSION` = `8`

4. **Deploy starten:**
   - Klicke auf **"Deploy site"**
   - Warte 2-3 Minuten
   - Fertig! ✅

5. **Custom Domain (optional):**
   - Gehe zu **Site settings → Domain management**
   - Klicke auf **"Add custom domain"**
   - Folge den DNS-Anweisungen

## 🔄 Automatische Updates

Nach dem Setup wird die Dokumentation **automatisch aktualisiert**, wenn du Code auf GitHub pushst:

```bash
git add .
git commit -m "docs: update API documentation"
git push origin main
```

Netlify erkennt den Push, baut die Docs neu und deployed sie automatisch! 🎉

## 🌐 URL Format

Netlify gibt dir eine kostenlose URL:

```
https://voiceinvoice-docs.netlify.app
```

Du kannst den Namen ändern:

1. Gehe zu **Site settings → Domain management**
2. Klicke auf **Options → Edit site name**
3. Gib einen neuen Namen ein (z.B. `voiceinvoice-api-docs`)

## 💡 Vorteile von Netlify

✅ **Komplett kostenlos** für Open-Source
✅ **Automatisches Deployment** bei jedem Push
✅ **HTTPS** inklusive (Let's Encrypt)
✅ **CDN** weltweit für schnelle Ladezeiten
✅ **Build Logs** zum Debuggen
✅ **Preview Deployments** für Pull Requests
✅ **Custom Domains** kostenlos

## 🛠️ Troubleshooting

### Build schlägt fehl

**Problem:** `doxygen: command not found`

**Lösung:** Füge zu `netlify.toml` hinzu:

```toml
[build]
  command = "apt-get update && apt-get install -y doxygen graphviz && pnpm install && pnpm run docs:generate"
```

### pnpm nicht gefunden

**Problem:** `pnpm: command not found`

**Lösung:** In Netlify Dashboard:

1. Gehe zu **Site settings → Environment variables**
2. Füge hinzu: `PNPM_VERSION` = `8`
3. Triggere einen neuen Deploy

### Alte Version wird angezeigt

**Problem:** Browser cached alte Docs

**Lösung:**

- **Chrome/Edge:** Strg + Shift + R (Hard Refresh)
- **Firefox:** Strg + F5
- **Safari:** Cmd + Shift + R

## 📚 Weiterführende Links

- [Netlify Dokumentation](https://docs.netlify.com/)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)
- [Custom Domains Setup](https://docs.netlify.com/domains-https/custom-domains/)

## 🎯 Integration in README

Füge zu deiner README.md hinzu:

```markdown
[![API Docs](https://img.shields.io/badge/API%20Docs-Doxygen-blue)](https://voiceinvoice-docs.netlify.app)
```

---

**Erstellt:** 2026-01-26
**Kosten:** $0/Monat 💰
**Setup-Zeit:** 5 Minuten ⏱️
**Status:** Production-Ready ✅
