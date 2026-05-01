"""
Open Graph router — génère des pages HTML légères avec les meta tags OG
pour les bots de prévisualisation (WhatsApp, Telegram, Discord, Twitter…).

Fonctionnement :
  GET /og/join/{slug}        → page OG pour le lien d'invitation
  GET /og/tournament/{slug}  → page OG pour la vue publique

Logique image :
  - Tournoi avec logo → /api/tournaments/{slug}/logo (servi par ce même backend)
  - Tournoi sans logo → pwa-512x512.png sur Vercel (image par défaut)

IMPORTANT : WhatsApp/Telegram téléchargent l'image directement depuis l'URL og:image.
L'URL doit être publiquement accessible, sans auth, et répondre vite.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.tournament import Tournament
from ..models.player import Player, PlayerStatus
from ..utils.logger import logger

router = APIRouter()

# ── Configuration URLs ────────────────────────────────────────────────────────

FRONTEND_URL = "https://dls-tg-iai-officel.vercel.app"
BACKEND_URL  = "https://dls-hub-backend.onrender.com"
DEFAULT_OG_IMAGE = f"{FRONTEND_URL}/pwa-512x512.png"

# ── Labels lisibles ───────────────────────────────────────────────────────────

TYPE_LABELS = {
    "elimination": "Élimination directe",
    "groups":      "Poules + Élimination",
    "championship":"Championnat",
}

ELIM_LABELS = {
    "single": "Simple",
    "double": "Double",
}

LEGS_LABELS = {
    "single": "Aller simple",
    "double": "Aller-retour",
}

STATUS_LABELS = {
    "registration": "📋 Inscriptions ouvertes",
    "draw":         "🎲 Tirage en cours",
    "in_progress":  "⚽ En cours",
    "finished":     "🏁 Terminé",
    "draft":        "📝 Brouillon",
}

STATUS_EMOJI = {
    "registration": "📋",
    "draw":         "🎲",
    "in_progress":  "⚽",
    "finished":     "🏁",
    "draft":        "📝",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _val(v) -> str:
    """Extrait la valeur d'un enum SQLAlchemy ou retourne la string."""
    return v.value if hasattr(v, "value") else (v or "")


def _og_image_url(tournament) -> str:
    """
    URL de l'image OG.
    Si le tournoi a un logo stocké en base → endpoint public du backend.
    Sinon → image par défaut de l'app sur Vercel.
    """
    if tournament.logo_data:
        return f"{BACKEND_URL}/api/tournaments/{tournament.slug}/logo"
    return DEFAULT_OG_IMAGE


