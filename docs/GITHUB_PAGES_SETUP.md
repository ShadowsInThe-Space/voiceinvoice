# GitHub Pages Setup für Doxygen-Dokumentation

Diese Anleitung erklärt, wie du die automatisch generierte Doxygen-API-Dokumentation auf GitHub Pages hostest.

## ✅ Voraussetzungen

- Repository auf GitHub
- Admin-Rechte für das Repository
- GitHub Actions aktiviert

## 🚀 Einmalige Einrichtung

### Schritt 1: GitHub Pages aktivieren

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf **Settings** (Einstellungen)
3. Navigiere zu **Pages** in der linken Seitenleiste
4. Unter **Source** wähle:
   - **Source:** "GitHub Actions"

   ![GitHub Pages Source](https://docs.github.com/assets/cb-47267/mw-1440/images/help/pages/configure-publishing-source.webp)

5. Klicke auf **Save**

### Schritt 2: Workflow triggern

Der Workflow wird automatisch bei jedem Push auf `main` ausgeführt, wenn sich TypeScript-Dateien ändern.

**Manuell triggern:**

1. Gehe zu **Actions** Tab
2. Wähle **Deploy Documentation** Workflow
3. Klicke auf **Run workflow**
4. Wähle den `main` Branch
5. Klicke auf **Run workflow**

### Schritt 3: Deployment überprüfen

1. Gehe zu **Actions** Tab
2. Warte, bis der Workflow erfolgreich durchläuft (grüner Haken ✅)
3. Klicke auf den Workflow-Run
4. In der **deploy** Job findest du die URL unter **Environment**

## 🌐 URL der Dokumentation

Nach erfolgreichem Deployment ist die Dokumentation verfügbar unter:

```
https://<username>.github.io/<repository-name>/
```

**Beispiel für dieses Projekt:**

```
https://Shadows-In-The-Space.github.io/invoice_finance_app/
```

## 🔄 Automatische Updates

Die Dokumentation wird automatisch aktualisiert, wenn:

- Code auf den `main` Branch gepusht wird
- TypeScript-Dateien (`*.ts`, `*.tsx`) geändert werden
- Die `Doxyfile` Konfiguration geändert wird
- Der Workflow manuell getriggert wird

## 📝 Workflow-Details

Der Workflow (`.github/workflows/deploy-docs.yml`) führt folgende Schritte aus:

1. **Build-Job:**
   - Installiert Doxygen und Graphviz
   - Installiert Node.js und pnpm Dependencies
   - Generiert die Dokumentation mit `pnpm run docs:generate`
   - Lädt die generierten HTML-Seiten als Artifact hoch

2. **Deploy-Job:**
   - Deployed das Artifact zu GitHub Pages
   - Stellt die Dokumentation unter der GitHub Pages URL bereit

## 🛠️ Troubleshooting

### Workflow schlägt fehl

**Problem:** Build-Job schlägt mit Doxygen-Fehler fehl

**Lösung:**

```bash
# Lokal testen
pnpm run docs:generate
cat docs/api/doxygen_warnings.log
```

Behebe die Warnungen in deinem Code (fehlende JSDoc-Kommentare, etc.).

### Dokumentation ist leer oder veraltet

**Problem:** GitHub Pages zeigt alte oder leere Seiten

**Lösung:**

1. Gehe zu **Settings → Pages**
2. Stelle sicher, dass Source auf "GitHub Actions" steht
3. Triggere den Workflow manuell neu
4. Lösche Browser-Cache und lade die Seite neu

### 404-Fehler

**Problem:** GitHub Pages URL gibt 404 zurück

**Lösung:**

1. Warte 1-2 Minuten nach Deployment
2. Prüfe, ob der Deploy-Job erfolgreich war
3. Stelle sicher, dass GitHub Pages aktiviert ist
4. Prüfe, dass die Repository-Visibility auf "Public" steht
   (oder GitHub Pages für Private Repos aktiviert ist)

## 📚 Weiterführende Links

- [GitHub Pages Dokumentation](https://docs.github.com/en/pages)
- [GitHub Actions Dokumentation](https://docs.github.com/en/actions)
- [Doxygen Dokumentation](https://www.doxygen.nl/manual/index.html)

## 💡 Tipps

### Custom Domain

Wenn du eine eigene Domain verwenden möchtest:

1. Gehe zu **Settings → Pages**
2. Unter **Custom domain** trage deine Domain ein
3. Folge den Anweisungen für DNS-Konfiguration

### Branch Protection

Empfohlen für Production:

1. Gehe zu **Settings → Branches**
2. Füge eine Branch Protection Rule für `main` hinzu
3. Aktiviere **Require status checks to pass**
4. Wähle "Deploy Documentation" als required check

### Lokale Vorschau

Bevor du pushst, teste die Doxygen-Docs lokal:

```bash
# Dokumentation generieren
pnpm run docs:generate

# Lokalen Server starten
pnpm run docs:serve

# Browser öffnen
open http://localhost:8080
```

## 🎯 Integration in README

Füge folgenden Badge zu deiner README.md hinzu:

```markdown
[![API Docs](https://img.shields.io/badge/API%20Docs-Doxygen-blue)](https://Shadows-In-The-Space.github.io/invoice_finance_app/)
```

Ergebnis:
[![API Docs](https://img.shields.io/badge/API%20Docs-Doxygen-blue)](https://Shadows-In-The-Space.github.io/invoice_finance_app/)

---

**Erstellt:** 2026-01-26
**Status:** Production-Ready ✅
