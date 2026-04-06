# Requirements Document — DLS Hub v2

## Introduction

DLS Hub v2 apporte trois évolutions majeures à la plateforme de gestion de tournois Dream League Soccer :

1. **IDX lié au compte utilisateur** — l'identifiant FTGames est vérifié et associé définitivement au compte lors de l'inscription, ce qui permet le pré-remplissage automatique lors de la participation à un tournoi.
2. **Ajout manuel de participants par l'admin** — le créateur d'un tournoi peut ajouter des participants directement depuis le dashboard, en les liant à un compte existant ou en les créant comme invités.
3. **Tournois publics / privés** — à la création, le créateur choisit la visibilité du tournoi ; les tournois privés n'apparaissent pas sur la page d'accueil et sont accessibles uniquement via lien d'invitation.

Le contexte technique est : FastAPI + SQLAlchemy async + PostgreSQL (backend), React + TypeScript + TailwindCSS + React Query (frontend), JWT (cookie + Bearer header).

---

## Glossaire

- **System** : l'application DLS Hub dans son ensemble (backend + frontend).
- **Auth_Service** : le service d'authentification gérant l'inscription, la connexion et la session JWT.
- **Tracker_Service** : le service backend qui interroge l'API FTGames pour vérifier et récupérer les données d'un joueur à partir de son idx.
- **User** : un utilisateur enregistré possédant un compte DLS Hub (pseudo, mot de passe, idx DLS optionnel).
- **idx** : l'identifiant unique FTGames (TId) d'un joueur Dream League Soccer, aussi appelé "dll_idx".
- **Tournament** : un tournoi créé par un User, caractérisé par un slug, un format, un statut et une visibilité.
- **Player** : l'enregistrement d'un participant dans un tournoi spécifique (lié à un User ou invité).
- **Creator** : le User ayant créé un Tournament ; il dispose de droits d'administration sur ce tournoi.
- **Guest_Player** : un participant ajouté manuellement par le Creator, sans compte DLS Hub associé.
- **Visibility** : propriété d'un Tournament valant `public` ou `private`.
- **Invitation_Link** : URL unique construite à partir du slug du tournoi, permettant d'accéder à un tournoi privé.
- **Dashboard** : interface d'administration du tournoi, accessible uniquement au Creator.
- **Home_Page** : page d'accueil de DLS Hub listant les tournois publics.

---

## Requirements

### Requirement 1 : Association de l'idx DLS au compte utilisateur

**User Story :** En tant qu'utilisateur, je veux associer mon idx DLS à mon compte lors de l'inscription, afin de ne plus avoir à le ressaisir à chaque tournoi.

#### Acceptance Criteria

1. WHEN un utilisateur soumet le formulaire d'inscription, THE Auth_Service SHALL accepter un champ `dll_idx` optionnel en plus du pseudo et du mot de passe.
2. WHEN un utilisateur fournit un `dll_idx` lors de l'inscription, THE Tracker_Service SHALL vérifier l'existence de cet idx auprès de l'API FTGames avant de valider la création du compte.
3. IF le `dll_idx` fourni lors de l'inscription est introuvable sur le tracker FTGames, THEN THE Auth_Service SHALL rejeter la création du compte avec un message d'erreur explicite indiquant que l'idx est invalide.
4. IF le tracker FTGames est indisponible lors de l'inscription, THEN THE Auth_Service SHALL rejeter la création du compte avec un message d'erreur indiquant que la vérification est temporairement impossible.
5. WHEN un `dll_idx` valide est vérifié lors de l'inscription, THE Auth_Service SHALL stocker l'idx, le nom d'équipe DLS et la division dans le profil du User de manière permanente.
6. THE Auth_Service SHALL garantir qu'un même `dll_idx` ne peut être associé qu'à un seul compte User actif à la fois.
7. IF un `dll_idx` est déjà associé à un compte User existant, THEN THE Auth_Service SHALL rejeter la création du nouveau compte avec un message d'erreur indiquant que cet idx est déjà utilisé.
8. WHEN un utilisateur connecté accède au formulaire d'inscription à un tournoi, THE System SHALL pré-remplir automatiquement les champs `dll_idx` et `pseudo` depuis le profil du User connecté.
9. WHILE un utilisateur connecté possède un `dll_idx` vérifié dans son profil, THE System SHALL afficher les stats DLS (équipe, division, victoires, défaites) pré-chargées sans appel supplémentaire au Tracker_Service lors de l'inscription au tournoi.
10. WHERE un utilisateur connecté ne possède pas de `dll_idx` dans son profil, THE System SHALL afficher le champ `dll_idx` vide et déclencher la vérification via le Tracker_Service lors de la saisie, comme en v1.

