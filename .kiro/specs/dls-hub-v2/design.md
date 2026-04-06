# Design Document — DLS Hub v2

## Overview

DLS Hub v2 étend la plateforme de gestion de tournois Dream League Soccer avec trois évolutions ciblées :

1. **IDX lié au compte** — association permanente de l'identifiant FTGames au profil utilisateur, avec pré-remplissage automatique lors des inscriptions tournoi.
2. **Ajout manuel de participants** — le créateur peut inscrire directement des joueurs (liés à un compte existant ou en tant qu'invités) depuis le dashboard.
3. **Visibilité des tournois** — chaque tournoi peut être `public` (visible sur la home) ou `private` (accessible uniquement via lien d'invitation).

Ces trois fonctionnalités s'appuient sur la stack existante sans rupture : FastAPI + SQLAlchemy async + PostgreSQL côté backend, React 18 + TypeScript + React Query côté frontend. Toutes les modifications sont rétrocompatibles avec les données existantes.

---

## Architecture

Le système suit l'architecture en couches déjà en place :

```
Frontend (React/TS)
    │  React Query + Axios
    ▼
Backend (FastAPI)
    │  Routers → Services → Models
    ▼
PostgreSQL (via SQLAlchemy async)
    │
    ▼
Tracker FTGames (API externe — lecture seule)
```

Les changements v2 touchent :
- **Modèles** : `User` (3 nouvelles colonnes), `Tournament` (1 nouvelle colonne), `Player` (contraintes d'unicité)
- **Routers** : `auth`, `tournaments`, `players` (nouveaux endpoints + modifications)
- **Services** : `tracker_service` (normalisation idx), `auth_service` (validation idx à l'inscription)
- **Frontend** : `Register.tsx`, `PlayerRegistration.tsx`, `CreateTournament.tsx`, `CreatorDashboard.tsx`, `Home.tsx`, `api.ts`, `AuthContext.tsx`
- **Migration Alembic** : une nouvelle révision additive

---

## Components and Interfaces

### Backend — Nouveaux endpoints

#### Auth Router (`/api/auth`)

```
POST /api/auth/register
  Body: { pseudo, password, dll_idx? }
  → Accepte dll_idx optionnel
  → Si dll_idx fourni : appel tracker, stockage idx+team_name+division sur User
  → Contrainte unicité dll_idx
```

#### Players Router (`/api/players`)

```
POST /api/players/add/{slug}
  Auth: Creator requis
  Body: { dll_idx, pseudo, user_id? }
  → Ajout manuel par le créateur
  → Vérification tracker sur dll_idx
  → Recherche user par pseudo (optionnelle)
  → Statut accepted directement
  → Retourne PlayerOut

GET /api/players/search-user?pseudo={query}
  Auth: Requis
  → Recherche partielle insensible à la casse sur User.pseudo
  → Retourne liste de { id, pseudo }

DELETE /api/players/{player_id}
  Auth: Creator requis
  → Suppression d'un Guest_Player en phase registration uniquement
```

#### Tournaments Router (`/api/tournaments`)

```
POST /api/tournaments/ et /api/tournaments/json
  Body: { ..., visibility?: "public" | "private" }
  → Nouveau champ visibility (défaut: "public")

PATCH /api/tournaments/{slug}
  Body: { ..., visibility?: "public" | "private" }
  → Modification visibilité si status != finished

GET /api/tournaments/
  → Sans auth : retourne uniquement les tournois publics
  → Avec auth : retourne publics + tournois du user (créés ou rejoints)
```

### Frontend — Modifications composants

#### `Register.tsx`
- Ajout champ `dll_idx` optionnel avec vérification tracker en temps réel (debounce 800ms)
- Affichage fiche joueur si idx valide
- Appel `api.register(pseudo, password, dll_idx?)`

#### `AuthContext.tsx`
- `AuthUser` étendu avec `dll_idx?`, `dll_team_name?`, `dll_division?`
- `register()` accepte `dll_idx` optionnel
- `GET /auth/me` retourne les nouvelles colonnes

#### `PlayerRegistration.tsx`
- Si `user.dll_idx` défini : pré-remplissage idx + pseudo, affichage stats sans appel tracker
- Si `user.dll_idx` null : comportement v1 inchangé

#### `CreateTournament.tsx`
- Ajout toggle visibilité (public/privé) à l'étape 1 (Infos)
- Valeur par défaut : public

#### `CreatorDashboard.tsx`
- Indicateur visuel "Privé" si `tournament.visibility === 'private'`
- Bouton "Ajouter un participant" (visible si status=registration)
- Modal d'ajout manuel avec : champ idx, champ pseudo + autocomplete users, sélection optionnelle d'un user existant

#### `Home.tsx`
- `GET /tournaments/` retourne déjà les bons tournois selon l'auth (filtrage côté backend)
- Affichage badge "Privé" sur les tournois privés du créateur

#### `api.ts`
- `register(pseudo, password, dllIdx?)` — ajout paramètre optionnel
- `addPlayerManually(slug, data)` — nouveau
- `searchUsers(pseudo)` — nouveau
- `deletePlayer(playerId)` — nouveau
- `Tournament` type étendu avec `visibility`
- `AuthUser` type étendu avec `dll_idx?`, `dll_team_name?`, `dll_division?`

---

## Data Models

### Migration Alembic — Révision v2

```python
# Nouvelle révision : dls_hub_v2_schema

def upgrade():
    # Table users — nouvelles colonnes nullable (rétrocompatible)
    op.add_column('users', sa.Column('dll_idx', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('dll_team_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('dll_division', sa.Integer(), nullable=True))
    op.create_unique_constraint('uq_users_dll_idx', 'users', ['dll_idx'])

    # Table tournaments — colonne visibility
    op.add_column('tournaments', sa.Column(
        'visibility',
        sa.Enum('public', 'private', name='tournamentvisibility'),
        nullable=False,
        server_default='public'
    ))

    # Table players — contraintes d'unicité
    op.create_unique_constraint(
        'uq_players_tournament_idx', 'players', ['tournament_id', 'dll_idx']
    )
    # Unicité (tournament_id, user_id) pour user_id non null — via index partiel
    op.execute("""
        CREATE UNIQUE INDEX uq_players_tournament_user
        ON players (tournament_id, user_id)
        WHERE user_id IS NOT NULL
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_players_tournament_user")
    op.drop_constraint('uq_players_tournament_idx', 'players', type_='unique')
    op.drop_column('tournaments', 'visibility')
    op.execute("DROP TYPE IF EXISTS tournamentvisibility")
    op.drop_constraint('uq_users_dll_idx', 'users', type_='unique')
    op.drop_column('users', 'dll_idx')
    op.drop_column('users', 'dll_team_name')
    op.drop_column('users', 'dll_division')
```

### Modèle `User` mis à jour

```python
class User(Base):
    __tablename__ = "users"
    id            = Column(String(36), primary_key=True, ...)
    pseudo        = Column(String(30), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    is_active     = Column(Boolean, default=True)
    # Nouvelles colonnes v2
    dll_idx       = Column(String(20), nullable=True, unique=True)
    dll_team_name = Column(String(100), nullable=True)
    dll_division  = Column(Integer, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), ...)
```

### Modèle `Tournament` mis à jour

```python
class TournamentVisibility(str, enum.Enum):
    PUBLIC  = "public"
    PRIVATE = "private"

class Tournament(Base):
    # ... colonnes existantes ...
    visibility = Column(
        Enum(TournamentVisibility),
        default=TournamentVisibility.PUBLIC,
        nullable=False
    )
```

### Schémas Pydantic mis à jour

```python
# auth schemas
class RegisterRequest(BaseModel):
    pseudo:  str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=6)
    dll_idx: str | None = None  # nouveau, optionnel

class UserOut(BaseModel):
    id:            str
    pseudo:        str
    dll_idx:       str | None
    dll_team_name: str | None
    dll_division:  int | None
    created_at:    str

# tournament schemas
class TournamentOut(BaseModel):
    # ... champs existants ...
    visibility: str  # "public" | "private"

# player schemas
class AddPlayerManualRequest(BaseModel):
    dll_idx: str
    pseudo:  str
    user_id: str | None = None  # UUID du user existant, optionnel

class UserSearchResult(BaseModel):
    id:     str
    pseudo: str
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1 : Rejet de tout idx invalide à l'inscription

*For any* idx qui provoque une `ValueError` dans `fetch_player_data` (idx introuvable sur le tracker), la création de compte via `POST /auth/register` doit être rejetée avec un code d'erreur 400.

**Validates: Requirements 1.3**

---

### Property 2 : Round-trip stockage des données tracker à l'inscription

*For any* idx valide (retournant des données tracker avec `TNm`, `Div`), après une inscription réussie, les champs `user.dll_idx`, `user.dll_team_name` et `user.dll_division` doivent correspondre exactement aux valeurs retournées par le tracker (avec idx normalisé en lowercase).

**Validates: Requirements 1.5**

---

### Property 3 : Unicité de l'idx par compte utilisateur

*For any* idx valide, si un premier compte est créé avec cet idx, toute tentative de créer un second compte avec le même idx doit être rejetée avec une erreur 409.

**Validates: Requirements 1.6, 1.7**

---

### Property 4 : Pré-remplissage automatique du formulaire d'inscription tournoi

*For any* utilisateur connecté possédant un `dll_idx` non null dans son profil, les valeurs initiales du formulaire `PlayerRegistration` doivent contenir cet idx et le pseudo du compte, sans déclencher d'appel au Tracker_Service.

**Validates: Requirements 1.8, 1.9**

---

### Property 5 : Rejet de tout idx invalide lors de l'ajout manuel

*For any* idx qui provoque une `ValueError` dans `fetch_player_data`, l'endpoint `POST /api/players/add/{slug}` doit retourner une erreur 400 et ne pas créer de Player.

**Validates: Requirements 2.4**

---

### Property 6 : Validation des champs obligatoires de l'ajout manuel

*For any* requête d'ajout manuel avec `dll_idx` vide ou `pseudo` vide, l'endpoint doit retourner une erreur de validation (422) et ne pas créer de Player.

**Validates: Requirements 2.2**

---

### Property 7 : Recherche de users insensible à la casse

*For any* chaîne de recherche `q` et ensemble de users en base, `GET /api/players/search-user?pseudo=q` doit retourner exactement tous les users dont le pseudo contient `q` (comparaison case-insensitive), ni plus ni moins.

**Validates: Requirements 2.5**

---

### Property 8 : Statut accepted pour tout ajout manuel valide

*For any* ajout manuel valide (idx valide, pseudo non vide, tournoi en phase registration), le Player créé doit avoir `status = accepted`, indépendamment du contenu des données.

**Validates: Requirements 2.8**

---

### Property 9 : Unicité de l'idx par tournoi

*For any* tournoi et *for any* idx déjà présent dans ce tournoi, toute tentative d'ajout (manuel ou standard) avec le même idx doit être rejetée avec une erreur 400.

**Validates: Requirements 2.9, 4.2**

---

### Property 10 : Round-trip persistance de la visibilité

*For any* valeur de visibilité (`public` ou `private`), créer un tournoi avec cette valeur puis le récupérer via `GET /tournaments/{slug}` doit retourner la même valeur de visibilité.

**Validates: Requirements 3.2**

---

### Property 11 : Filtrage des tournois publics pour les non-authentifiés

*For any* ensemble de tournois en base (mix public/private), `GET /api/tournaments/` sans token d'authentification doit retourner uniquement les tournois dont `visibility = public`.

**Validates: Requirements 3.3, 3.9**

---

### Property 12 : Visibilité complète pour le créateur authentifié

*For any* utilisateur authentifié, `GET /api/tournaments/mine` doit retourner tous ses tournois créés, quelle que soit leur visibilité (public ou private).

**Validates: Requirements 3.4, 3.10**

---

### Property 13 : Normalisation lowercase de l'idx avant appel tracker

*For any* idx contenant des majuscules, `fetch_player_data` doit recevoir la version `.lower()` de cet idx — que l'appel provienne de l'inscription compte, de l'inscription tournoi ou de l'ajout manuel.

**Validates: Requirements 5.1, 5.3, 5.5**

---

### Property 14 : Stockage lowercase de l'idx en base

*For any* idx saisi avec des majuscules (dans n'importe quel formulaire), la valeur stockée dans la colonne `dll_idx` (table `users` ou `players`) doit être en minuscules.

**Validates: Requirements 5.2**

---

## Error Handling

### Tracker indisponible

- `fetch_player_data` lève `ConnectionError` après les retries configurés
- Backend : retourne HTTP 503 avec message explicite
- Frontend : toast d'erreur "Tracker FTGames indisponible — réessaie dans quelques secondes"
- Comportement identique pour : inscription compte, inscription tournoi, ajout manuel

### Idx invalide / introuvable

- `fetch_player_data` lève `ValueError`
- Backend : retourne HTTP 400 avec message "Identifiant DLS '{idx}' introuvable sur le tracker FTGames"
- Frontend : toast d'erreur, champ idx mis en état d'erreur

### Idx déjà utilisé (unicité compte)

- Backend : contrainte unique PostgreSQL → HTTP 409 "Cet idx est déjà associé à un compte"
- Frontend : message d'erreur sous le champ idx dans le formulaire d'inscription

### Idx déjà inscrit dans le tournoi

- Backend : vérification applicative avant INSERT → HTTP 400 "Cet identifiant DLL est déjà inscrit dans ce tournoi"
- Frontend : toast d'erreur dans le modal d'ajout manuel

### User déjà inscrit dans le tournoi

- Backend : vérification applicative (user_id) → HTTP 400 "Ce joueur est déjà inscrit dans ce tournoi"

### Suppression Guest_Player refusée

- Si tournoi pas en phase `registration` → HTTP 400 "Suppression impossible hors phase d'inscription"
- Si player n'est pas un Guest_Player (user_id non null) → HTTP 403 "Seuls les joueurs invités peuvent être supprimés"

### Modification visibilité refusée

- Si tournoi en statut `finished` → HTTP 400 "Impossible de modifier un tournoi terminé"

---

## Testing Strategy

### Approche duale

Les tests combinent des **tests unitaires** (exemples concrets, cas limites) et des **tests basés sur les propriétés** (couverture universelle via génération aléatoire d'inputs).

### Bibliothèque PBT

**Backend (Python)** : [Hypothesis](https://hypothesis.readthedocs.io/) — bibliothèque PBT mature pour Python, intégration native avec pytest.

**Frontend (TypeScript)** : [fast-check](https://fast-check.dev/) — bibliothèque PBT pour JavaScript/TypeScript.

### Configuration

- Minimum **100 itérations** par test de propriété (paramètre `max_examples=100` pour Hypothesis)
- Chaque test de propriété référence sa propriété de design via un commentaire :
  `# Feature: dls-hub-v2, Property N: <texte de la propriété>`

### Tests unitaires (exemples et cas limites)

```
backend/tests/
  test_auth_register.py
    - test_register_without_idx_succeeds
    - test_register_with_valid_idx_stores_data
    - test_register_tracker_unavailable_returns_503
    - test_register_duplicate_pseudo_returns_409
    - test_register_duplicate_idx_returns_409

  test_players_manual_add.py
    - test_add_player_links_existing_user
    - test_add_player_creates_guest_when_no_user_selected
    - test_add_player_outside_registration_phase_fails
    - test_delete_guest_player_succeeds
    - test_delete_non_guest_player_fails

  test_tournaments_visibility.py
    - test_create_tournament_default_visibility_is_public
    - test_update_visibility_on_finished_tournament_fails
    - test_get_tournament_by_slug_works_for_private

  test_tracker_normalization.py
    - test_fetch_player_data_receives_lowercase_idx
    - test_register_stores_lowercase_idx
```

### Tests de propriétés (Hypothesis)

```python
# Feature: dls-hub-v2, Property 1: Rejet de tout idx invalide à l'inscription
@given(idx=st.text(min_size=1).filter(lambda x: x.strip()))
@settings(max_examples=100)
def test_invalid_idx_always_rejected(idx, mock_tracker_raises_value_error):
    response = client.post("/api/auth/register", json={
        "pseudo": "testuser", "password": "Test1234!", "dll_idx": idx
    })
    assert response.status_code == 400

# Feature: dls-hub-v2, Property 3: Unicité de l'idx par compte utilisateur
@given(idx=st.from_regex(r'[a-z0-9]{6,12}'))
@settings(max_examples=100)
def test_idx_uniqueness_across_accounts(idx, mock_tracker_valid):
    # Premier compte : succès
    r1 = client.post("/api/auth/register", json={"pseudo": "user1", "password": "Test1!", "dll_idx": idx})
    assert r1.status_code == 200
    # Second compte : rejet
    r2 = client.post("/api/auth/register", json={"pseudo": "user2", "password": "Test1!", "dll_idx": idx})
    assert r2.status_code == 409

# Feature: dls-hub-v2, Property 9: Unicité de l'idx par tournoi
@given(idx=st.from_regex(r'[a-z0-9]{6,12}'))
@settings(max_examples=100)
def test_idx_uniqueness_per_tournament(idx, tournament_in_registration, mock_tracker_valid):
    # Premier ajout : succès
    r1 = add_player(tournament_in_registration.slug, idx, "player1")
    assert r1.status_code == 200
    # Second ajout même idx : rejet
    r2 = add_player(tournament_in_registration.slug, idx, "player2")
    assert r2.status_code == 400

# Feature: dls-hub-v2, Property 11: Filtrage tournois publics pour non-authentifiés
@given(tournaments=st.lists(st.builds(TournamentFactory), min_size=1, max_size=20))
@settings(max_examples=100)
def test_public_filter_for_unauthenticated(tournaments, db_with_tournaments):
    response = client.get("/api/tournaments/")  # sans token
    result = response.json()
    assert all(t["visibility"] == "public" for t in result)

# Feature: dls-hub-v2, Property 13: Normalisation lowercase avant appel tracker
@given(idx=st.text(alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd')), min_size=6, max_size=12))
@settings(max_examples=100)
def test_idx_normalized_before_tracker_call(idx, mock_tracker):
    fetch_player_data(idx)
    mock_tracker.assert_called_with(idx.lower())

# Feature: dls-hub-v2, Property 14: Stockage lowercase en base
@given(idx=st.text(alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd')), min_size=6, max_size=12))
@settings(max_examples=100)
def test_idx_stored_lowercase(idx, mock_tracker_valid):
    client.post("/api/auth/register", json={"pseudo": "u1", "password": "Test1!", "dll_idx": idx})
    user = db.query(User).filter_by(pseudo="u1").first()
    assert user.dll_idx == idx.lower()
```

### Tests d'intégration

```
- test_tracker_called_with_normalized_idx  (Req 1.2, 2.3)
- test_schema_constraints_exist            (Req 4.1, 4.2, 4.3, 4.5, 4.6)
- test_migration_preserves_existing_data   (Req 4.7)
```
