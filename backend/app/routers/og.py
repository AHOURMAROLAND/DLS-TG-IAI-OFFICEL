"""
Open Graph router — génère des pages HTML avec les meta tags OG
pour les bots de prévisualisation (WhatsApp, Telegram, Discord, Twitter…).

Architecture :
  Vercel proxifie /join/:slug et /tournament/:slug vers ce backend.
  Ce router détecte si c'est un bot ou un humain :
    - Bot  → retourne le HTML avec les meta OG (WhatsApp lit ça)
    - Humain → redirige vers le SPA React sur Vercel

Logique image :
  - Tournoi avec logo → /api/tournaments/{slug}/logo (ce même backend)
  - Tournoi sans logo → pwa-512x512.png sur Vercel
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.tournament import Tournament
from ..models.player import Player, PlayerStatus
from ..utils.logger import logger

router = APIRouter()

# ── URLs ──────────────────────────────────────────────────────────────────────

FRONTEND_URL    = "https://dls-tg-iai-officel.vercel.app"
BACKEND_URL     = "https://dls-hub-backend.onrender.com"
DEFAULT_OG_IMAGE = f"{FRONTEND_URL}/pwa-512x512.png"

# ── Bots connus ───────────────────────────────────────────────────────────────

# User-Agents des bots de prévisualisation de liens
_BOT_SIGNATURES = [
    "whatsapp",
    "telegrambot",
    "discordbot",
    "twitterbot",
    "facebookexternalhit",
    "facebot",
    "linkedinbot",
    "slackbot",
    "slack-imgproxy",
    "applebot",
    "googlebot",
    "bingbot",
    "iframely",
    "unfurl",
    "preview",
    "crawler",
    "spider",
    "bot/",
    "bot ",
    "scraper",
    "curl/",
    "wget/",
    "python-requests",
    "go-http-client",
    "java/",
    "okhttp",
]

def _is_bot(user_agent: str) -> bool:
    ua = user_agent.lower()
    return any(sig in ua for sig in _BOT_SIGNATURES)

# ── Labels ────────────────────────────────────────────────────────────────────

TYPE_LABELS = {
    "elimination":  "Élimination directe",
    "groups":       "Poules + Élimination",
    "championship": "Championnat",
}
ELIM_LABELS  = {"single": "Simple", "double": "Double"}
LEGS_LABELS  = {"single": "Aller simple", "double": "Aller-retour"}
STATUS_LABELS = {
    "registration": "📋 Inscriptions ouvertes",
    "draw":         "🎲 Tirage en cours",
    "in_progress":  "⚽ En cours",
    "finished":     "🏁 Terminé",
    "draft":        "📝 Brouillon",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _val(v) -> str:
    return v.value if hasattr(v, "value") else (v or "")

def _esc(s: str) -> str:
    return s.replace("&","&amp;").replace('"',"&quot;").replace("<","&lt;").replace(">","&gt;")

def _og_image(tournament) -> str:
    if tournament.logo_data:
        return f"{BACKEND_URL}/api/tournaments/{tournament.slug}/logo"
    return DEFAULT_OG_IMAGE

def _build_description(t, accepted: int) -> str:
    t_type   = _val(t.tournament_type)
    t_elim   = _val(t.elimination_type)
    t_legs   = _val(t.championship_legs)
    t_status = _val(t.status)

    type_label   = TYPE_LABELS.get(t_type, "Tournoi")
    status_label = STATUS_LABELS.get(t_status, t_status)

    # Format détaillé
    fmt = type_label
    if t_type == "elimination":
        fmt += f" {ELIM_LABELS.get(t_elim, '')}"
    elif t_type == "championship":
        fmt += f" · {LEGS_LABELS.get(t_legs, '')}"
    elif t_type == "groups" and t.group_count:
        fmt += f" · {t.group_count} poules × {t.teams_per_group} équipes"

    # Places
    remaining = t.max_teams - accepted
    if remaining <= 0:
        slots = f"🔴 Complet ({t.max_teams}/{t.max_teams})"
    elif t_status == "registration":
        slots = f"🟢 {accepted}/{t.max_teams} inscrits · {remaining} place{'s' if remaining>1 else ''} dispo"
    else:
        slots = f"👥 {accepted}/{t.max_teams} équipes"

    cta = {
        "registration": "👉 Rejoins le tournoi sur DLS Hub !",
        "in_progress":  "👉 Suis le tournoi en direct !",
        "finished":     "👉 Voir les résultats !",
    }.get(t_status, "👉 DLS Hub — Tournois Dream League Soccer 26")

    return f"{fmt} · {slots} · {status_label}\n{cta}"


def _og_page(title: str, description: str, image: str, url: str, redirect: str, name: str = "") -> str:
    t   = _esc(title)
    d   = _esc(description)
    img = _esc(image)
    u   = _esc(url)
    r   = _esc(redirect)
    n   = _esc(name or "DLS Hub")

    return f"""<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>{t}</title>

  <!-- Open Graph — WhatsApp, Facebook, Telegram, Discord, LinkedIn -->
  <meta property="og:title"            content="{t}"/>
  <meta property="og:description"      content="{d}"/>
  <meta property="og:image"            content="{img}"/>
  <meta property="og:image:secure_url" content="{img}"/>
  <meta property="og:image:width"      content="512"/>
  <meta property="og:image:height"     content="512"/>
  <meta property="og:image:type"       content="image/png"/>
  <meta property="og:image:alt"        content="Logo {n}"/>
  <meta property="og:url"              content="{u}"/>
  <meta property="og:type"             content="website"/>
  <meta property="og:site_name"        content="DLS Hub"/>
  <meta property="og:locale"           content="fr_FR"/>

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="{t}"/>
  <meta name="twitter:description" content="{d}"/>
  <meta name="twitter:image"       content="{img}"/>
  <meta name="twitter:image:alt"   content="Logo {n}"/>

  <!-- SEO -->
  <meta name="description" content="{d}"/>

  <!-- Redirection immédiate pour les navigateurs humains -->
  <meta http-equiv="refresh" content="0;url={r}"/>
  <script>window.location.replace("{r}");</script>