---

### Requirement 2 : Ajout manuel de participants par le Creator

**User Story :** En tant que créateur de tournoi, je veux pouvoir ajouter manuellement des participants depuis le dashboard, afin d'inscrire des joueurs qui ne peuvent pas s'inscrire eux-mêmes.

#### Acceptance Criteria

1. WHILE un Tournament a le statut `registration`, THE Dashboard SHALL proposer au Creator une action "Ajouter un participant" distincte du flux d'inscription standard.
2. WHEN le Creator soumet le formulaire d'ajout manuel, THE System SHALL exiger la saisie d'un `dll_idx` et d'un `pseudo` pour le participant.
3. WHEN le Creator soumet un `dll_idx` dans le formulaire d'ajout manuel, THE Tracker_Service SHALL vérifier l'existence de cet idx auprès de l'API FTGames.
4. IF le `dll_idx` saisi par le Creator est introuvable sur le tracker FTGames, THEN THE System SHALL afficher un message d'erreur et empêcher l'ajout du participant.
5. WHEN le Creator saisit un `pseudo` dans le formulaire d'ajout manuel, THE System SHALL rechercher parmi les Users existants ceux dont le pseudo correspond (recherche partielle, insensible à la casse) et proposer une liste de suggestions.
6. WHEN le Creator sélectionne un User existant dans les suggestions, THE System SHALL lier le Player créé au `user_id` de ce User.
7. WHEN le Creator ne sélectionne aucun User existant et valide l'ajout, THE System SHALL créer le Player avec `user_id` null et le marquer comme Guest_Player.
8. WHEN un participant est ajouté manuellement par le Creator, THE System SHALL créer le Player avec le statut `accepted` directement, sans passer par la file d'attente de validation.
9. IF un `dll_idx` est déjà inscrit dans le même Tournament, THEN THE System SHALL rejeter l'ajout manuel avec un message d'erreur indiquant que cet idx est déjà présent dans le tournoi.
10. IF un User lié est déjà inscrit dans le même Tournament, THEN THE System SHALL rejeter l'ajout manuel avec un message d'erreur indiquant que ce joueur est déjà inscrit.
11. WHEN un participant est ajouté manuellement avec succès, THE Dashboard SHALL mettre à jour la liste des participants en temps réel sans rechargement de page.
12. THE System SHALL permettre au Creator de supprimer un Guest_Player qu'il a ajouté manuellement, tant que le Tournament a le statut `registration`.

---

### Requirement 3 : Visibilité des tournois (public / privé)

**User Story :** En tant que créateur de tournoi, je veux choisir si mon tournoi est public ou privé, afin de contrôler qui peut le découvrir sur la plateforme.

#### Acceptance Criteria

