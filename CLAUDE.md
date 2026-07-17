# CLAUDE.md — contexte projet (lu automatiquement à chaque session)

> Ce fichier est le **contexte portable** du projet. Il est versionné : sur n'importe quelle
> machine, après `git clone` + `claude` dans ce dossier, l'assistant le lit et reprend le travail
> là où on en était. Tenir ce fichier à jour à chaque avancée notable.

## En une phrase

Application **desktop, locale et privée** (Tauri 2 + React/TS) qui lit l'historique de tournois
Winamax (Expresso / MTT) et affiche un tableau de bord de progression : bankroll, ROI, volume,
distribution des multiplicateurs, bilan mensuel. Usage perso, ~1×/mois.

## Statut actuel (2026-07-17)

Fonctionnel de bout en bout et distribué :
- Parser des fichiers résumé + tests (Vitest) ✅
- Dashboard fidèle à la maquette (courbe animée + tooltip, KPIs, distribution, format, mensuel) ✅
- Lecture du **vrai dossier Winamax** (auto-détection, scan incrémental, dédup, watch, persistance JSON) ✅
- CI GitHub Actions → **Release multi-OS** (Windows/macOS-ARM/Linux) sur tag `v*` ✅ (v0.1.0 publiée)

## Reprendre le travail (n'importe quelle machine)

```bash
git clone https://github.com/maximeBreham/poker-tracker && cd poker-tracker
npm install
npm run dev         # front seul (navigateur, mode démo sur fixtures)
npm run tauri dev   # vraie app desktop (lit le dossier Winamax réel)
npm run test        # tests du cœur (parsing + calculs)
npm run build       # build front (tsc + vite)
npm run tauri build # installeurs locaux
```

- **Sur Bazzite (Linux immuable)** : travailler dans le conteneur distrobox `tauri-dev` (`distrobox enter tauri-dev`) — Rust, Node, libs webkit2gtk y sont installés. Ne pas installer les toolchains sur l'hôte.
- **Sur macOS** : natif, pas de conteneur. `xcode-select --install`, `brew install node`, Rust via rustup.

## Stack & architecture

Tauri 2 · Vite · React 19 · TypeScript · Tailwind v4 (CSS-first) · shadcn/ui · TanStack Table.
Persistance **JSON** (v1) derrière une interface `Storage` (SQLite possible plus tard sans refonte).

**Principe directeur** : le cœur (`parsing/`, `core/`) est du **TS pur testable**, sans dépendance
Tauri. Tout accès système passe par les abstractions `datasource/` et `storage/` → une future
version web ne réécrit que ces impls.

```
src/
  parsing/     parse les fichiers résumé → Tournoi[]  (TS pur + tests + __fixtures__/)
    types.ts       modèle de données (Tournoi, Format, ParseResult)
    parseSummary.ts  découpe multi-blocs + extraction des champs
    derive.ts      format, multiplicateur, gains, dedupKey, date ISO
  core/
    aggregate.ts   KPIs, courbe bankroll, distribution, format, mensuel (+ tests)
  datasource/    abstraction d'accès aux données
    types.ts       interface DataSource
    tauri.ts       impl Tauri (fs/dialog/watch, auto-détection multi-OS)
    scan.ts        scan incrémental + déduplication
  storage/       persistance de la base cumulée
    types.ts / json.ts   impl JSON (appDataDir)
  app/
    useDatabase.ts  hook central (source + storage + scan + watch)
    fixtures.ts     jeu de démo (hors Tauri)
  components/dashboard/  TopBar, Hero, BankrollCurve, Panels (KPI/distrib/format/mensuel/empty)
  lib/format.ts   € / % / dates Europe/Paris
  index.css       design tokens (variante A indigo) + keyframes
src-tauri/       coquille Tauri (tauri.conf.json, capabilities/, Rust minimal)
.github/workflows/release.yml   CI build + Release multi-OS
```

## Décisions clés

