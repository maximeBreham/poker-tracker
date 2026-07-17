# Poker Tracker — Winamax (Expresso / MTT)

Application **desktop, locale et privée** qui lit l'historique de parties Winamax et affiche un
tableau de bord de progression : profit net, ROI, volume, courbe de bankroll, distribution des
multiplicateurs, bilan mensuel.

> 🔒 **100 % local.** Aucune donnée ne quitte la machine : pas de backend, pas d'upload.
> Les vraies données Winamax ne sont **jamais** versionnées (voir `.gitignore`). Seules des
> fixtures **anonymisées** servent de jeu de test (`src/parsing/__fixtures__/`).

## Stack

- **Tauri 2** (coquille desktop, webview système, cross-platform)
- **Vite + React + TypeScript**
- **Tailwind v4 + shadcn/ui** · **TanStack Table**
- Persistance **JSON** (v1) derrière une interface `Storage` (SQLite possible plus tard sans refonte)
- Parsing = **TS pur testé** (Vitest), découplé de Tauri

## Développement

Le projet se développe dans un conteneur **distrobox** (`tauri-dev`) pour garder l'hôte propre
(Bazzite immuable). Prérequis déjà installés dedans : Rust, Node 22, libs système Tauri.

```bash
distrobox enter tauri-dev
cd ~/Projets/poker-tracker

npm install            # dépendances JS
npm run dev            # front seul (Vite) sur http://localhost:1420
npm run tauri dev      # application desktop complète (front + Rust)
npm run test           # tests Vitest (parsing / calculs)
npm run build          # build front (tsc + vite)
npm run tauri build    # installeurs desktop
```

Sur **macOS**, pas besoin de conteneur : Node + Rust via Homebrew, Xcode CLT, puis les mêmes commandes.

## Structure

```
src/
  parsing/     cœur testable — parse les fichiers résumé → Tournoi[]  (TS pur)
  core/        agrégats & KPIs (net, ROI, courbe, mensuel…)          (TS pur)
  datasource/  abstraction d'accès (Tauri fs/dialog/watch ↔ web)
  storage/     persistance de la base cumulée (impl JSON en v1)
  components/  ui (shadcn) + dashboard
  lib/         utils (format €, dates UTC→Europe/Paris)
src-tauri/     coquille Tauri (config, capabilities, Rust)
```

## Périmètre

- **v1** : parsing des fichiers *résumé* de tournoi (buy-in, place, gains dérivés, multiplicateur).
- **v2** (non démarré) : EV Chips via parsing des historiques de mains.

## Distribution

Build des installeurs via GitHub Actions (Windows `.msi`/`.exe`, macOS `.dmg`, Linux AppImage + `.deb`).
**Pas de signature de code** pour l'instant :

- **Windows** : SmartScreen → « Informations complémentaires » → « Exécuter quand même ».
- **macOS** : clic-droit sur l'app → « Ouvrir » (au lieu du double-clic).

Le pipeline de signature pourra être ajouté plus tard sans refonte.
