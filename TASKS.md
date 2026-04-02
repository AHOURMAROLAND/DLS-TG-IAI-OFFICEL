# DLS Hub — Suivi des tâches

Chaque tâche est marquée ✅ (corrigé/fait), 🔄 (en cours), ❌ (à faire).

---

## BACKEND

### Modèles

- ✅ `Player` — ajout `logo_data` (LargeBinary) + `logo_content_type` pour stocker le logo en base
- ✅ `Player` — `team_logo_url` conservé pour compatibilité ascendante
- ✅ Migration Alembic `f1a2b3c4d5e6` — ajout colonnes logo sur players

### Services

- ✅ `draw_service.py` — algorithme `balanced_draw` amélioré (serpentin pour mieux équilibrer les niveaux)
- ✅ `draw_service.py` — ajout `championship_draw` (round-robin aller simple/retour)
- ✅ `draw_service.py` — ajout `create_group_matches` : crée les matchs de poules en base après confirmation du tirage
- ✅ `draw_service.py` — ajout `create_elimination_matches` : crée les matchs d'élimination en base
- ✅ `draw_service.py` — ajout `create_championship_matches` : crée les matchs de championnat en base
- ✅ `tracker_service.py` — ajout `logger` manquant (était utilisé sans import)
- ✅ `tracker_service.py` — ajout délai `TRACKER_REQUEST_DELAY` entre appels pour éviter le blocage API
- ✅ `tracker_service.py` — `find_recent_matches_vs_opponent` : extraction correcte home/away selon `Hom`, ajout `gcr`, `extra_time`, `penalties`
- ✅ `session_service.py` — ajout `set_session_cookie` et `get_session_from_request` pour gestion cookie HTTP

### Routers

#### tournaments.py
- ✅ `POST /` — statut initial `REGISTRATION` (DRAFT était sauté, maintenant documenté)
- ✅ `POST /{slug}/draw` — passe le tournoi en statut `DRAW` à la première génération
- ✅ `POST /{slug}/draw` — validation : min 2 joueurs acceptés, group_count valide
- ✅ `POST /{slug}/draw` — support des 3 types : groups, championship, elimination
- ✅ `POST /{slug}/draw/confirm` — **crée les matchs en base** (était manquant)
- ✅ `POST /{slug}/draw/confirm` — utilise `DrawConfirmRequest` avec `creator_session` + `draw`
- ✅ `POST /{slug}/draw/confirm` — détermine la phase d'élimination selon le nombre de paires
- ✅ `GET /{slug}/bracket` — **nouvel endpoint** : retourne les matchs organisés par phase avec infos joueurs
- ✅ `GET /{slug}/groups` — **nouvel endpoint** : retourne les groupes avec classement, stats et matchs
- ✅ `GET /{slug}/groups` — calcul classement poules : pts > diff > buts, qualifiés marqués

#### players.py
- ✅ `POST /register/{slug}` — logo stocké en base (LargeBinary) au lieu de Cloudinary
- ✅ `POST /register/{slug}` — vérification statut tournoi (REGISTRATION uniquement)
- ✅ `POST /register/{slug}/creator` — **nouvel endpoint** : créateur s'inscrit avec statut ACCEPTED + is_creator=True
- ✅ `GET /logo/{player_id}` — **nouvel endpoint** : sert le logo binaire d'un joueur
- ✅ `POST /decision` — endpoint corrigé (était `/accept` et `/reject` séparés inexistants)
- ✅ `GET /tournament/{slug}` — `team_logo_url` pointe vers `/api/players/logo/{id}`
- ✅ Suppression dépendance Cloudinary du router players

#### matches.py
- ✅ `POST /validate` — **règle des 90 min** implémentée via `_apply_score_rules`
  - Poule / Championnat / Double élim match 1 : Min ≤ 90 seulement
  - Double élim match 2 : prolongations + penalties comptent
- ✅ `POST /validate` — vérification que le match n'est pas déjà validé
- ✅ `POST /validate` — retourne les scores finaux appliqués
- ✅ `GET /tournament/{slug}` — enrichi avec infos joueurs (pseudo, team, logo, dll_idx)
- ✅ `GET /{match_id}/tracker-suggest` — retourne phase + round_number pour que le frontend sache quelle règle appliquer
- ✅ `GET /standings/{slug}` — forme limitée aux 5 derniers matchs
- ✅ `GET /standings/{slug}` — `team_logo_url` pointe vers `/api/players/logo/{id}`
- ✅ `GET /scorers/{slug}` — ajout comptage des passes décisives

