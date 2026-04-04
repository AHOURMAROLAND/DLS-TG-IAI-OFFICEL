# DLS Hub - Guide de deploiement

Stack de production :
- Backend : Render (FastAPI + PostgreSQL)
- Frontend : Vercel (React PWA)

## 1. Prerequis

- Compte Render (https://render.com)
- Compte Vercel (https://vercel.com)
- Compte GitHub avec le repo pousse
- Node.js 18+ et Python 3.11+ en local

## 2. Deploiement Backend - Render

### 2.1 Creer la base de donnees PostgreSQL

1. Render -> New -> PostgreSQL
2. Name : dls-hub-db
3. Region : Frankfurt (EU) ou Oregon (US)
4. Plan : Free
5. Copier l'Internal Database URL (format postgresql://user:pass@host/db)

### 2.2 Creer le Web Service

1. Render -> New -> Web Service
2. Connecter le repo GitHub
3. Configurer :
   - Name : dls-hub-backend
   - Region : meme region que la DB
   - Root Directory : backend
   - Runtime : Docker
   - Instance Type : Free
4. Cliquer Create Web Service

### 2.3 Variables d'environnement Render

Dans le Web Service -> Environment -> ajouter :

DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST/DBNAME
SECRET_KEY=<generer avec : python -c "import secrets; print(secrets.token_urlsafe(64))">
ENVIRONMENT=production
DEBUG=false
TRACKER_API_URL=https://st.cf.api.ftpub.net/StatsTracker_Frontline
TRACKER_TIMEOUT=15
TRACKER_RETRY_ATTEMPTS=3
LOG_LEVEL=INFO
BACKEND_CORS_ORIGINS=["https://dls-hub.vercel.app"]

IMPORTANT : L'URL PostgreSQL Render est en postgresql:// - remplacer par postgresql+asyncpg://
IMPORTANT : BACKEND_CORS_ORIGINS doit contenir l'URL exacte de ton frontend Vercel (sans slash final)

### 2.4 URL du backend

Render fournit une URL du type : https://dls-hub-backend.onrender.com
Copier cette URL pour configurer Vercel.

### 2.5 Migrations automatiques

Les migrations s'executent automatiquement au demarrage via le Dockerfile :
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port PORT

## 3. Deploiement Frontend - Vercel

### 3.1 Mettre a jour vercel.json

Dans frontend/vercel.json, remplacer dls-hub-backend.onrender.com par l'URL reelle de ton service Render.

### 3.2 Importer le projet sur Vercel

1. vercel.com -> New Project
2. Importer depuis GitHub
3. Root Directory : frontend
4. Framework Preset : Vite
5. Build Command : npm run build
6. Output Directory : dist

### 3.3 Variables d'environnement Vercel

VITE_API_URL=https://dls-hub-backend.onrender.com/api

## 4. Variables d'environnement - Recap

Backend (Render) :
- DATABASE_URL : URL PostgreSQL Render (avec +asyncpg) - OBLIGATOIRE
- SECRET_KEY : Token aleatoire 64 chars - OBLIGATOIRE
- ENVIRONMENT : production - OBLIGATOIRE
- DEBUG : false - OBLIGATOIRE
- BACKEND_CORS_ORIGINS : URL Vercel en JSON - OBLIGATOIRE
- TRACKER_API_URL : URL FTGames - OBLIGATOIRE
- TRACKER_TIMEOUT : 15 - OBLIGATOIRE
- LOG_LEVEL : INFO - OBLIGATOIRE

Frontend (Vercel) :
- VITE_API_URL : URL Render + /api

## 5. Securite production

- Cookies JWT : httponly + samesite=lax + secure=True (automatique si ENVIRONMENT=production)
- CORS : uniquement l'URL Vercel exacte dans BACKEND_CORS_ORIGINS
- Trusted Hosts : *.onrender.com, *.vercel.app, localhost

## 6. Commandes utiles

Lancer le backend en dev :
  cd backend
  venv\Scripts\activate
  alembic upgrade head
  uvicorn app.main:app --reload --port 8000

Lancer le frontend en dev :
  cd frontend
  npm install
  npm run dev

Build production frontend :
  cd frontend
  npm run build

Generer une SECRET_KEY :
  python -c "import secrets; print(secrets.token_urlsafe(64))"

## 7. Architecture de production

Utilisateur
    |
    v
Vercel (React PWA)
    |  /api/* --> proxy vers Render
    |  /ws/*  --> proxy vers Render
    v
Render (FastAPI)
    |
    +-- PostgreSQL (Render)
    +-- WebSocket /ws/*

## 8. Checklist avant mise en production

[ ] SECRET_KEY generee et configuree sur Render
[ ] DATABASE_URL avec postgresql+asyncpg:// (pas postgresql://)
[ ] ENVIRONMENT=production sur Render
[ ] BACKEND_CORS_ORIGINS contient l'URL Vercel exacte
[ ] frontend/vercel.json mis a jour avec l'URL Render reelle
[ ] VITE_API_URL configuree sur Vercel
[ ] Build frontend sans erreurs (npm run build)

## 9. Mise a jour du deploiement

Chaque push sur la branche principale declenche automatiquement :
- Render : rebuild et redeploiement du backend
- Vercel : rebuild et redeploiement du frontend