1. WHEN un Creator crée un Tournament, THE System SHALL proposer un champ de visibilité avec deux valeurs possibles : `public` et `private`, avec `public` comme valeur par défaut.
2. THE System SHALL stocker la valeur de visibilité dans le modèle Tournament de manière persistante.
3. WHEN la Home_Page est chargée, THE System SHALL afficher uniquement les Tournaments dont la visibilité est `public` dans la liste des tournois récents.
4. WHEN la Home_Page est chargée par un User connecté, THE System SHALL afficher ses propres Tournaments (créés ou rejoints) quelle que soit leur visibilité.
5. WHEN un utilisateur accède à l'URL d'un Tournament privé via l'Invitation_Link, THE System SHALL afficher la page du tournoi normalement.
6. IF un utilisateur non authentifié tente d'accéder à l'URL directe d'un Tournament privé sans passer par l'Invitation_Link, THEN THE System SHALL afficher la page du tournoi normalement (l'accès par URL directe reste possible).
7. WHEN le Creator accède au Dashboard d'un Tournament privé, THE System SHALL afficher un indicateur visuel clair signalant que le tournoi est privé.
8. WHEN le Creator accède aux paramètres d'un Tournament, THE System SHALL permettre de modifier la visibilité entre `public` et `private` tant que le Tournament n'a pas le statut `finished`.
9. THE System SHALL exposer un endpoint API `GET /tournaments/` qui retourne uniquement les Tournaments publics pour les requêtes non authentifiées.
10. WHEN un User authentifié appelle `GET /tournaments/mine`, THE System SHALL retourner tous ses Tournaments créés quelle que soit leur visibilité.
11. WHEN un User authentifié appelle `GET /tournaments/participating`, THE System SHALL retourner tous les Tournaments auxquels il participe quelle que soit leur visibilité.

---

### Requirement 5 : Normalisation de l'idx DLS

**User Story :** En tant qu'utilisateur, je veux pouvoir saisir mon idx en majuscules ou minuscules sans que ça pose problème, afin de ne pas avoir d'erreur de vérification à cause de la casse.

#### Acceptance Criteria

1. WHEN un utilisateur saisit un `dll_idx` dans n'importe quel formulaire (inscription compte, inscription tournoi, ajout manuel par le Creator), THE System SHALL convertir automatiquement la valeur en minuscules avant tout appel au Tracker_Service.
2. THE System SHALL stocker le `dll_idx` en minuscules dans la base de données, quelle que soit la casse saisie par l'utilisateur.
3. WHEN le Tracker_Service reçoit un `dll_idx`, THE tracker_service.fetch_player_data() function SHALL appliquer `.lower()` sur la valeur avant de l'envoyer à l'API FTGames.
4. WHEN le frontend affiche un `dll_idx` existant (pré-remplissage, profil, liste joueurs), THE System SHALL toujours afficher la valeur en minuscules.
5. THE System SHALL appliquer la normalisation en minuscules côté backend de manière systématique, indépendamment de ce que le frontend envoie, afin de garantir la cohérence même en cas d'appel API direct.

---

### Requirement 4 : Cohérence et intégrité des données

**User Story :** En tant que développeur, je veux que les nouvelles données (idx utilisateur, visibilité, participants invités) soient cohérentes et intègres, afin d'éviter les incohérences en base de données.

#### Acceptance Criteria

1. THE System SHALL appliquer une contrainte d'unicité sur la colonne `dll_idx` de la table `users` pour les valeurs non nulles.
2. THE System SHALL appliquer une contrainte d'unicité composite sur (`tournament_id`, `dll_idx`) dans la table `players`.
3. THE System SHALL appliquer une contrainte d'unicité composite sur (`tournament_id`, `user_id`) dans la table `players` pour les valeurs `user_id` non nulles.
4. WHEN un User est supprimé ou désactivé, THE System SHALL conserver les enregistrements Player liés à ce User avec leur `user_id` intact pour préserver l'historique des tournois.
5. THE System SHALL ajouter une colonne `visibility` de type enum (`public`, `private`) avec la valeur par défaut `public` dans la table `tournaments`.
6. THE System SHALL ajouter les colonnes `dll_idx`, `dll_team_name` et `dll_division` dans la table `users`, toutes nullable pour rester compatibles avec les comptes existants.
7. WHEN une migration de base de données est appliquée, THE System SHALL conserver toutes les données existantes sans perte ni modification des enregistrements actuels.
