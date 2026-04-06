# Plan d'implémentation — DLS Hub v2

## Vue d'ensemble

Implémentation en 15 étapes couvrant : migration Alembic, modèles SQLAlchemy, normalisation idx, backend auth/tournaments/players, schémas Pydantic, frontend api.ts/AuthContext/pages, et tests backend.

## Tâches

- [x] 1. Migration Alembic — révision v2
  - [x] 1.1 Créer une nouvelle révision Alembic `dls_hub_v2_schema` dans `backend/alembic/versions/`
    - Ajouter `op.add_column('users', ...)` pour `dll_idx` (String 20, nullable, unique), `dll_team_name` (String 100, nullable), `dll_division` (Integer, nullable)
    - Ajouter `op.create_unique_constraint('uq_users_dll_idx', 'users', ['dll_idx'])`
    - Ajouter `op.add_column('tournaments', ...)` pour `visibility` (Enum `public`/`private`, server_default `public`, not null)
    - Ajouter `op.create_unique_constraint('uq_players_tournament_idx', 'players', ['tournament_id', 'dll_idx'])`
    - Ajouter l'index partiel `uq_players_tournament_user` via `op.execute()`
    - Implémenter `downgrade()` complet (drop index, drop constraints, drop columns, drop enum type)
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_

- [x] 2. Modèles SQLAlchemy mis à jour
  - [x] 2.1 Mettre à jour `backend/app/models/user.py`
    - Ajouter `dll_idx = Column(String(20), nullable=True, unique=True)`
    - Ajouter `dll_team_name = Column(String(100), nullable=True)`
    - Ajouter `dll_division = Column(Integer, nullable=True)`
    - _Requirements: 4.6_
  - [x] 2.2 Mettre à jour `backend/app/models/tournament.py`
    - Ajouter l'enum `TournamentVisibility` avec valeurs `public` / `private`
    - Ajouter `visibility = Column(Enum(TournamentVisibility), default=TournamentVisibility.PUBLIC, nullable=False)`
    - _Requirements: 3.2, 4.5_

- [x] 3. Normalisation idx lowercase dans tracker_service
  - [x] 3.1 Modifier `backend/app/services/tracker_service.py`
    - Dans `fetch_player_data()`, appliquer `dll_idx = dll_idx.lower()` en première ligne
    - _Requirements: 5.1, 5.3, 5.5_
  - [ ]* 3.2 Écrire le test unitaire `test_fetch_player_data_receives_lowercase_idx` dans `backend/tests/test_tracker_normalization.py`
    - Vérifier que `fetch_player_data("ABCDEF")` appelle l'API avec `"abcdef"`
    - _Requirements: 5.3_
  - [ ]* 3.3 Écrire le test de propriété pour la normalisation lowercase
    - **Property 13 : Normalisation lowercase de l'idx avant appel tracker**
    - **Validates: Requirements 5.1, 5.3, 5.5**
    - `@given(idx=st.text(...))` — vérifier que `fetch_player_data` reçoit `idx.lower()`
    - _Requirements: 5.1, 5.3, 5.5_

- [x] 4. Backend auth — inscription avec idx optionnel
  - [x] 4.1 Mettre à jour le schéma `RegisterRequest` dans `backend/app/routers/auth.py`
    - Ajouter `dll_idx: str | None = None`
    - Mettre à jour `UserOut` avec `dll_idx`, `dll_team_name`, `dll_division`
    - _Requirements: 1.1_
  - [x] 4.2 Modifier l'endpoint `POST /auth/register` dans `backend/app/routers/auth.py`
    - Si `dll_idx` fourni : appeler `fetch_player_data(dll_idx.lower())`, lever HTTP 400 si `ValueError`, HTTP 503 si `ConnectionError`
    - Vérifier unicité `dll_idx` en base avant INSERT → HTTP 409 si déjà pris
    - Stocker `dll_idx.lower()`, `dll_team_name`, `dll_division` sur le `User` créé
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [x] 4.3 Mettre à jour `GET /auth/me` pour retourner `dll_idx`, `dll_team_name`, `dll_division`
    - _Requirements: 1.8_
  - [ ]* 4.4 Écrire les tests unitaires dans `backend/tests/test_auth_register.py`
    - `test_register_without_idx_succeeds`
    - `test_register_with_valid_idx_stores_data`
    - `test_register_tracker_unavailable_returns_503`
    - `test_register_duplicate_idx_returns_409`
    - _Requirements: 1.2, 1.3, 1.4, 1.7_
  - [ ]* 4.5 Écrire le test de propriété pour le rejet des idx invalides
    - **Property 1 : Rejet de tout idx invalide à l'inscription**
    - **Validates: Requirements 1.3**
    - `@given(idx=st.text(...))` avec mock tracker levant `ValueError`
    - _Requirements: 1.3_
  - [ ]* 4.6 Écrire le test de propriété pour le round-trip stockage tracker
    - **Property 2 : Round-trip stockage des données tracker à l'inscription**
    - **Validates: Requirements 1.5**
    - _Requirements: 1.5_
  - [ ]* 4.7 Écrire le test de propriété pour l'unicité idx par compte
    - **Property 3 : Unicité de l'idx par compte utilisateur**
    - **Validates: Requirements 1.6, 1.7**
    - _Requirements: 1.6, 1.7_
  - [ ]* 4.8 Écrire le test de propriété pour le stockage lowercase en base
    - **Property 14 : Stockage lowercase de l'idx en base**
    - **Validates: Requirements 5.2**
    - `@given(idx=st.text(...))` — vérifier `user.dll_idx == idx.lower()`
    - _Requirements: 5.2_

