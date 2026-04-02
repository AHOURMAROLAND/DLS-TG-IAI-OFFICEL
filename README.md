# DLS Hub - Plateforme de Tournois Dream League Soccer

Plateforme web permettant de créer et gérer des tournois DLS 26 avec intégration automatique du tracker officiel FTGames.

## 🚀 Stack Technique MVP

### Backend
- **FastAPI** - Framework API moderne
- **SQLite** - Base de données pour le MVP (facilement migrable vers PostgreSQL)
- **SQLAlchemy 2.0** - ORM avec support async
- **Alembic** - Migrations de base de données
- **Python 3.11+**

### Frontend
- **React 19** avec TypeScript
- **Vite** - Build tool ultra-rapide
- **Tailwind CSS** - Styling moderne
- **React Router** - Navigation
- **React Query** - Gestion d'état serveur
- **Zustand** - Gestion d'état client
- **PWA** - Application web progressive

## 📋 Fonctionnalités

### ✅ Implémentées (MVP)
- 🏆 **Création de tournois** - Élimination, Poules, Championnat
- 👥 **Gestion des joueurs** - Inscription et DLL Index
- 📊 **Tableau de bord** - Statistiques et vue d'ensemble
- 📱 **Responsive Design** - Mobile-first
- 🖼️ **Stockage d'images** - En base de données (pas Cloudinary)
- 🔒 **Sécurité** - Rate limiting, headers sécurisés
- 📝 **Logging** - Système de logs complet
- ⚡ **Performance** - Optimisations et caching

### 🔄 En cours
- 🎮 **Gestion des matchs** - Scores et résultats
- 📈 **Intégration Tracker** - API FTGames
- 🏁 **Tirage au sort** - Automatique
- 📡 **WebSocket** - Mises à jour en temps réel

## 🛠️ Installation

### Prérequis
- Python 3.11+
- Node.js 18+
- npm ou yarn

### Backend

```bash
cd backend

# Créer l'environnement virtuel
python -m venv venv

# Activer l'environnement
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Copier la configuration
cp .env.example .env

# Démarrer le serveur
uvicorn app.main:app --reload
```

Le backend sera disponible sur `http://localhost:8000`

### Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

Le frontend sera disponible sur `http://localhost:5173`

## 📁 Structure du Projet

```
dls/
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── models/         # Modèles SQLAlchemy
│   │   ├── schemas/        # Schémas Pydantic
│   │   ├── routers/        # Routes API
│   │   ├── services/       # Logique métier
│   │   ├── utils/          # Utilitaires (logging, exceptions)
│   │   ├── middleware/     # Middlewares (sécurité)
│   │   └── websocket/      # WebSocket manager
│   ├── alembic/           # Migrations
│   ├── logs/              # Logs de l'application
│   └── dlshub.db          # Base SQLite
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/    # Composants UI
│   │   ├── pages/         # Pages de l'application
│   │   ├── lib/           # Utilitaires et API
│   │   ├── stores/        # État global (Zustand)
│   │   └── assets/        # Images et ressources
│   └── public/            # Fichiers statiques
└── README.md
```

## 🎯 Modes de Tournoi

### 🗡️ Élimination Directe
- **Simple élimination** - Match unique, perdant éliminé
- **Double élimination** - Deux chances, tableau des perdants

### 🏆 Poules + Élimination
- Phase de groupes (poules)
- Qualification automatique
- Phase finale à élimination

### 🏅 Championnat
- **Aller simple** - Un match par opposition
- **Aller-retour** - Deux matchs par opposition

## 🔧 Configuration

### Variables d'environnement (Backend)

```bash
# Base de données (SQLite pour MVP)
DATABASE_URL=sqlite+aiosqlite:///./dlshub.db

# Sécurité
SECRET_KEY=votre_clé_secrète_ici

# API Tracker (optionnel pour MVP)
TRACKER_API_URL=https://st.cf.api.ftpub.net/StatsTracker_Frontline

# Application
ENVIRONMENT=development
DEBUG=true
```

## 📊 API Endpoints

### Tournois
- `GET /api/tournaments` - Lister tous les tournois
- `POST /api/tournaments` - Créer un tournoi
- `GET /api/tournaments/{slug}` - Détails d'un tournoi
- `GET /api/tournaments/{slug}/logo` - Logo du tournoi

### Joueurs
- `GET /api/players/tournament/{tournament_id}` - Joueurs d'un tournoi
- `POST /api/players/tournament/{tournament_id}` - Ajouter un joueur
- `PUT /api/players/{player_id}` - Modifier un joueur
- `DELETE /api/players/{player_id}` - Supprimer un joueur

### Matchs
- `GET /api/matches/tournament/{slug}` - Matchs d'un tournoi
- `PUT /api/matches/{match_id}/score` - Mettre à jour un score

## 🚀 Déploiement

### Production (Backend)
```bash
# Installer Gunicorn
pip install gunicorn

# Démarrer avec Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Production (Frontend)
```bash
# Build pour production
npm run build

# Preview du build
npm run preview
```

## 🔄 Migration vers PostgreSQL

Pour passer de SQLite à PostgreSQL en production :

1. Installer les dépendances PostgreSQL
2. Mettre à jour `DATABASE_URL` dans `.env`
3. Exécuter les migrations Alembic
4. Exporter/importer les données si nécessaire

## 🤝 Contribuer

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonction`)
3. Commit (`git commit -am 'Ajouter nouvelle fonction'`)
4. Push (`git push origin feature/nouvelle-fonction`)
5. Pull Request

## 📝 License

Ce projet est sous licence MIT - voir le fichier LICENSE pour les détails.

## 👨‍💻 Auteur

**AHOUR MAROLAND - IAI-Togo**

Plateforme développée pour la communauté Dream League Soccer.