### Schemas
- ✅ `match.py` — ajout `minutes_played` dans `MatchValidate`
- ✅ `match.py` — `DrawRequest` simplifié (juste `creator_session`)
- ✅ `match.py` — ajout `DrawConfirmRequest` avec `creator_session` + `draw`

### main.py
- ✅ WebSocket endpoint `/ws/{tournament_id}` — path correct et cohérent avec le frontend

### Optimisations & bugs silencieux corrigés

- ✅ `database.py` — crash SQLite : `pool_size/max_overflow/pool_recycle` retirés proprement via `_build_engine_kwargs()`
- ✅ `websocket/manager.py` — `broadcast` envoyait sur des WS morts → nettoyage automatique + vérification `WebSocketState.CONNECTED`
- ✅ `websocket/manager.py` — `disconnect` : `ValueError` silencieux si WS déjà retiré → try/except ajouté
- ✅ `utils/exceptions.py` — `dls_hub_exception_handler` crashait sur `logger.handlers[0]` si aucun handler → remplacé par `datetime.now().isoformat()`
- ✅ `utils/exceptions.py` — `general_exception_handler` interceptait les `HTTPException` FastAPI → ré-raise ajouté
- ✅ `utils/logger.py` — handlers dupliqués si `setup_logging()` appelé plusieurs fois → guard ajouté
- ✅ `routers/matches.py` — `standings` : `Player.status == "accepted"` (string vs enum) → 0 résultats silencieux → corrigé avec `PlayerStatus.ACCEPTED`
- ✅ `routers/matches.py` — `Match.status.in_(["validated", "manual"])` (string vs enum) → 0 résultats silencieux → corrigé avec `[MS.VALIDATED, MS.MANUAL]`
- ✅ `routers/tournaments.py` — `get_groups` : double import `Match`, comparaison enum vs string → corrigé
- ✅ `routers/tournaments.py` — `get_groups` : `next((p for p in players ...))` O(n) dans boucle → `players_map` dict O(1)
- ✅ `routers/tournaments.py` — `get_bracket` : `home.team_logo_url` (Cloudinary legacy) → `/api/players/logo/{id}`
- ✅ `services/draw_service.py` — `create_group_matches` ne mettait pas à jour `Player.group_id` → `get_groups` retournait tout dans `"?"` silencieusement
- ✅ `schemas/tournament.py` — `TournamentOut` n'exposait pas `teams_per_group`, `qualified_per_group`, `elimination_round` → ajoutés

---

## FRONTEND

> Routing, thème et structure corrigés. Pages à implémenter.

### Structure & Thème
- ✅ `App.tsx` — routing corrigé selon les 19 écrans (5 groupes fonctionnels)
- ✅ `App.tsx` — routes nommées cohérentes : `/dashboard/:slug/*`, `/tournament/:slug/*`, `/register/:slug/*`
- ✅ `App.tsx` — fallback `*` → `/error/404`
- ✅ `App.tsx` — `CreatorDashboard` branché sur `/dashboard/:slug` (était `TournamentDetail`)
- ✅ `tailwind.config.js` — palette DLS intégrée : `dls-base`, `dls-card`, `dls-blue`, `dls-violet`, `dls-crimson`, `dls-gold`, `dls-green`
- ✅ `dls-theme.css` — thème complet : fonds, accents, boutons, badges, tables, match cards, bracket, podium, stepper, tabs, spinner WS
- ✅ `index.css` — base body dark, input/label DLS, suppression des classes Tailwind light-mode conflictuelles

### Session (backend)
- ✅ `session_service.py` — `is_session_valid` supporte timezone-aware et naive datetimes
- ✅ `session_service.py` — `cleanup_expired_sessions` : supprime les joueurs PENDING expirés (> 30j)
- ✅ `main.py` — tâche de fond `_session_cleanup_task` : nettoyage automatique toutes les 24h
- ✅ `main.py` — endpoint `GET /api/session/verify` : vérifie le cookie créateur, retourne `valid`, `expires_at`, `tournament_slug`

### Priorité haute