- [ ] 5. Checkpoint — tests backend auth + normalisation
  - Vérifier que tous les tests des tâches 3 et 4 passent. Demander si des questions se posent.

- [x] 6. Backend tournaments — champ visibility + filtrage GET /
  - [x] 6.1 Mettre à jour `backend/app/schemas/tournament.py`
    - Ajouter `visibility: str` dans `TournamentOut`
    - Mettre à jour `from_db()` pour inclure `visibility`
    - _Requirements: 3.2_
  - [x] 6.2 Mettre à jour les endpoints `POST /tournaments/` et `POST /tournaments/json` dans `backend/app/routers/tournaments.py`
    - Accepter le paramètre `visibility` (Form ou JSON, défaut `"public"`)
    - Passer `visibility` au constructeur `Tournament`
    - _Requirements: 3.1, 3.2_
  - [x] 6.3 Mettre à jour `PATCH /tournaments/{slug}` pour accepter la modification de `visibility`
    - Rejeter si `t.status == TournamentStatus.FINISHED` → HTTP 400
    - _Requirements: 3.8_
  - [x] 6.4 Modifier `GET /tournaments/` pour filtrer selon l'authentification
    - Sans token : retourner uniquement `visibility == "public"`
    - Utiliser `optional_auth` (déjà dans `dependencies.py`)
    - _Requirements: 3.3, 3.9_
  - [ ]* 6.5 Écrire les tests unitaires dans `backend/tests/test_tournaments_visibility.py`
    - `test_create_tournament_default_visibility_is_public`
    - `test_update_visibility_on_finished_tournament_fails`
    - `test_get_tournament_by_slug_works_for_private`
    - _Requirements: 3.1, 3.2, 3.8_
  - [ ]* 6.6 Écrire le test de propriété pour le round-trip visibilité
    - **Property 10 : Round-trip persistance de la visibilité**
    - **Validates: Requirements 3.2**
    - _Requirements: 3.2_
  - [ ]* 6.7 Écrire le test de propriété pour le filtrage public/non-authentifié
    - **Property 11 : Filtrage des tournois publics pour les non-authentifiés**
    - **Validates: Requirements 3.3, 3.9**
    - _Requirements: 3.3, 3.9_
  - [ ]* 6.8 Écrire le test de propriété pour la visibilité complète du créateur
    - **Property 12 : Visibilité complète pour le créateur authentifié**
    - **Validates: Requirements 3.4, 3.10**
    - _Requirements: 3.4, 3.10_

