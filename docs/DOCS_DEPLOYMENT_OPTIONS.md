# Dokumentations-Deployment Optionen

Da GitHub Pages Enterprise benötigt, hier die **kostenlosen Alternativen** für Doxygen-Docs:

## 🥇 Empfohlen: Netlify

**Warum:** Einfach, kostenlos, automatisch, schnell

### Quick Start

```bash
# 1. Docs generieren
pnpm run docs:generate

# 2. Zu Netlify Drop gehen und docs/api/html hochziehen
open https://app.netlify.com/drop
```

**Vollständige Anleitung:** [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md)

**URL-Format:** `https://voiceinvoice-docs.netlify.app`

---

## 🥈 Alternative: ReadTheDocs

**Warum:** Spezialisiert auf API-Docs, sehr professionell

### Setup

1. **Account erstellen:**
   - Gehe zu https://readthedocs.org
   - Melde dich mit GitHub an

2. **Projekt importieren:**
   - Klicke auf **"Import a Project"**
   - Wähle `invoice_finance_app` Repository
   - ReadTheDocs erkennt automatisch die Doxygen-Konfiguration

3. **Build-Konfiguration:**
   Erstelle `.readthedocs.yaml` im Repository:

```yaml
version: 2

build:
  os: ubuntu-22.04
  tools:
    nodejs: "20"
  apt_packages:
    - doxygen
    - graphviz

# Sphinx-Konfiguration (für ReadTheDocs)
sphinx:
  configuration: docs/conf.py

# Doxygen ausführen vor Sphinx
build:
  commands:
    - pnpm install
    - pnpm run docs:generate
```

**URL-Format:** `https://voiceinvoice.readthedocs.io`

---

## 🥉 Alternative: Vercel

**Warum:** Sehr schnell, gute GitHub-Integration

### Setup

1. **Account erstellen:**
   - Gehe zu https://vercel.com
   - Melde dich mit GitHub an

2. **Projekt importieren:**
   - Klicke auf **"New Project"**
   - Wähle `invoice_finance_app`
   - Framework: **Other**

3. **Build-Einstellungen:**
   - **Build Command:** `pnpm install && pnpm run docs:generate`
   - **Output Directory:** `docs/api/html`
   - **Install Command:** `pnpm install`

4. **Environment Variables:**
   - `PNPM_VERSION` = `8`

**URL-Format:** `https://invoice-finance-app-docs.vercel.app`

---

## 💾 Option: Docs im Repository committen

**Warum:** Einfachste Lösung, keine externe Dependency

### Vorteile

- ✅ Keine externe Plattform nötig
- ✅ Docs immer mit Code versioniert
- ✅ Funktioniert offline

### Nachteile

- ❌ Repository-Größe wächst
- ❌ Kein Custom Domain
- ❌ Keine automatische Build-Pipeline

### Setup

1. **Gitignore anpassen:**
   Entferne diese Zeile aus `.gitignore`:

   ```diff
   - docs/api/html/
   ```

2. **Docs generieren und committen:**

   ```bash
   pnpm run docs:generate
   git add docs/api/html
   git commit -m "docs: add generated API documentation"
   git push
   ```

3. **Zugriff über GitHub:**

   ```
   https://github.com/Shadows-In-The-Space/invoice_finance_app/tree/main/docs/api/html
   ```

4. **Oder über htmlpreview.github.io:**
   ```
   https://htmlpreview.github.io/?https://github.com/Shadows-In-The-Space/invoice_finance_app/blob/main/docs/api/html/index.html
   ```

---

## 📊 Vergleichstabelle

| Feature              | Netlify          | ReadTheDocs      | Vercel           | Git Commit  |
| -------------------- | ---------------- | ---------------- | ---------------- | ----------- |
| **Kostenlos**        | ✅               | ✅               | ✅               | ✅          |
| **Setup-Zeit**       | 5 min            | 10 min           | 5 min            | 1 min       |
| **Auto-Deploy**      | ✅               | ✅               | ✅               | ❌          |
| **Custom Domain**    | ✅               | ✅               | ✅               | ❌          |
| **HTTPS**            | ✅               | ✅               | ✅               | ✅ (GitHub) |
| **CDN**              | ✅               | ✅               | ✅               | ❌          |
| **Preview PRs**      | ✅               | ✅               | ✅               | ❌          |
| **Build Logs**       | ✅               | ✅               | ✅               | ❌          |
| **Docs-fokussiert**  | -                | ✅✅             | -                | -           |
| **Repository-Größe** | Keine Auswirkung | Keine Auswirkung | Keine Auswirkung | Wächst      |

## 🏆 Empfehlung

### Für schnellen Start (heute):

➡️ **Netlify Drop** (2 Minuten)

### Für langfristige Lösung:

➡️ **Netlify mit GitHub Integration** (5 Minuten)

### Für Offline-Entwicklung:

➡️ **Lokaler Server** mit `pnpm run docs:serve`

---

## 🚀 Nächste Schritte

1. **Jetzt:** Wähle eine Option oben
2. **Deploy:** Folge der jeweiligen Anleitung
3. **README:** Aktualisiere den Badge in der README.md
4. **Team:** Teile die URL mit deinem Team

---

**Erstellt:** 2026-01-26
**Kosten:** Alle Optionen kostenlos! 💰
**Empfehlung:** Netlify 🥇
