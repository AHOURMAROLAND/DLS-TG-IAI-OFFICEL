# DLS Hub — Guide de déploiement

**Stack de production :**
- Backend : Railway (FastAPI + PostgreSQL)
- Frontend : Vercel (React PWA)
- Domaine : configurable

---

## 1. Prérequis

- Compte [Railway](https://railway.app)
- Compte [Vercel](https://vercel.com)
- Compte [GitHub](https://github.com) avec le repo pushé
- Node.js 18+ et Python 3.11+ en local

---

## 2. Déploiement Backend — Railway

### 2.1 Créer le projet Railway

1. Aller sur [railway.app](https://railway.app) → **New Project**
2. Choisir **Deploy from GitHub repo** → sélectionner `DLS-TG-IAI-OFFICEL`
3. Sélectionner le dossier `backend` comme **Root Directory**

### 2.2 Ajouter PostgreSQL

Dans Railway → **New Service** → **Database** → **PostgreSQL**

Railway génère automatiquement `DATABASE_URL` — copier la valeur.

### 2.3 Variables d'environnement Railway

Dans le service backend → **Variables** → ajouter :

```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
SECRET_KEY=<générer avec: python -c "import secrets; print(secrets.token_urlsafe(64))">
ENVIRONMENT=production
DEBUG=false
TRACKER_API_URL=https://st.cf.api.ftpub.net/StatsTracker_Frontline
TRACKER_TIMEOUT=15
TRACKER_RETRY_ATTEMPTS=3
LOG_LEVEL=INFO
BACKEND_CORS_ORIGINS=["https://votre-domaine.vercel.app"]
```

### 2.4 Fichier de démarrage Railway

Créer `backend/Procfile` :
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Ou utiliser le `Dockerfile` existant.

### 2.5 Migration base de données

Après le premier déploiement, dans Railway → **Shell** :
```bash
alembic upgrade head
```

### 2.6 URL du backend

Railway fournit une URL du type : `https://dls-hub-backend.up.railway.app`

---

## 3. Déploiement Frontend — Vercel

### 3.1 Importer le projet

1. Aller sur [vercel.com](https://vercel.com) → **New Project**
2. Importer depuis GitHub → `DLS-TG-IAI-OFFICEL`
3. **Root Directory** : `frontend`
4. **Framework Preset** : Vite
5. **Build Command** : `npm run build`
6. **Output Directory** : `dist`

### 3.2 Variables d'environnement Vercel

Dans le projet Vercel → **Settings** → **Environment Variables** :

```
VITE_API_URL=https://dls-hub-backend.up.railway.app/api
```

### 3.3 Fichier de configuration Vercel

Créer `frontend/vercel.json` pour le routing SPA :

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3.4 Proxy WebSocket

Ajouter dans `frontend/vercel.json` :

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://dls-hub-backend.up.railway.app/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Migration SQLite → PostgreSQL

Le backend utilise SQLite en développement. En production Railway, PostgreSQL est utilisé automatiquement via `DATABASE_URL`.

**Changer le driver dans `.env` production :**
```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
```

**Installer le driver asyncpg :**
```bash
pip install asyncpg
```

Ajouter dans `requirements.txt` :
```
asyncpg==0.29.0
```

---

## 5. Variables d'environnement — Récapitulatif

### Backend (`.env` production)

| Variable | Valeur | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL Railway | ✅ |
| `SECRET_KEY` | Token aléatoire 64 chars | ✅ |
| `ENVIRONMENT` | `production` | ✅ |
| `DEBUG` | `false` | ✅ |
| `BACKEND_CORS_ORIGINS` | URL Vercel en JSON | ✅ |
| `TRACKER_API_URL` | URL FTGames | ✅ |
| `TRACKER_TIMEOUT` | `15` | ✅ |
| `LOG_LEVEL` | `INFO` | ✅ |

### Frontend (Vercel)

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | URL Railway + `/api` |

---

## 6. Checklist avant mise en production

- [ ] `SECRET_KEY` changée (ne pas utiliser la valeur par défaut)
- [ ] `DEBUG=false` en production
- [ ] `BACKEND_CORS_ORIGINS` contient l'URL Vercel exacte
- [ ] Migration Alembic exécutée (`alembic upgrade head`)
- [ ] `asyncpg` dans `requirements.txt` ✅ (déjà présent)
- [ ] `vercel.json` créé avec les rewrites ✅
- [ ] `VITE_API_URL` configurée sur Vercel
- [ ] Icônes PWA générées ✅ (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`)
- [ ] Animations Lottie copiées dans `frontend/public/lottie/` ✅

---

## 7. Sécurité production

### Cookies HTTPS

`secure=True` est activé automatiquement quand `ENVIRONMENT=production`. Aucune modification de code nécessaire.

### Headers CORS stricts

En production, `BACKEND_CORS_ORIGINS` doit contenir **uniquement** l'URL Vercel :
```
BACKEND_CORS_ORIGINS=["https://dls-hub.vercel.app"]
```

---

## 8. Commandes utiles

### Lancer en développement

```bash
# Terminal 1 — Backend
cd backend
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

### Build production frontend

```bash
cd frontend
npm run build
# Le dossier dist/ est prêt pour Vercel
```

### Tests backend

```bash
cd backend
venv\Scripts\activate
pip install pytest pytest-asyncio
pytest tests/ -v
```

### Générer les icônes PWA

```bash
cd frontend
npm install sharp --save-dev
node scripts/generate-pwa-icons.cjs
```

---

## 9. Architecture de production

```
Utilisateur
    │
    ▼
Vercel (React PWA)
    │  /api/* → proxy
    ▼
Railway (FastAPI)
    │
    ├── PostgreSQL (Railway)
    └── WebSocket /ws/*
```

---

## 10. Monitoring

Railway fournit des logs en temps réel dans le dashboard.

Pour les logs applicatifs, les fichiers sont dans `backend/logs/` :
- `dls_hub_YYYYMMDD.log` — tous les logs
- `errors_YYYYMMDD.log` — erreurs uniquement

En production Railway, les logs sont accessibles via :
```
railway logs
```

---

## 11. Checklist déploiement final

### Avant de déployer

```bash
# 1. Build frontend et vérifier qu'il n'y a pas d'erreurs
cd frontend
npm run build

# 2. Vérifier que les icônes PWA sont présentes
ls public/pwa-192x192.png public/pwa-512x512.png public/apple-touch-icon.png

# 3. Tester le build localement
npm run preview
```

### Railway (Backend)

1. Connecter le repo GitHub sur [railway.app](https://railway.app)
2. Root Directory : `backend`
3. Ajouter PostgreSQL comme service
4. Configurer les variables d'environnement (voir section 3)
5. Copier l'URL Railway générée (ex: `https://dls-hub-xxx.up.railway.app`)

### Vercel (Frontend)

1. Connecter le repo sur [vercel.com](https://vercel.com)
2. Root Directory : `frontend`
3. **Mettre à jour `frontend/vercel.json`** avec la vraie URL Railway
4. Ajouter `VITE_API_URL=https://dls-hub-xxx.up.railway.app/api`
5. Déployer

### Après déploiement

```bash
# Exécuter les migrations sur Railway
railway run alembic upgrade head
```

### Vérifier la PWA

- Ouvrir l'URL Vercel sur mobile Chrome
- La bannière "Installer DLS Hub" doit apparaître après quelques secondes
- Vérifier dans Chrome DevTools → Application → Manifest
- Vérifier que le Service Worker est actif