- [x] 7. Backend players — ajout manuel, recherche user, suppression guest
  - [x] 7.1 Ajouter `GET /players/search-user` dans `backend/app/routers/players.py`
    - Paramètre query `pseudo` (str)
    - Recherche `ILIKE %pseudo%` sur `User.pseudo`
    - Retourner liste de `{ id, pseudo }`
    - Auth requise
    - _Requirements: 2.5_
  - [x] 7.2 Ajouter `POST /players/add/{slug}` dans `backend/app/routers/players.py`
    - Auth créateur requis
    - Body JSON : `{ dll_idx, pseudo, user_id? }`
    - Vérifier statut tournoi = `registration`
    - Appeler `fetch_player_data(dll_idx.lower())` → HTTP 400/503 si erreur
    - Vérifier unicité `(tournament_id, dll_idx)` → HTTP 400
    - Si `user_id` fourni : vérifier unicité `(tournament_id, user_id)` → HTTP 400
    - Créer `Player` avec `status=ACCEPTED`, `user_id` nullable (guest si absent)
    - Stocker `dll_idx.lower()` en base
    - Broadcaster l'événement WebSocket `new_registration`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 2.9, 2.10, 2.11_
  - [x] 7.3 Ajouter `DELETE /players/{player_id}` dans `backend/app/routers/players.py`
    - Auth créateur requis
    - Vérifier que le tournoi est en statut `registration` → HTTP 400 sinon
    - Vérifier que `player.user_id is None` (guest) → HTTP 403 sinon
    - Supprimer le Player
    - _Requirements: 2.12_
  - [ ]* 7.4 Écrire les tests unitaires dans `backend/tests/test_players_manual_add.py`
    - `test_add_player_links_existing_user`
    - `test_add_player_creates_guest_when_no_user_selected`
    - `test_add_player_outside_registration_phase_fails`
    - `test_delete_guest_player_succeeds`
    - `test_delete_non_guest_player_fails`
    - _Requirements: 2.6, 2.7, 2.8, 2.12_
  - [ ]* 7.5 Écrire le test de propriété pour le rejet des idx invalides (ajout manuel)
    - **Property 5 : Rejet de tout idx invalide lors de l'ajout manuel**
    - **Validates: Requirements 2.4**
    - _Requirements: 2.4_
  - [ ]* 7.6 Écrire le test de propriété pour la validation des champs obligatoires
    - **Property 6 : Validation des champs obligatoires de l'ajout manuel**
    - **Validates: Requirements 2.2**
    - _Requirements: 2.2_
  - [ ]* 7.7 Écrire le test de propriété pour la recherche insensible à la casse
    - **Property 7 : Recherche de users insensible à la casse**
    - **Validates: Requirements 2.5**
    - _Requirements: 2.5_
  - [ ]* 7.8 Écrire le test de propriété pour le statut accepted à l'ajout manuel
    - **Property 8 : Statut accepted pour tout ajout manuel valide**
    - **Validates: Requirements 2.8**
    - _Requirements: 2.8_
  - [ ]* 7.9 Écrire le test de propriété pour l'unicité idx par tournoi
    - **Property 9 : Unicité de l'idx par tournoi**
    - **Validates: Requirements 2.9, 4.2**
    - _Requirements: 2.9, 4.2_

- [ ] 8. Checkpoint — tests backend players + tournaments
  - Vérifier que tous les tests des tâches 6 et 7 passent. Demander si des questions se posent.

- [x] 9. Schémas Pydantic mis à jour
  - [x] 9.1 Mettre à jour `backend/app/schemas/player.py`
    - Ajouter `class AddPlayerManualRequest(BaseModel)` avec `dll_idx: str`, `pseudo: str`, `user_id: str | None = None`
    - Ajouter `class UserSearchResult(BaseModel)` avec `id: str`, `pseudo: str`
    - Mettre à jour `PlayerOut` pour inclure `registered_at: str | None`
    - _Requirements: 2.2, 2.5_

- [x] 10. Frontend api.ts — nouveaux types et méthodes
  - [x] 10.1 Mettre à jour `frontend/src/lib/api.ts`
    - Étendre `AuthUser` avec `dll_idx?: string | null`, `dll_team_name?: string | null`, `dll_division?: number | null`
    - Étendre `Tournament` avec `visibility: 'public' | 'private'`
    - Modifier `register(pseudo, password, dllIdx?)` pour accepter le 3e paramètre optionnel
    - Ajouter `searchUsers(pseudo: string): Promise<{ id: string; pseudo: string }[]>`
    - Ajouter `addPlayerManually(slug: string, data: { dll_idx: string; pseudo: string; user_id?: string })`
    - Ajouter `deletePlayer(playerId: string): Promise<void>`
    - _Requirements: 1.1, 2.5, 2.12, 3.1_

- [x] 11. Frontend AuthContext — user étendu avec dll_idx
  - [x] 11.1 Mettre à jour `frontend/src/contexts/AuthContext.tsx`
    - Modifier `register(pseudo, password, dllIdx?)` pour passer `dll_idx` à `api.register()`
    - Mettre à jour la restauration du token JWT local pour inclure `dll_idx` si présent dans le payload
    - Mettre à jour `setUser` après `api.getMe()` pour propager `dll_idx`, `dll_team_name`, `dll_division`
    - _Requirements: 1.1, 1.8_

