"""
Open Graph router — génère des pages HTML légères avec les meta tags OG
pour les bots de prévisualisation (WhatsApp, Telegram, Discord, Twitter…).

Fonctionnement :
  GET /og/join/{slug}   → page OG pour le lien d'invitation d'un tournoi
  GET /og/tournament/{slug} → page OG pour la vue publique d'un tournoi

Logique image :
  - Tournoi avec logo → /api/tournaments/{slug}/logo  (image binaire en base)
  - Tournoi sans logo → image par défaut de l'app (pwa-512x512.png sur Vercel)
"""

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.tournament import Tournament
from ..models.player import Player, PlayerStatus
from ..config import settings
from ..utils.logger import logger

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

# URL publique du frontend (Vercel)
FRONTEND_URL = "https://dls-tg-iai-officel.vercel.app"
# URL publique du backend (Render)
BACKEND_URL = "https://dls-hub-backend.onrender.com"
# Image par défaut si le tournoi n'a pas de logo
DEFAULT_OG_IMAGE = f"{FRONTEND_URL}/pwa-512x512.png"

TYPE_LABELS = {
    "elimination": "Élimination directe",
    "groups": "Poules + Élimination",
    "championship": "Championnat",
}

STATUS_LABELS = {
    "registration": "Inscriptions ouvertes",
    "draw": "Tirage en cours",
    "in_progress": "En cours",
    "finished": "Terminé",
    "draft": "Brouillon",
}


def _tournament_og_image(tournament) -> str:
    """Retourne l'URL de l'image OG pour un tournoi."""
    if tournament.logo_data:
        # Le logo est stocké en base — on pointe vers l'endpoint binaire du backend
        return f"{BACKEND_URL}/api/tournaments/{tournament.slug}/logo"
    return DEFAULT_OG_IMAGE


def _accepted_count_label(accepted: int, max_teams: int) -> str:
    remaining = max_teams - accepted
    if remaining <= 0:
        return f"Complet · {max_teams} équipes"
    return f"{accepted}/{max_teams} équipes · {remaining} place{'s' if remaining > 1 else ''} restante{'s' if remaining > 1 else ''}"


def _build_og_html(
    title: str,
    description: str,
    image_url: str,
    page_url: str,
    redirect_url: str,
) -> str:
    """
    Génère une page HTML minimale avec :
    - Les meta OG pour les bots
    - Une redirection JS immédiate pour les vrais navigateurs
    - Un lien de fallback si JS désactivé
    """
    # Échapper les guillemets pour éviter les injections dans les attributs HTML
    def esc(s: str) -> str:
        return s.replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')

    t = esc(title)
    d = esc(description)
    img = esc(image_url)
    url = esc(page_url)
    redir = esc(redirect_url)

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{t}</title>

  <!-- Open Graph — WhatsApp, Facebook, Telegram, Discord -->
  <meta property="og:title" content="{t}" />
  <meta property="og:description" content="{d}" />
  <meta property="og:image" content="{img}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:url" content="{url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DLS Hub" />
  <meta property="og:locale" content="fr_FR" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{t}" />
  <meta name="twitter:description" content="{d}" />
  <meta name="twitter:image" content="{img}" />

  <!-- Redirection immédiate pour les vrais navigateurs -->
  <meta http-equiv="refresh" content="0;url={redir}" />
  <script>window.location.replace("{redir}");</script>
</head>
<body style="background:#07080F;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;">
    <p style="color:#64748B;font-size:0.875rem;">Redirection en cours…</p>
    <a href="{redir}" style="color:#4D8EFF;font-size:0.875rem;">Cliquez ici si la redirection ne fonctionne pas</a>
  </div>
</body>
</html>"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/join/{slug}", response_class=HTMLResponse)
async def og_join(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Page OG pour le lien d'invitation d'un tournoi.
    URL partagée : https://dls-hub.vercel.app/join/{slug}
    Les bots lisent cette page, les humains sont redirigés vers /join/{slug}.
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug.lower()))
    t = result.scalar_one_or_none()

    if not t:
        # Tournoi introuvable — page OG générique
        return HTMLResponse(
            content=_build_og_html(
                title="DLS Hub — Tournoi introuvable",
                description="Ce tournoi n'existe pas ou a été supprimé.",
                image_url=DEFAULT_OG_IMAGE,
                page_url=f"{FRONTEND_URL}/join/{slug}",
                redirect_url=f"{FRONTEND_URL}/join/{slug}",
            ),
            status_code=200,
        )

    # Compter les joueurs acceptés
    accepted_result = await db.execute(
        select(Player).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    accepted = len(accepted_result.scalars().all())

    # Construire les infos OG
    type_label = TYPE_LABELS.get(
        t.tournament_type.value if hasattr(t.tournament_type, "value") else t.tournament_type,
        "Tournoi"
    )
    status_label = STATUS_LABELS.get(
        t.status.value if hasattr(t.status, "value") else t.status,
        "Tournoi"
    )
    slots_label = _accepted_count_label(accepted, t.max_teams)

    title = f"🏆 {t.name}"
    description = f"{type_label} · {slots_label} · {status_label}\nRejoins le tournoi sur DLS Hub !"
    image_url = _tournament_og_image(t)
    page_url = f"{FRONTEND_URL}/join/{slug}"

    logger.info(f"OG page served for tournament: {slug} (image: {'logo' if t.logo_data else 'default'})")

    return HTMLResponse(
        content=_build_og_html(
            title=title,
            description=description,
            image_url=image_url,
            page_url=page_url,
            redirect_url=page_url,
        ),
        status_code=200,
        headers={
            # Cache court — les infos du tournoi changent (inscriptions, statut)
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
    )


@router.get("/tournament/{slug}", response_class=HTMLResponse)
async def og_tournament(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Page OG pour la vue publique d'un tournoi (bracket, classement…).
    """
    result = await db.execute(select(Tournament).where(Tournament.slug == slug.lower()))
    t = result.scalar_one_or_none()

    if not t:
        return HTMLResponse(
            content=_build_og_html(
                title="DLS Hub — Tournoi introuvable",
                description="Ce tournoi n'existe pas ou a été supprimé.",
                image_url=DEFAULT_OG_IMAGE,
                page_url=f"{FRONTEND_URL}/tournament/{slug}",
                redirect_url=f"{FRONTEND_URL}/tournament/{slug}",
            ),
            status_code=200,
        )

    type_label = TYPE_LABELS.get(
        t.tournament_type.value if hasattr(t.tournament_type, "value") else t.tournament_type,
        "Tournoi"
    )
    status_label = STATUS_LABELS.get(
        t.status.value if hasattr(t.status, "value") else t.status,
        "Tournoi"
    )

    title = f"🏆 {t.name}"
    description = f"{type_label} · {t.max_teams} équipes · {status_label}\nSuis le tournoi en direct sur DLS Hub !"
    image_url = _tournament_og_image(t)
    page_url = f"{FRONTEND_URL}/tournament/{slug}"

    return HTMLResponse(
        content=_build_og_html(
            title=title,
            description=description,
            image_url=image_url,
            page_url=page_url,
            redirect_url=page_url,
        ),
        status_code=200,
        headers={
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
    )