</head>
<body style="background:#07080F;color:#fff;font-family:sans-serif;
             display:flex;align-items:center;justify-content:center;
             min-height:100vh;margin:0;">
  <p style="color:#64748B;font-size:.875rem;">
    Redirection… <a href="{r}" style="color:#4D8EFF;">Cliquez ici</a>
  </p>
</body>
</html>"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/join/{slug}", response_class=HTMLResponse)
async def og_join(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Appelé par Vercel pour toutes les requêtes /join/{slug}.
    - Bot  → HTML avec meta OG (WhatsApp, Telegram…)
    - Humain → redirection 302 vers le SPA React
    """
    ua       = request.headers.get("user-agent", "")
    slug     = slug.lower().strip()
    spa_url  = f"{FRONTEND_URL}/join/{slug}"

    # Humain → redirection directe vers le SPA (pas besoin de HTML OG)
    if not _is_bot(ua):
        logger.debug(f"OG /join/{slug} — humain, redirection SPA")
        return RedirectResponse(url=spa_url, status_code=302)

    # Bot → chercher le tournoi et construire le HTML OG
    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()

    if not t:
        logger.info(f"OG /join/{slug} — tournoi introuvable")
        return HTMLResponse(
            content=_og_page(
                title="DLS Hub — Tournoi introuvable",
                description="Ce tournoi n'existe pas ou a été supprimé.",
                image=DEFAULT_OG_IMAGE,
                url=spa_url,
                redirect=spa_url,
            ),
            status_code=200,
            headers={"Cache-Control": "no-cache"},
        )

    count = await db.execute(
        select(func.count(Player.id)).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    accepted = count.scalar() or 0

    title       = f"🏆 {t.name}"
    description = _build_description(t, accepted)
    image       = _og_image(t)

    logger.info(
        f"OG /join/{slug} — bot={ua[:40]} "
        f"image={'logo' if t.logo_data else 'default'} "
        f"accepted={accepted}/{t.max_teams}"
    )

    return HTMLResponse(
        content=_og_page(
            title=title,
            description=description,
            image=image,
            url=spa_url,
            redirect=spa_url,
            name=t.name,
        ),
        status_code=200,
        headers={"Cache-Control": "public, max-age=60, stale-while-revalidate=300"},
    )


@router.get("/tournament/{slug}", response_class=HTMLResponse)
async def og_tournament(slug: str, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Appelé par Vercel pour toutes les requêtes /tournament/{slug}.
    """
    ua      = request.headers.get("user-agent", "")
    slug    = slug.lower().strip()
    spa_url = f"{FRONTEND_URL}/tournament/{slug}"

    if not _is_bot(ua):
        logger.debug(f"OG /tournament/{slug} — humain, redirection SPA")
        return RedirectResponse(url=spa_url, status_code=302)

    result = await db.execute(select(Tournament).where(Tournament.slug == slug))
    t = result.scalar_one_or_none()

    if not t:
        return HTMLResponse(
            content=_og_page(
                title="DLS Hub — Tournoi introuvable",
                description="Ce tournoi n'existe pas ou a été supprimé.",
                image=DEFAULT_OG_IMAGE,
                url=spa_url,
                redirect=spa_url,
            ),
            status_code=200,
            headers={"Cache-Control": "no-cache"},
        )

    count = await db.execute(
        select(func.count(Player.id)).where(
            Player.tournament_id == t.id,
            Player.status == PlayerStatus.ACCEPTED,
        )
    )
    accepted = count.scalar() or 0

    title       = f"🏆 {t.name}"
    description = _build_description(t, accepted)
    image       = _og_image(t)

    logger.info(
        f"OG /tournament/{slug} — bot={ua[:40]} "
        f"image={'logo' if t.logo_data else 'default'} "
        f"accepted={accepted}/{t.max_teams}"
    )

    return HTMLResponse(
        content=_og_page(
            title=title,
            description=description,
            image=image,
            url=spa_url,
            redirect=spa_url,
            name=t.name,
        ),
        status_code=200,
        headers={"Cache-Control": "public, max-age=60, stale-while-revalidate=300"},
    )