- [x] 12. Frontend Register.tsx — champ idx optionnel
  - [x] 12.1 Modifier `frontend/src/pages/Register.tsx`
    - Ajouter un champ `dll_idx` optionnel avec label "Identifiant DLS (optionnel)"
    - Déclencher `api.verifyPlayer(idx)` en debounce 800ms si `idx.length >= 8`
    - Afficher la fiche joueur (équipe, division) si idx valide, message d'erreur si invalide
    - Passer `dll_idx` à `register()` lors du submit si renseigné
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 12.2 Écrire le test de propriété pour le pré-remplissage formulaire tournoi
    - **Property 4 : Pré-remplissage automatique du formulaire d'inscription tournoi**
    - **Validates: Requirements 1.8, 1.9**
    - Test frontend avec fast-check : vérifier que si `user.dll_idx` est non null, les champs sont pré-remplis sans appel tracker
    - _Requirements: 1.8, 1.9_

- [x] 13. Frontend PlayerRegistration.tsx — pré-remplissage depuis profil
  - [x] 13.1 Modifier `frontend/src/pages/PlayerRegistration.tsx`
    - Récupérer `user` depuis `useAuth()`
    - Si `user.dll_idx` non null : initialiser `idx` et `pseudo` depuis le profil, afficher les stats pré-chargées sans appel tracker
    - Si `user.dll_idx` null : comportement v1 inchangé (champ vide, vérification à la saisie)
    - _Requirements: 1.8, 1.9, 1.10_

- [x] 14. Frontend CreateTournament.tsx — toggle visibilité
  - [x] 14.1 Modifier `frontend/src/pages/CreateTournament.tsx`
    - Ajouter `visibility` au schéma Zod (`z.enum(['public', 'private'])`, défaut `'public'`)
    - Ajouter un toggle public/privé à l'étape 0 (Infos) avec icône cadenas pour privé
    - Afficher la valeur choisie dans le récapitulatif (étape 2)
    - Passer `visibility` dans le `FormData` lors du submit
    - _Requirements: 3.1, 3.2_

- [x] 15. Frontend CreatorDashboard.tsx — modal ajout manuel + indicateur privé
  - [x] 15.1 Modifier `frontend/src/pages/CreatorDashboard.tsx`
    - Afficher un badge/indicateur "Privé" dans le header si `t.visibility === 'private'`
    - Ajouter un bouton "Ajouter un participant" visible uniquement si `t.status === 'registration'`
    - Implémenter le modal d'ajout manuel :
      - Champ `dll_idx` avec vérification tracker (debounce 800ms, `api.verifyPlayer`)
      - Champ `pseudo` avec autocomplete via `api.searchUsers()` (debounce 400ms)
      - Sélection optionnelle d'un user existant dans les suggestions
      - Submit via `api.addPlayerManually(slug, { dll_idx, pseudo, user_id? })`
      - Invalider la query `['players', slug]` après succès
    - Afficher un bouton "Supprimer" sur les Guest_Players dans la liste (si `player.user_id === null` et status `registration`)
      - Appel `api.deletePlayer(playerId)` + invalidation query
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.11, 2.12, 3.7_

- [x] 16. Frontend Home.tsx — filtrage tournois publics
  - [x] 16.1 Modifier `frontend/src/pages/Home.tsx`
    - Afficher un badge "Privé" (icône cadenas) sur les tournois du créateur dont `visibility === 'private'`
    - Le filtrage public/privé est déjà géré côté backend (`GET /tournaments/`) — aucun filtre frontend supplémentaire nécessaire
    - _Requirements: 3.3, 3.4, 3.7_

- [x] 17. Checkpoint final — intégration complète
  - Vérifier que tous les tests passent. Vérifier que le frontend compile sans erreurs TypeScript. Demander si des questions se posent.

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être sautées pour un MVP rapide
- Chaque tâche référence les requirements pour la traçabilité
- Les tests de propriétés utilisent Hypothesis (backend Python) avec `max_examples=100`
- Les tests frontend de propriétés utilisent fast-check (TypeScript)
- La migration Alembic est additive et rétrocompatible — aucune donnée existante n'est modifiée
