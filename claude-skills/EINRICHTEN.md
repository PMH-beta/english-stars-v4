# Claude-Werkzeuge einrichten (Übergabe für weitere Rechner)

Stand 28.10.2026, eingerichtet auf dem Windows-Hauptrechner. `.claude/` ist gitignored,
deshalb liegen die eigenen Skills hier im Repo und werden pro Rechner kopiert.
**Auslöser:** Der Nutzer sagt „ich arbeite am Linux-Rechner“ (o. Ä.) oder
`.claude/skills/app-im-browser-pruefen/` fehlt. Dann diese Liste abarbeiten, ohne
nachzufragen, und am Ende den Nutzer bitten, Claude Code neu zu starten.

## 1 · Eigene Projekt-Skills
```bash
mkdir -p .claude/skills
cp -r claude-skills/app-im-browser-pruefen claude-skills/speicherfeld-pruefen claude-skills/db-korrektur .claude/skills/
```
Quelle der Wahrheit ist `claude-skills/`. Änderungen dort machen, committen, dann neu kopieren.

## 2 · Fremd-Skills (MIT, auf Windows gelesen und geprüft)
In einen leeren Ordner unter /tmp klonen, auf den geprüften Stand setzen, kopieren:
```bash
T=$(mktemp -d)
git clone -q https://github.com/addyosmani/web-quality-skills "$T/wq" && git -C "$T/wq" checkout -q afa8da9
git clone -q https://github.com/supabase/agent-skills "$T/sb" && git -C "$T/sb" checkout -q c9be0e9
for k in accessibility performance core-web-vitals best-practices web-quality-audit; do cp -r "$T/wq/skills/$k" .claude/skills/; done
for k in supabase supabase-postgres-best-practices; do cp -r "$T/sb/skills/$k" .claude/skills/; done
```
Schlägt ein checkout fehl (Stand nicht mehr da): neuesten Stand nehmen, aber die SKILL.md-Dateien
vorher lesen und auf Auffälliges prüfen. `seo` bewusst nicht.

## 3 · Plugin
```bash
claude plugin marketplace list   # fehlt claude-plugins-official → claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install claude-md-management@claude-plugins-official -s user
```

## 4 · Playwright-MCP (Supabase gesperrt!)
Browser prüfen: `which google-chrome chromium chromium-browser`. Mit Chrome `--browser chrome`,
sonst `npx -y playwright@1 install chromium` und `--browser chromium`.
```bash
claude mcp add -s local playwright -- npx -y @playwright/mcp@0.0.83 --browser chrome --headless --isolated \
  --viewport-size 412,915 \
  --blocked-origins "https://bjjdofvvzlivyhvjdfyw.supabase.co;wss://bjjdofvvzlivyhvjdfyw.supabase.co" \
  --output-dir /tmp/playwright-out
claude mcp get playwright   # muss „Connected“ zeigen
```
Windows-Fassung (nur zur Info): `cmd /c npx …`, in Git Bash mit `MSYS_NO_PATHCONV=1`.
Die Sperre `--blocked-origins` nie weglassen — sonst schreibt der Test-Browser in die echte DB.

## 5 · Abschluss
- Freigabe: Damit nicht jeder Browser-Schritt nachfragt, kann der Nutzer über `/permissions`
  die Regel `mcp__playwright` erlauben (darf Claude nicht selbst eintragen).
- Nutzer bitten: Claude Code ganz schließen (`/exit`) und neu starten — erst dann sind
  Playwright und das Plugin geladen. `claude --continue` holt das Gespräch zurück.
- Wann welcher Skill greift: Abschnitt „Werkzeuge“ in `CLAUDE.md`.
