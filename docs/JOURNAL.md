# Journal des sessions

Log distillé des sessions de travail (décisions, contexte, « pourquoi »). Complète `CLAUDE.md`.
Ajouter une entrée à chaque session notable, la plus récente en haut.

---

## 2026-07-17 — De la spec à une app distribuée

Session initiale complète, à partir du brief (`SPEC-tracker-poker-winamax`).

### Déroulé
1. **Fixtures réelles** — Extraction de vrais fichiers résumé Winamax depuis le dossier `history/`,
   anonymisés (pseudo → `Hero`) → `src/parsing/__fixtures__/`. C'est ce qui a révélé le format réel
   (voir « Connaissances format » dans `CLAUDE.md`) : gains/multiplicateur absents, buy-in 2/3
   composantes, fichiers multi-blocs (re-entries).
2. **Environnement de dev** — Conteneur distrobox `tauri-dev` (hôte Bazzite immuable gardé propre) :
   Rust + Node (NodeSource) + libs Tauri. Git configuré (email noreply GitHub), repo public créé.
3. **Scaffold** — create-tauri-app (React/TS) + Tailwind v4 + shadcn/ui + TanStack Table + plugins
   Tauri (fs, dialog). Tokens design variante A dans `index.css`.
4. **Parser + tests** — `parsing/` (TS pur) + 14 tests Vitest sur les fixtures. `core/aggregate` pour
   les KPIs. Aperçu de dev branché sur les fixtures.
5. **Dashboard** — Recomposé **fidèle à la maquette** `PokerDash.dc.html` (fournie par l'utilisateur ;
   je m'étais d'abord basé à tort sur les seuls tokens texte). Courbe SVG animée + tooltip au survol,
   distribution enrichie (buy-in + gagné/perdu/net par multiplicateur).
6. **Lecture des vraies données** — Couche `datasource/` (Tauri) + `storage/` (JSON) + hook
   `useDatabase` : auto-détection, scan incrémental, dédup, watch. Vérifié en vrai : **91 tournois**
   scannés. Piège résolu : scope fs Tauri qui ignore les dossiers cachés (`.config`/`.local`).
7. **Distribution** — CI GitHub Actions (tauri-action, matrix 3 OS). Tag `v0.1.0` → **Release
   multi-OS réussie du premier coup**. A nécessité d'ajouter le scope `workflow` au token gh.
8. **Archivage du contexte** — Création de ce `CLAUDE.md` + `docs/JOURNAL.md` pour rendre le contexte
   portable (reprise sur n'importe quelle machine).

### Décisions prises
- Stack arrêtée (pas de re-débat framework). Persistance JSON d'abord derrière `Storage`.
- Design variante A (indigo). Repo public → aucune donnée perso versionnée.

### État de sortie
Tout vert, v0.1.0 distribuée. Prochaines pistes : voir « Backlog » dans `CLAUDE.md`.