- ✅ `MatchValidation.tsx` — appelle `/api/matches/{id}/tracker-suggest` (plus d'appel direct FTGames)
- ✅ `MatchValidation.tsx` — endpoint correct : `POST /api/matches/validate`
- ✅ `MatchValidation.tsx` — envoie `minutes_played` dans le body
- ✅ `PlayerRegistration.tsx` — appelle `/api/players/verify/{dll_idx}`
- ✅ `PlayerRegistration.tsx` — logo envoyé dans le même `multipart/form-data`
- ✅ `ManageRegistrations.tsx` — `POST /api/players/decision` avec `{ player_id, decision, creator_session }`
- ✅ `DrawGeneration.tsx` — envoie `creator_session` + `draw` dans le confirm

### Priorité moyenne

- ✅ `BracketView.tsx` — URL correcte : `GET /api/tournaments/{slug}/bracket`
- ✅ `BracketView.tsx` — WebSocket URL relative, reconnexion automatique
- ✅ `GroupPhase.tsx` — données réelles via `GET /api/tournaments/{slug}/groups`
- ✅ `ChampionshipStandings.tsx` — URL correcte : `GET /api/matches/standings/{slug}`
- ✅ `CreatorDashboard.tsx` — flow inscription créateur via `/dashboard/:slug`

### Pages implémentées (19/19)

- ✅ ① `Home.tsx` — Landing, hero, rejoindre rapide, liste tournois
- ✅ ② `CreateTournament.tsx` — Stepper 3 étapes, tous les formats
- ✅ ③ `JoinTournament.tsx` — Vérification slug, affichage tournoi
- ✅ ④ `PlayerRegistration.tsx` — Vérification idx, upload logo, inscription
- ✅ ⑤ `UploadLogo.tsx` — Upload + emojis alternatifs
- ✅ ⑥ `PendingValidation.tsx` — Checklist animée
- ✅ ⑦ `CreatorDashboard.tsx` — Stats, lien invitation, actions rapides
- ✅ ⑧ `ManageRegistrations.tsx` — Filtres, accept/reject, badges division
- ✅ ⑨ `DrawGeneration.tsx` — Génération + confirmation, affichage groupes/paires
- ✅ ⑩ `MatchValidation.tsx` — Suggestions tracker, score manuel, règle 90min
- ✅ ⑪ `TournamentSettings.tsx` — Modifier nom, partage, zone dangereuse
- ✅ ⑫ `BracketView.tsx` — Bracket par phase, WebSocket live, score manuel rouge
- ✅ ⑬ `GroupPhase.tsx` — Classement poules, qualifiés en vert, résultats
- ✅ ⑭ `ChampionshipStandings.tsx` — Classement, forme 5 matchs, médailles
- ✅ ⑮ `StatisticsView.tsx` — MOTM, buteurs, passeurs
- ✅ ⑯ `MatchCalendar.tsx` — Calendrier par phase, live indicator
- ✅ ⑰ `PlayerProfile.tsx` — Hero, stats tournoi, historique matchs
- ✅ ⑱ `TournamentFinished.tsx` — Podium, champion, stats globales
- ✅ ⑲ `SystemStates.tsx` — 404, session expirée, loading WebSocket

### Composants & infrastructure

- ✅ `Button`, `Card`, `Input` — redesignés avec le thème DLS
- ✅ `Header` — navbar DLS dark, responsive
- ✅ `TournamentNav` — onglets navigation vues tournoi
- ✅ `useWebSocket` — hook réutilisable avec reconnexion automatique
- ✅ `useTournament`, `usePlayers`, `useMatches`, etc. — hooks React Query centralisés

### Priorité basse

- ❌ Session — stocker `creator_session` en cookie (pas localStorage) pour cohérence avec le backend
- ❌ WebSocket — ajouter listeners dans toutes les pages concernées (ManageRegistrations, BracketView, GroupPhase)
- ❌ `StatisticsView.tsx` — brancher sur `GET /api/matches/scorers/{slug}`

---

## DÉPLOIEMENT

- ❌ Passer le stockage logos vers Cloudinary/S3 en production (actuellement LargeBinary en base)
- ❌ Migrer SQLite → PostgreSQL pour la production (Railway)
- ❌ Configurer Redis pour le rate limiting distribué
- ❌ CI/CD GitHub Actions
- ❌ Variables d'environnement production (SECRET_KEY, CLOUDINARY, DATABASE_URL PostgreSQL)
- ❌ `secure=True` sur les cookies en production (HTTPS)