- **Stack arrêtée** (ne pas rouvrir le débat framework) : Tauri 2 + React/TS + Tailwind v4 + shadcn.
- **Persistance JSON d'abord** derrière `Storage` (volume réel faible ; web-friendly ; SQLite = swap ultérieur).
- **Design** : variante A (accent indigo). Prévisualisation via URL : `?mono` (variante B), `?empty` (état vide).
- **Identité git** : compte perso GitHub, **email noreply** GitHub dans les commits (jamais d'email pro).

## Connaissances sur le format Winamax (durement acquises — ne pas redécouvrir)

- Fichiers **résumé** = `*_summary.txt`, texte à plat `Clé : valeur`. Source de la v1.
- **Ni gains ni multiplicateur** dans le résumé → **dérivés** (`derive.ts`) :
  - multiplicateur Expresso = `Prizepool / Buy-In total`.
  - winnings Expresso = winner-take-all pour multiplicateur ≤ 5 (au-delà : peut payer 2e/3e → marqué estimé).
- **Buy-In** à 2 composantes (Expresso : entry + rake) ou 3 (KO : entry + bounty + rake).
- **Un fichier peut contenir plusieurs blocs** `Tournament summary :` (re-entries late reg, **même id**)
  → dédup par `dedupKey = id#entryIndex`, jamais par `id` seul.
- **Limite** : gains MTT/KO non calculables depuis le résumé seul (primes absentes) → `winnings=0`, `isWinningsEstimated=true`.
- Emplacement du dossier : `<config>/winamax/documents/accounts/<pseudo>/history/` où `<config>` =
  `~/.config` (Linux), `%APPDATA%` (Windows), `~/Library/Application Support` (macOS) → couvert par `configDir()`.
  (Client Linux sous Wine : chemin dans le préfixe → sélection manuelle.)

## Pièges techniques résolus (à ne pas reproduire)

- **Scope fs Tauri & dossiers cachés** : le glob `$HOME/**` **ne matche pas** les dossiers en point
  (`.config`, `.local`). Il faut lister explicitement `$HOME/.config/**`, `$HOME/.local/**`, etc. dans
  `fs:scope` (`src-tauri/capabilities/default.json`). Sinon `exists/readDir` → « forbidden path ».
- **Push de `.github/workflows/**`** : nécessite le scope `workflow` sur le token gh
  (`gh auth refresh -h github.com -s workflow`). Acquis.
- **Node dans distrobox** : installé via NodeSource (nvm avait échoué).

## Distribution / Release

- CI déclenchée par un **tag** `v*`. Pour publier : bumper la version (dans `src-tauri/tauri.conf.json`
  et `package.json`), puis `git tag vX.Y.Z && git push origin vX.Y.Z`.
- Résultat : Release GitHub avec `.dmg` (macOS ARM), `.exe`/`.msi` (Windows), `.AppImage`/`.deb`/`.rpm` (Linux).
- **App non signée** : Windows SmartScreen → « Exécuter quand même » ; macOS clic-droit → Ouvrir
  (ou `xattr -dr com.apple.quarantine …app`).

## Confidentialité

100 % local : aucune donnée ne sort de la machine. Les **vraies** données Winamax et la base locale
ne sont **jamais** commitées (voir `.gitignore`). Seules les **fixtures anonymisées**
(`src/parsing/__fixtures__/`, pseudos remplacés par `Hero`) sont versionnées comme jeu de test.

## Backlog / prochaines étapes possibles

- Bankroll de départ éditable dans l'UI (déjà persistée dans les settings, défaut 50 €).
- Tri / filtres sur les tableaux (TanStack Table).
- Affiner les gains « estimés » (gros multiplicateurs Expresso > ×5 ; MTT-KO).
- **v2 — EV Chips** : parser les historiques de mains (≠ résumés), détecter les tapis, calculer l'équité.
  À ne lancer qu'après validation (cf. brief). Redemander un échantillon de hand history dédié.

Voir `docs/JOURNAL.md` pour l'historique détaillé des sessions.