def _esc(s: str) -> str:
    """Échappe les caractères HTML dangereux pour les attributs."""
    return (s
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;"))


def _build_description(tournament, accepted: int) -> str:
    """
    Construit une description riche avec tous les détails du tournoi.
    Visible dans l'aperçu WhatsApp/Telegram sous le titre.
    """
    t_type  = _val(tournament.tournament_type)
    t_elim  = _val(tournament.elimination_type)
    t_legs  = _val(tournament.championship_legs)
    t_status = _val(tournament.status)

    type_label   = TYPE_LABELS.get(t_type, "Tournoi")
    status_label = STATUS_LABELS.get(t_status, t_status)

    # Ligne 1 : format du tournoi
    format_detail = type_label
    if t_type == "elimination":
        format_detail += f" ({ELIM_LABELS.get(t_elim, t_elim)})"
    elif t_type == "championship":
        format_detail += f" · {LEGS_LABELS.get(t_legs, t_legs)}"
    elif t_type == "groups" and tournament.group_count:
        format_detail += f" · {tournament.group_count} poules × {tournament.teams_per_group} équipes"

    # Ligne 2 : places
    remaining = tournament.max_teams - accepted
    if remaining <= 0:
        slots = f"🔴 Complet — {tournament.max_teams}/{tournament.max_teams} équipes"
    elif t_status == "registration":
        slots = f"🟢 {accepted}/{tournament.max_teams} inscrits · {remaining} place{'s' if remaining > 1 else ''} restante{'s' if remaining > 1 else ''}"
    else:
        slots = f"👥 {accepted}/{tournament.max_teams} équipes"

    # Ligne 3 : statut
    lines = [
        format_detail,
        slots,
        status_label,
    ]

    if t_status == "registration":
        lines.append("👉 Rejoins le tournoi sur DLS Hub !")
    elif t_status == "in_progress":
        lines.append("👉 Suis le tournoi en direct sur DLS Hub !")
    elif t_status == "finished":
        lines.append("👉 Voir les résultats sur DLS Hub !")

    return " · ".join(lines[:3]) + "\n" + lines[-1]


def _build_og_html(
    title: str,
    description: str,
    image_url: str,
    page_url: str,
    redirect_url: str,
    tournament_name: str = "",
) -> str:
    """
    Page HTML minimale avec :
    - Meta OG complètes (WhatsApp, Telegram, Discord, Twitter, Facebook)
    - Redirection JS immédiate pour les vrais navigateurs
    """
    t   = _esc(title)
    d   = _esc(description)
    img = _esc(image_url)
    url = _esc(page_url)
    r   = _esc(redirect_url)
    name = _esc(tournament_name or "DLS Hub")

    return f"""<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{t}</title>

  <!-- ── Open Graph (WhatsApp, Facebook, Telegram, Discord, LinkedIn) ── -->
  <meta property="og:title"        content="{t}"/>
  <meta property="og:description"  content="{d}"/>
  <meta property="og:image"        content="{img}"/>
  <meta property="og:image:secure_url" content="{img}"/>
  <meta property="og:image:width"  content="512"/>
  <meta property="og:image:height" content="512"/>
  <meta property="og:image:type"   content="image/png"/>
  <meta property="og:image:alt"    content="Logo du tournoi {name}"/>
  <meta property="og:url"          content="{url}"/>
  <meta property="og:type"         content="website"/>
  <meta property="og:site_name"    content="DLS Hub"/>
  <meta property="og:locale"       content="fr_FR"/>

  <!-- ── Twitter / X Card ── -->
  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="{t}"/>
  <meta name="twitter:description" content="{d}"/>
  <meta name="twitter:image"       content="{img}"/>
  <meta name="twitter:image:alt"   content="Logo du tournoi {name}"/>

  <!-- ── SEO standard ── -->
  <meta name="description" content="{d}"/>

  <!-- ── Redirection immédiate pour les navigateurs humains ── -->
  <meta http-equiv="refresh" content="0;url={r}"/>
  <script>window.location.replace("{r}");</script>
</head>
<body style="background:#07080F;color:#fff;font-family:sans-serif;
             display:flex;align-items:center;justify-content:center;
             min-height:100vh;margin:0;padding:1rem;box-sizing:border-box;">
  <div style="text-align:center;">
    <p style="color:#64748B;font-size:0.875rem;margin-bottom:0.5rem;">Redirection en cours…</p>
    <a href="{r}" style="color:#4D8EFF;font-size:0.875rem;text-decoration:none;">
      Cliquez ici si la redirection ne fonctionne pas
    </a>
  </div>
</body>
</html>"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/join/{slug}", response_class=HTMLResponse)
async def og_join(slug: str, db: AsyncSession = Depends(get_db)):
    """Page OG pour le lien d'invitation d'un tournoi (/join/{slug})."""
    slug = slug.lower().strip()
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()

    page_url = f"{FRONTEND_URL}/join/{slug}"

    if not t:
        return HTMLResponse(
            content=_build_og_html(
                title="DLS Hub — Tournoi introuvable",
                description="Ce tournoi n'existe pas ou a été supprimé.",
                image_url=DEFAULT_OG_IMAGE,
                page_url=page_url,
                redirect_url=page_url,
            ),
            status_code=200,
            headers={"Cache-Control": "no-cache"},
        )

    # Compter les joueurs acceptés
    count_result = await db.execute(
        select(func.count(Player.id)).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    accepted = count_result.scalar() or 0

    title       = f"🏆 {t.name}"
    description = _build_description(t, accepted)
    image_url   = _og_image_url(t)

    logger.info(
        f"OG /join/{slug} — image: {'logo' if t.logo_data else 'default'} "
        f"— accepted: {accepted}/{t.max_teams}"
    )

    return HTMLResponse(
        content=_build_og_html(
            title=title,
            description=description,
            image_url=image_url,
            page_url=page_url,
            redirect_url=page_url,
            tournament_name=t.name,
        ),
        status_code=200,
        headers={"Cache-Control": "public, max-age=60, stale-while-revalidate=300"},
    )


@router.get("/tournament/{slug}", response_class=HTMLResponse)
async def og_tournament(slug: str, db: AsyncSession = Depends(get_db)):
    """Page OG pour la vue publique d'un tournoi (/tournament/{slug}/...)."""
    slug = slug.lower().strip()
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()

    page_url = f"{FRONTEND_URL}/tournament/{slug}"

    if not t:
        return HTMLResponse(
            content=_build_og_html(
                title="DLS Hub — Tournoi introuvable",
                description="Ce tournoi n'existe pas ou a été supprimé.",
                image_url=DEFAULT_OG_IMAGE,
                page_url=page_url,
                redirect_url=page_url,
            ),
            status_code=200,
            headers={"Cache-Control": "no-cache"},
        )

    count_result = await db.execute(
        select(func.count(Player.id)).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    accepted = count_result.scalar() or 0

    title       = f"🏆 {t.name}"
    description = _build_description(t, accepted)
    image_url   = _og_image_url(t)

    logger.info(
        f"OG /tournament/{slug} — image: {'logo' if t.logo_data else 'default'} "
        f"— accepted: {accepted}/{t.max_teams}"
    )

    return HTMLResponse(
        content=_build_og_html(
            title=title,
            description=description,
            image_url=image_url,
            page_url=page_url,
            redirect_url=page_url,
            tournament_name=t.name,
        ),
        status_code=200,
        headers={"Cache-Control": "public, max-age=60, stale-while-revalidate=300"},
    )
